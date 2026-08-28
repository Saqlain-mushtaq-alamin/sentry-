import { describe, it, expect } from 'vitest';
import { DryRunEngine } from '../../../src/main/agent/dry-run';
import { ModelAdapter } from '../../../src/main/agent/model-adapter';
import { TaskPlan, PageSnapshot, RiskTier } from '../../../src/shared/types';

describe('DryRunEngine', () => {
  const mockAdapter: ModelAdapter = {
    providerId: 'mock',
    modelId: 'mock-model',
    async chat() {
      return {
        content: '{}',
        tokenUsage: { prompt: 10, completion: 10, total: 20 },
        cost: 0,
        latencyMs: 1,
        modelId: 'mock-model',
      };
    },
    async isAvailable() { return true; },
    getContextLimit() { return 128_000; },
    estimateTokens(text) { return Math.ceil(text.length / 4); },
  };

  const sampleSnapshot: PageSnapshot = {
    url: 'https://example.com/checkout',
    title: 'Checkout Page',
    timestamp: Date.now(),
    dom: { tag: 'body', children: [] },
    accessibilityTree: [],
    visibleText: 'Checkout form',
    forms: [],
    links: [],
    interactiveElements: [
      { index: 0, tag: 'button', role: 'button', label: 'Delete user account', selector: '#delete-button', boundingBox: { x: 0, y: 0, width: 100, height: 30 }, isVisible: true, isEnabled: true }
    ],
    estimatedTokenCount: 50,
  };

  const samplePlan: TaskPlan = {
    taskId: 'plan-1',
    instruction: 'Complete purchase',
    steps: [
      { stepNumber: 1, description: 'Navigate to checkout', expectedActions: ['navigate https://example.com/checkout'], estimatedRisk: RiskTier.LOW },
      { stepNumber: 2, description: 'Delete user account', expectedActions: ['click #delete-button'], estimatedRisk: RiskTier.CRITICAL },
    ],
    estimatedActions: 2,
    estimatedTime: '~15 seconds',
    risks: ['Handling sensitive credit card data'],
    requiresHighRiskActions: true,
  };

  it('runs a dry-run simulation without executing any actions', async () => {
    const engine = new DryRunEngine(mockAdapter);
    const report = await engine.executeDryRun(samplePlan, sampleSnapshot);

    expect(report.confirmedSafe).toBe(true);
    expect(report.steps.length).toBe(2);
    expect(report.highestRisk).toBe(RiskTier.CRITICAL);
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings.some(w => w.includes('CRITICAL'))).toBe(true);
  });
});
