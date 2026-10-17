import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';

vi.mock('electron', () => ({
  BrowserWindow: class {},
  shell: {
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
    openExternal: vi.fn(),
  },
}));

import { BrowserWindow, shell } from 'electron';
import { DownloadManager } from '../../../src/main/browser/download-manager';
import { ResourceManager } from '../../../src/main/browser/resource-manager';
import { SpeechToText } from '../../../src/main/voice/speech-to-text';
import { TextToSpeech } from '../../../src/main/voice/text-to-speech';

type DownloadHandler = (event: unknown, item: unknown, wc: unknown) => void;

function makeWindowWithSession() {
  const willDownloadHandlers: DownloadHandler[] = [];
  const win = {
    webContents: {
      session: {
        on: vi.fn((event: string, handler: DownloadHandler) => {
          if (event === 'will-download') willDownloadHandlers.push(handler);
        }),
      },
      send: vi.fn(),
    },
    isDestroyed: vi.fn(() => false),
  };
  return { win, willDownloadHandlers };
}

function makeStorage(settingsOverrides: Record<string, unknown> = {}) {
  return {
    getSettings: vi.fn(() => ({
      askDownloadPath: false,
      defaultDownloadPath: '',
      ...settingsOverrides,
    })),
    addDownload: vi.fn(),
    updateDownload: vi.fn(),
    getDownloads: vi.fn(() => [{ id: 'dl-1', filename: 'file.pdf' }]),
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const onceHandlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    item: {
      getFilename: vi.fn(() => 'file.pdf'),
      getSavePath: vi.fn(() => '/tmp/file.pdf'),
      getTotalBytes: vi.fn(() => 1234),
      getURL: vi.fn(() => 'https://example.com/file.pdf'),
      getReceivedBytes: vi.fn(() => 500),
      isPaused: vi.fn(() => false),
      setSavePath: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers[event] = handler;
      }),
      once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        onceHandlers[event] = handler;
      }),
      ...overrides,
    },
    handlers,
    onceHandlers,
  };
}

