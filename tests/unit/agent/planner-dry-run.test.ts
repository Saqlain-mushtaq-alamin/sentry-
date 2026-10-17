import { describe, it, expect, vi } from 'vitest';
import { TaskPlanner } from '../../../src/main/agent/task-planner';
import { DryRunEngine } from '../../../src/main/agent/dry-run';
import { ModelAdapter } from '../../../src/main/agent/model-adapter';
import { RiskClassifier } from '../../../src/main/action-layer/risk-classifier';
import { TrustManager } from '../../../src/main/action-layer/trust-manager';
import {
  ChatResponse,
  PageSnapshot,
  RiskTier,
  TaskPlan,
} from '../../../src/shared/types';

function chatResponse(content: string): ChatResponse {
  return {
    content,
    tokenUsage: { prompt: 10, completion: 20, total: 30 },
    cost: 0,
    latencyMs: 1,
    modelId: 'test-model',
  };
}

function adapterReturning(content: string): ModelAdapter {
  return {
    providerId: 'mock',
    modelId: 'test-model',
    chat: vi.fn().mockResolvedValue(chatResponse(content)),
    isAvailable: vi.fn().mockResolvedValue(true),
    getContextLimit: () => 128_000,
    estimateTokens: (t: string) => Math.ceil(t.length / 4),
  };
}

function throwingAdapter(): ModelAdapter {
  return {
    providerId: 'mock',
    modelId: 'test-model',
    chat: vi.fn().mockRejectedValue(new Error('model offline')),
    isAvailable: vi.fn().mockResolvedValue(false),
    getContextLimit: () => 128_000,
    estimateTokens: (t: string) => Math.ceil(t.length / 4),
  };
}

function snapshotWith(url: string): PageSnapshot {
  return {
    url,
    title: 'Page',
    timestamp: Date.now(),
    dom: { tag: 'body', children: [] },
    accessibilityTree: [],
    visibleText: 'content',
    forms: [],
    links: [],
    interactiveElements: [
      {
        index: 0,
        tag: 'input',
        type: 'search',
        role: 'textbox',
        label: 'Search',
        selector: '#search',
        boundingBox: { x: 0, y: 0, width: 200, height: 30 },
        isVisible: true,
        isEnabled: true,
      },
    ],
    estimatedTokenCount: 80,
  };
}

// ─── TaskPlanner ─────────────────────────────────────────────────────────────

describe('TaskPlanner', () => {
  const snapshot = snapshotWith('https://example.com');

  it('parses a valid JSON plan from the adapter into a TaskPlan with steps and risks', async () => {
    const planJson = JSON.stringify({
      steps: [
        { stepNumber: 1, description: 'Navigate to the site', expectedActions: ['navigate https://example.com'], estimatedRisk: 'low' },
        { stepNumber: 2, description: 'Search for laptops', expectedActions: ['type #search laptops'], estimatedRisk: 'medium' },
        { stepNumber: 3, description: 'Submit the order', expectedActions: ['click #buy'], estimatedRisk: 'critical' },
      ],
      estimatedActions: 5,
      estimatedTime: '~30 seconds',
      risks: ['Handles payment data'],
      requiresHighRiskActions: true,
    });

    const planner = new TaskPlanner(adapterReturning(planJson));
    const plan = await planner.generatePlan('Buy a laptop', snapshot);

    expect(plan.taskId).toBeTruthy();
    expect(plan.instruction).toBe('Buy a laptop');
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0]!.estimatedRisk).toBe(RiskTier.LOW);
    expect(plan.steps[1]!.estimatedRisk).toBe(RiskTier.MEDIUM);
    expect(plan.steps[2]!.estimatedRisk).toBe(RiskTier.CRITICAL);
    expect(plan.steps[1]!.expectedActions).toEqual(['type #search laptops']);
    expect(plan.estimatedActions).toBe(5);
    expect(plan.estimatedTime).toBe('~30 seconds');
    expect(plan.risks).toEqual(['Handles payment data']);
    expect(plan.requiresHighRiskActions).toBe(true);
  });

  it('falls back to a single-step plan when the adapter returns garbage', async () => {
    const planner = new TaskPlanner(adapterReturning('definitely not json {{{'));
    const plan = await planner.generatePlan('Do the thing', snapshot);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]!.description).toBe('Do the thing');
    expect(plan.steps[0]!.expectedActions).toEqual(['Do the thing']);
    expect(plan.steps[0]!.estimatedRisk).toBe(RiskTier.MEDIUM);
    expect(plan.estimatedActions).toBe(1);
    expect(plan.estimatedTime).toBe('~unknown');
    expect(plan.risks).toEqual([]);
    expect(plan.requiresHighRiskActions).toBe(false);
  });

  it('falls back to a single-step plan when the adapter throws', async () => {
    const planner = new TaskPlanner(throwingAdapter());
    const plan = await planner.generatePlan('Retry me', snapshot);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]!.expectedActions).toEqual(['Retry me']);
    expect(plan.estimatedTime).toBe('~unknown');
  });
});

