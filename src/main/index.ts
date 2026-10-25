import { app, BrowserWindow, ipcMain, dialog, globalShortcut, session } from 'electron';
import * as fs from 'fs';
import path from 'path';

// Enable Web Speech API in Chromium for SpeechRecognition in Electron
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI');
app.commandLine.appendSwitch('enable-speech-dispatcher');
import { StorageManager } from './browser/storage-manager';
import { TabManager } from './browser/tab-manager';
import { DownloadManager } from './browser/download-manager';
import { AgentService } from './agent/agent-service';
import { FeedbackService } from './beta/feedback-service';
import { BetaMetricsCollector } from './beta/metrics';
import { UpdateService } from './beta/update-service';
import { startCrashReporter } from './beta/crash-reporter';
import { BetaChannel, BetaConsentSettings, BetaMetricEvent, BetaStatus, FeedbackInput } from '../shared/beta';

let mainWindow: BrowserWindow | null = null;
let storageManager: StorageManager;
let tabManager: TabManager;
let downloadManager: DownloadManager;
let agentService: AgentService;

// Beta program services (Phase 15)
let feedbackService: FeedbackService;
let metricsCollector: BetaMetricsCollector;
let updateService: UpdateService;
let resolvedChannel: BetaChannel | null = null;

import { ExtensionManager } from './extensions/extension-manager';

let extensionManager: ExtensionManager;

/**
 * Beta channel resolution: explicit env (CI/QA) → packaged metadata injected
 * by `npm run package:beta` (-c.extraMetadata.channel=beta) → stable.
 */
function resolveChannel(): BetaChannel {
  if (resolvedChannel) return resolvedChannel;
  if (process.env.SENTRY_CHANNEL === 'beta') {
    resolvedChannel = 'beta';
  } else if (process.env.SENTRY_CHANNEL === 'stable') {
    resolvedChannel = 'stable';
  } else {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf-8')) as {
        channel?: string;
      };
      resolvedChannel = pkg.channel === 'beta' ? 'beta' : 'stable';
    } catch {
      resolvedChannel = 'stable';
    }
  }
  return resolvedChannel;
}

function consentSettings(): BetaConsentSettings {
  const settings = storageManager.getSettings();
  return {
    telemetryEnabled: settings.betaTelemetryEnabled === true,
    crashReportingEnabled: settings.betaCrashReportingEnabled === true,
  };
}

function getBetaStatus(): BetaStatus {
  const update = updateService.getStatusEvent();
  return {
    channel: resolveChannel(),
    appVersion: app.getVersion(),
    consent: consentSettings(),
    pendingFeedbackCount: feedbackService.pendingCount(),
    lastUpdateCheck: updateService.getLastCheck(),
    updateState: update.state,
    updateAvailableVersion: update.version,
  };
}