describe('DownloadManager', () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = makeStorage();
  });

  it('hooks a will-download listener on the window webContents session', () => {
    const { win, willDownloadHandlers } = makeWindowWithSession();

    new DownloadManager(win as unknown as BrowserWindow, storage as any);

    expect(win.webContents.session.on).toHaveBeenCalledWith('will-download', expect.any(Function));
    expect(willDownloadHandlers).toHaveLength(1);
  });

  it('records a new download in storage when will-download fires', () => {
    const { win, willDownloadHandlers } = makeWindowWithSession();
    new DownloadManager(win as unknown as BrowserWindow, storage as any);
    const { item } = makeItem();

    willDownloadHandlers[0]!({}, item, {});

    expect(storage.addDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'file.pdf',
        url: 'https://example.com/file.pdf',
        totalBytes: 1234,
        receivedBytes: 0,
        state: 'progressing',
      }),
    );
  });

  it('sets a custom save path when askDownloadPath is off and a default path is configured', () => {
    const customStorage = makeStorage({ defaultDownloadPath: path.join(os.tmpdir(), 'dl') });
    const { win, willDownloadHandlers } = makeWindowWithSession();
    new DownloadManager(win as unknown as BrowserWindow, customStorage as any);
    const { item } = makeItem();

    willDownloadHandlers[0]!({}, item, {});

    expect(item.setSavePath).toHaveBeenCalledWith(path.join(os.tmpdir(), 'dl', 'file.pdf'));
  });

  it('does not force a save path when askDownloadPath is enabled', () => {
    const askStorage = makeStorage({ askDownloadPath: true, defaultDownloadPath: '/dl' });
    const { win, willDownloadHandlers } = makeWindowWithSession();
    new DownloadManager(win as unknown as BrowserWindow, askStorage as any);
    const { item } = makeItem();

    willDownloadHandlers[0]!({}, item, {});

    expect(item.setSavePath).not.toHaveBeenCalled();
  });

  it('updates progress on the updated event and notifies the renderer', () => {
    const { win, willDownloadHandlers } = makeWindowWithSession();
    new DownloadManager(win as unknown as BrowserWindow, storage as any);
    const { item, handlers } = makeItem();
    willDownloadHandlers[0]!({}, item, {});

    handlers['updated']!({}, 'progressing');

    expect(storage.updateDownload).toHaveBeenCalledWith(
      expect.stringMatching(/^dl-/),
      expect.objectContaining({ receivedBytes: 500, state: 'progressing' }),
    );
    expect(win.webContents.send).toHaveBeenCalledWith('downloads:updated', [
      { id: 'dl-1', filename: 'file.pdf' },
    ]);
  });

  it('marks paused downloads as interrupted', () => {
    const { win, willDownloadHandlers } = makeWindowWithSession();
    new DownloadManager(win as unknown as BrowserWindow, storage as any);
    const { item, handlers } = makeItem({ isPaused: vi.fn(() => true) });
    willDownloadHandlers[0]!({}, item, {});

    handlers['updated']!({}, 'progressing');

    expect(storage.updateDownload).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ state: 'interrupted' }),
    );
  });

  it('marks interrupted updates as interrupted', () => {
    const { win, willDownloadHandlers } = makeWindowWithSession();
    new DownloadManager(win as unknown as BrowserWindow, storage as any);
    const { item, handlers } = makeItem();
    willDownloadHandlers[0]!({}, item, {});

    handlers['updated']!({}, 'interrupted');

    expect(storage.updateDownload).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ state: 'interrupted' }),
    );
  });

  it('marks the download completed on the done event and notifies', () => {
    const { win, willDownloadHandlers } = makeWindowWithSession();
    new DownloadManager(win as unknown as BrowserWindow, storage as any);
    const { item, onceHandlers } = makeItem();
    willDownloadHandlers[0]!({}, item, {});

    onceHandlers['done']!({}, 'completed');

    expect(storage.updateDownload).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ receivedBytes: 500, state: 'completed', endTime: expect.any(Number) }),
    );
    expect(win.webContents.send).toHaveBeenCalledWith('downloads:updated', expect.any(Array));
  });

  it('marks the download cancelled for any non-completed done state', () => {
    const { win, willDownloadHandlers } = makeWindowWithSession();
    new DownloadManager(win as unknown as BrowserWindow, storage as any);
    const { item, onceHandlers } = makeItem();
    willDownloadHandlers[0]!({}, item, {});

    onceHandlers['done']!({}, 'cancelled');

    expect(storage.updateDownload).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ state: 'cancelled', endTime: expect.any(Number) }),
    );
  });

  it('does not notify the renderer when the window is destroyed', () => {
    const { win, willDownloadHandlers } = makeWindowWithSession();
    win.isDestroyed.mockReturnValue(true);
    new DownloadManager(win as unknown as BrowserWindow, storage as any);
    const { item, onceHandlers } = makeItem();
    willDownloadHandlers[0]!({}, item, {});

    onceHandlers['done']!({}, 'completed');

    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it('openFile delegates to shell.openPath for non-empty paths only', () => {
    const { win } = makeWindowWithSession();
    const dm = new DownloadManager(win as unknown as BrowserWindow, storage as any);

    dm.openFile('/tmp/file.pdf');
    dm.openFile('');

    expect(shell.openPath).toHaveBeenCalledTimes(1);
    expect(shell.openPath).toHaveBeenCalledWith('/tmp/file.pdf');
  });

  it('openFolder delegates to shell.showItemInFolder for non-empty paths only', () => {
    const { win } = makeWindowWithSession();
    const dm = new DownloadManager(win as unknown as BrowserWindow, storage as any);

    dm.openFolder('/tmp/file.pdf');
    dm.openFolder('');

    expect(shell.showItemInFolder).toHaveBeenCalledTimes(1);
    expect(shell.showItemInFolder).toHaveBeenCalledWith('/tmp/file.pdf');
  });
});

