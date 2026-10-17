/**
 * Phase 15 E2E — Daily browsing + agent completes a task.
 *
 * Covers: running an agent task through the window.sentry.agent.runTask
 * bridge (scripted mock adapter — no API key configured), the completed task
 * state reaching the renderer via agent:state-changed, the action history and
 * firewall audit trail, and the end-to-end UI path (Agent sidebar → send task
 * → "Task Completed" toast in the NotificationCenter).
 */
import { test, expect, evaluateInMain, navigateActiveTab, forceMockModel, prepareTabForTask } from './helpers/electron-app';

test('Daily browsing + agent completes a task', async ({ app, mainWindow }) => {
  const restoreModel = await forceMockModel(mainWindow);
  try {
    await navigateActiveTab(app, 'sentry://newtab');
    // The agent loop's CDP calls hang on never-loaded internal views — prime
    // the newtab view with about:blank so the scanner/observer can attach.
    await prepareTabForTask(app);

    // Capture task-state transitions delivered to the renderer bridge
    await mainWindow.evaluate(() => {
      const w = window as unknown as { sentry: any; __e2eTaskStates: string[] };
      w.__e2eTaskStates = [];
      w.sentry.agent.onStateChanged((state: string) => {
        w.__e2eTaskStates.push(state);
      });
    });

    const res = await mainWindow.evaluate(() =>
      (window as unknown as { sentry: any }).sentry.agent.runTask('search for the weather')
    );
    expect(res.success).toBe(true);
    expect(res.result.state).toBe('completed');
    expect(typeof res.result.summary).toBe('string');

    // Renderer observed the terminal state through the IPC subscription
    const states = await mainWindow.evaluate(
      () => (window as unknown as { __e2eTaskStates: string[] }).__e2eTaskStates
    );
    expect(states).toContain('completed');

    // Agent action history recorded the executed steps
    const history = await mainWindow.evaluate(() =>
      (window as unknown as { sentry: any }).sentry.agent.getHistory()
    );
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);

    // Firewall audit trail responds and returns an array (may be empty when the
    // mock adapter's only action is a benign scroll on an internal page)
    const audit = await evaluateInMain(app, () => {
      const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getAgentService(): any } }).__SENTRY_E2E__;
      return hooks.getAgentService().getAuditLogEntries();
    });
    expect(Array.isArray(audit)).toBe(true);

    // Full UI workflow: open the agent sidebar, send a task, and observe the
    // NotificationCenter "Task Completed" toast
    await mainWindow.getByRole('button', { name: 'Agent', exact: true }).click();
    await mainWindow.getByPlaceholder(/Ask Sentry to do something/).fill('check the weather');
    await mainWindow.locator('.agent-send-button').click();
    await expect(mainWindow.getByText('Task Completed', { exact: true })).toBeVisible({ timeout: 30_000 });
  } finally {
    await restoreModel().catch(() => undefined);
  }
});
