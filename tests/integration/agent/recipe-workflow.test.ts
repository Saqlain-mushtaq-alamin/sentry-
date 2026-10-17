/**
 * Phase 15 — Recipe lifecycle integration tests.
 *
 * Capture → persist → replay through the real RecipeCapture,
 * RecipeManager, RecipeReplayEngine, and Action Firewall.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

vi.mock('electron', async () => {
  const osMod = await import('os');
  return {
    app: { getPath: () => osMod.tmpdir() },
    safeStorage: { isEncryptionAvailable: () => false },
  };
});

import { ReActLoop } from '../../../src/main/agent/react-loop';
import { ModelAdapter } from '../../../src/main/agent/model-adapter';
import { ActionExecutor } from '../../../src/main/cdp/action-executor';
import { ActionFirewall } from '../../../src/main/action-layer/action-firewall';
import { PageObserver } from '../../../src/main/cdp/page-observer';
import { RiskClassifier } from '../../../src/main/action-layer/risk-classifier';
import { TrustManager } from '../../../src/main/action-layer/trust-manager';
import { PermissionManager } from '../../../src/main/action-layer/permission-manager';
import { AuditLog } from '../../../src/main/action-layer/audit-log';
import { RecipeCapture } from '../../../src/main/agent/recipe-capture';
import { RecipeManager } from '../../../src/main/agent/recipe-manager';
import { RecipeReplayEngine } from '../../../src/main/agent/recipe-replay';
import {
  AgentTask, PageSnapshot, Recipe, RiskTier, TaskState,
  ChatRequest, ChatResponse,
} from '../../../src/shared/types';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeSnapshot(url = 'https://example.com'): PageSnapshot {
  return {
    url,
    title: 'Example Shop',
    timestamp: Date.now(),
    dom: { tag: 'body', children: [] },
    accessibilityTree: [],
    visibleText: 'Welcome to the example shop. Search the catalog or browse the featured links.',
    forms: [],
    links: [],
    interactiveElements: [
      { index: 0, tag: 'input', role: 'searchbox', label: 'Search', selector: '#search-input', boundingBox: { x: 0, y: 0, width: 200, height: 30 }, isVisible: true, isEnabled: true, type: 'search' },
      { index: 1, tag: 'button', role: 'button', label: 'Place Order', selector: '#submit-btn', boundingBox: { x: 200, y: 0, width: 80, height: 30 }, isVisible: true, isEnabled: true, type: 'submit' },
      { index: 2, tag: 'input', role: 'textbox', label: 'Password', selector: '#password', boundingBox: { x: 0, y: 40, width: 200, height: 30 }, isVisible: true, isEnabled: true, type: 'password' },
      { index: 3, tag: 'a', role: 'link', label: 'About us', selector: '#about-link', boundingBox: { x: 0, y: 80, width: 100, height: 20 }, isVisible: true, isEnabled: true },
    ],
    estimatedTokenCount: 120,
  };
}

function scriptedAdapter(script: string[]): ModelAdapter {
  let n = 0;
  return {
    providerId: 'mock',
    modelId: 'mock-model',
    async chat(_req: ChatRequest): Promise<ChatResponse> {
      const content = script[Math.min(n++, script.length - 1)] ?? '{}';
      return {
        content,
        tokenUsage: { prompt: 10, completion: 10, total: 20 },
        cost: 0,
        latencyMs: 1,
        modelId: 'mock-model',
      };
    },
    async isAvailable() { return true; },
    getContextLimit() { return 128_000; },
    estimateTokens(t: string) { return Math.ceil(t.length / 4); },
  };
}

function sampleRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: `recipe-${Math.random().toString(36).slice(2)}`,
    name: 'Search and click',
    description: 'Test recipe',
    version: 1,
    steps: [
      {
        order: 0,
        actionType: 'scroll',
        target: { primary: 'body', fallbacks: [] },
        value: 'down',
        riskTier: RiskTier.LOW,
      },
      {
        order: 1,
        actionType: 'click',
        target: { primary: '#about-link', fallbacks: [] },
        riskTier: RiskTier.LOW,
      },
    ],
    variables: [],
    sitePatterns: ['example.com'],
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    useCount: 0,
    tags: [],
    isPublic: false,
    ...overrides,
  };
}

function makeEngine(): {
  engine: RecipeReplayEngine;
  executor: { execute: ReturnType<typeof vi.fn> };
  auditLog: AuditLog;
} {
  const executor = {
    execute: vi.fn().mockResolvedValue({ success: true, duration: 5 }),
  };
  const observer = {
    getPageSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
  };
  const auditLog = new AuditLog();
  const firewall = new ActionFirewall(
    new RiskClassifier(),
    new TrustManager(),
    new PermissionManager(),
    auditLog,
  );
  const engine = new RecipeReplayEngine(
    executor as unknown as ActionExecutor,
    firewall,
    observer as unknown as PageObserver,
  );
  return { engine, executor, auditLog };
}

async function runReplay(
  engine: RecipeReplayEngine,
  tabId: string,
  recipe: Recipe,
  variables: Record<string, string> = {},
  advanceMs = 5_000,
) {
  const p = engine.replay(tabId, recipe, variables);
  await vi.advanceTimersByTimeAsync(advanceMs);
  return p;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Recipe workflow integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a) captures an ordered recipe with variables from a full agent run', async () => {
    const adapter = scriptedAdapter([
      JSON.stringify({ thought: 'Scroll.', action: { type: 'scroll', target: 'body', value: 'down', reason: 'Look around' } }),
      JSON.stringify({ thought: 'Type query.', action: { type: 'type', target: '0', value: 'Sentry browser', reason: 'Enter search' } }),
      JSON.stringify({ thought: 'Click link.', action: { type: 'click', target: '3', reason: 'Open about page' } }),
      JSON.stringify({ thought: 'Done.', action: { type: 'done', reason: 'Finished', answer: 'All steps executed.' } }),
    ]);
    const observer = {
      getPageSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    };
    const executor = {
      execute: vi.fn().mockResolvedValue({ success: true, duration: 5 }),
    };
    const firewall = new ActionFirewall(
      new RiskClassifier(),
      new TrustManager(),
      new PermissionManager(),
      new AuditLog(),
    );
    const loop = new ReActLoop(
      adapter,
      executor as unknown as ActionExecutor,
      firewall,
      observer as unknown as PageObserver,
    );

    const task: AgentTask = {
      id: 'capture-task',
      tabId: 'tab-1',
      instruction: 'Search for Sentry browser and open the about page',
      context: {
        currentUrl: 'https://example.com',
        userInstruction: 'Search for Sentry browser',
        currentStep: 0,
        totalSteps: 3,
      },
      createdAt: Date.now(),
    };

    const p = loop.executeTask(task);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await p;

    expect(result.state).toBe(TaskState.COMPLETED);
    expect(result.actionLog).toHaveLength(3);

    const recipe = new RecipeCapture().capture(task.instruction, result.actionLog);

    expect(recipe.steps).toHaveLength(3);
    expect(recipe.steps.map(s => s.order)).toEqual([0, 1, 2]);
    expect(recipe.steps.map(s => s.actionType)).toEqual(['scroll', 'type', 'click']);
    // The typed value became a variable; the step references it
    expect(recipe.variables).toHaveLength(1);
    expect(recipe.variables[0]!.defaultValue).toBe('Sentry browser');
    expect(recipe.steps[1]!.value).toEqual({ type: 'variable', name: recipe.variables[0]!.name });
    expect(recipe.sitePatterns).toContain('example.com');
    expect(recipe.name).toContain('Search for Sentry browser');
  });

  it('b) persists recipes to disk and restores them in a new manager instance', () => {
    const file = path.join(
      os.tmpdir(),
      `sentry-recipes-test-${Date.now()}-${Math.random().toString(36).slice(2)}.enc`,
    );
    try {
      const recipe = sampleRecipe();
      const manager1 = new RecipeManager(file);
      manager1.saveRecipe(recipe);

      const manager2 = new RecipeManager(file);
      const restored = manager2.getRecipe(recipe.id);
      expect(restored).toBeDefined();
      expect(restored!.name).toBe('Search and click');
      expect(restored!.steps).toHaveLength(2);
      expect(manager2.getAllRecipes()).toHaveLength(1);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it('c) replays a recipe step with variable substitution through the firewall', async () => {
    const { engine, executor } = makeEngine();
    const recipe = sampleRecipe({
      steps: [
        {
          order: 0,
          actionType: 'type',
          target: { primary: '#search-input', fallbacks: [] },
          value: { type: 'variable', name: 'query' },
          riskTier: RiskTier.MEDIUM,
        },
      ],
      variables: [
        { name: 'query', description: 'Search term', type: 'text', required: true },
      ],
    });

    const result = await runReplay(engine, 'tab-1', recipe, { query: 'laptop deals' });

    expect(result.state).toBe(TaskState.COMPLETED);
    expect(result.error).toBeUndefined();
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(executor.execute.mock.calls[0]![1]).toMatchObject({
      type: 'type',
      target: '#search-input',
      value: 'laptop deals',
    });
  });

  it('d) fails with Firewall blocked when a CRITICAL step is replayed', async () => {
    const { engine, executor } = makeEngine();
    const recipe = sampleRecipe({
      steps: [
        {
          order: 0,
          actionType: 'type',
          target: { primary: '#password', fallbacks: [] },
          value: 'hunter2',
          riskTier: RiskTier.CRITICAL,
        },
      ],
    });

    const result = await runReplay(engine, 'tab-1', recipe);

    expect(result.state).toBe(TaskState.FAILED);
    expect(result.error).toContain('Firewall blocked');
    // The !allowed check runs before the requiresConfirmation pause path
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('e) evaluates every replayed step against the firewall audit log', async () => {
    const { engine, executor, auditLog } = makeEngine();
    const recipe = sampleRecipe();

    const result = await runReplay(engine, 'tab-1', recipe);

    expect(result.state).toBe(TaskState.COMPLETED);
    expect(executor.execute).toHaveBeenCalledTimes(2);
    const entries = auditLog.getEntries();
    expect(entries).toHaveLength(recipe.steps.length);
    for (const entry of entries) {
      expect(entry.decision).toBeDefined();
      expect(entry.decision.allowed).toBe(true);
    }
    // One entry per step, in order
    expect(entries.map(e => e.action.type)).toEqual(['scroll', 'click']);
  });

  it('f) honors a short waitCondition and still completes the replay', async () => {
    const { engine, executor } = makeEngine();
    const recipe = sampleRecipe({
      steps: [
        {
          order: 0,
          actionType: 'scroll',
          target: { primary: 'body', fallbacks: [] },
          value: 'down',
          waitCondition: { type: 'time', timeoutMs: 20 },
          riskTier: RiskTier.LOW,
        },
      ],
    });

    const startedAt = Date.now();
    const result = await runReplay(engine, 'tab-1', recipe, {}, 1_000);

    expect(result.state).toBe(TaskState.COMPLETED);
    expect(result.error).toBeUndefined();
    expect(executor.execute).toHaveBeenCalledTimes(1);
    // The waitCondition delay was actually honored before the replay resolved
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(20);
  });
});