describe('ResourceManager', () => {
  let memorySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    memorySpy = vi.spyOn(process, 'memoryUsage');
    memorySpy.mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 1,
      heapUsed: 1,
      external: 1,
      arrayBuffers: 1,
    } as any);
  });

  afterEach(() => {
    memorySpy.mockRestore();
  });

  it('shouldThrottleNewTask is false under normal memory usage', () => {
    expect(new ResourceManager().shouldThrottleNewTask()).toBe(false);
  });

  it('shouldThrottleNewTask is true when rss exceeds 80% of total memory', () => {
    const total = os.totalmem() as number;
    memorySpy.mockReturnValue({
      rss: Math.floor(total * 0.9),
      heapTotal: 1,
      heapUsed: 1,
      external: 1,
      arrayBuffers: 1,
    } as any);

    expect(new ResourceManager().shouldThrottleNewTask()).toBe(true);
  });

  it('startMonitoring polls resources on an interval and stopMonitoring halts it', async () => {
    vi.useFakeTimers();
    try {
      const rm = new ResourceManager();
      rm.startMonitoring();

      await vi.advanceTimersByTimeAsync(5000);
      expect(memorySpy.mock.calls.length).toBeGreaterThanOrEqual(1);

      const callsAfterStart = memorySpy.mock.calls.length;
      rm.stopMonitoring();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(memorySpy.mock.calls.length).toBe(callsAfterStart);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SpeechToText', () => {
  const config = { engine: 'browser' as const, language: 'en', continuous: false };

  it('startListening flips the listening status on', async () => {
    const stt = new SpeechToText();
    expect(stt.getListeningStatus()).toBe(false);

    await stt.startListening(config);

    expect(stt.getListeningStatus()).toBe(true);
  });

  it('stopListening flips the listening status off', async () => {
    const stt = new SpeechToText();
    await stt.startListening(config);

    await stt.stopListening();

    expect(stt.getListeningStatus()).toBe(false);
  });

  it('emitTranscript notifies registered callbacks only while listening', async () => {
    const stt = new SpeechToText();
    const cb = vi.fn();
    stt.onTranscript(cb);

    stt.emitTranscript('before listening', true);
    expect(cb).not.toHaveBeenCalled();

    await stt.startListening(config);
    stt.emitTranscript('hello world', false);
    expect(cb).toHaveBeenCalledWith('hello world', false);

    await stt.stopListening();
    stt.emitTranscript('after stop', true);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('supports multiple transcript callbacks', async () => {
    const stt = new SpeechToText();
    const first = vi.fn();
    const second = vi.fn();
    stt.onTranscript(first);
    stt.onTranscript(second);
    await stt.startListening(config);

    stt.emitTranscript('both hear me', true);

    expect(first).toHaveBeenCalledWith('both hear me', true);
    expect(second).toHaveBeenCalledWith('both hear me', true);
  });
});

describe('TextToSpeech', () => {
  it('speak is a safe no-crash operation in the node environment', async () => {
    const tts = new TextToSpeech();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(tts.speak('hello there', 'normal')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();

    log.mockRestore();
  });

  it('stop is a safe no-crash operation in the node environment', async () => {
    const tts = new TextToSpeech();
    await expect(tts.stop()).resolves.toBeUndefined();
  });

  it('speak returns early without speaking when disabled via updateConfig', async () => {
    const tts = new TextToSpeech();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    tts.updateConfig({ enabled: false });
    await tts.speak('should not speak', 'normal');

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('updateConfig merges partial config over the defaults', async () => {
    const tts = new TextToSpeech();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    tts.updateConfig({ speed: 1.5, voice: 'custom' });
    await tts.speak('speedy', 'urgent');

    expect(log).toHaveBeenCalledWith('[TextToSpeech] (urgent) Speaking: "speedy"');
    log.mockRestore();
  });
});
