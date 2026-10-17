/**
 * Phase 15 E2E — Multi-tab orchestration.
 *
 * Covers: creating extra tabs via the TabManager hook, switchTab / closeTab
 * (including the auto-recreate-on-last-close behavior), reorderTabs, and the
 * MultiTabCoordinator workflow through window.sentry.agent.runMultiTab
 * (success + combinedSummary).
 */
import { test, expect, evaluateInMain } from './helpers/electron-app';

test('Multi-tab orchestration', async ({ app, mainWindow }) => {
  const tabsBefore = await evaluateInMain(app, () => {
    const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getTabManager(): any } }).__SENTRY_E2E__;
    return hooks.getTabManager().getTabs().map((t: { id: string }) => t.id) as string[];
  });

  // 1. Creating two extra tabs grows the tab list
  const created = await evaluateInMain(app, () => {
    const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getTabManager(): any } }).__SENTRY_E2E__;
    const tabManager = hooks.getTabManager();
    const a = tabManager.createTab();
    const b = tabManager.createTab();
    return { a: a.id as string, b: b.id as string, total: tabManager.getTabs().length as number };
  });
  expect(created.total).toBe(tabsBefore.length + 2);

  // 2. switchTab changes the active tab (and the isActive flags)
  const switched = await evaluateInMain(
    app,
    (_electronModule, id: string) => {
      const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getTabManager(): any } }).__SENTRY_E2E__;
      const tabManager = hooks.getTabManager();
      tabManager.switchTab(id);
      return {
        activeId: tabManager.getActiveTab().id as string,
        flags: tabManager.getTabs().map((t: { id: string; isActive: boolean }) => ({
          id: t.id,
          isActive: t.isActive,
        })),
      };
    },
    created.a
  );
  expect(switched.activeId).toBe(created.a);
  expect(switched.flags.find((t) => t.isActive)?.id).toBe(created.a);

  // 3. closeTab removes exactly one tab
  const afterClose = await evaluateInMain(
    app,
    (_electronModule, id: string) => {
      const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getTabManager(): any } }).__SENTRY_E2E__;
      const tabManager = hooks.getTabManager();
      const before = tabManager.getTabs().length as number;
      tabManager.closeTab(id);
      return {
        before,
        after: tabManager.getTabs().length as number,
        ids: tabManager.getTabs().map((t: { id: string }) => t.id) as string[],
      };
    },
    created.b
  );
  expect(afterClose.after).toBe(afterClose.before - 1);
  expect(afterClose.ids).not.toContain(created.b);

  // 4. reorderTabs reorders getTabs()
  const reordered = await evaluateInMain(app, () => {
    const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getTabManager(): any } }).__SENTRY_E2E__;
    const tabManager = hooks.getTabManager();
    const ids = tabManager.getTabs().map((t: { id: string }) => t.id) as string[];
    const newOrder = [...ids].reverse();
    tabManager.reorderTabs(newOrder);
    return { expected: newOrder, actual: tabManager.getTabs().map((t: { id: string }) => t.id) as string[] };
  });
  expect(reordered.actual).toEqual(reordered.expected);

  // 5. Closing every tab auto-recreates one fresh new-tab page
  const closedDown = await evaluateInMain(app, () => {
    const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getTabManager(): any } }).__SENTRY_E2E__;
    const tabManager = hooks.getTabManager();
    let guard = 0;
    while (tabManager.getTabs().length > 1 && guard++ < 20) {
      tabManager.closeTab(tabManager.getTabs()[tabManager.getTabs().length - 1].id);
    }
    tabManager.closeTab(tabManager.getTabs()[0].id);
    const tabs = tabManager.getTabs() as Array<{ url: string }>;
    return { count: tabs.length, urls: tabs.map((t) => t.url) };
  });
  expect(closedDown.count).toBe(1);
  expect(closedDown.urls[0]).toBe('sentry://newtab');

  // 6. Multi-tab agent task through the renderer bridge (coordinator simulates
  //    per-tab progress; no real navigation is required)
  const multi = await mainWindow.evaluate(() =>
    (window as unknown as { sentry: any }).sentry.agent.runMultiTab({
      id: 'mt-e2e',
      instruction: 'compare prices across tabs',
      tabs: [
        { tabId: 'mt-e2e-1', url: 'https://example.com', subInstruction: 'get price', status: 'pending' },
        { tabId: 'mt-e2e-2', url: 'https://shop.example.com', subInstruction: 'get price', status: 'pending' },
      ],
    })
  );
  expect(multi.success).toBe(true);
  expect(typeof multi.combinedSummary).toBe('string');
  expect(multi.combinedSummary.length).toBeGreaterThan(0);
  expect(multi.taskId).toBe('mt-e2e');
});
