/**
 * Phase 15 E2E — First-time user launches the app.
 *
 * Covers: cold launch against the built renderer, default tab + settings
 * bootstrap via the __SENTRY_E2E__ main-process hooks, shell chrome rendered
 * by React in the main window (titlebar controls, address bar), and
 * internal-page routing (sentry://newtab).
 */
import { test, expect, evaluateInMain, navigateActiveTab } from './helpers/electron-app';

test('First-time user launches the app', async ({ app, mainWindow }) => {
  // 1. App launched: main window exists and the renderer process responds
  expect(mainWindow.isClosed()).toBe(false);
  await expect(mainWindow.locator('body')).toBeVisible();

  // 2. TabManager seeded at least one tab, exactly one active
  const tabs = await evaluateInMain(app, () => {
    const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getTabManager(): any } }).__SENTRY_E2E__;
    return hooks
      .getTabManager()
      .getTabs()
      .map((t: { id: string; url: string; isActive: boolean }) => ({
        id: t.id,
        url: t.url,
        isActive: t.isActive,
      }));
  });
  expect(tabs.length).toBeGreaterThanOrEqual(1);
  expect(tabs.filter((t) => t.isActive)).toHaveLength(1);

  // 3. StorageManager exposes persisted user settings with expected fields
  const settings = await evaluateInMain(app, () => {
    const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getStorageManager(): any } }).__SENTRY_E2E__;
    return hooks.getStorageManager().getSettings();
  });
  expect(settings).toBeTruthy();
  expect(typeof settings.searchEngine).toBe('string');
  expect(typeof settings.theme).toBe('string');

  // 4. Renderer shell: custom titlebar window controls + address bar input
  await expect(mainWindow.locator('button[title="Minimize"]')).toBeVisible({ timeout: 10_000 });
  await expect(mainWindow.locator('button[title="Maximize"]')).toBeVisible();
  await expect(mainWindow.locator('button[title="Close"]')).toBeVisible();
  await expect(mainWindow.getByPlaceholder('Search with Google or enter address')).toBeVisible();

  // 5. Navigate the active tab away from newtab, then back — the NewTab page
  //    content must render in the main window for sentry://newtab
  await navigateActiveTab(app, 'sentry://settings');
  await expect(mainWindow.getByText('Frequently visited')).toBeHidden({ timeout: 5_000 });

  await navigateActiveTab(app, 'sentry://newtab');
  await expect(mainWindow.getByText('Agentic browser', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(mainWindow.getByPlaceholder('Search with Google or enter web address…')).toBeVisible();
});
