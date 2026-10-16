/**
 * ReActLoop — Task 5.4
 *
 * The core AI execution loop: Observe → Think → Plan → Propose → (Confirm) → Act.
 * All proposed actions pass through the Action Firewall before execution.
 */

import * as crypto from 'crypto';
import {
  AgentTask, TaskResult, TaskState, ProposedAction, RiskTier,
  ActionLogEntry, ChatMessage, FirewallDecision, ConfirmationResponse,
  TraceStep, TaskTrace,
} from '../../shared/types';
import { ModelAdapter } from './model-adapter';
import { ActionExecutor } from '../cdp/action-executor';
import { ActionFirewall } from '../action-layer/action-firewall';
import { PageObserver } from '../cdp/page-observer';
import { buildSystemPrompt } from './prompts/system-prompt';
import { ContextManager } from './context-manager';
import { ActionParser } from './action-parser';
import { TaskStateMachine } from './task-state-machine';
import { InjectionDetector } from '../action-layer/injection-detector';

const MAX_STEPS = 30;
const MAX_PARSE_RETRIES = 3;

export class ReActLoop {
  private sm = new TaskStateMachine();
  private parser = new ActionParser();
  private contextManager = new ContextManager();
  private confirmationCallback?: (
    action: ProposedAction,
    decision: FirewallDecision,
  ) => Promise<ConfirmationResponse>;

  private injectionDetectedCallback?: (report: any) => void;
  private stepTraceCallback?: (step: TraceStep, trace: TaskTrace) => void;

  private navigateCallback?: (tabId: string, url: string) => Promise<void>;
  private goBackCallback?: (tabId: string) => Promise<void>;
  private goForwardCallback?: (tabId: string) => Promise<void>;

  constructor(
    private adapter: ModelAdapter,
    private executor: ActionExecutor,
    private firewall: ActionFirewall,
    private observer: PageObserver,
    private detector?: InjectionDetector,
  ) {}

  /** Register a native navigation handler (for sentry:// tabs where CDP can't do window.location) */
  onNavigate(cb: (tabId: string, url: string) => Promise<void>): void {
    this.navigateCallback = cb;
  }

  onGoBack(cb: (tabId: string) => Promise<void>): void {
    this.goBackCallback = cb;
  }

  onGoForward(cb: (tabId: string) => Promise<void>): void {
    this.goForwardCallback = cb;
  }

  /** Register a callback for trace steps */
  onStepTrace(cb: (step: TraceStep, trace: TaskTrace) => void): void {
    this.stepTraceCallback = cb;
  }

  /** Register a callback that the UI calls with the user's response */
  onConfirmationRequired(
    cb: (action: ProposedAction, decision: FirewallDecision) => Promise<ConfirmationResponse>,
  ): void {
    this.confirmationCallback = cb;
  }

  onInjectionDetected(cb: (report: any) => void): void {
    this.injectionDetectedCallback = cb;
  }

  pause()  { this.sm.pause(); }
  stop()   { this.sm.stop(); }
  resume() { this.sm.resume(); }
  getState(): TaskState { return this.sm.getState(); }

