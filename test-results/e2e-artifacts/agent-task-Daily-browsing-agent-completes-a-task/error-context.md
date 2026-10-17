# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agent-task.spec.ts >> Daily browsing + agent completes a task
- Location: tests\e2e\agent-task.spec.ts:12:5

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: page.evaluate: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - generic [ref=f1e4]:
    - generic [ref=f1e6]:
      - generic "New Tab" [ref=f1e7] [cursor=pointer]:
        - button [ref=f1e10]
      - button "New Tab (Ctrl+T)" [ref=f1e14] [cursor=pointer]
    - generic [ref=f1e17]:
      - button "─" [ref=f1e18] [cursor=pointer]
      - button "□" [ref=f1e19] [cursor=pointer]
      - button "✕" [ref=f1e20] [cursor=pointer]
  - generic [ref=f1e21]:
    - button "Go Back (Alt+Left)" [disabled] [ref=f1e22]
    - button "Go Forward (Alt+Right)" [disabled] [ref=f1e25]
    - button "Reload page (Ctrl+R)" [ref=f1e28] [cursor=pointer]
    - textbox "Search with Google or enter address" [ref=f1e38]
    - button [ref=f1e39] [cursor=pointer]
    - generic [ref=f1e45]:
      - button "Notifications" [ref=f1e46] [cursor=pointer]
      - generic: "1"
    - button "More options" [ref=f1e51] [cursor=pointer]
  - generic [ref=f1e56]:
    - generic "Google (https://google.com) — Right-click to remove" [ref=f1e57] [cursor=pointer]: Google
    - generic "GitHub (https://github.com) — Right-click to remove" [ref=f1e61] [cursor=pointer]: GitHub
    - generic "Wikipedia (https://wikipedia.org) — Right-click to remove" [ref=f1e65] [cursor=pointer]: Wikipedia
  - generic [ref=f1e72]:
    - heading "Sentry" [level=1] [ref=f1e73]
    - paragraph [ref=f1e74]: Agentic browser
    - textbox "Search with Google or enter web address…" [active] [ref=f1e80]
    - generic [ref=f1e81]:
      - generic [ref=f1e82]: Frequently visited
      - generic "Daily News — Special Report (file:///D:/canvas/Sentry/tests/e2e/fixtures/injection-page.html)" [ref=f1e84] [cursor=pointer]: Daily News — Special Report
