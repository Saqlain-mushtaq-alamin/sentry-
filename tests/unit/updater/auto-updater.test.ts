import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentryUpdater, AutoUpdaterLike } from '../../../src/main/updater/auto-updater';

describe('SentryUpdater (Phase 16 - Task 16.3)', () => {
  let fakeUpdater: AutoUpdaterLike;
  let listeners: Record<string, ((...args: any[]) => void)[]>;
  let mockWindow: any;

  beforeEach(() => {
    listeners = {};
    fakeUpdater = {
      autoDownload: true,
      autoInstallOnAppQuit: false,
      channel: 'latest',
      allowPrerelease: false,
      checkForUpdates: vi.fn().mockResolvedValue({ updateInfo: { version: '1.2.0' } }),
      downloadUpdate: vi.fn().mockResolvedValue(undefined),
      quitAndInstall: vi.fn(),
      on: vi.fn((event, handler) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
        return fakeUpdater;
      }),
    };

    mockWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: {
        send: vi.fn(),
      },
    };
  });

  function emit(event: string, ...args: any[]) {
    listeners[event]?.forEach((h) => h(...args));
  }

  it('configures autoDownload=false and autoInstallOnAppQuit=true on initialization', () => {
    const updater = new SentryUpdater({
      channel: 'stable',
      getWindow: () => mockWindow,
      createUpdater: () => fakeUpdater,
    });

    updater.initialize();

    expect(fakeUpdater.autoDownload).toBe(false);
    expect(fakeUpdater.autoInstallOnAppQuit).toBe(true);
    expect(updater.getChannel()).toBe('stable');
    updater.dispose();
  });

  it('handles update channels: stable, beta, canary', () => {
    const updater = new SentryUpdater({
      channel: 'beta',
      getWindow: () => mockWindow,
      createUpdater: () => fakeUpdater,
    });

    updater.initialize();
    expect(updater.getChannel()).toBe('beta');
    expect(fakeUpdater.channel).toBe('beta');

    updater.setChannel('canary');
    expect(updater.getChannel()).toBe('canary');
    expect(fakeUpdater.channel).toBe('canary');
    updater.dispose();
  });

  it('handles update-available, download-progress, and update-downloaded cycle', async () => {
    const updater = new SentryUpdater({
      channel: 'stable',
      getWindow: () => mockWindow,
      createUpdater: () => fakeUpdater,
    });
    updater.initialize();

    // Check updates
    await updater.checkForUpdates();
    expect(updater.getStatus().state).toBe('available');

    // Emit download progress
    emit('download-progress', { percent: 45, bytesPerSecond: 10240, transferred: 450, total: 1000 });
    expect(updater.getStatus().state).toBe('downloading');
    expect(updater.getStatus().progress?.percent).toBe(45);

    // Emit update-downloaded
    emit('update-downloaded', { version: '1.2.0' });
    expect(updater.getStatus().state).toBe('downloaded');

    // Quit and install
    updater.quitAndInstall();
    expect(fakeUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);

    updater.dispose();
  });

  it('handles errors cleanly', async () => {
    (fakeUpdater.checkForUpdates as any).mockRejectedValueOnce(new Error('Network offline'));
    const updater = new SentryUpdater({
      channel: 'stable',
      getWindow: () => mockWindow,
      createUpdater: () => fakeUpdater,
    });
    updater.initialize();

    await updater.checkForUpdates();
    expect(updater.getStatus().state).toBe('error');
    expect(updater.getStatus().error).toContain('Network offline');
    updater.dispose();
  });
});