  async executeTask(task: AgentTask): Promise<TaskResult> {
    this.sm.reset();
    this.sm.transition(TaskState.EXECUTING);

    const actionLog: ActionLogEntry[] = [];
    let stepCount = 0;
    const recentActionKeys: string[] = [];

    let totalTokens = 0;
    let totalCost = 0;
    let totalDecisions = 0;
    let totalAllowed = 0;
    let totalBlocked = 0;
    let totalConfirmationsAsked = 0;
    let totalConfirmationsDenied = 0;
    let totalScans = 0;
    let detectionsFound = 0;
    let totalObservationLatency = 0;
    let totalModelLatency = 0;
    let totalFirewallLatency = 0;
    let totalExecLatency = 0;
    const accumulatedSteps: TraceStep[] = [];

    while (
      this.sm.getState() !== TaskState.COMPLETED &&
      this.sm.getState() !== TaskState.FAILED
    ) {
      // Safety limits
      if (stepCount >= MAX_STEPS) {
        return this.fail('Maximum steps reached. The task may be too complex.', actionLog, stepCount);
      }

      // Pause / stop hooks
      if (this.sm.isPaused()) await this.sm.waitForResume();
      if (this.sm.isStopped()) return this.cancel(actionLog, stepCount);

      // ── OBSERVE ──────────────────────────────────────────────────────────
      const obsStart = Date.now();
      let snapshot;
      try {
        // Check if the current URL is an internal sentry:// page — CDP won't work there
        const currentTabUrl = task.context.currentUrl || '';
        if (currentTabUrl.startsWith('sentry://') || currentTabUrl === '' || currentTabUrl === 'about:blank') {
          // Provide a dummy snapshot so the agent can decide to navigate somewhere
          snapshot = {
            url: currentTabUrl || 'sentry://newtab',
            title: 'New Tab',
            timestamp: Date.now(),
            dom: { tag: 'body', children: [] },
            accessibilityTree: [],
            visibleText: 'You are on the Sentry browser new tab or internal page. To start a task, navigate to a real website first.',
            forms: [],
            links: [],
            interactiveElements: [],
            estimatedTokenCount: 50,
          };
        } else {
          snapshot = await this.observer.getPageSnapshot(task.tabId);
        }
      } catch (err) {
        console.error('[ReActLoop] Failed to observe page:', err);
        return this.fail(`Failed to observe page: ${err}`, actionLog, stepCount);
      }

      const obsLatency = Date.now() - obsStart;

      // ── SCAN FOR INJECTIONS ──────────────────────────────────────────────
      const scanStart = Date.now();
      let scanReport = { isClean: true, confidence: 1.0 };
      if (this.detector) {
        try {
          const report = await this.detector.scanPage(task.tabId, snapshot);
          scanReport = { isClean: report.isClean, confidence: report.isClean ? 1.0 : 0.2 };
          if (!report.isClean) {
            console.warn('[ReActLoop] Prompt injection detected!', report.detections);
            snapshot = report.sanitizedSnapshot;
            if (this.injectionDetectedCallback) {
              this.injectionDetectedCallback(report);
            }
          }
        } catch (err) {
          console.warn('[ReActLoop] Injection scan failed, proceeding with original snapshot:', err);
        }
      }
      const scanLatency = Date.now() - scanStart;

      // Update context
      task.context.currentUrl = snapshot.url;
      task.context.currentStep = stepCount + 1;

      // ── THINK + PLAN ─────────────────────────────────────────────────────
      const systemPromptText = buildSystemPrompt(task.context);
      const messages: ChatMessage[] = this.contextManager.buildMessageHistory(
        task, snapshot, actionLog, this.adapter.getContextLimit(),
      );

      let parseResult;
      let parseAttempts = 0;
      let modelLatency = 0;
      let chatResponseContent = '';
      let chatResponseCost = 0;
      let tokensIn = 0;
      let tokensOut = 0;

      do {
        const modelStart = Date.now();
        let chatResponse;
        try {
          chatResponse = await this.adapter.chat({
            systemPrompt: systemPromptText,
            messages,
            temperature: 0.1,
            responseFormat: 'json',
            maxTokens: 768,
          });
        } catch (err) {
          return this.fail(`Model call failed: ${err}`, actionLog, stepCount);
        }
        modelLatency = Date.now() - modelStart;
        chatResponseContent = chatResponse.content;
        chatResponseCost = chatResponse.cost || 0;
        tokensIn = chatResponse.tokenUsage?.prompt || this.adapter.estimateTokens(systemPromptText + JSON.stringify(messages));
        tokensOut = chatResponse.tokenUsage?.completion || this.adapter.estimateTokens(chatResponseContent);

        parseResult = this.parser.parse(chatResponse.content);

        if (!parseResult.ok) {
          parseAttempts++;
          console.warn(`[ReActLoop] Parse failed (attempt ${parseAttempts}): ${parseResult.error}`);
          messages.push({
            role: 'assistant',
            content: chatResponse.content,
          });
          messages.push({
            role: 'user',
            content: `Your previous response was not valid JSON. Error: ${parseResult.error}. Please respond with only valid JSON.`,
          });
        }
      } while (!parseResult.ok && parseAttempts < MAX_PARSE_RETRIES);

      if (!parseResult.ok) {
        return this.fail(
          `Model returned invalid JSON ${MAX_PARSE_RETRIES} times in a row. Stopping.`,
          actionLog, stepCount,
        );
      }

      const parsedAction = parseResult.action;

      if (parsedAction.memory) {
        task.context.memory = parsedAction.memory;
      }

      // ── DONE / ASK_USER ──────────────────────────────────────────────────
      if (parsedAction.type === 'done') {
        this.sm.transition(TaskState.COMPLETED);
        return {
          state: TaskState.COMPLETED,
          actionLog,
          totalSteps: stepCount,
          summary: parsedAction.answer || parsedAction.reason,
        };
      }

      if (parsedAction.type === 'ask_user') {
        console.info(`[ReActLoop] Agent asks: ${parsedAction.reason}`);
        this.sm.transition(TaskState.PAUSED);
        return {
          state: TaskState.PAUSED,
          actionLog,
          totalSteps: stepCount,
          summary: `Agent needs clarification: ${parsedAction.reason}`,
        };
      }

      // ── BUILD ProposedAction ─────────────────────────────────────────────
      const proposed: ProposedAction = {
        id: crypto.randomUUID(),
        type: parsedAction.type,
        target: parsedAction.target ?? '',
        value: parsedAction.value,
        riskTier: RiskTier.LOW,
        reason: parsedAction.reason,
        timestamp: Date.now(),
        tabId: task.tabId,
        url: snapshot.url,
      };

      // ── LOOP DETECTION ──────────────────────────────────────────────────
      const actionKey = `${proposed.type}:${proposed.target}:${proposed.value ?? ''}`;
      recentActionKeys.push(actionKey);
      if (recentActionKeys.length > 15) recentActionKeys.shift();

      // Scrolling down a long page is standard exploration; allow up to 8 consecutive scrolls.
      // Other actions (clicks, types, navigations) trigger after 4 identical attempts.
      const isScroll = proposed.type === 'scroll';
      const loopLimit = isScroll ? 8 : 4;
      const recentMatching = recentActionKeys.slice(-loopLimit);

      if (
        recentMatching.length === loopLimit &&
        recentMatching.every(k => k === actionKey)
      ) {
        if (snapshot.visibleText && snapshot.visibleText.length > 100) {
          console.warn(`[ReActLoop] Agent repeated ${actionKey} ${loopLimit} times; completing gracefully.`);
          this.sm.transition(TaskState.COMPLETED);
          return {
            state: TaskState.COMPLETED,
            actionLog,
            totalSteps: stepCount,
            summary: `Task completed based on page observation: ${snapshot.title}. (Finished exploring page content).`,
          };
        }
        return this.fail(
          `Agent appears stuck — same action proposed ${loopLimit} times. Stopping.`,
          actionLog, stepCount,
        );
      }

      // ── FIREWALL ─────────────────────────────────────────────────────────
      const firewallStart = Date.now();
      const decision = await this.firewall.evaluateAction(proposed, snapshot);
      const firewallLatency = Date.now() - firewallStart;

      if (!decision.allowed && !decision.requiresConfirmation) {
        actionLog.push({ action: proposed, decision, executed: false, timestamp: Date.now() });
        messages.push({
          role: 'user',
          content: `Action DENIED by security policy: ${decision.explanation}. Please try a different approach.`,
        });
        stepCount++;
        continue;
      }

      if (decision.requiresConfirmation) {
        this.sm.transition(TaskState.AWAITING_CONFIRMATION);
        let userResponse: ConfirmationResponse = 'deny';

        if (this.confirmationCallback) {
          userResponse = await this.confirmationCallback(proposed, decision);
        } else {
          userResponse = decision.riskTier === RiskTier.CRITICAL ? 'deny' : 'allow_once';
        }

        this.sm.transition(TaskState.EXECUTING);

        if (userResponse === 'deny') {
          actionLog.push({ action: proposed, decision, executed: false, timestamp: Date.now() });
          messages.push({
            role: 'user',
            content: `The user denied this action: "${proposed.reason}". Please find an alternative approach or ask the user.`,
          });
          stepCount++;
          continue;
        }
      }

      // ── ACT ──────────────────────────────────────────────────────────────
      const dir = ['up', 'down', 'left', 'right'].includes(parsedAction.value ?? '')
        ? (parsedAction.value as 'up' | 'down' | 'left' | 'right')
        : 'down';
      const actionRequest = {
        type: parsedAction.type as import('../../shared/types').ActionType,
        target: parsedAction.target,
        value: parsedAction.value,
        direction: parsedAction.type === 'scroll' ? dir : undefined,
      };

      const execStart = Date.now();
      let execResult;
      try {
        // For 'navigate' actions, use the native TabManager navigation when available
        // (CDP's Runtime.evaluate window.location.href doesn't work on sentry:// internal pages)
        const targetUrl = parsedAction.value || parsedAction.target;
        if (parsedAction.type === 'navigate' && this.navigateCallback && targetUrl) {
          let url = targetUrl.trim();
          if (url.startsWith('/')) {
            try {
              const base = new URL(task.context.currentUrl);
              url = new URL(url, base).href;
            } catch {
              url = 'https://' + url.replace(/^\/+/, '');
            }
          } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('sentry://')) {
            const isDomain = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(url);
            if (!isDomain && task.context.currentUrl && (task.context.currentUrl.startsWith('http://') || task.context.currentUrl.startsWith('https://'))) {
              try {
                const base = new URL(task.context.currentUrl);
                url = new URL(url, base).href;
              } catch {
                url = 'https://' + url;
              }
            } else {
              url = 'https://' + url;
            }
          }
          await this.navigateCallback(task.tabId, url);
          // Update the task context URL so next observation uses the real page
          task.context.currentUrl = url;
          execResult = { success: true, duration: Date.now() - execStart };
          // Wait for page to begin loading
          await new Promise(r => setTimeout(r, 1500));
        } else if (parsedAction.type === 'goBack' && this.goBackCallback) {
          await this.goBackCallback(task.tabId);
          execResult = { success: true, duration: Date.now() - execStart };
          await new Promise(r => setTimeout(r, 1000));
        } else if (parsedAction.type === 'goForward' && this.goForwardCallback) {
          await this.goForwardCallback(task.tabId);
          execResult = { success: true, duration: Date.now() - execStart };
          await new Promise(r => setTimeout(r, 1000));
        } else {
          execResult = await this.executor.execute(task.tabId, actionRequest);
        }
      } catch (err) {
        execResult = { success: false, error: String(err), duration: 0 };
      }
      const execLatency = Date.now() - execStart;

      actionLog.push({
        action: proposed,
        decision,
        executed: execResult.success,
        result: execResult as import('../../shared/types').ActionResult,
        timestamp: Date.now(),
      });

      // Construct Real TraceStep for Developer Mode & Research Telemetry
      const traceStep: TraceStep = {
        stepNumber: stepCount + 1,
        timestamp: new Date().toLocaleTimeString(),
        observation: `URL: ${snapshot.url} | Elements: ${snapshot.interactiveElements?.length || 0}`,
        modelThought: parsedAction.thought || parsedAction.reason || '',
        proposedAction: proposed,
        firewallDecision: decision,
        actionResult: execResult as any,
        injectionScanResult: scanReport,
        latency: {
          observation: obsLatency,
          model: modelLatency,
          firewall: firewallLatency,
          execution: execLatency,
        },
        rawPrompt: {
          systemPrompt: systemPromptText,
          userMessage: JSON.stringify(messages, null, 2),
          modelResponse: chatResponseContent,
          tokensIn,
          tokensOut,
          latencyMs: modelLatency,
        },
      };

      accumulatedSteps.push(traceStep);
      totalTokens += (tokensIn + tokensOut);
      totalCost += chatResponseCost;
      totalDecisions++;
      if (decision.allowed) totalAllowed++;
      else totalBlocked++;
      if (decision.requiresConfirmation) totalConfirmationsAsked++;
      totalScans++;
      if (!scanReport.isClean) detectionsFound++;
      totalObservationLatency += obsLatency;
      totalModelLatency += modelLatency;
      totalFirewallLatency += firewallLatency;
      totalExecLatency += execLatency;

      if (this.stepTraceCallback) {
        const stepTotalDuration = totalObservationLatency + totalModelLatency + totalFirewallLatency + totalExecLatency;
        const liveTrace: TaskTrace = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          sentryVersion: '0.1.0',
          task: {
            id: task.id,
            instruction: task.instruction,
            startedAt: new Date(task.createdAt).toISOString(),
            completedAt: new Date().toISOString(),
            state: TaskState.EXECUTING,
            totalSteps: stepCount + 1,
          },
          model: {
            providerId: this.adapter.providerId,
            modelId: this.adapter.modelId,
            isLocal: this.adapter.providerId === 'ollama',
            totalTokens,
            estimatedCost: totalCost,
          },
          steps: accumulatedSteps,
          firewallSummary: {
            totalDecisions,
            allowed: totalAllowed,
            blocked: totalBlocked,
            confirmationsAsked: totalConfirmationsAsked,
            confirmationsDenied: totalConfirmationsDenied,
          },
          injectionSummary: {
            totalScans,
            detectionsFound,
            falsePositives: 0,
          },
          performance: {
            totalDurationMs: stepTotalDuration,
            avgStepLatencyMs: Math.round(stepTotalDuration / (stepCount + 1)),
            avgModelLatencyMs: Math.round(totalModelLatency / (stepCount + 1)),
            avgActionLatencyMs: Math.round(totalExecLatency / (stepCount + 1)),
          },
        };
        this.stepTraceCallback(traceStep, liveTrace);
      }


      if (!execResult.success) {
        messages.push({
          role: 'user',
          content: `Action failed: ${execResult.error ?? 'Unknown error'}. Please try a different approach or element.`,
        });
      }

      // Brief settle time after action
      await new Promise(r => setTimeout(r, 500));
      stepCount++;
    }

    return { state: this.sm.getState(), actionLog, totalSteps: stepCount };
  }

  private fail(message: string, actionLog: ActionLogEntry[], totalSteps: number): TaskResult {
    console.error(`[ReActLoop] Task failed: ${message}`);
    this.sm.transition(TaskState.FAILED);
    return { state: TaskState.FAILED, actionLog, totalSteps, error: message };
  }

  private cancel(actionLog: ActionLogEntry[], totalSteps: number): TaskResult {
    return { state: TaskState.FAILED, actionLog, totalSteps, error: 'Task cancelled by user.' };
  }
}
