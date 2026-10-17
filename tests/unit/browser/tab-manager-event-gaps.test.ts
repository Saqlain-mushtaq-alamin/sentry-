import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => {
  class WebContentsViewMock {
    static instances: WebContentsViewMock[] = [];
    webContents: any;
    setBounds = vi.fn();

    constructor(_opts?: unknown) {
      this.webContents = {
        loadURL: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        canGoBack: vi.fn().mockReturnValue(false),
        canGoForward: vi.fn().mockReturnValue(false),
        goBack: vi.fn(),
        goForward: vi.fn(),
        reload: vi.fn(),
        stop: vi.fn(),
        setZoomFactor: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        capturePage: vi.fn().mockResolvedValue({ toJPEG: () => Buffer.from('jpeg-frame') }),
        id: WebContentsViewMock.instances.length + 1,
      };
      WebContentsViewMock.instances.push(this);
    }
  }

  return {
    BrowserWindow: class {},
    WebContentsView: WebContentsViewMock,
  };
});

import { BrowserWindow, WebContentsView } from 'electron';
import { TabManager } from '../../../src/main/browser/tab-manager';
import { StorageManager } from '../../../src/main/browser/storage-manager';

type ViewMock = InstanceType<typeof WebContentsView>;

describe('TabManager webContents event handlers', () => {
  let mockWindow: any;
  let mockStorage: {
    getSettings: ReturnType<typeof vi.fn>;
    addHistoryEntry: ReturnType<typeof vi.fn>;
  };
  let tabManager: TabManager;

  beforeEach(() => {
    (WebContentsView as any).instances.length = 0;

    mockWindow = {
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      webContents: { send: vi.fn() },
      getContentBounds: vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
      isDestroyed: vi.fn(() => false),
      on: vi.fn(),
    };

    mockStorage = {
      getSettings: vi.fn(() => ({
        searchEngine: 'google',
        startupBehavior: 'newtab',
        theme: 'dark',
        showBookmarksBar: false,
        defaultDownloadPath: '',
        askDownloadPath: false,
      })),
      addHistoryEntry: vi.fn(),
    };

    tabManager = new TabManager(
      mockWindow as unknown as BrowserWindow,
      mockStorage as unknown as StorageManager,
    );
  });

  function getView(tabId: string): ViewMock {
    return tabManager.getView(tabId) as unknown as ViewMock;
  }

  function getHandler(view: ViewMock, event: string): ((...args: any[]) => void) | undefined {
    const call = (view.webContents.on as any).mock.calls.find((c: any[]) => c[0] === event);
    return call?.[1];
  }

  describe('did-navigate', () => {
    it('updates the tab url, pushes history and records a history entry', () => {
      const tab = tabManager.createTab('https://a.com');
      const handler = getHandler(getView(tab.id), 'did-navigate');

      handler?.(null, 'https://example.com/landed');

      expect(tab.url).toBe('https://example.com/landed');
      expect(tab.canGoBack).toBe(true); // new history entry after the initial url
      expect(mockStorage.addHistoryEntry).toHaveBeenCalledWith('https://example.com/landed', tab.title, undefined);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('tabs:updated', expect.any(Array));
    });

    it('does not duplicate history when navigating back to the current history url', () => {
      const tab = tabManager.createTab('https://a.com');
      const handler = getHandler(getView(tab.id), 'did-navigate');

      handler?.(null, 'https://a.com');
      handler?.(null, 'https://a.com');

      expect(tab.canGoBack).toBe(false);
    });
  });

  describe('did-navigate-in-page', () => {
    it('tracks in-page url changes without a browser-level navigation', () => {
      const tab = tabManager.createTab('https://a.com');
      const handler = getHandler(getView(tab.id), 'did-navigate-in-page');

      handler?.(null, 'https://a.com/app#settings');

      expect(tab.url).toBe('https://a.com/app#settings');
      expect(tab.canGoBack).toBe(true);
    });
  });

  describe('page-title-updated', () => {
    it('stores the new title and appends a history entry', () => {
      const tab = tabManager.createTab('https://a.com');
      const handler = getHandler(getView(tab.id), 'page-title-updated');

      handler?.(null, 'Example Domain');

      expect(tab.title).toBe('Example Domain');
      expect(mockStorage.addHistoryEntry).toHaveBeenCalledWith('https://a.com', 'Example Domain', undefined);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('tabs:updated', expect.any(Array));
    });
  });

  describe('page-favicon-updated', () => {
    it('stores the first favicon url on the tab', () => {
      const tab = tabManager.createTab('https://a.com');
      const handler = getHandler(getView(tab.id), 'page-favicon-updated');

      handler?.(null, ['https://cdn.example.com/favicon.png']);

      expect((tab as any).favicon).toBe('https://cdn.example.com/favicon.png');
    });

    it('ignores empty favicon updates', () => {
      const tab = tabManager.createTab('https://a.com');
      const handler = getHandler(getView(tab.id), 'page-favicon-updated');

      handler?.(null, []);
      handler?.(null, undefined);

      expect((tab as any).favicon).toBeUndefined();
    });
  });

  describe('loading flags', () => {
    it('did-start-loading marks the tab as loading', () => {
      const tab = tabManager.createTab('https://a.com');
      tab.isLoading = false;
      const handler = getHandler(getView(tab.id), 'did-start-loading');

      handler?.();

      expect(tab.isLoading).toBe(true);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('tabs:updated', expect.any(Array));
    });

    it('did-stop-loading clears the flag and refreshes nav state', () => {
      const tab = tabManager.createTab('https://a.com');
      tab.isLoading = true;
      const handler = getHandler(getView(tab.id), 'did-stop-loading');

      handler?.();

      expect(tab.isLoading).toBe(false);
    });

    it('does nothing when the tab was closed before the event fired', () => {
      const tab = tabManager.createTab('https://a.com');
      const startHandler = getHandler(getView(tab.id), 'did-start-loading');
      const stopHandler = getHandler(getView(tab.id), 'did-stop-loading');
      tabManager.closeTab(tab.id);
      (mockWindow.webContents.send as any).mockClear();

      expect(() => startHandler?.()).not.toThrow();
      expect(() => stopHandler?.()).not.toThrow();
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('before-input-event agent shortcuts', () => {
    function fireInput(view: ViewMock, input: Record<string, unknown>) {
      const handler = getHandler(view, 'before-input-event');
      const event = { preventDefault: vi.fn() };
      handler?.(event, input);
      return event;
    }

    it('Ctrl+Shift+Space toggles the agent command box', () => {
      const tab = tabManager.createTab('https://a.com');
      const event = fireInput(getView(tab.id), {
        type: 'keyDown',
        control: true,
        shift: true,
        code: 'Space',
        key: ' ',
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('agent:toggle-command-box');
    });

    it('Ctrl+Shift+P sends the pause/resume shortcut', () => {
      const tab = tabManager.createTab('https://a.com');
      const event = fireInput(getView(tab.id), { type: 'keyDown', control: true, shift: true, key: 'P' });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('agent:shortcut-pause-resume');
    });

    it('Ctrl+Shift+S sends the stop shortcut', () => {
      const tab = tabManager.createTab('https://a.com');
      const event = fireInput(getView(tab.id), { type: 'keyDown', control: true, shift: true, key: 's' });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('agent:shortcut-stop');
    });

    it('ignores key-up events and unrelated combinations', () => {
      const tab = tabManager.createTab('https://a.com');
      (mockWindow.webContents.send as any).mockClear();

      const keyUp = fireInput(getView(tab.id), { type: 'keyUp', control: true, shift: true, key: 'P' });
      const unrelated = fireInput(getView(tab.id), { type: 'keyDown', control: false, shift: false, key: 'a' });

      expect(keyUp.preventDefault).not.toHaveBeenCalled();
      expect(unrelated.preventDefault).not.toHaveBeenCalled();
      expect(mockWindow.webContents.send).not.toHaveBeenCalledWith('agent:toggle-command-box');
      expect(mockWindow.webContents.send).not.toHaveBeenCalledWith('agent:shortcut-pause-resume');
      expect(mockWindow.webContents.send).not.toHaveBeenCalledWith('agent:shortcut-stop');
    });
  });
});
