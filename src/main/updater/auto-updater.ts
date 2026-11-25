/**
 * Phase 16 — Production Auto-Updater (Task 16.3)
 *
 * Provides release channel management (stable, beta, canary), user-prompted
 * downloads (autoDownload = false), periodic background update checks every 4 hours,
 * release notes parsing, and IPC synchronization with renderer UI.
 */
import { BrowserWindow } from 'electron';
import {
  UpdateChannel,
  UpdateLifecycleState,
  UpdateStatusEvent,
  UpdateInfoPayload,
  DownloadProgressPayload,
} from '../../shared/updater';

export const UPDATER_STATUS_CHANNEL = 'updater:status';

export interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  channel: string;
  allowPrerelease?: boolean;
  setFeedURL?(options: { provider: 'github' | 'generic'; url?: string; owner?: string; repo?: string; channel?: string }): void;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  removeAllListeners?(event?: string): unknown;
}

export interface SentryUpdaterOptions {
  channel?: UpdateChannel;
  appVersion?: string;
  feedUrl?: string;
  checkIntervalMs?: number; // Default 4 hours
  getWindow: () => BrowserWindow | null;
  createUpdater?: () => AutoUpdaterLike;
  now?: () => number;
}

function defaultCreateUpdater(): AutoUpdaterLike {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('electron-updater') as { autoUpdater: AutoUpdaterLike };
    return mod.autoUpdater;
  } catch (err) {
    throw new Error(`electron-updater is unavailable: ${String(err)}`);
  }
}

export class SentryUpdater {
  private updater: AutoUpdaterLike | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: UpdateLifecycleState = 'idle';
  private channel: UpdateChannel;
  private updateInfo: UpdateInfoPayload | null = null;
  private progress: DownloadProgressPayload | null = null;
  private errorMessage: string | null = null;
  private lastCheck: number | null = null;
  private readonly now: () => number;

  constructor(private readonly options: SentryUpdaterOptions) {
    this.channel = options.channel ?? 'stable';
    this.now = options.now ?? Date.now;
  }

  public initialize(): void {
    const updater = this.ensureUpdater();
    updater.autoDownload = false; // Don't download without asking (Task 16.3 requirement)
    updater.autoInstallOnAppQuit = true;
    this.applyChannelSettings(updater);

    // Periodic check every 4 hours by default (Task 16.3)
    const checkInterval = this.options.checkIntervalMs ?? 4 * 60 * 60 * 1000;
    this.startPeriodicChecks(checkInterval);
  }

  public getChannel(): UpdateChannel {
    return this.channel;
  }

  public setChannel(channel: UpdateChannel): void {
    this.channel = channel;
    if (this.updater) {
      this.applyChannelSettings(this.updater);
    }
    this.broadcastStatus();
  }

  private applyChannelSettings(updater: AutoUpdaterLike): void {
    updater.channel = this.channel;
    if (updater.allowPrerelease !== undefined) {
      updater.allowPrerelease = this.channel !== 'stable';
    }
  }

  private broadcastStatus(): void {
    const win = this.options.getWindow();
    if (win && !win.isDestroyed()) {
      const event = this.getStatus();
      win.webContents.send(UPDATER_STATUS_CHANNEL, event);
      // Also broadcast to beta:update-status for interoperability
      win.webContents.send('beta:update-status', {
        state: this.state,
        channel: this.channel === 'canary' ? 'beta' : this.channel,
        version: this.updateInfo?.version,
        percent: this.progress?.percent,
        error: this.errorMessage ?? undefined,
      });
    }
  }

  private ensureUpdater(): AutoUpdaterLike {
    if (this.updater) return this.updater;

    const create = this.options.createUpdater ?? defaultCreateUpdater;
    const updater = create();

    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;
    this.applyChannelSettings(updater);

    updater.on('checking-for-update', () => {
      this.state = 'checking';
      this.errorMessage = null;
      this.broadcastStatus();
    });

    updater.on('update-available', (info: any) => {
      this.state = 'available';
      this.errorMessage = null;
      this.updateInfo = {
        version: info?.version ?? 'unknown',
        releaseDate: info?.releaseDate,
        releaseNotes: info?.releaseNotes,
        channel: this.channel,
      };
      this.broadcastStatus();
    });

    updater.on('update-not-available', () => {
      this.state = 'not-available';
      this.errorMessage = null;
      this.broadcastStatus();
    });

    updater.on('download-progress', (progress: any) => {
      this.state = 'downloading';
      this.progress = {
        percent: progress?.percent ?? 0,
        bytesPerSecond: progress?.bytesPerSecond ?? 0,
        transferred: progress?.transferred ?? 0,
        total: progress?.total ?? 0,
      };
      this.broadcastStatus();
    });

    updater.on('update-downloaded', (info: any) => {
      this.state = 'downloaded';
      if (info?.version) {
        this.updateInfo = {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes,
          channel: this.channel,
        };
      }
      this.broadcastStatus();
    });

    updater.on('error', (err: unknown) => {
      this.state = 'error';
      this.errorMessage = String(err);
      this.broadcastStatus();
    });

    this.updater = updater;
    return updater;
  }

  public async checkForUpdates(): Promise<UpdateStatusEvent> {
    this.lastCheck = this.now();
    this.state = 'checking';
    this.errorMessage = null;
    this.broadcastStatus();

    try {
      const updater = this.ensureUpdater();
      const result: any = await updater.checkForUpdates();
      if (result?.updateInfo?.version && this.state === 'checking') {
        this.state = 'available';
        this.updateInfo = {
          version: result.updateInfo.version,
          releaseDate: result.updateInfo.releaseDate,
          releaseNotes: result.updateInfo.releaseNotes,
          channel: this.channel,
        };
        this.broadcastStatus();
      }
    } catch (err) {
      this.state = 'error';
      this.errorMessage = String(err);
      this.broadcastStatus();
    }

    return this.getStatus();
  }

  public async downloadUpdate(): Promise<UpdateStatusEvent> {
    if (this.state !== 'available' && this.state !== 'error') {
      return this.getStatus();
    }

    this.state = 'downloading';
    this.errorMessage = null;
    this.broadcastStatus();

    try {
      const updater = this.ensureUpdater();
      await updater.downloadUpdate();
    } catch (err) {
      this.state = 'error';
      this.errorMessage = String(err);
      this.broadcastStatus();
    }

    return this.getStatus();
  }

  public quitAndInstall(isSilent = false, isForceRunAfter = true): void {
    if (this.state !== 'downloaded') return;
    try {
      const updater = this.ensureUpdater();
      updater.quitAndInstall(isSilent, isForceRunAfter);
    } catch (err) {
      this.state = 'error';
      this.errorMessage = String(err);
      this.broadcastStatus();
    }
  }

  public startPeriodicChecks(intervalMs?: number): void {
    const period = intervalMs ?? this.options.checkIntervalMs ?? 4 * 60 * 60 * 1000;
    this.stopPeriodicChecks();
    this.timer = setInterval(() => {
      void this.checkForUpdates();
    }, period);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public stopPeriodicChecks(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getStatus(): UpdateStatusEvent {
    return {
      state: this.state,
      channel: this.channel,
      version: this.updateInfo?.version,
      releaseDate: this.updateInfo?.releaseDate,
      releaseNotes: this.updateInfo?.releaseNotes,
      progress: this.progress ?? undefined,
      error: this.errorMessage ?? undefined,
      lastCheck: this.lastCheck ?? undefined,
    };
  }

  public dispose(): void {
    this.stopPeriodicChecks();
    this.updater = null;
  }
}
