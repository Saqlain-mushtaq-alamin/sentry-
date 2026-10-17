/**
 * Phase 15 E2E — First-time user completes onboarding.
 *
 * Covers: routing the active tab to sentry://onboarding via the TabManager
 * hook, the 5-step Onboarding wizard (Next progression through each step's
 * visible content), finishing via "Skip & Open New Tab", and the persisted
 * hasCompletedOnboarding flag plus navigation back to the new tab page.
 */
import { test, expect, evaluateInMain, navigateActiveTab } from './helpers/electron-app';

test('First-time user completes onboarding', async ({ app, mainWindow }) => {
  // Reset the persisted flag so the final assertion is meaningful on repeat runs
  await evaluateInMain(app, () => {
    const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getStorageManager(): any } }).__SENTRY_E2E__;
    hooks.getStorageManager().updateSettings({ hasCompletedOnboarding: false });
  });

  await navigateActiveTab(app, 'sentry://onboarding');

  // Step 1 — welcome screen (PageShell h1 + intro copy)
  await expect(mainWindow.getByRole('heading', { name: 'Welcome to Sentry' })).toBeVisible({ timeout: 10_000 });
  await expect(
    mainWindow.getByText("A browser where you're in complete control of the AI agent.")
  ).toBeVisible();
  await expect(mainWindow.getByText('Traditional browsers are passive tools')).toBeVisible();

  // Step 2 — AI model choice
  const next = mainWindow.getByRole('button', { name: /^next/i });
  await next.click();
  await expect(mainWindow.getByText('Auto (Recommended)')).toBeVisible();
  await expect(mainWindow.getByText('Local only')).toBeVisible();

  // Step 3 — import data (optional)
  await next.click();
  await expect(mainWindow.getByText('Import bookmarks from Chrome/Edge/Firefox')).toBeVisible();

  // Step 4 — trust tiers
  await next.click();
  await expect(mainWindow.getByText('READ_ACT')).toBeVisible();
  await expect(mainWindow.getByText('HIGHLY_RESTRICTED')).toBeVisible();

  // Step 5 — try it out
  await next.click();
  await expect(mainWindow.getByRole('button', { name: /try now/i })).toBeVisible();
  await expect(mainWindow.getByPlaceholder('Enter a task for the AI agent…')).toBeVisible();

  // Finish → settings marked complete + navigation back to the new tab page
  await mainWindow.getByRole('button', { name: /skip & open new tab/i }).click();
  await expect(mainWindow.getByText('Agentic browser', { exact: true })).toBeVisible({ timeout: 10_000 });

  const settings = await evaluateInMain(app, () => {
    const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getStorageManager(): any } }).__SENTRY_E2E__;
    return hooks.getStorageManager().getSettings();
  });
  expect(settings.hasCompletedOnboarding).toBe(true);
});
