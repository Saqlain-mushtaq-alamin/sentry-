/**
 * Phase 15 — Beta distribution & auto-update pipeline.
 *
 * Wraps electron-updater behind a narrow interface so the update lifecycle
 * (check → available → download → downloaded → install) is unit testable
 * without a network or a packaged app, and broadcasts status events to the
 * renderer on `beta:update-status`.
 *
 * Feed configuration: the beta channel is published by `npm run package:beta`
 * (see electron-builder.yml → publish.provider generic). SENTRY_UPDATE_URL
 * overrides the feed for QA/staging installs.
 */
import { BrowserWindow } from 'electron';
import { BetaChannel, BetaUpdateState, BetaUpdateStatusEvent } from '../../shared/beta';

export const UPDATE_STATUS_CHANNEL = 'beta:update-status';

/** Minimal surface of electron-updater's autoUpdater that we rely on. */
export interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  channel: string;
  setFeedURL?(options: { provider: 'generic'; url: string; channel?: string }): void;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  removeAllListeners?(event?: string): unknown;
}

export interface UpdateServiceOptions {
  channel: BetaChannel;
  appVersion: string;
  feedUrl?: string;
  checkIntervalMs?: number;
  getWindow: () => BrowserWindow | null;
  /** Injected for tests; defaults to a lazily-required electron-updater. */
  createUpdater?: () => AutoUpdaterLike;
  now?: () => number;
}

function defaultCreateUpdater(): AutoUpdaterLike {
  try {
    // Lazy require: electron-updater loads Electron internals, which must not
    // run in unit tests (they inject a fake updater instead).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('electron-updater') as { autoUpdater: AutoUpdaterLike };
    return mod.autoUpdater;
  } catch (err) {
    throw new Error(`electron-updater is unavailable: ${String(err)}`);
  }
}

export class UpdateService {
  private updater: AutoUpdaterLike | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: BetaUpdateState = 'idle';
  private availableVersion: string | undefined;
  private lastCheck: number | null = null;
  private readonly now: () => number;

  constructor(private readonly options: UpdateServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  private broadcast(event: BetaUpdateStatusEvent): void {
    const win = this.options.getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(UPDATE_STATUS_CHANNEL, event);
    }
  }

  private setState(state: BetaUpdateState, version?: string, error?: string, percent?: number): void {
    this.state = state;
    if (version) this.availableVersion = version;
    const event: BetaUpdateStatusEvent = {
      state,
      channel: this.options.channel,
      version: this.availableVersion,
      error,
      percent,
    };
    this.broadcast(event);
  }

  private ensureUpdater(): AutoUpdaterLike {
    if (this.updater) return this.updater;

    const create = this.options.createUpdater ?? defaultCreateUpdater;
    const updater = create();

    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.channel = this.options.channel;

    if (this.options.feedUrl && updater.setFeedURL) {
      updater.setFeedURL({
        provider: 'generic',
        url: this.options.feedUrl,
        channel: this.options.channel,
      });
    }

    updater.on('checking-for-update', () => {
      this.setState('checking');
    });
    updater.on('update-available', (info: unknown) => {
      const version = (info as { version?: string } | undefined)?.version;
      this.setState('available', version);
    });
    updater.on('update-not-available', () => {
      this.setState('not-available');
    });
    updater.on('download-progress', (progress: unknown) => {
      const percent = (progress as { percent?: number } | undefined)?.percent;
      this.setState('downloading', this.availableVersion, undefined, percent);
    });
    updater.on('update-downloaded', (info: unknown) => {
      const version = (info as { version?: string } | undefined)?.version;
      this.setState('downloaded', version);
    });
    updater.on('error', (error: unknown) => {
      this.setState('error', this.availableVersion, String(error));
    });

    this.updater = updater;
    return updater;
  }

  public async checkForUpdates(): Promise<BetaUpdateStatusEvent> {
    this.lastCheck = this.now();
    this.setState('checking');

    try {
      const updater = this.ensureUpdater();
      const result = await updater.checkForUpdates();
      const info = (result as { updateInfo?: { version?: string } } | null | undefined)?.updateInfo;
      if (info?.version && this.state === 'checking') {
        // Provider resolved without emitting an event (older electron-updater).
        this.setState('available', info.version);
      }
    } catch (err) {
      this.setState('error', this.availableVersion, String(err));
    }

    return this.getStatusEvent();
  }

  public async downloadUpdate(): Promise<BetaUpdateStatusEvent> {
    if (this.state !== 'available' && this.state !== 'error') {
      return this.getStatusEvent();
    }
    this.setState('downloading', this.availableVersion);
    try {
      const updater = this.ensureUpdater();
      await updater.downloadUpdate();
    } catch (err) {
      this.setState('error', this.availableVersion, String(err));
    }
    return this.getStatusEvent();
  }

  public installUpdate(): void {
    if (this.state !== 'downloaded') return;
    try {
      this.ensureUpdater().quitAndInstall(false, true);
    } catch (err) {
      this.setState('error', this.availableVersion, String(err));
    }
  }

  public startPeriodicChecks(intervalMs?: number): void {
    const period = intervalMs ?? this.options.checkIntervalMs ?? 6 * 60 * 60 * 1000;
    this.stopPeriodicChecks();
    this.timer = setInterval(() => {
      void this.checkForUpdates();
    }, period);
    // Don't keep the process alive just for update checks.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  public stopPeriodicChecks(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getStatusEvent(): BetaUpdateStatusEvent {
    return {
      state: this.state,
      channel: this.options.channel,
      version: this.availableVersion,
    };
  }

  public getLastCheck(): number | null {
    return this.lastCheck;
  }

  public dispose(): void {
    this.stopPeriodicChecks();
    this.updater = null;
  }
}
