/**
 * Phase 15 — ModelRouter routing-flow integration tests.
 *
 * Exercises the router against a stubbed Ollama endpoint (global fetch)
 * and mock cloud adapters across all routing modes and mid-life config
 * changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelRouter } from '../../../src/main/agent/model-router';
import { ModelAdapter } from '../../../src/main/agent/model-adapter';
import {
  AgentTask, ActionLogEntry, FirewallDecision, RiskTier, SiteTrustLevel,
} from '../../../src/shared/types';

function makeAdapter(providerId: string, modelId = 'cloud-model'): ModelAdapter {
  return {
    providerId,
    modelId,
    chat: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
    getContextLimit: () => 128_000,
    estimateTokens: (t: string) => Math.ceil(t.length / 4),
  };
}

function makeTask(instruction = 'Find the cheapest laptop'): AgentTask {
  return {
    id: 'task-route',
    tabId: 'tab-1',
    instruction,
    context: {
      currentUrl: 'https://example.com',
      userInstruction: instruction,
      currentStep: 1,
      totalSteps: 3,
    },
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
      reason: 'attempt',
      timestamp: 1,
      tabId: 'tab-1',
      url: 'https://example.com',
    },
    decision: { ...okDecision, actionId: id },
    executed: false,
    result: { success: false, error: 'element not found', duration: 5 },
  };
}

describe('ModelRouter routing flows (stubbed Ollama)', () => {
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
    fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes('/api/tags')) {
        return { ok: true, json: async () => ({ models: [{ name: 'qwen3:8b' }] }) };
      }
      throw new Error(`unexpected fetch: ${String(url)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a) auto mode routes a simple task to the local model when local is available', async () => {
    localAvailable();
    const cloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'auto' },
      cloud,
    );

    const decision = await router.route({
      task: makeTask(),
      actionLog: [],
      pageContentLength: 500,
    });

    expect(decision.adapter.providerId).toBe('ollama');
    expect(decision.isCloud).toBe(false);
    expect(decision.estimatedCost).toBe(0);
    expect(decision.reason).toContain('local model');
  });

  it('b) auto mode escalates to cloud after 2 consecutive failures', async () => {
    localAvailable();
    const cloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'auto' },
      cloud,
    );

    const decision = await router.route({
      task: makeTask('Compare prices across many shops and apply coupons'),
      actionLog: [failedEntry('f1'), failedEntry('f2')],
      pageContentLength: 30_000,
    });

    expect(decision.adapter).toBe(cloud);
    expect(decision.isCloud).toBe(true);
    expect(decision.reason).toContain('escalating');
  });

  it('c) local_only mode keeps routing on the local model', async () => {
    localAvailable();
    const cloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'local_only' },
      cloud,
    );

    const decision = await router.route({
      task: makeTask(),
      actionLog: [],
      pageContentLength: 100,
    });

    expect(decision.adapter.providerId).toBe('ollama');
    expect(decision.isCloud).toBe(false);
    expect(decision.reason).toContain('local-only');
  });

  it('d) auto mode falls back to cloud with a Local model unavailable reason', async () => {
    localUnavailable();
    const cloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'auto' },
      cloud,
    );

    const decision = await router.route({
      task: makeTask(),
      actionLog: [],
      pageContentLength: 100,
    });

    expect(decision.adapter).toBe(cloud);
    expect(decision.isCloud).toBe(true);
    expect(decision.reason).toContain('Local model unavailable');
  });

  it('e) local_only mode throws when the local model is unavailable', async () => {
    localUnavailable();
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'local_only' },
      makeAdapter('openai', 'gpt-4o'),
    );

    await expect(
      router.route({ task: makeTask(), actionLog: [], pageContentLength: 100 }),
    ).rejects.toThrow('local model is not available');
  });

  it('f) cloud_only mode always routes to the cloud, even with local available', async () => {
    localAvailable();
    const cloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'cloud_only' },
      cloud,
    );

    const decision = await router.route({
      task: makeTask(),
      actionLog: [],
      pageContentLength: 100,
    });

    expect(decision.adapter).toBe(cloud);
    expect(decision.isCloud).toBe(true);
  });

  it('g) takes the local shortcut when the cloud adapter is only a mock', async () => {
    localAvailable();
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: null, routingMode: 'auto' },
      makeAdapter('mock', 'mock-model'),
    );

    const decision = await router.route({
      task: makeTask(),
      actionLog: [],
      pageContentLength: 100,
    });

    expect(decision.adapter.providerId).toBe('ollama');
    expect(decision.isCloud).toBe(false);
    expect(decision.reason).toContain('active via Ollama');
  });

  it('h) updateConfig + setCloudAdapter affect the next route decision', async () => {
    localAvailable();
    const firstCloud = makeAdapter('openai', 'gpt-4o');
    const router = new ModelRouter(
      { localModel: 'qwen3:8b', cloudModel: 'gpt-4o', routingMode: 'local_only' },
      firstCloud,
    );

    // First route: local_only keeps us on the local model
    const before = await router.route({
      task: makeTask(),
      actionLog: [],
      pageContentLength: 100,
    });
    expect(before.adapter.providerId).toBe('ollama');

    // Mid-life: switch to cloud_only and swap the cloud adapter
    const secondCloud = makeAdapter('anthropic', 'claude-x');
    router.updateConfig({
      localModel: 'qwen3:8b',
      cloudModel: 'claude-x',
      routingMode: 'cloud_only',
    });
    router.setCloudAdapter(secondCloud);

    const after = await router.route({
      task: makeTask(),
      actionLog: [],
      pageContentLength: 100,
    });
    expect(after.adapter).toBe(secondCloud);
    expect(after.adapter.providerId).toBe('anthropic');
    expect(after.isCloud).toBe(true);
  });
});
