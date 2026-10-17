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
        debugger: {
          isAttached: vi.fn().mockReturnValue(false),
          attach: vi.fn(),
          detach: vi.fn(),
          on: vi.fn(),
          sendCommand: vi.fn(),
        },
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

describe('TabManager', () => {
  let mockWindow: {
    contentView: { addChildView: ReturnType<typeof vi.fn>; removeChildView: ReturnType<typeof vi.fn> };
    webContents: { send: ReturnType<typeof vi.fn> };
    getContentBounds: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };
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

  function getResizeHandler(): () => void {
    const call = (mockWindow.on as any).mock.calls.find((c: any[]) => c[0] === 'resize');
    return call?.[1];
  }

  describe('createTab', () => {
    it('creates a tab and view, marks it active and loads http urls', () => {
      const tab = tabManager.createTab('https://example.com');

      expect(tab.url).toBe('https://example.com');
      expect(tab.isActive).toBe(true);
      expect(tab.isSleeping).toBe(false);
      expect(tabManager.getTabs()).toHaveLength(1);
      expect(tabManager.getActiveTab()?.id).toBe(tab.id);
      expect(tabManager.getView(tab.id)).toBeDefined();
      expect(getView(tab.id).webContents.loadURL).toHaveBeenCalledWith('https://example.com');
    });

    it('formats bare domains before loading them', () => {
      const tab = tabManager.createTab('example.com');
      expect(tab.url).toBe('https://example.com');
      expect(getView(tab.id).webContents.loadURL).toHaveBeenCalledWith('https://example.com');
    });

    it('opens the internal new tab page without calling loadURL for sentry:// urls', () => {
      const tab = tabManager.createTab();

      expect(tab.url).toBe('sentry://newtab');
      expect(tab.title).toBe('New Tab');
      expect(getView(tab.id).webContents.loadURL).not.toHaveBeenCalled();
    });

    it('creates a sentry://internal tab with its human title without loadURL', () => {
      const tab = tabManager.createTab('sentry://settings');

      expect(tab.title).toBe('Settings');
      expect(getView(tab.id).webContents.loadURL).not.toHaveBeenCalled();
    });
  });

  describe('lookups and switching', () => {
    it('getTabs / getActiveTab / getView return the expected objects', () => {
      const first = tabManager.createTab('https://a.com');
      const second = tabManager.createTab('https://b.com');

      expect(tabManager.getTabs().map((t) => t.id)).toEqual([first.id, second.id]);
      expect(tabManager.getAllTabs()).toHaveLength(2);
      expect(tabManager.getActiveTab()?.id).toBe(second.id);
      expect(tabManager.getView(first.id)).toBeDefined();
      expect(tabManager.getView('missing')).toBeUndefined();
    });

    it('switchTab detaches all views and re-adds the newly active one', () => {
      const first = tabManager.createTab('https://a.com');
      const second = tabManager.createTab('https://b.com');
      (mockWindow.contentView.removeChildView as any).mockClear();
      (mockWindow.contentView.addChildView as any).mockClear();

      tabManager.switchTab(first.id);

      expect(tabManager.getActiveTab()?.id).toBe(first.id);
      expect(first.isActive).toBe(true);
      expect(second.isActive).toBe(false);
      expect(mockWindow.contentView.removeChildView).toHaveBeenCalled();
      expect(mockWindow.contentView.addChildView).toHaveBeenCalledWith(getView(first.id));
      expect(getView(first.id).setBounds).toHaveBeenCalledWith({
        x: 0,
        y: 82,
        width: 1200,
        height: 680, // 800 - topOffset 82 - bottomOffset 38
      });
    });

    it('switchTab does not add a view for internal sentry:// tabs', () => {
      const internal = tabManager.createTab('sentry://bookmarks');
      (mockWindow.contentView.addChildView as any).mockClear();

      tabManager.switchTab(internal.id);

      expect(mockWindow.contentView.addChildView).not.toHaveBeenCalled();
    });

    it('switchTab ignores unknown tab ids', () => {
      tabManager.createTab('https://a.com');
      expect(() => tabManager.switchTab('nope')).not.toThrow();
      expect(tabManager.getActiveTab()).not.toBeNull();
    });
  });

  describe('closeTab', () => {
    it('removes the tab, its view and its history entry', () => {
      const first = tabManager.createTab('https://a.com');
      const second = tabManager.createTab('https://b.com');
      const firstView = getView(first.id);

      tabManager.closeTab(first.id);

      expect(tabManager.getTabs().map((t) => t.id)).toEqual([second.id]);
      expect(tabManager.getView(first.id)).toBeUndefined();
      expect(mockWindow.contentView.removeChildView).toHaveBeenCalledWith(firstView);
      // closing a background tab activates the remaining one
      expect(tabManager.getActiveTab()?.id).toBe(second.id);
    });

    it('auto-creates a fresh new tab when the last tab is closed', () => {
      const only = tabManager.createTab('https://a.com');

      tabManager.closeTab(only.id);

      const tabs = tabManager.getTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0]!.id).not.toBe(only.id);
      expect(tabs[0]!.url).toBe('sentry://newtab');
      expect(tabs[0]!.isActive).toBe(true);
    });

    it('ignores unknown tab ids', () => {
      tabManager.createTab('https://a.com');
      expect(() => tabManager.closeTab('missing')).not.toThrow();
      expect(tabManager.getTabs()).toHaveLength(1);
    });
  });

  describe('navigation', () => {
    it('navigate formats the url, updates history and calls loadURL', () => {
      const tab = tabManager.createTab('https://a.com');

      tabManager.navigate(tab.id, 'example.com/page');

      expect(tab.url).toBe('https://example.com/page');
      expect(tab.isLoading).toBe(true);
      expect(getView(tab.id).webContents.loadURL).toHaveBeenCalledWith('https://example.com/page');
    });

    it('navigate to a sentry:// page detaches the view and skips loadURL', () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      const loadCallsBefore = (view.webContents.loadURL as any).mock.calls.length;

      tabManager.navigate(tab.id, 'sentry://downloads');

      expect(tab.url).toBe('sentry://downloads');
      expect(tab.title).toBe('Downloads');
      expect(tab.isLoading).toBe(false);
      expect(mockWindow.contentView.removeChildView).toHaveBeenCalledWith(view);
      expect((view.webContents.loadURL as any).mock.calls.length).toBe(loadCallsBefore);
    });

    it('navigate ignores unknown tab ids', () => {
      expect(() => tabManager.navigate('missing', 'https://example.com')).not.toThrow();
    });

    it('goBack walks the internal tab history and reloads via loadURL', () => {
      const tab = tabManager.createTab('https://a.com');
      tabManager.navigate(tab.id, 'https://b.com');

      tabManager.goBack(tab.id);

      expect(tab.url).toBe('https://a.com');
      expect(getView(tab.id).webContents.loadURL).toHaveBeenCalledWith('https://a.com');
      expect(tab.canGoBack).toBe(false);
      expect(tab.canGoForward).toBe(true);
    });

    it('goBack falls back to webContents.goBack when internal history is exhausted', () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      view.webContents.canGoBack.mockReturnValue(true);

      tabManager.goBack(tab.id);

      expect(view.webContents.goBack).toHaveBeenCalled();
      expect(tab.url).toBe('https://a.com');
    });

    it('goBack does nothing when neither internal history nor webContents can go back', () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);

      tabManager.goBack(tab.id);

      expect(view.webContents.goBack).not.toHaveBeenCalled();
    });

    it('goForward walks forward through the internal history', () => {
      const tab = tabManager.createTab('https://a.com');
      tabManager.navigate(tab.id, 'https://b.com');
      tabManager.goBack(tab.id);

      tabManager.goForward(tab.id);

      expect(tab.url).toBe('https://b.com');
      expect(getView(tab.id).webContents.loadURL).toHaveBeenCalledWith('https://b.com');
    });

    it('goForward falls back to webContents.goForward when internal forward entries are exhausted', () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      view.webContents.canGoForward.mockReturnValue(true);

      tabManager.goForward(tab.id);

      expect(view.webContents.goForward).toHaveBeenCalled();
    });

    it('reload restarts a finished page via webContents.reload', () => {
      const tab = tabManager.createTab('https://a.com');
      tab.isLoading = false;

      tabManager.reload(tab.id);

      expect(getView(tab.id).webContents.reload).toHaveBeenCalled();
    });

    it('reload stops an in-flight page load instead of restarting it', () => {
      const tab = tabManager.createTab('https://a.com');
      tabManager.navigate(tab.id, 'https://b.com'); // sets isLoading = true
      const view = getView(tab.id);

      tabManager.reload(tab.id);

      expect(view.webContents.stop).toHaveBeenCalled();
      expect(view.webContents.reload).not.toHaveBeenCalled();
      expect(tab.isLoading).toBe(false);
    });

    it('reload of an internal sentry:// tab notifies the window renderer', () => {
      const tab = tabManager.createTab('sentry://newtab');

      tabManager.reload(tab.id);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('tabs:reload-internal', 'sentry://newtab');
    });
  });

  describe('reorder / duplicate / pin', () => {
    it('reorderTabs applies the given order and drops ids not mentioned', () => {
      const a = tabManager.createTab('https://a.com');
      const b = tabManager.createTab('https://b.com');
      const c = tabManager.createTab('https://c.com');

      tabManager.reorderTabs([c.id, a.id]);

      expect(tabManager.getTabs().map((t) => t.id)).toEqual([c.id, a.id]);
      expect(tabManager.getTabs().some((t) => t.id === b.id)).toBe(false);
    });

    it('duplicateTab creates a new tab pointing at the same url', () => {
      const tab = tabManager.createTab('https://a.com');

      const copy = tabManager.duplicateTab(tab.id);

      expect(copy.id).not.toBe(tab.id);
      expect(copy.url).toBe('https://a.com');
      expect(tabManager.getTabs()).toHaveLength(2);
    });

    it('duplicateTab on an unknown id opens a new-tab page', () => {
      const copy = tabManager.duplicateTab('missing');

      expect(copy.url).toBe('sentry://newtab');
    });

    it('togglePinTab flips the pinned flag and notifies', () => {
      const tab = tabManager.createTab('https://a.com');

      tabManager.togglePinTab(tab.id);
      expect(tab.isPinned).toBe(true);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('tabs:updated', expect.any(Array));

      tabManager.togglePinTab(tab.id);
      expect(tab.isPinned).toBe(false);
    });

    it('togglePinTab ignores unknown ids', () => {
      expect(() => tabManager.togglePinTab('missing')).not.toThrow();
    });
  });

  describe('unloadTab / wakeTab', () => {
    it('unloads a background tab: drops the view and marks it sleeping', () => {
      tabManager.createTab('https://a.com'); // active
      const background = tabManager.createTab('https://b.com'); // becomes active
      const first = tabManager.getTabs()[0]!;
      tabManager.switchTab(background.id);
      const view = getView(first.id);

      const ok = tabManager.unloadTab(first.id);

      expect(ok).toBe(true);
      expect(first.isSleeping).toBe(true);
      expect(tabManager.getView(first.id)).toBeUndefined();
      expect(mockWindow.contentView.removeChildView).toHaveBeenCalledWith(view);
    });

    it('refuses to unload the active tab', () => {
      const tab = tabManager.createTab('https://a.com');

      expect(tabManager.unloadTab(tab.id)).toBe(false);
      expect(tab.isSleeping).toBe(false);
    });

    it('refuses to unload internal sentry:// tabs', () => {
      tabManager.createTab('https://a.com');
      const internal = tabManager.createTab('sentry://history');
      tabManager.switchTab(tabManager.getTabs()[0]!.id);

      expect(tabManager.unloadTab(internal.id)).toBe(false);
      expect(internal.isSleeping).toBe(false);
    });

    it('refuses to unload a tab that is already sleeping', () => {
      tabManager.createTab('https://a.com');
      const background = tabManager.createTab('https://b.com');
      const first = tabManager.getTabs()[0]!;
      tabManager.switchTab(background.id);
      tabManager.unloadTab(first.id);

      expect(tabManager.unloadTab(first.id)).toBe(false);
    });

    it('refuses to unload an unknown tab', () => {
      expect(tabManager.unloadTab('missing')).toBe(false);
    });

    it('wakeTab recreates the view and reloads the stored url', () => {
      tabManager.createTab('https://a.com');
      const background = tabManager.createTab('https://b.com');
      const first = tabManager.getTabs()[0]!;
      tabManager.switchTab(background.id);
      const oldView = getView(first.id);
      tabManager.unloadTab(first.id);

      tabManager.wakeTab(first.id);

      expect(first.isSleeping).toBe(false);
      const newView = getView(first.id);
      expect(newView).toBeDefined();
      expect(newView).not.toBe(oldView);
      expect(newView.webContents.loadURL).toHaveBeenCalledWith('https://a.com');
    });

    it('wakeTab skips view recreation for internal sentry:// tabs', () => {
      tabManager.createTab('https://a.com');
      const internal = tabManager.createTab('sentry://settings');
      tabManager.switchTab(tabManager.getTabs()[0]!.id);
      // force the internal tab to look sleeping without a view
      internal.isSleeping = true;
      (tabManager as any).views.delete(internal.id);

      tabManager.wakeTab(internal.id);

      expect(internal.isSleeping).toBe(false);
      expect(tabManager.getView(internal.id)).toBeUndefined();
    });

    it('wakeTab is a no-op for unknown tabs and already-awake tabs with a view', () => {
      const tab = tabManager.createTab('https://a.com');

      expect(() => tabManager.wakeTab('missing')).not.toThrow();
      tabManager.wakeTab(tab.id); // awake + has view
      expect(tabManager.getTabs()).toHaveLength(1);
    });

    it('switchTab automatically wakes a sleeping tab', () => {
      tabManager.createTab('https://a.com');
      const background = tabManager.createTab('https://b.com');
      const first = tabManager.getTabs()[0]!;
      tabManager.switchTab(background.id);
      tabManager.unloadTab(first.id);

      tabManager.switchTab(first.id);

      expect(tabManager.getActiveTab()?.id).toBe(first.id);
      expect(first.isSleeping).toBe(false);
      expect(tabManager.getView(first.id)).toBeDefined();
    });
  });

  describe('setHidden', () => {
    it('captures a jpeg frame and detaches the view when hiding', async () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);

      const frame = await tabManager.setHidden(true);

      expect(frame).toMatch(/^data:image\/jpeg;base64,/);
      expect(view.webContents.capturePage).toHaveBeenCalled();
      expect(mockWindow.contentView.removeChildView).toHaveBeenCalledWith(view);
    });

    it('returns null and skips capture for internal sentry:// tabs', async () => {
      const tab = tabManager.createTab('sentry://newtab');

      expect(await tabManager.setHidden(true)).toBeNull();
      expect(await tabManager.setHidden(false)).toBeNull();
    });

    it('re-attaches the view and restores bounds when showing again', async () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      await tabManager.setHidden(true);
      (mockWindow.contentView.addChildView as any).mockClear();
      (view.setBounds as any).mockClear();

      expect(await tabManager.setHidden(false)).toBeNull();

      expect(mockWindow.contentView.addChildView).toHaveBeenCalledWith(view);
      expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 82, width: 1200, height: 680 });
    });

    it('returns null when there is no active tab', async () => {
      expect(await tabManager.setHidden(true)).toBeNull();
    });
  });

  describe('layout bounds', () => {
    it('derives bounds from window.getContentBounds minus layout offsets', () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      (view.setBounds as any).mockClear();

      tabManager.updateActiveViewBounds();

      expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 82, width: 1200, height: 680 });
    });

    it('setLayoutOffsets recomputes the active view bounds', () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      (view.setBounds as any).mockClear();

      tabManager.setLayoutOffsets({ topOffset: 100, rightOffset: 50 });

      expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 100, width: 1150, height: 662 });
    });

    it('uses a 112px top offset when the bookmarks bar is shown', () => {
      mockStorage.getSettings.mockReturnValue({
        searchEngine: 'google',
        startupBehavior: 'newtab',
        theme: 'dark',
        showBookmarksBar: true,
        defaultDownloadPath: '',
        askDownloadPath: false,
      });
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      (view.setBounds as any).mockClear();

      tabManager.updateActiveViewBounds();

      expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 112, width: 1200, height: 650 });
    });

    it('clamps width and height to a minimum of 100px', () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      mockWindow.getContentBounds.mockReturnValue({ x: 0, y: 0, width: 120, height: 150 });
      (view.setBounds as any).mockClear();

      tabManager.updateActiveViewBounds();

      // width stays 120 (above the minimum); height clamps up from 30 to 100
      expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 82, width: 120, height: 100 });
    });

    it('setContentBounds overrides the computed bounds entirely', () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      (view.setBounds as any).mockClear();

      tabManager.setContentBounds({ x: 5.4, y: 15.6, width: 600.2, height: 300.7 });

      expect(view.setBounds).toHaveBeenCalledWith({ x: 5, y: 16, width: 600, height: 301 });
    });

    it('recomputes bounds on window resize', () => {
      const tab = tabManager.createTab('https://a.com');
      const view = getView(tab.id);
      mockWindow.getContentBounds.mockReturnValue({ x: 0, y: 0, width: 1000, height: 600 });
      (view.setBounds as any).mockClear();

      getResizeHandler()();

      expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 82, width: 1000, height: 480 });
    });

    it('does not touch bounds for internal sentry:// tabs or hidden views', async () => {
      const internal = tabManager.createTab('sentry://newtab');
      const internalView = getView(internal.id);
      (internalView.setBounds as any).mockClear();

      tabManager.updateActiveViewBounds();
      expect(internalView.setBounds).not.toHaveBeenCalled();

      const web = tabManager.createTab('https://a.com');
      const webView = getView(web.id);
      await tabManager.setHidden(true);
      (webView.setBounds as any).mockClear();

      tabManager.updateActiveViewBounds();
      expect(webView.setBounds).not.toHaveBeenCalled();
    });
  });

  describe('trackInteraction', () => {
    it('refreshes the last-interaction timestamp used by the unload logic', () => {
      const tab = tabManager.createTab('https://a.com');
      tab.lastInteraction = 0;

      tabManager.trackInteraction(tab.id);

      expect(tab.lastInteraction).toBeGreaterThan(0);
    });

    it('ignores unknown tab ids', () => {
      expect(() => tabManager.trackInteraction('missing')).not.toThrow();
    });

    it('leaves background tabs untouched when tracking the active one', () => {
      const background = tabManager.createTab('https://a.com');
      background.lastInteraction = 0;
      const active = tabManager.createTab('https://b.com');

      tabManager.trackInteraction(active.id);

      expect(background.lastInteraction).toBe(0);
      expect(active.lastInteraction).toBeGreaterThan(0);
    });
  });

  it('sends tabs:updated to the window whenever the tab list changes', () => {
    tabManager.createTab('https://a.com');

    expect(mockWindow.webContents.send).toHaveBeenCalledWith('tabs:updated', expect.any(Array));
  });
});