```

# Test source

```ts
  15  | 
  16  | export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
  17  | export const MAIN_ENTRY = path.join(REPO_ROOT, 'dist', 'main', 'main', 'index.js');
  18  | export const RENDERER_HTML = path.join(REPO_ROOT, 'dist', 'main', 'renderer', 'index.html');
  19  | const VITE_RENDERER_DIR = path.join(REPO_ROOT, 'dist', 'renderer');
  20  | 
  21  | /**
  22  |  * src/main/index.ts loads ../renderer/index.html relative to dist/main/main,
  23  |  * i.e. dist/main/renderer/index.html — but vite.config.ts emits the renderer to
  24  |  * dist/renderer. Mirror the built output into the path the main process expects
  25  |  * so SENTRY_E2E=1 loads a real page instead of a dead file path.
  26  |  */
  27  | function ensureRendererBuild(): boolean {
  28  |   if (fs.existsSync(RENDERER_HTML)) return true;
  29  |   if (!fs.existsSync(path.join(VITE_RENDERER_DIR, 'index.html'))) return false;
  30  |   fs.mkdirSync(path.dirname(RENDERER_HTML), { recursive: true });
  31  |   fs.cpSync(VITE_RENDERER_DIR, path.dirname(RENDERER_HTML), { recursive: true });
  32  |   return fs.existsSync(RENDERER_HTML);
  33  | }
  34  | 
  35  | export const test = base.extend<{ app: ElectronApplication; mainWindow: Page }>({
  36  |   app: async ({}, use) => {
  37  |     if (!fs.existsSync(MAIN_ENTRY) || !ensureRendererBuild()) {
  38  |       test.skip(true, 'Build the app first: npm run build');
  39  |     }
  40  | 
  41  |     const env: Record<string, string> = {
  42  |       ...(process.env as Record<string, string>),
  43  |       SENTRY_E2E: '1',
  44  |       ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
  45  |     };
  46  |     // Keep cloud keys out of the app under test so the agent always falls back
  47  |     // to the scripted mock adapter (deterministic, offline).
  48  |     delete env.OPENAI_API_KEY;
  49  |     delete env.ANTHROPIC_API_KEY;
  50  | 
  51  |     const app = await _electron.launch({ args: [MAIN_ENTRY], env });
  52  |     await use(app);
  53  |     await app.close().catch(() => undefined);
  54  |   },
  55  | 
  56  |   mainWindow: async ({ app }, use) => {
  57  |     const win = await app.firstWindow();
  58  |     await win.waitForLoadState('domcontentloaded');
  59  |     await use(win);
  60  |   },
  61  | });
  62  | 
  63  | export { expect };
  64  | 
  65  | /**
  66  |  * Run a function in the Electron main process. The optional arg is forwarded as
  67  |  * the second parameter of the evaluated function (first param is the electron
  68  |  * module, which hooks-based calls ignore).
  69  |  */
  70  | export function evaluateInMain<T>(app: ElectronApplication, fn: (electron: unknown) => T | Promise<T>): Promise<T>;
  71  | export function evaluateInMain<T, A>(
  72  |   app: ElectronApplication,
  73  |   fn: (electron: unknown, arg: A) => T | Promise<T>,
  74  |   arg: A
  75  | ): Promise<T>;
  76  | export function evaluateInMain(app: ElectronApplication, fn: unknown, arg?: unknown): Promise<unknown> {
  77  |   return arg === undefined
  78  |     ? (app as unknown as { evaluate(f: unknown): Promise<unknown> }).evaluate(fn)
  79  |     : (app as unknown as { evaluate(f: unknown, a: unknown): Promise<unknown> }).evaluate(fn, arg);
  80  | }
  81  | 
  82  | /** Navigate the active tab through the TabManager test hook. */
  83  | export function navigateActiveTab(app: ElectronApplication, url: string): Promise<string> {
  84  |   return evaluateInMain(
  85  |     app,
  86  |     (_electronModule, target: string) => {
  87  |       const hooks = (globalThis as unknown as { __SENTRY_E2E__: { getTabManager(): any } }).__SENTRY_E2E__;
  88  |       const tabManager = hooks.getTabManager();
  89  |       const active = tabManager.getActiveTab();
  90  |       tabManager.navigate(active.id, target);
  91  |       return active.id as string;
  92  |     },
  93  |     url
  94  |   );
  95  | }
  96  | 
  97  | /**
  98  |  * Force the model router onto cloud_only mode. With no API key configured the
  99  |  * "cloud" adapter is the deterministic scripted mock — required on machines
  100 |  * where a local Ollama server is running (auto routing would otherwise pick a
  101 |  * real model). Returns a restore function for the persisted config.
  102 |  */
  103 | export async function forceMockModel(mainWindow: Page): Promise<() => Promise<void>> {
  104 |   const previous = await mainWindow.evaluate(() =>
  105 |     (window as unknown as { sentry: { agent: { getModelConfig(): { localModel: string; cloudModel: string; routingMode: string } } } }).sentry.agent.getModelConfig()
  106 |   );
  107 |   await mainWindow.evaluate(
  108 |     (cfg) =>
  109 |       (window as unknown as {
  110 |         sentry: { agent: { setModelConfig(c: { localModel: string; cloudModel: string; routingMode: string }): Promise<boolean> } };
  111 |       }).sentry.agent.setModelConfig({ ...cfg, routingMode: 'cloud_only' }),
  112 |     previous
  113 |   );
  114 |   return () =>
> 115 |     mainWindow.evaluate(
      |                ^ Error: page.evaluate: Target page, context or browser has been closed
  116 |       (cfg) =>
  117 |         (window as unknown as {
  118 |           sentry: { agent: { setModelConfig(c: { localModel: string; cloudModel: string; routingMode: string }): Promise<boolean> } };
  119 |         }).sentry.agent.setModelConfig(cfg),
  120 |       previous
  121 |     );
  122 | }
  123 | 
```