import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '' },
  safeStorage: { isEncryptionAvailable: () => false },
}));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RecipeCapture } from '../../../src/main/agent/recipe-capture';
import { RecipeManager } from '../../../src/main/agent/recipe-manager';
import { RecipeReplayEngine } from '../../../src/main/agent/recipe-replay';
import { ActionFirewall } from '../../../src/main/action-layer/action-firewall';
import { RiskClassifier } from '../../../src/main/action-layer/risk-classifier';
import { TrustManager } from '../../../src/main/action-layer/trust-manager';
import { PermissionManager } from '../../../src/main/action-layer/permission-manager';
import { AuditLog } from '../../../src/main/action-layer/audit-log';
import {
  ActionLogEntry,
  FirewallDecision,
  PageSnapshot,
  ProposedAction,
  Recipe,
  RecipeStep,
  RiskTier,
  SiteTrustLevel,
  TaskState,
} from '../../../src/shared/types';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

function decisionFor(action: ProposedAction, over: Partial<FirewallDecision> = {}): FirewallDecision {
  return {
    actionId: action.id,
    allowed: true,
    requiresConfirmation: false,
    riskTier: RiskTier.LOW,
    classification: { tier: RiskTier.LOW, reasons: ['ok'], policyRulesFired: [], confidence: 0.9 },
    siteTrust: SiteTrustLevel.READ_ACT,
    explanation: 'Low risk action allowed automatically.',
    detailedReason: 'ok',
    ...over,
  };
}

function captureEntry(over: Partial<ProposedAction> & { type: string }): ActionLogEntry {
  const action: ProposedAction = {
    id: `a-${over.type}-${Math.random().toString(36).slice(2, 8)}`,
    target: '#x',
    riskTier: RiskTier.LOW,
    reason: 'because',
    timestamp: Date.now(),
    tabId: 'tab-1',
    url: 'https://example.com/page',
    ...over,
  };
  return { action, decision: decisionFor(action), executed: true };
}

function makeSnapshot(over: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: 'https://example.com',
    title: 'Example',
    timestamp: Date.now(),
    dom: { tag: 'body', children: [] },
    accessibilityTree: [],
    visibleText: 'Hello page',
    forms: [],
    links: [],
    interactiveElements: [],
    estimatedTokenCount: 120,
    ...over,
  };
}

function makeStep(over: Partial<RecipeStep> & { order: number; actionType: string }): RecipeStep {
  return {
    target: { primary: '#el', fallbacks: [] },
    riskTier: RiskTier.LOW,
    waitCondition: { type: 'time', timeoutMs: 25 },
    ...over,
  };
}

function makeRecipe(steps: RecipeStep[], over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    name: 'Test recipe',
    description: 'A test recipe',
    version: 1,
    steps,
    variables: [],
    sitePatterns: ['example.com'],
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    useCount: 0,
    tags: [],
    isPublic: false,
    ...over,
  };
}

// ─── RecipeCapture ───────────────────────────────────────────────────────────

describe('RecipeCapture', () => {
  const capture = new RecipeCapture();

  it('builds a Recipe from an ActionLogEntry[] with variables, selectors, and site patterns', () => {
    const recipe = capture.capture('Search laptops on example.com', [
      captureEntry({ type: 'navigate', target: 'https://example.com/search', value: 'https://example.com/search' }),
      captureEntry({ type: 'type', target: '#q', value: 'laptops' }),
      captureEntry({ type: 'click', target: '#go' }),
    ]);

    expect(recipe.id).toBeTruthy();
    expect(recipe.name).toBe('Search laptops on example.com');
    expect(recipe.description).toContain('Search laptops on example.com');
    expect(recipe.version).toBe(1);
    expect(recipe.useCount).toBe(0);
    expect(recipe.tags).toEqual([]);
    expect(recipe.isPublic).toBe(false);
    expect(recipe.sitePatterns).toEqual(['example.com']);

    expect(recipe.steps).toHaveLength(3);
    expect(recipe.steps.map(s => s.order)).toEqual([0, 1, 2]);
    expect(recipe.steps[0]!.target.primary).toBe('https://example.com/search');
    expect(recipe.steps[0]!.riskTier).toBe(RiskTier.LOW);
    expect(recipe.steps[2]!.target.primary).toBe('#go');

    // typed value became a variable reference
    expect(recipe.variables).toHaveLength(1);
    expect(recipe.variables[0]).toEqual({
      name: 'laptops',
      description: 'Value entered into #q',
      type: 'text',
      defaultValue: 'laptops',
      required: true,
    });
    expect(recipe.steps[1]!.value).toEqual({ type: 'variable', name: 'laptops' });
  });

  it('falls back to a numbered variable name for complex typed values', () => {
    const recipe = capture.capture('Fill form', [
      captureEntry({ type: 'type', target: '#email', value: 'user@example.com' }),
    ]);
    expect(recipe.variables[0]!.name).toBe('input_var_1');
    expect(recipe.steps[0]!.value).toEqual({ type: 'variable', name: 'input_var_1' });
  });

  it('truncates long instructions into the recipe name', () => {
    const longInstruction = 'Search for the cheapest round trip flights from Boston to Tokyo in December';
    const recipe = capture.capture(longInstruction, []);
    expect(recipe.name.length).toBeLessThanOrEqual(40);
    expect(recipe.name.endsWith('...')).toBe(true);
  });
});

