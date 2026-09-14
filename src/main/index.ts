import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import path from 'path';
import { StorageManager } from './browser/storage-manager';
import { TabManager } from './browser/tab-manager';
import { DownloadManager } from './browser/download-manager';
import { AgentService } from './agent/agent-service';

let mainWindow: BrowserWindow | null = null;
let storageManager: StorageManager;
let tabManager: TabManager;
let downloadManager: DownloadManager;
let agentService: AgentService;

import { ExtensionManager } from './extensions/extension-manager';

let extensionManager: ExtensionManager;

function createWindow(): void {
  storageManager = new StorageManager();

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

  tabManager = new TabManager(mainWindow, storageManager);
  downloadManager = new DownloadManager(mainWindow, storageManager);
  agentService = new AgentService(mainWindow, storageManager, tabManager);
  
  extensionManager = new ExtensionManager(tabManager);
  // electron-chrome-extensions needs to be initialized after session is ready
  extensionManager.initialize();

  // Initialize initial tab
  tabManager.createTab();

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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

app.whenReady().then(() => {
  createWindow();

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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

