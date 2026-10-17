import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModelRouter } from '../../../src/main/agent/model-router';
import { ModelAdapter } from '../../../src/main/agent/model-adapter';
import { AgentTask, ActionLogEntry, FirewallDecision, RiskTier, SiteTrustLevel } from '../../../src/shared/types';

function makeAdapter(providerId: string, modelId = 'test-model'): ModelAdapter {
  return {
    providerId,
    modelId,
    chat: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
    getContextLimit: () => 128_000,
    estimateTokens: (t: string) => Math.ceil(t.length / 4),
  };
}

function makeTask(): AgentTask {
  return {
    id: 'task-1',
    tabId: 'tab-1',
    instruction: 'Search for laptops',
    context: { currentUrl: 'https://example.com', userInstruction: 'Search', currentStep: 1, totalSteps: 3 },
    createdAt: Date.now(),
  };
}

const okDecision: FirewallDecision = {
  actionId: 'a',
  allowed: true,
  requiresConfirmation: false,
  riskTier: RiskTier.LOW,
  classification: { tier: RiskTier.LOW, reasons: [], policyRulesFired: [], confidence: 0.9 },
  siteTrust: SiteTrustLevel.READ_ACT,
  explanation: 'ok',
  detailedReason: 'ok',
};

function failedEntry(id: string): ActionLogEntry {
  return {
    action: {
      id,
      type: 'click',
      target: `#${id}`,
      riskTier: RiskTier.LOW,
      reason: 'try',
      timestamp: 1,
      tabId: 'tab-1',
      url: 'https://example.com',
    },
    decision: { ...okDecision, actionId: id },
    executed: false,
    result: { success: false, error: 'element not found', duration: 5 },
  };
}

describe('ModelRouter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const localAvailable = () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ models: [{ name: 'qwen3:8b' }] }),
    });
  };

  const localUnavailable = () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws in local_only mode when the local model is not available', async () => {
    localUnavailable();
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: null, routingMode: 'local_only' },
      makeAdapter('openai', 'gpt-4o'),
    );
    await expect(router.route({ task: makeTask(), actionLog: [], pageContentLength: 100 }))
      .rejects.toThrow('Routing mode is local_only but local model is not available.');
  });

  it('routes to the local adapter with zero cost in local_only mode when local is available', async () => {
    localAvailable();
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: null, routingMode: 'local_only' },
      makeAdapter('openai', 'gpt-4o'),
    );
    const decision = await router.route({ task: makeTask(), actionLog: [], pageContentLength: 100 });
    expect(decision.isCloud).toBe(false);
    expect(decision.estimatedCost).toBe(0);
    expect(decision.adapter.providerId).toBe('ollama');
  });

  it('always routes to the cloud adapter in cloud_only mode', async () => {
    localAvailable();
    const cloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'cloud_only' },
      cloud,
    );
    const decision = await router.route({ task: makeTask(), actionLog: [], pageContentLength: 100 });
    expect(decision.isCloud).toBe(true);
    expect(decision.adapter).toBe(cloud);
  });

  it('routes to the local model even in auto mode when the cloud adapter is only a mock', async () => {
    localAvailable();
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'auto' },
      makeAdapter('mock', 'mock-model'),
    );
    const decision = await router.route({ task: makeTask(), actionLog: [], pageContentLength: 100 });
    expect(decision.isCloud).toBe(false);
    expect(decision.adapter.providerId).toBe('ollama');
    expect(decision.reason).toContain('active via Ollama');
  });

  it('routes local in prefer_local mode when the local model is available', async () => {
    localAvailable();
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'prefer_local' },
      makeAdapter('openai', 'gpt-4o'),
    );
    const decision = await router.route({ task: makeTask(), actionLog: [], pageContentLength: 100 });
    expect(decision.isCloud).toBe(false);
    expect(decision.adapter.providerId).toBe('ollama');
  });

  it('falls back to cloud in prefer_local mode when the local model is unavailable', async () => {
    localUnavailable();
    const cloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'prefer_local' },
      cloud,
    );
    const decision = await router.route({ task: makeTask(), actionLog: [], pageContentLength: 100 });
    expect(decision.isCloud).toBe(true);
    expect(decision.adapter).toBe(cloud);
    expect(decision.reason).toContain('Falling back to cloud');
  });

  it('escalates to cloud in auto mode after 2 consecutive failed steps with a real cloud adapter', async () => {
    localAvailable();
    const cloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'auto' },
      cloud,
    );
    const decision = await router.route({
      task: makeTask(),
      actionLog: [failedEntry('a1'), failedEntry('a2')],
      pageContentLength: 100,
    });
    expect(decision.isCloud).toBe(true);
    expect(decision.adapter).toBe(cloud);
    expect(decision.reason).toContain('escalating');
  });

  it('stays local in auto mode when the local model is available and there are no failures', async () => {
    localAvailable();
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'auto' },
      makeAdapter('openai', 'gpt-4o'),
    );
    const decision = await router.route({ task: makeTask(), actionLog: [failedEntry('a1')], pageContentLength: 100 });
    expect(decision.isCloud).toBe(false);
    expect(decision.adapter.providerId).toBe('ollama');
  });

  it('uses the cloud adapter in auto mode when the local model is unavailable', async () => {
    localUnavailable();
    const cloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'auto' },
      cloud,
    );
    const decision = await router.route({ task: makeTask(), actionLog: [], pageContentLength: 100 });
    expect(decision.isCloud).toBe(true);
    expect(decision.adapter).toBe(cloud);
  });

  it('updateConfig changes the local model id and setCloudAdapter swaps the cloud adapter', async () => {
    localAvailable();
    const initialCloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'cloud_only' },
      initialCloud,
    );

    router.updateConfig({ localModel: 'llama3:8b', cloudModel: 'gpt-4o', routingMode: 'cloud_only' });
    expect((router as any).localAdapter.modelId).toBe('llama3:8b');

    const newCloud = makeAdapter('anthropic', 'claude-sonnet-5-5');
    router.setCloudAdapter(newCloud);
    const decision = await router.route({ task: makeTask(), actionLog: [], pageContentLength: 100 });
    expect(decision.adapter).toBe(newCloud);
    expect(decision.adapter.providerId).toBe('anthropic');
  });
});
