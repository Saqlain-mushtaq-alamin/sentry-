import { ModelAdapter } from './model-adapter';
import { AgentTask, ActionLogEntry } from '../../shared/types';
import { OllamaAdapter } from './adapters/ollama-adapter';

export interface RouterConfig {
  localModel: string | null;       // e.g., 'qwen3:8b'
  cloudModel: string | null;       // e.g., 'gpt-4o'
  routingMode: 'local_only' | 'cloud_only' | 'auto' | 'prefer_local';
  cloudApiKey?: string;
}

export interface RoutingDecision {
  adapter: ModelAdapter;
  reason: string;
  isCloud: boolean;
  estimatedCost: number;    // $0 for local
  estimatedLatency: number; // ms
}

export interface RoutingContext {
  task: AgentTask;
  actionLog: ActionLogEntry[];
  pageContentLength: number;
}

export class ModelRouter {
  private localAdapter: OllamaAdapter;
  private cloudAdapter: ModelAdapter;

  constructor(private config: RouterConfig, cloudAdapter: ModelAdapter) {
    this.localAdapter = new OllamaAdapter({ modelId: config.localModel || 'qwen3:8b' });
    this.cloudAdapter = cloudAdapter; 
  }

  public updateConfig(config: RouterConfig) {
    this.config = config;
    this.localAdapter.modelId = config.localModel || 'qwen3:8b';
  }

  public setCloudAdapter(adapter: ModelAdapter) {
    this.cloudAdapter = adapter;
  }

  public async route(context: RoutingContext): Promise<RoutingDecision> {
    const isLocalAvailable = await this.localAdapter.isAvailable();
    const hasRealCloud = this.cloudAdapter.providerId !== 'mock';
    const mode = this.config.routingMode;

    if (mode === 'local_only') {
      if (!isLocalAvailable) {
        throw new Error('Routing mode is local_only but local model is not available.');
      }
      return this.makeDecision(this.localAdapter, 'User configured local-only mode.', false);
    }

    if (mode === 'cloud_only') {
      return this.makeDecision(this.cloudAdapter, 'User configured cloud-only mode.', true);
    }

    // If there is no real cloud API key configured (cloudAdapter is mock) and local model IS available,
    // ALWAYS use the real local model! Never route to a mock dummy when local Ollama is active.
    if (!hasRealCloud && isLocalAvailable) {
      return this.makeDecision(
        this.localAdapter,
        `Local model (${this.localAdapter.modelId}) active via Ollama.`,
        false,
      );
    }

    if (mode === 'prefer_local') {
      if (isLocalAvailable) {
        return this.makeDecision(this.localAdapter, `Prefer local mode active (${this.localAdapter.modelId}).`, false);
      }
      return this.makeDecision(this.cloudAdapter, 'Prefer local mode, but local model is unavailable. Falling back to cloud.', true);
    }

    // Auto mode: start local, escalate to cloud after 2 consecutive failed steps
    const recent = context.actionLog.slice(-2);
    const twoConsecutiveFailures = recent.length === 2 && recent.every(e => !e.executed || e.result?.success === false);

    if (twoConsecutiveFailures && hasRealCloud) {
      return this.makeDecision(
        this.cloudAdapter,
        'Auto mode: 2 consecutive failed steps detected with local model, escalating to cloud model.',
        true,
      );
    }

    if (isLocalAvailable) {
      return this.makeDecision(
        this.localAdapter,
        `Auto mode: Starting with local model (${this.localAdapter.modelId}).`,
        false,
      );
    }

    return this.makeDecision(this.cloudAdapter, 'Auto mode: Local model unavailable, using cloud model.', true);
  }

  private estimateComplexity(context: RoutingContext): 'simple' | 'moderate' | 'complex' {
    const { task, actionLog, pageContentLength } = context;

    // High number of steps implies complex reasoning required
    if (actionLog.length > 5) return 'complex';
    if (actionLog.length > 2) return 'moderate';

    // Complex instructions
    const instructionWords = task.instruction.split(' ').length;
    if (instructionWords > 20) return 'complex';
    if (instructionWords > 10) return 'moderate';

    // Large pages are harder to process
    if (pageContentLength > 40000) return 'complex';
    if (pageContentLength > 10000) return 'moderate';

    return 'simple';
  }

  private makeDecision(adapter: ModelAdapter, reason: string, isCloud: boolean): RoutingDecision {
    return {
      adapter,
      reason,
      isCloud,
      estimatedCost: isCloud ? 0.02 : 0, // Mock estimation
      estimatedLatency: isCloud ? 800 : 2500, // Mock estimation
    };
  }
}
