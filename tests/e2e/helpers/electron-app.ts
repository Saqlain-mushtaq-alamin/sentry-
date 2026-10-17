/**
 * Phase 15 E2E — shared Electron test fixture.
 *
 * Launches the built app (dist/main/main/index.js) with SENTRY_E2E=1 so the
 * main process loads the packaged renderer and registers the
 * globalThis.__SENTRY_E2E__ hooks (getTabManager / getAgentService /
 * getStorageManager). Note: inside app.evaluate the serialized function runs IN
 * the Electron main process, so it reads those hooks off globalThis directly —
 * no closure over test-side helpers is possible there.
 */
import fs from 'fs';
import path from 'path';
import { test as base, expect, _electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
export const MAIN_ENTRY = path.join(REPO_ROOT, 'dist', 'main', 'main', 'index.js');
export const RENDERER_HTML = path.join(REPO_ROOT, 'dist', 'main', 'renderer', 'index.html');
const VITE_RENDERER_DIR = path.join(REPO_ROOT, 'dist', 'renderer');

/**
 * src/main/index.ts loads ../renderer/index.html relative to dist/main/main,
 * i.e. dist/main/renderer/index.html — but vite.config.ts emits the renderer to
 * dist/renderer. Mirror the built output into the path the main process expects
 * so SENTRY_E2E=1 loads a real page instead of a dead file path.
 */
function ensureRendererBuild(): boolean {
  if (fs.existsSync(RENDERER_HTML)) return true;
  if (!fs.existsSync(path.join(VITE_RENDERER_DIR, 'index.html'))) return false;
  fs.mkdirSync(path.dirname(RENDERER_HTML), { recursive: true });
  fs.cpSync(VITE_RENDERER_DIR, path.dirname(RENDERER_HTML), { recursive: true });
  return fs.existsSync(RENDERER_HTML);
}

export const test = base.extend<{ app: ElectronApplication; mainWindow: Page }>({
  app: async ({}, use) => {
    if (!fs.existsSync(MAIN_ENTRY) || !ensureRendererBuild()) {
      test.skip(true, 'Build the app first: npm run build');
    }

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      SENTRY_E2E: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    };
    // Keep cloud keys out of the app under test so the agent always falls back
    // to the scripted mock adapter (deterministic, offline).
    delete env.OPENAI_API_KEY;
    delete env.ANTHROPIC_API_KEY;

    const app = await _electron.launch({ args: [MAIN_ENTRY], env });
    await use(app);
    await app.close().catch(() => undefined);
  },

  mainWindow: async ({ app }, use) => {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await use(win);
  },
});

export { expect };

/**
 * Run a function in the Electron main process. The optional arg is forwarded as
 * the second parameter of the evaluated function (first param is the electron
 * module, which hooks-based calls ignore).
 */
export function evaluateInMain<T>(app: ElectronApplication, fn: (electron: unknown) => T | Promise<T>): Promise<T>;
export function evaluateInMain<T, A>(
  app: ElectronApplication,
  fn: (electron: unknown, arg: A) => T | Promise<T>,
  arg: A
): Promise<T>;
export function evaluateInMain(app: ElectronApplication, fn: unknown, arg?: unknown): Promise<unknown> {
  return arg === undefined
    ? (app as unknown as { evaluate(f: unknown): Promise<unknown> }).evaluate(fn)
    : (app as unknown as { evaluate(f: unknown, a: unknown): Promise<unknown> }).evaluate(fn, arg);
}

/** Navigate the active tab through the TabManager test hook. */
export function navigateActiveTab(app: ElectronApplication, url: string): Promise<string> {
  return evaluateInMain(
    app,
    (_electronModule, target: string) => {
      const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getTabManager(): any } }).__SENTRY_E2E__;
      const tabManager = hooks.getTabManager();
      const active = tabManager.getActiveTab();
      tabManager.navigate(active.id, target);
      return active.id as string;
    },
    url
  );
}

/**
 * Make the active tab usable by the agent's ReAct loop.
 *
 * Views created for sentry:// internal pages never call loadURL, so their
 * webContents stays in the pristine initial state where debugger.attach /
 * Runtime.evaluate (used by the hidden-injection scanner and the page observer)
 * hang forever. Explicitly load about:blank on the internal tab's view so CDP
 * commands resolve; real pages (file://, http(s)://) are left untouched.
 */
export async function prepareTabForTask(app: ElectronApplication): Promise<void> {
  await evaluateInMain(app, () => {
    const hooks = (globalThis as unknown as {
      __SENTRY_E2E__: {
        getTabManager(): {
          getActiveTab(): { id: string; url: string };
          getView(id: string): { webContents: { loadURL(url: string): Promise<void> } };
        };
      };
    }).__SENTRY_E2E__;
    const tabManager = hooks.getTabManager();
    const active = tabManager.getActiveTab();
    if (!active.url.startsWith('sentry://')) return;
    const wc = tabManager.getView(active.id).webContents;
    return wc.loadURL('about:blank');
  });
}

/**
 * Force the model router onto cloud_only mode. With no API key configured the
 * "cloud" adapter is the deterministic scripted mock — required on machines
 * where a local Ollama server is running (auto routing would otherwise pick a
 * real model). Returns a restore function for the persisted config.
 */
export async function forceMockModel(mainWindow: Page): Promise<() => Promise<void>> {
  const previous = await mainWindow.evaluate(() =>
    (window as unknown as { sentry: { agent: { getModelConfig(): { localModel: string; cloudModel: string; routingMode: string } } } }).sentry.agent.getModelConfig()
  );
  await mainWindow.evaluate(
    (cfg) =>
      (window as unknown as {
        sentry: { agent: { setModelConfig(c: { localModel: string; cloudModel: string; routingMode: string }): Promise<boolean> } };
      }).sentry.agent.setModelConfig({ ...cfg, routingMode: 'cloud_only' }),
    previous
  );
  return () =>
    mainWindow.evaluate(
      (cfg) =>
        (window as unknown as {
          sentry: { agent: { setModelConfig(c: { localModel: string; cloudModel: string; routingMode: string }): Promise<boolean> } };
        }).sentry.agent.setModelConfig(cfg),
      previous
    );
}
