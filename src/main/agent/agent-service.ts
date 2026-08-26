import { ipcMain, BrowserWindow } from 'electron';
import * as crypto from 'crypto';
import { ReActLoop } from './react-loop';
import { OpenAIAdapter } from './adapters/openai-adapter';
import { AnthropicAdapter } from './adapters/anthropic-adapter';
import { ModelAdapter } from './model-adapter';
import { ActionFirewall } from '../action-layer/action-firewall';
import { RiskClassifier } from '../action-layer/risk-classifier';
import { TrustManager } from '../action-layer/trust-manager';
import { PermissionManager } from '../action-layer/permission-manager';
import { AuditLog } from '../action-layer/audit-log';
import { CDPManager } from '../cdp/cdp-manager';
import { ActionExecutor } from '../cdp/action-executor';
import { PageObserver } from '../cdp/page-observer';
import { ElementResolver } from '../cdp/element-resolver';
import { ActionLogEntry, AgentTask, ChatMessage, TaskState, DeveloperSessionStats, TraceStep, TaskTrace } from '../../shared/types';
import { StorageManager } from '../browser/storage-manager';
import { TabManager } from '../browser/tab-manager';

import { InjectionDetector } from '../action-layer/injection-detector';
import { ModelRouter, RoutingContext } from './model-router';
import { RecipeManager } from './recipe-manager';
import { RecipeCapture } from './recipe-capture';
import { RecipeReplayEngine } from './recipe-replay';
import { MultiTabCoordinator } from './multi-tab-coordinator';
import { TabGrouper } from '../browser/tab-grouper';
import { BackgroundTaskRunner } from './background-runner';
import { ResourceManager } from '../browser/resource-manager';
import { SpeechToText } from '../voice/speech-to-text';
import { TextToSpeech } from '../voice/text-to-speech';
import { MultiTabTask, BackgroundTask } from '../../shared/types';
import { TraceExporter } from './trace-exporter';
import { BenchmarkRunner } from './benchmarks';

export class AgentService {
  private reactLoop: ReActLoop | null = null;
  private cdp: CDPManager;
  private firewall: ActionFirewall;
  private observer: PageObserver;
  private resolver: ElementResolver;
  private actionExecutor: ActionExecutor;
  private detector: InjectionDetector;
  private storageManager: StorageManager;
  private tabManager: TabManager;
  private mainWindow: BrowserWindow;
  private actionHistory: ActionLogEntry[] = [];

  private currentDeveloperStats: DeveloperSessionStats = {
    tasksCompleted: 0,
    actionsExecuted: 0,
    firewallBlocks: 0,
    confirmationsAsked: 0,
    injectionsDetected: 0,
    falsePositives: 0,
    totalTokens: 0,
    estimatedCost: 0,
    avgActionLatencyMs: 0,
    lastModelInfo: {
      activeModel: 'ollama:llama3.1:8b (local)',
      providerId: 'ollama',
      isLocal: true,
      routerDecision: 'Local-first default mode',
      contextUsageTokens: 0,
      contextLimitTokens: 8192,
      lastLatencyMs: 0,
      avgLatencyMs: 0,
    },
  };
  private lastTaskTrace: TaskTrace | null = null;
  private currentTraceSteps: TraceStep[] = [];
  private modelRouter: ModelRouter;
  private recipeManager: RecipeManager;
  private recipeCapture: RecipeCapture;
  private replayEngine: RecipeReplayEngine;
  private multiTabCoordinator: MultiTabCoordinator;
  private tabGrouper: TabGrouper;
  private backgroundRunner: BackgroundTaskRunner;
  private resourceManager: ResourceManager;
  private stt: SpeechToText;
  private tts: TextToSpeech;
  private benchmarkRunner: BenchmarkRunner;

