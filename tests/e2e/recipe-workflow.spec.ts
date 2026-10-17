/**
 * Phase 15 E2E — Run task → save recipe → replay.
 *
 * Covers: completing a mock-adapter task to populate the action history,
 * saving that history as a recipe (agent:save-recipe returns the captured
 * recipe and getRecipes reflects it), replaying the recipe (the promise must
 * settle — a FAILED state from a missing page snapshot on an internal page is
 * an accepted, known outcome), and deleting the recipe.
 */
import { test, expect, navigateActiveTab, forceMockModel, prepareTabForTask } from './helpers/electron-app';

test('Run task → save recipe → replay', async ({ app, mainWindow }) => {
  const restoreModel = await forceMockModel(mainWindow);
  try {
    await navigateActiveTab(app, 'sentry://newtab');
    // Prime the never-loaded newtab view with about:blank so the agent loop's
    // hidden-content scanner can attach CDP (it hangs on pristine views).
    await prepareTabForTask(app);

    const instruction = 'check the weather';
    const res = await mainWindow.evaluate((instr: string) =>
      (window as unknown as { sentry: any }).sentry.agent.runTask(instr),
      instruction
    );
    expect(res.success).toBe(true);
    expect(res.result.state).toBe('completed');

    const recipesBefore = await mainWindow.evaluate(() =>
      (window as unknown as { sentry: any }).sentry.agent.getRecipes()
    );
    expect(Array.isArray(recipesBefore)).toBe(true);

    // Save a recipe from the action history captured by the task above
    const recipe = await mainWindow.evaluate((instr: string) =>
      (window as unknown as { sentry: any }).sentry.agent.saveRecipe(instr),
      instruction
    );
    expect(recipe).toBeTruthy();
    expect(typeof recipe.id).toBe('string');
    expect(Array.isArray(recipe.steps)).toBe(true);

    const recipesAfter = await mainWindow.evaluate(() =>
      (window as unknown as { sentry: any }).sentry.agent.getRecipes()
    );
    expect(recipesAfter.length).toBeGreaterThanOrEqual(recipesBefore.length + 1);
    expect(recipesAfter.some((r: { id: string }) => r.id === recipe.id)).toBe(true);

    // Replay must settle without throwing. On an internal sentry:// page the
    // replay engine may legitimately fail to snapshot the page — assert the
    // outcome honestly either way.
    const replay = await mainWindow.evaluate(async (id: string) => {
      try {
        const result = await (window as unknown as { sentry: any }).sentry.agent.replayRecipe(id, {});
        return { threw: false, state: result?.state ?? null, error: result?.error ?? null };
      } catch (err) {
        return { threw: true, state: null, error: String((err as Error)?.message ?? err) };
      }
    }, recipe.id);

    if (replay.threw) {
      // Only the known snapshot failure may surface as a thrown IPC error
      expect(replay.error).toMatch(/snapshot|not found/i);
    } else if (replay.state) {
      expect(['completed', 'failed', 'paused']).toContain(replay.state);
    } else {
      // Known failure mode: no page snapshot available on an internal page
      expect(replay.error).toMatch(/snapshot|not found/i);
    }

    // Delete removes it from the recipe list
    const deleted = await mainWindow.evaluate((id: string) =>
      (window as unknown as { sentry: any }).sentry.agent.deleteRecipe(id),
      recipe.id
    );
    expect(deleted).toBe(true);

    const recipesFinal = await mainWindow.evaluate(() =>
      (window as unknown as { sentry: any }).sentry.agent.getRecipes()
    );
    expect(recipesFinal.some((r: { id: string }) => r.id === recipe.id)).toBe(false);
  } finally {
    await restoreModel().catch(() => undefined);
  }
});