function createWindow(): void {
  storageManager = new StorageManager();

  // ── Beta program services (Phase 15 Task 15.6) ────────────────────────────
  const channel = resolveChannel();
  const consent = consentSettings();

  metricsCollector = new BetaMetricsCollector({
    filePath: path.join(app.getPath('userData'), 'beta-metrics.json'),
    channel,
    appVersion: app.getVersion(),
  });
  metricsCollector.startSession();
  metricsCollector.recordStartup(Math.round(process.uptime() * 1000));

  feedbackService = new FeedbackService({
    filePath: path.join(app.getPath('userData'), 'beta-feedback.json'),
    appVersion: app.getVersion(),
    channel,
  });

  updateService = new UpdateService({
    channel,
    appVersion: app.getVersion(),
    feedUrl: process.env.SENTRY_UPDATE_URL,
    getWindow: () => mainWindow,
  });

  // Crash reporting is strictly opt-in: requires user consent AND a submit URL.
  startCrashReporter({
    submitURL: process.env.SENTRY_CRASH_REPORT_URL ?? '',
    enabled: consent.crashReportingEnabled,
    channel,
    appVersion: app.getVersion(),
  });

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Custom title bar for a modern look
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const ses = session.defaultSession;
  const ALLOWED_PERMISSIONS = new Set([
    'media',
    'microphone',
    'audio-capture',
    'speech-recognition',
  ]);
  ses.setPermissionRequestHandler((wc, permission, cb) => {
    cb(ALLOWED_PERMISSIONS.has(permission));
  });
  ses.setPermissionCheckHandler((wc, permission) => {
    return ALLOWED_PERMISSIONS.has(permission);
  });

  tabManager = new TabManager(mainWindow, storageManager);
  downloadManager = new DownloadManager(mainWindow, storageManager);
  agentService = new AgentService(mainWindow, storageManager, tabManager);

  // Feed beta metrics from the agent pipeline (consent-gated at record time).
  agentService.setMetricsListener((event: BetaMetricEvent) => {
    if (consentSettings().telemetryEnabled) {
      metricsCollector.recordEvent(event);
    }
  });


  extensionManager = new ExtensionManager(tabManager);
  // electron-chrome-extensions needs to be initialized after session is ready
  extensionManager.initialize();

  // Initialize initial tab
  tabManager.createTab();

  // Playwright E2E runs against the built renderer (no dev server), so
  // SENTRY_E2E=1 forces loading the packaged index.html even when unpackaged.
  if (process.env.SENTRY_E2E === '1') {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Test hooks for the Playwright E2E suite (enabled only with SENTRY_E2E=1).
  if (process.env.SENTRY_E2E === '1') {
    (globalThis as unknown as Record<string, unknown>).__SENTRY_E2E__ = {
      getTabManager: (): TabManager => tabManager,
      getAgentService: (): AgentService => agentService,
      getStorageManager: (): StorageManager => storageManager,
    };
  }
}

// Register IPC Handlers
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window:close', () => mainWindow?.close());

// Tab IPC Handlers
ipcMain.handle('tabs:get-all', () => tabManager.getTabs());
ipcMain.handle('tabs:create', (_, url) => tabManager.createTab(url));
ipcMain.handle('tabs:close', (_, id) => tabManager.closeTab(id));
ipcMain.handle('tabs:switch', (_, id) => tabManager.switchTab(id));
ipcMain.handle('tabs:reorder', (_, newOrder) => tabManager.reorderTabs(newOrder));
ipcMain.handle('tabs:duplicate', (_, id) => tabManager.duplicateTab(id));
ipcMain.handle('tabs:toggle-pin', (_, id) => tabManager.togglePinTab(id));

// Navigation IPC Handlers
ipcMain.handle('nav:navigate', (_, id, url) => tabManager.navigate(id, url));
ipcMain.handle('nav:go-back', (_, id) => tabManager.goBack(id));
ipcMain.handle('nav:go-forward', (_, id) => tabManager.goForward(id));
ipcMain.handle('nav:reload', (_, id) => tabManager.reload(id));
ipcMain.handle('nav:set-zoom', (_, id, level) => tabManager.setZoom(id, level));

// Bookmark IPC Handlers
ipcMain.handle('bookmarks:get-all', () => storageManager.getBookmarks());
ipcMain.handle('bookmarks:add', (_, item) => storageManager.addBookmark(item));
ipcMain.handle('bookmarks:remove', (_, id) => storageManager.removeBookmark(id));
ipcMain.handle('bookmarks:is-bookmarked', (_, url) => storageManager.isBookmarked(url));

// History IPC Handlers
ipcMain.handle('history:get-all', (_, query) => storageManager.getHistory(query));
ipcMain.handle('history:clear', () => storageManager.clearHistory());
ipcMain.handle('history:remove-entry', (_, id) => storageManager.removeHistoryEntry(id));

// Download IPC Handlers
ipcMain.handle('downloads:get-all', () => storageManager.getDownloads());
ipcMain.handle('downloads:open-file', (_, path) => downloadManager.openFile(path));
ipcMain.handle('downloads:open-folder', (_, path) => downloadManager.openFolder(path));

// Settings IPC Handlers
ipcMain.handle('settings:get', () => storageManager.getSettings());
ipcMain.handle('settings:update', (_, settings) => storageManager.updateSettings(settings));

// Extension IPC Handlers
ipcMain.handle('extensions:get-all', () => extensionManager.getExtensions());
ipcMain.handle('extensions:load', async (_, path: string) => extensionManager.loadExtension(path));
ipcMain.handle('extensions:choose-and-load', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Extension Directory or .crx',
    properties: ['openFile', 'openDirectory'],
    filters: [{ name: 'Chrome Extension', extensions: ['crx', '*'] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return extensionManager.loadExtension(result.filePaths[0]!);
});
ipcMain.handle('extensions:unload', async (_, id: string) => extensionManager.unloadExtension(id));
ipcMain.handle('extensions:toggle', async (_, id: string, enabled: boolean) => extensionManager.toggleExtension(id, enabled));

// View Layout IPC Handlers
ipcMain.handle('view:set-layout-offsets', (_, offsets) => tabManager.setLayoutOffsets(offsets));
ipcMain.handle('view:set-bounds', (_, bounds) => tabManager.setContentBounds(bounds));
ipcMain.handle('view:set-hidden', (_, hidden) => tabManager.setHidden(hidden));

// Beta Program IPC (Phase 15 Task 15.6)
ipcMain.handle('beta:get-status', (): BetaStatus => getBetaStatus());

ipcMain.handle('beta:submit-feedback', (_, input: FeedbackInput) => feedbackService.submit(input));

ipcMain.handle('beta:set-consent', (_, consent: BetaConsentSettings): BetaStatus => {
  storageManager.updateSettings({
    betaTelemetryEnabled: consent.telemetryEnabled,
    betaCrashReportingEnabled: consent.crashReportingEnabled,
  });
  startCrashReporter({
    submitURL: process.env.SENTRY_CRASH_REPORT_URL ?? '',
    enabled: consent.crashReportingEnabled,
    channel: resolveChannel(),
    appVersion: app.getVersion(),
  });
  return getBetaStatus();
});

ipcMain.handle('beta:get-metrics', () => metricsCollector.getSnapshot());

ipcMain.handle('beta:check-updates', () => updateService.checkForUpdates());
ipcMain.handle('beta:download-update', () => updateService.downloadUpdate());
ipcMain.handle('beta:install-update', () => {
  updateService.installUpdate();
  return true;
});

app.whenReady().then(() => {
  createWindow();

  // Periodic beta update checks (6h cadence; skipped silently if offline).
  updateService.startPeriodicChecks();

  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:toggle-command-box');
      }
    });
  } catch (err) {
    console.error('Failed to register global shortcut:', err);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  updateService?.stopPeriodicChecks();
  updateService?.dispose();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