  constructor(
    mainWindow: BrowserWindow,
    storageManager: StorageManager,
    tabManager: TabManager
  ) {
    this.mainWindow = mainWindow;
    this.storageManager = storageManager;
    this.tabManager = tabManager;

    this.cdp = new CDPManager((tabId) => this.tabManager.getView(tabId));
    const classifier = new RiskClassifier();
    const trustManager = new TrustManager();
    const permissionManager = new PermissionManager();
    const auditLog = new AuditLog();

    this.firewall = new ActionFirewall(classifier, trustManager, permissionManager, auditLog);
    this.observer = new PageObserver(this.cdp);
    this.resolver = new ElementResolver();
    this.actionExecutor = new ActionExecutor(this.cdp, this.observer, this.resolver);
    this.detector = new InjectionDetector(this.cdp);
    this.modelRouter = new ModelRouter({
      localModel: 'llama3.1:8b',
      cloudModel: 'gpt-4o',
      routingMode: 'auto'
    }, this.getCloudAdapter());
    
    this.recipeManager = new RecipeManager();
    this.recipeCapture = new RecipeCapture();
    this.replayEngine = new RecipeReplayEngine(this.actionExecutor, this.firewall, this.observer);

    this.multiTabCoordinator = new MultiTabCoordinator();
    this.tabGrouper = new TabGrouper();
    this.backgroundRunner = new BackgroundTaskRunner();
    this.resourceManager = new ResourceManager();
    this.resourceManager.startMonitoring();

    this.stt = new SpeechToText();
    this.tts = new TextToSpeech();
    this.benchmarkRunner = new BenchmarkRunner();

    this.registerIpcHandlers();
  }