// ─── RecipeManager ───────────────────────────────────────────────────────────

describe('RecipeManager', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-recipes-'));
    filePath = path.join(tmpDir, 'recipes.enc');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function recipeFixture(id: string, lastUsedAt: number): Recipe {
    return makeRecipe([], { id, name: `Recipe ${id}`, lastUsedAt });
  }

  it('saveRecipe persists and getAllRecipes returns recipes sorted by lastUsedAt desc', () => {
    const manager = new RecipeManager(filePath);
    manager.saveRecipe(recipeFixture('r-old', 1000));
    manager.saveRecipe(recipeFixture('r-new', 9000));
    manager.saveRecipe(recipeFixture('r-mid', 5000));

    const all = manager.getAllRecipes();
    expect(all.map(r => r.id)).toEqual(['r-new', 'r-mid', 'r-old']);
  });

  it('getRecipe returns a recipe by id and deleteRecipe removes it', () => {
    const manager = new RecipeManager(filePath);
    manager.saveRecipe(recipeFixture('r-1', 1000));
    manager.saveRecipe(recipeFixture('r-2', 2000));

    expect(manager.getRecipe('r-1')?.id).toBe('r-1');
    expect(manager.getRecipe('missing')).toBeUndefined();

    manager.deleteRecipe('r-1');
    expect(manager.getRecipe('r-1')).toBeUndefined();
    expect(manager.getAllRecipes().map(r => r.id)).toEqual(['r-2']);
  });

  it('forgetAll clears recipes and the empty state persists across reload', () => {
    const manager = new RecipeManager(filePath);
    manager.saveRecipe(recipeFixture('r-1', 1000));
    manager.forgetAll();
    expect(manager.getAllRecipes()).toEqual([]);

    const reloaded = new RecipeManager(filePath);
    expect(reloaded.getAllRecipes()).toEqual([]);
  });

  it('restores saved recipes when reloaded from the same file (base64 fallback path)', () => {
    const manager = new RecipeManager(filePath);
    manager.saveRecipe(recipeFixture('r-persist', 4242));

    const reloaded = new RecipeManager(filePath);
    const restored = reloaded.getRecipe('r-persist');
    expect(restored).toBeDefined();
    expect(restored?.lastUsedAt).toBe(4242);
    expect(restored?.steps).toEqual([]);
  });

  it('does not throw when the recipes file is corrupt', () => {
    fs.writeFileSync(filePath, '!!!definitely-not-valid-json###', 'utf-8');
    let manager!: RecipeManager;
    expect(() => { manager = new RecipeManager(filePath); }).not.toThrow();
    expect(manager.getAllRecipes()).toEqual([]);
  });
});

// ─── RecipeReplayEngine ──────────────────────────────────────────────────────