// ─── DryRunEngine ────────────────────────────────────────────────────────────

describe('DryRunEngine', () => {
  function makePlan(steps: Array<{ stepNumber: number; description: string; expectedActions: string[] }>): TaskPlan {
    return {
      taskId: 'plan-dry',
      instruction: 'Shop safely',
      steps: steps.map(s => ({ ...s, estimatedRisk: RiskTier.LOW })),
      estimatedActions: steps.length,
      estimatedTime: '~20 seconds',
      risks: [],
      requiresHighRiskActions: false,
    };
  }

  function makeEngine(): DryRunEngine {
    return new DryRunEngine(
      adapterReturning('{}'),
      new RiskClassifier(),
      new TrustManager(),
    );
  }

  it('simulates each plan step, parses expectedActions, and produces per-step results with confirmedSafe', async () => {
    const engine = makeEngine();
    const plan = makePlan([
      { stepNumber: 1, description: 'Go to the homepage', expectedActions: ['navigate https://example.com'] },
      { stepNumber: 2, description: 'Enter a search term', expectedActions: ['type #search hello world'] },
      { stepNumber: 3, description: 'Click the button', expectedActions: ['click #btn'] },
    ]);

    const report = await engine.executeDryRun(plan, snapshotWith('https://example.com'));

    expect(report.confirmedSafe).toBe(true);
    expect(report.steps).toHaveLength(3);

    expect(report.steps[0]!.simulatedAction.type).toBe('navigate');
    expect(report.steps[0]!.simulatedAction.target).toBe('https://example.com');
    expect(report.steps[0]!.predictedRisk).toBe(RiskTier.LOW);

    expect(report.steps[1]!.simulatedAction.type).toBe('type');
    expect(report.steps[1]!.simulatedAction.target).toBe('#search');
    expect(report.steps[1]!.simulatedAction.value).toBe('hello world');

    expect(report.steps[2]!.simulatedAction.type).toBe('click');
    expect(report.steps[2]!.simulatedAction.target).toBe('#btn');
    expect(report.steps[2]!.predictedUrl).toBe('https://example.com');
    expect(report.steps[2]!.explanation.length).toBeGreaterThan(0);

    expect(report.estimatedTime).toBe('~20 seconds');
  });

  it('escalates and warns when the plan runs on a HIGHLY_RESTRICTED domain', async () => {
    const engine = makeEngine();
    const plan = makePlan([
      { stepNumber: 1, description: 'Open the wallet', expectedActions: ['click #wallet'] },
    ]);

    const report = await engine.executeDryRun(plan, snapshotWith('https://www.paypal.com/checkout'));

    expect(report.warnings.some(w => w.includes('HIGHLY_RESTRICTED') && w.includes('paypal.com'))).toBe(true);
    // MEDIUM default risk escalates to HIGH on highly-restricted domains
    expect(report.highestRisk).toBe(RiskTier.HIGH);
    expect(report.steps[0]!.predictedRisk).toBe(RiskTier.HIGH);
    expect(report.confirmedSafe).toBe(true);
  });

  it('tracks the maximum risk tier across steps', async () => {
    const engine = makeEngine();
    const plan = makePlan([
      { stepNumber: 1, description: 'Read a page', expectedActions: ['navigate https://example.com/a'] },
      { stepNumber: 2, description: 'Fill the search box', expectedActions: ['type #search query'] },
    ]);

    const report = await engine.executeDryRun(plan, snapshotWith('https://example.com'));
    expect(report.highestRisk).toBe(RiskTier.MEDIUM);
  });
});