  private getCloudAdapter(): ModelAdapter {
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';

    if (process.env.ANTHROPIC_API_KEY) {
      return new AnthropicAdapter(process.env.ANTHROPIC_API_KEY);
    }
    if (apiKey) {
      return new OpenAIAdapter(apiKey);
    }

    // Default Mock Adapter when no API key is provided
    let step = 0;
    return {
      providerId: 'mock',
      modelId: 'mock-llm',
      async chat(req) {
        step++;
        let action;
        
        if (step === 1) {
          action = { type: 'scroll', direction: 'down', amount: 500, reason: 'Mock scrolling down.' };
        } else {
          action = { type: 'done', reason: 'Mock task completed! (Set an API key or install Ollama for real tasks)' };
          step = 0;
        }

        return {
          content: JSON.stringify({
            thought: `Simulating step ${step}.`,
            action
          }),
          tokenUsage: { prompt: 50, completion: 50, total: 100 },
          cost: 0,
          latencyMs: 800,
          modelId: 'mock-llm',
        };
      },
      async isAvailable() { return true; },
      getContextLimit() { return 128000; },
      estimateTokens(text: string) { return Math.ceil(text.length / 4); },
    };
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('agent:run-task', async (_, instruction: string) => {
      const activeTabId = this.tabManager.getActiveTab()?.id || 'tab-default';
      
      const task: AgentTask = {
        id: crypto.randomUUID(),
        instruction,
        createdAt: Date.now(),
        tabId: activeTabId,
        context: {
          userInstruction: instruction,
          currentStep: 0,
          totalSteps: 30,
          currentUrl: this.mainWindow.webContents.getURL() || 'https://google.com',
        },
      };

      const routingContext: RoutingContext = {
        task,
        actionLog: this.actionHistory,
        pageContentLength: 5000, // rough estimate, could fetch snapshot first
      };

      const routingDecision = await this.modelRouter.route(routingContext);
      const adapter = routingDecision.adapter;

      // Send routing decision to UI
      this.mainWindow.webContents.send('agent:routing-decision', routingDecision);

      this.reactLoop = new ReActLoop(
        adapter,
        this.actionExecutor,
        this.firewall,
        this.observer,
        this.detector,
      );

      this.currentTraceSteps = [];

      this.reactLoop.onStepTrace((step, trace) => {
        this.currentTraceSteps.push(step);
        this.currentDeveloperStats.actionsExecuted++;
        if (!step.firewallDecision.allowed) this.currentDeveloperStats.firewallBlocks++;
        if (step.firewallDecision.requiresConfirmation) this.currentDeveloperStats.confirmationsAsked++;
        if (!step.injectionScanResult.isClean) this.currentDeveloperStats.injectionsDetected++;
        
        const stepTokens = (step.rawPrompt?.tokensIn || 0) + (step.rawPrompt?.tokensOut || 0);
        this.currentDeveloperStats.totalTokens += stepTokens;

        this.currentDeveloperStats.lastModelInfo = {
          activeModel: `${adapter.providerId}:${adapter.modelId} (${routingDecision.isCloud ? 'cloud' : 'local'})`,
          providerId: adapter.providerId,
          isLocal: !routingDecision.isCloud,
          routerDecision: routingDecision.reason,
          contextUsageTokens: stepTokens,
          contextLimitTokens: adapter.getContextLimit(),
          lastLatencyMs: step.latency.model,
          avgLatencyMs: Math.round((this.currentDeveloperStats.lastModelInfo?.avgLatencyMs || step.latency.model + step.latency.model) / 2),
        };

        this.currentDeveloperStats.lastActionAnalysis = {
          actionType: step.proposedAction.type,
          target: step.proposedAction.target,
          riskScore: step.firewallDecision.riskTier === 'critical' ? 95 : step.firewallDecision.riskTier === 'high' ? 75 : step.firewallDecision.riskTier === 'medium' ? 45 : 10,
          riskTier: step.firewallDecision.riskTier,
          policyRulesFired: step.firewallDecision.classification?.policyRulesFired || [],
          firewallDecision: step.firewallDecision.allowed ? 'ALLOWED' : step.firewallDecision.requiresConfirmation ? 'REQUIRES_CONFIRMATION' : 'BLOCKED',
          injectionScanClean: step.injectionScanResult.isClean,
          injectionScanTimeMs: step.latency.observation,
          executionTimeMs: step.latency.execution,
        };

        // Construct live TaskTrace
        this.lastTaskTrace = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          sentryVersion: '0.1.0',
          task: {
            id: task.id,
            instruction: task.instruction,
            startedAt: new Date(task.createdAt).toISOString(),
            completedAt: new Date().toISOString(),
            state: TaskState.EXECUTING,
            totalSteps: this.currentTraceSteps.length,
          },
          model: {
            providerId: adapter.providerId,
            modelId: adapter.modelId,
            isLocal: !routingDecision.isCloud,
            totalTokens: this.currentDeveloperStats.totalTokens,
            estimatedCost: this.currentDeveloperStats.estimatedCost,
          },
          steps: [...this.currentTraceSteps],
          firewallSummary: {
            totalDecisions: this.currentDeveloperStats.actionsExecuted,
            allowed: this.currentDeveloperStats.actionsExecuted - this.currentDeveloperStats.firewallBlocks,
            blocked: this.currentDeveloperStats.firewallBlocks,
            confirmationsAsked: this.currentDeveloperStats.confirmationsAsked,
            confirmationsDenied: 0,
          },
          injectionSummary: {
            totalScans: this.currentDeveloperStats.actionsExecuted,
            detectionsFound: this.currentDeveloperStats.injectionsDetected,
            falsePositives: 0,
          },
          performance: {
            totalDurationMs: this.currentTraceSteps.reduce((acc, s) => acc + s.latency.model + s.latency.execution, 0),
            avgStepLatencyMs: Math.round(this.currentTraceSteps.reduce((acc, s) => acc + s.latency.model + s.latency.execution, 0) / (this.currentTraceSteps.length || 1)),
            avgModelLatencyMs: Math.round(this.currentTraceSteps.reduce((acc, s) => acc + s.latency.model, 0) / (this.currentTraceSteps.length || 1)),
            avgActionLatencyMs: Math.round(this.currentTraceSteps.reduce((acc, s) => acc + s.latency.execution, 0) / (this.currentTraceSteps.length || 1)),
          },
        };

        this.mainWindow.webContents.send('agent:developer-stats-updated', this.currentDeveloperStats);
        this.mainWindow.webContents.send('agent:step-trace-added', step);
      });

      this.reactLoop.onInjectionDetected((report) => {
        this.mainWindow.webContents.send('agent:injection-detected', report);
      });

      try {
        const result = await this.reactLoop.executeTask(task);
        if (result.state === TaskState.COMPLETED) {
          this.currentDeveloperStats.tasksCompleted++;
          if (this.lastTaskTrace) {
            this.lastTaskTrace.task.state = TaskState.COMPLETED;
            this.lastTaskTrace.task.completedAt = new Date().toISOString();
          }
        }
        this.mainWindow.webContents.send('agent:developer-stats-updated', this.currentDeveloperStats);

        if (result.actionLog) {
          this.actionHistory.push(...result.actionLog);
          result.actionLog.forEach((entry) => {
            this.mainWindow.webContents.send('agent:action-logged', entry);
          });
        }
        return { success: result.state === TaskState.COMPLETED, result };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('agent:pause', () => {
      this.reactLoop?.pause();
      return true;
    });

    ipcMain.handle('agent:resume', () => {
      this.reactLoop?.resume();
      return true;
    });

    ipcMain.handle('agent:stop', () => {
      this.reactLoop?.stop();
      return true;
    });

    ipcMain.handle('agent:get-history', () => {
      return this.actionHistory;
    });

    ipcMain.handle('agent:get-recipes', () => {
      return this.recipeManager.getAllRecipes();
    });

    ipcMain.handle('agent:save-recipe', (_, instruction: string) => {
      if (this.actionHistory.length > 0) {
        const recipe = this.recipeCapture.capture(instruction, this.actionHistory);
        this.recipeManager.saveRecipe(recipe);
        return recipe;
      }
      return null;
    });

    ipcMain.handle('agent:delete-recipe', (_, id: string) => {
      this.recipeManager.deleteRecipe(id);
      return true;
    });

    ipcMain.handle('agent:replay-recipe', async (_, id: string, variables: Record<string, string>) => {
      const recipe = this.recipeManager.getRecipe(id);
      if (!recipe) throw new Error('Recipe not found');
      const activeTabId = this.tabManager.getActiveTab()?.id || 'tab-default';
      return await this.replayEngine.replay(activeTabId, recipe, variables);
    });

    ipcMain.handle('agent:forget-all', () => {
      this.recipeManager.forgetAll();
      this.actionHistory = [];
      return true;
    });

    ipcMain.handle('agent:run-multi-tab', async (_, task: MultiTabTask) => {
      // Create tab group for visual tracking
      const tabIds = task.tabs.map(t => t.tabId);
      this.tabGrouper.createGroup(task.instruction, tabIds, task.id, true);

      const result = await this.multiTabCoordinator.executeMultiTabTask(task);
      this.tabGrouper.handleTaskComplete(task.id);
      return result;
    });

    ipcMain.handle('agent:submit-background', async (_, task: BackgroundTask) => {
      await this.backgroundRunner.submit(task);
      return true;
    });

    ipcMain.handle('agent:speak', async (_, text: string, priority: 'low' | 'normal' | 'urgent') => {
      await this.tts.speak(text, priority);
      return true;
    });

    ipcMain.handle('agent:stop-speech', async () => {
      await this.tts.stop();
      return true;
    });

    ipcMain.handle('agent:get-benchmark-suites', () => {
      return this.benchmarkRunner.getSuites();
    });

    ipcMain.handle('agent:run-benchmark', async (_, suiteId: string) => {
      return await this.benchmarkRunner.runSuite(suiteId);
    });

    ipcMain.handle('agent:get-developer-stats', () => {
      return this.currentDeveloperStats;
    });

    ipcMain.handle('agent:get-last-trace', () => {
      return this.lastTaskTrace;
    });

    ipcMain.handle('agent:reset-developer-stats', () => {
      this.currentDeveloperStats = {
        tasksCompleted: 0,
        actionsExecuted: 0,
        firewallBlocks: 0,
        confirmationsAsked: 0,
        injectionsDetected: 0,
        falsePositives: 0,
        totalTokens: 0,
        estimatedCost: 0,
        avgActionLatencyMs: 0,
        lastModelInfo: {
          activeModel: 'ollama:llama3.1:8b (local)',
          providerId: 'ollama',
          isLocal: true,
          routerDecision: 'Local-first default mode',
          contextUsageTokens: 0,
          contextLimitTokens: 8192,
          lastLatencyMs: 0,
          avgLatencyMs: 0,
        },
      };
      this.lastTaskTrace = null;
      this.currentTraceSteps = [];
      return true;
    });

    ipcMain.handle('agent:export-trace', (_, trace: any, format: 'json' | 'md' | 'csv') => {
      if (format === 'md') return TraceExporter.exportToMarkdown(trace);
      if (format === 'csv') return TraceExporter.exportToCsv(trace);
      return TraceExporter.exportToJson(trace);
    });
  }
}