describe('RecipeReplayEngine', () => {
  function buildEngine(over: { executor?: unknown; snapshot?: PageSnapshot } = {}) {
    const executor = (over.executor ?? {
      execute: vi.fn().mockResolvedValue({ success: true, duration: 5 }),
    }) as any;
    const observer = {
      getPageSnapshot: vi.fn().mockResolvedValue(over.snapshot ?? makeSnapshot()),
    } as any;
    const firewall = new ActionFirewall(
      new RiskClassifier(),
      new TrustManager(),
      new PermissionManager(),
      new AuditLog(),
    );
    const engine = new RecipeReplayEngine(executor as any, firewall, observer as any);
    return { engine, executor, observer };
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function run<T>(promise: Promise<T>, ms = 1000): Promise<T> {
    const pending = promise;
    await vi.advanceTimersByTimeAsync(ms);
    return pending;
  }

  it('replays an all-LOW recipe to COMPLETED, executing every step with firewall decisions logged', async () => {
    const { engine, executor } = buildEngine();
    const recipe = makeRecipe([
      makeStep({ order: 0, actionType: 'scroll', target: { primary: 'body', fallbacks: [] } }),
      makeStep({ order: 1, actionType: 'navigate', target: { primary: 'https://example.com/page', fallbacks: [] }, value: 'https://example.com/page' }),
    ]);

    const result = await run(engine.replay('tab-1', recipe, {}));

    expect(result.state).toBe(TaskState.COMPLETED);
    expect(result.error).toBeUndefined();
    expect(executor.execute).toHaveBeenCalledTimes(2);
    expect(result.actionLog).toHaveLength(2);
    expect(result.actionLog[0]!.decision.allowed).toBe(true);
    expect(result.actionLog[1]!.decision.allowed).toBe(true);
    expect(result.actionLog[0]!.executed).toBe(false); // log entry created before execution result
  });

  it('substitutes recipe variables from the provided variables map before executing', async () => {
    const { engine, executor } = buildEngine();
    const recipe = makeRecipe([
      makeStep({
        order: 0,
        actionType: 'type',
        target: { primary: '#search', fallbacks: [] },
        value: { type: 'variable', name: 'query' },
      }),
    ]);

    const result = await run(engine.replay('tab-1', recipe, { query: 'vitest recipes' }));

    expect(result.state).toBe(TaskState.COMPLETED);
    expect(executor.execute).toHaveBeenCalledWith(
      'tab-1',
      expect.objectContaining({ type: 'type', target: '#search', value: 'vitest recipes' }),
    );
  });

  it('pauses with a confirmation error when the firewall rates a step HIGH', async () => {
    const { engine, executor } = buildEngine();
    const recipe = makeRecipe([
      makeStep({ order: 0, actionType: 'submit', target: { primary: '#checkout-form', fallbacks: [] } }),
    ]);

    const result = await run(engine.replay('tab-1', recipe, {}));

    expect(result.state).toBe(TaskState.PAUSED);
    expect(result.error).toBe('Recipe requires user confirmation.');
    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.actionLog[0]!.decision.allowed).toBe(false);
    expect(result.actionLog[0]!.decision.requiresConfirmation).toBe(true);
    expect(result.actionLog[0]!.decision.riskTier).toBe(RiskTier.HIGH);
  });

  it('fails the replay when the firewall blocks a dangerous navigate target', async () => {
    const { engine, executor } = buildEngine();
    const recipe = makeRecipe([
      makeStep({
        order: 0,
        actionType: 'navigate',
        target: { primary: 'sentry://internal', fallbacks: [] },
        value: 'sentry://internal',
      }),
    ]);

    const result = await run(engine.replay('tab-1', recipe, {}));

    expect(result.state).toBe(TaskState.FAILED);
    expect(result.error).toContain('Firewall blocked action:');
    expect(result.actionLog[0]!.decision.allowed).toBe(false);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('fails with the failing step order when the executor reports failure', async () => {
    const { engine } = buildEngine({
      executor: { execute: vi.fn().mockResolvedValue({ success: false, error: 'element detached', duration: 3 }) },
    });
    const recipe = makeRecipe([
      makeStep({ order: 0, actionType: 'scroll', target: { primary: 'body', fallbacks: [] } }),
    ]);

    const result = await run(engine.replay('tab-1', recipe, {}));

    expect(result.state).toBe(TaskState.FAILED);
    expect(result.error).toContain('Replay failed at step 0');
    expect(result.error).toContain('element detached');
  });

  it('fails when the page observer cannot provide a snapshot', async () => {
    const { engine, executor } = buildEngine();
    (engine as any).observer = {
      getPageSnapshot: vi.fn().mockRejectedValue(new Error('tab crashed')),
    };

    const result = await engine.replay('tab-1', makeRecipe([
      makeStep({ order: 0, actionType: 'scroll', target: { primary: 'body', fallbacks: [] } }),
    ]), {});

    expect(result.state).toBe(TaskState.FAILED);
    expect(result.error).toBe('Failed to get page snapshot.');
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
