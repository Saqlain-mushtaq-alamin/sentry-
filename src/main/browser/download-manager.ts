import { BrowserWindow, shell } from 'electron';
import path from 'path';
import { StorageManager } from './storage-manager';

export class DownloadManager {
  private window: BrowserWindow;
  private storage: StorageManager;

  constructor(window: BrowserWindow, storage: StorageManager) {
    this.window = window;
    this.storage = storage;

    this.window.webContents.session.on('will-download', (_event, item, _webContents) => {
      const settings = this.storage.getSettings();
      if (!settings.askDownloadPath && settings.defaultDownloadPath) {
        try {
          const fullPath = path.join(settings.defaultDownloadPath, item.getFilename());
          item.setSavePath(fullPath);
        } catch (e) {
          console.warn('[DownloadManager] Failed to set custom save path:', e);
        }
      }

      const id = `dl-${Date.now()}`;
      const filename = item.getFilename();
      const savePath = item.getSavePath();
      const totalBytes = item.getTotalBytes();
      const url = item.getURL();

      this.storage.addDownload({
        id,
        filename,
        url,
        savePath,
        receivedBytes: 0,
        totalBytes,
        state: 'progressing',
        startTime: Date.now(),
      });

      item.on('updated', (_evt, state) => {
        if (state === 'interrupted') {
          this.storage.updateDownload(id, { state: 'interrupted' });
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            this.storage.updateDownload(id, { state: 'interrupted' });
          } else {
            this.storage.updateDownload(id, {
              receivedBytes: item.getReceivedBytes(),
              state: 'progressing',
            });
          }
        }
        this.notifyUpdated();
      });

      item.once('done', (_evt, state) => {
        if (state === 'completed') {
          this.storage.updateDownload(id, {
            receivedBytes: item.getReceivedBytes(),
            state: 'completed',
            endTime: Date.now(),
          });
        } else {
          this.storage.updateDownload(id, { state: 'cancelled', endTime: Date.now() });
        }
        this.notifyUpdated();
      });
    });
  }

  public openFile(savePath: string): void {
    if (savePath) shell.openPath(savePath);
  }

  public openFolder(savePath: string): void {
    if (savePath) shell.showItemInFolder(savePath);
  }

  private notifyUpdated(): void {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send('downloads:updated', this.storage.getDownloads());
    }
  }
}
