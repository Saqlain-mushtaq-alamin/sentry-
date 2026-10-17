/**
 * Phase 15 — Beta auto-update pipeline unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import {
  UpdateService,
  AutoUpdaterLike,
  UPDATE_STATUS_CHANNEL,
} from '../../../src/main/beta/update-service';
import { BetaUpdateStatusEvent } from '../../../src/shared/beta';

interface FakeUpdater {
  updater: AutoUpdaterLike;
  emit: (event: string, ...args: unknown[]) => void;
  setFeedURL: ReturnType<typeof vi.fn>;
  checkForUpdates: ReturnType<typeof vi.fn>;
  downloadUpdate: ReturnType<typeof vi.fn>;
  quitAndInstall: ReturnType<typeof vi.fn>;
}

function makeFakeUpdater(checkImpl?: () => Promise<unknown>): FakeUpdater {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const setFeedURL = vi.fn();
  const checkForUpdates = vi.fn().mockImplementation(checkImpl ?? (() => Promise.resolve(null)));
  const downloadUpdate = vi.fn().mockResolvedValue(undefined);
  const quitAndInstall = vi.fn();

  const updater: AutoUpdaterLike = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    channel: 'stable',
    setFeedURL,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    on(event: string, listener: (...args: unknown[]) => void) {
      (listeners[event] ??= []).push(listener);
      return updater;
    },
    removeAllListeners(event?: string) {
      if (event) delete listeners[event];
      else Object.keys(listeners).forEach((k) => delete listeners[k]);
      return updater;
    },
  };

  return {
    updater,
    setFeedURL,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    emit: (event, ...args) => (listeners[event] ?? []).forEach((l) => l(...args)),
  };
}

function makeFakeWindow() {
  const send = vi.fn();
  const win = {
    isDestroyed: () => false,
    webContents: { send },
  } as unknown as BrowserWindow;
  return { win, send };
}

describe('UpdateService', () => {
  let fake: FakeUpdater;
  let win: BrowserWindow;
  let send: ReturnType<typeof vi.fn>;
  let clock: number;

  const makeService = (feedUrl?: string): UpdateService =>
    new UpdateService({
      channel: 'beta',
      appVersion: '0.1.0',
      feedUrl,
      getWindow: () => win,
      createUpdater: () => fake.updater,
      now: () => clock,
    });

  beforeEach(() => {
    fake = makeFakeUpdater();
    const w = makeFakeWindow();
    win = w.win;
    send = w.send;
    clock = 1_700_000_000_000;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts idle with no broadcast', () => {
    const service = makeService();
    expect(service.getStatusEvent()).toEqual({ state: 'idle', channel: 'beta', version: undefined });
    expect(send).not.toHaveBeenCalled();
  });

  it('configures the updater on first use', async () => {
    const service = makeService('https://updates.example.test');
    await service.checkForUpdates();

    expect(fake.updater.autoDownload).toBe(true);
    expect(fake.updater.autoInstallOnAppQuit).toBe(true);
    expect(fake.updater.channel).toBe('beta');
    expect(fake.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://updates.example.test',
      channel: 'beta',
    });
  });

  it('skips setFeedURL when no feed URL is configured', async () => {
    await makeService().checkForUpdates();
    expect(fake.setFeedURL).not.toHaveBeenCalled();
  });

  it('checkForUpdates transitions checking → available and broadcasts', async () => {
    const service = makeService();
    const pending = service.checkForUpdates();

    expect(service.getStatusEvent().state).toBe('checking');
    fake.emit('update-available', { version: '0.2.0' });
    await pending;

    const status = await service.checkForUpdates();
    expect(status.state).toBe('available');
    expect(status.version).toBe('0.2.0');
    expect(service.getLastCheck()).toBe(clock);

    const states = send.mock.calls.map((c) => (c[1] as BetaUpdateStatusEvent).state);
    expect(states).toContain('checking');
    expect(states).toContain('available');
    expect(send.mock.calls[0][0]).toBe(UPDATE_STATUS_CHANNEL);
  });

  it('falls back to updateInfo when the provider emits no event', async () => {
    fake = makeFakeUpdater(() =>
      Promise.resolve({ updateInfo: { version: '0.3.0' } }),
    );
    const status = await makeService().checkForUpdates();
    expect(status.state).toBe('available');
    expect(status.version).toBe('0.3.0');
  });

  it('handles update-not-available', async () => {
    const service = makeService();
    const pending = service.checkForUpdates();
    fake.emit('update-not-available');
    await pending;
    expect(service.getStatusEvent().state).toBe('not-available');
  });

  it('records a check failure without throwing', async () => {
    fake = makeFakeUpdater(() => Promise.reject(new Error('offline')));
    const service = makeService();
    const status = await service.checkForUpdates();
    expect(status.state).toBe('error');
    expect(status.error).toContain('offline');
    expect(service.getLastCheck()).toBe(clock);
  });

  it('reports updater "error" events as error state', async () => {
    const service = makeService();
    const pending = service.checkForUpdates();
    fake.emit('update-available', { version: '0.9.0' });
    fake.emit('error', new Error('checksum mismatch'));
    await pending;
    const status = service.getStatusEvent();
    expect(status.state).toBe('error');
    expect(status.error).toContain('checksum mismatch');
    expect(status.version).toBe('0.9.0');
  });

  it('broadcasts download progress percent', async () => {
    const service = makeService();
    const pending = service.checkForUpdates();
    fake.emit('update-available', { version: '0.2.0' });
    await pending;

    await service.downloadUpdate();
    fake.emit('download-progress', { percent: 42.5 });
    fake.emit('update-downloaded', { version: '0.2.0' });

    const states = send.mock.calls.map((c) => c[1] as BetaUpdateStatusEvent);
    expect(states.some((s) => s.state === 'downloading' && s.percent === 42.5)).toBe(true);
    expect(service.getStatusEvent().state).toBe('downloaded');
    expect(service.getStatusEvent().version).toBe('0.2.0');
  });

  it('downloadUpdate is a no-op unless an update is available', async () => {
    const status = await makeService().downloadUpdate();
    expect(status.state).toBe('idle');
    expect(fake.downloadUpdate).not.toHaveBeenCalled();
  });

  it('downloadUpdate failure becomes error state', async () => {
    const service = makeService();
    const pending = service.checkForUpdates();
    fake.emit('update-available', { version: '0.2.0' });
    await pending;

    fake.downloadUpdate.mockRejectedValueOnce(new Error('network down'));
    const status = await service.downloadUpdate();
    expect(status.state).toBe('error');
    expect(status.error).toContain('network down');
  });

  it('installUpdate only quits when the update is downloaded', () => {
    const service = makeService();
    service.installUpdate();
    expect(fake.quitAndInstall).not.toHaveBeenCalled();
  });

  it('installUpdate quits and relaunches after download', async () => {
    const service = makeService();
    const pending = service.checkForUpdates();
    fake.emit('update-downloaded', { version: '0.2.0' });
    await pending;

    service.installUpdate();
    expect(fake.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('surfaces quitAndInstall failures as error state', async () => {
    const service = makeService();
    const pending = service.checkForUpdates();
    fake.emit('update-downloaded', { version: '0.2.0' });
    await pending;
    fake.quitAndInstall.mockImplementationOnce(() => {
      throw new Error('denied');
    });
    service.installUpdate();
    expect(service.getStatusEvent().state).toBe('error');
  });

  it('does not broadcast to a destroyed window', async () => {
    const destroyed = {
      isDestroyed: () => true,
      webContents: { send },
    } as unknown as BrowserWindow;
    const service = new UpdateService({
      channel: 'beta',
      appVersion: '0.1.0',
      getWindow: () => destroyed,
      createUpdater: () => fake.updater,
    });
    await expect(service.checkForUpdates()).resolves.toBeDefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('periodic checks run and stop cleanly', async () => {
    vi.useFakeTimers();
    const service = makeService();
    service.startPeriodicChecks(1000);
    await vi.advanceTimersByTimeAsync(3500);
    expect(fake.checkForUpdates).toHaveBeenCalledTimes(3);

    service.stopPeriodicChecks();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fake.checkForUpdates).toHaveBeenCalledTimes(3);
  });

  it('startPeriodicChecks is idempotent (restarts, does not double-fire)', async () => {
    vi.useFakeTimers();
    const service = makeService();
    service.startPeriodicChecks(1000);
    service.startPeriodicChecks(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fake.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('dispose stops timers and drops the cached updater', async () => {
    vi.useFakeTimers();
    const service = makeService();
    await service.checkForUpdates();
    service.startPeriodicChecks(1000);
    service.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fake.checkForUpdates).toHaveBeenCalledTimes(1);
  });
});
