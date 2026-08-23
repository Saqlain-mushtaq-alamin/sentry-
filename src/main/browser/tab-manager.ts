import { BrowserWindow, WebContentsView } from 'electron';
import { TabItem } from '../../shared/types';
import { StorageManager } from './storage-manager';
import { NavigationManager } from './navigation-manager';

export class TabManager {
  private window: BrowserWindow;
  private storage: StorageManager;
  private tabs: Map<string, TabItem> = new Map();
  private views: Map<string, WebContentsView> = new Map();
  private tabOrder: string[] = [];
  private activeTabId: string | null = null;

  constructor(window: BrowserWindow, storage: StorageManager) {
    this.window = window;
    this.storage = storage;

    this.window.on('resize', () => {
      this.updateActiveViewBounds();
    });
  }

  public getTabs(): TabItem[] {
    return this.tabOrder.map((id) => this.tabs.get(id)!).filter(Boolean);
  }

  public getActiveTab(): TabItem | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  public getView(tabId: string): WebContentsView | undefined {
    return this.views.get(tabId);
  }

  public createTab(initialUrl?: string): TabItem {
    const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const settings = this.storage.getSettings();
    const formattedUrl = initialUrl
      ? NavigationManager.formatUrl(initialUrl, settings.searchEngine)
      : 'sentry://newtab';

    const tab: TabItem = {
      id,
      url: formattedUrl,
      title: formattedUrl === 'sentry://newtab' ? 'New Tab' : formattedUrl,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isActive: false,
      isPinned: false,
      zoomLevel: 1.0,
    };

    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
      },
    });

    this.setupViewEvents(id, view);

    this.tabs.set(id, tab);
    this.views.set(id, view);
    this.tabOrder.push(id);

    this.switchTab(id);

    if (!formattedUrl.startsWith('sentry://')) {
      view.webContents.loadURL(formattedUrl).catch((err) => console.error('Load URL failed:', err));
    }

    return tab;
  }

  public closeTab(id: string): void {
    if (!this.tabs.has(id)) return;

    const view = this.views.get(id);
    if (view) {
      try {
        this.window.contentView.removeChildView(view);
      } catch {
        // ignore if not attached
      }
      this.views.delete(id);
    }

    const index = this.tabOrder.indexOf(id);
    this.tabs.delete(id);
    this.tabOrder = this.tabOrder.filter((tId) => tId !== id);

    if (this.tabs.size === 0) {
      this.createTab();
      return;
    }

    if (this.activeTabId === id) {
      const nextIndex = Math.min(index, this.tabOrder.length - 1);
      const nextTabId = this.tabOrder[nextIndex];
      if (nextTabId) {
        this.switchTab(nextTabId);
      }
    } else {
      this.notifyTabsUpdated();
    }
  }

  public switchTab(id: string): void {
    if (!this.tabs.has(id)) return;

    // Detach all current child views
    this.views.forEach((view) => {
      try {
        this.window.contentView.removeChildView(view);
      } catch {
        // ignored
      }
    });

    this.activeTabId = id;
    this.tabs.forEach((t, tId) => {
      t.isActive = tId === id;
    });

    const activeTab = this.tabs.get(id);
    const activeView = this.views.get(id);

    if (activeTab && activeView && !activeTab.url.startsWith('sentry://')) {
      this.window.contentView.addChildView(activeView);
      this.updateActiveViewBounds();
    }

    this.notifyTabsUpdated();
  }

  public reorderTabs(newOrder: string[]): void {
    this.tabOrder = newOrder.filter((id) => this.tabs.has(id));
    this.notifyTabsUpdated();
  }

  public duplicateTab(id: string): TabItem {
    const existing = this.tabs.get(id);
    const url = existing ? existing.url : 'sentry://newtab';
    return this.createTab(url);
  }

  public togglePinTab(id: string): void {
    const tab = this.tabs.get(id);
    if (tab) {
      tab.isPinned = !tab.isPinned;
      this.notifyTabsUpdated();
    }
  }

  public navigate(id: string, rawUrl: string): void {
    const tab = this.tabs.get(id);
    const view = this.views.get(id);
    if (!tab || !view) return;

    const settings = this.storage.getSettings();
    const url = NavigationManager.formatUrl(rawUrl, settings.searchEngine);
    tab.url = url;

    if (url.startsWith('sentry://')) {
      try {
        this.window.contentView.removeChildView(view);
      } catch {
        // ignored
      }
      tab.title = this.getInternalTitle(url);
      tab.isLoading = false;
      this.notifyTabsUpdated();
    } else {
      if (id === this.activeTabId) {
        this.window.contentView.addChildView(view);
        this.updateActiveViewBounds();
      }
      tab.isLoading = true;
      this.notifyTabsUpdated();
      view.webContents.loadURL(url).catch((err) => console.error('Failed to navigate:', err));
    }
  }

  public goBack(id: string): void {
    const view = this.views.get(id);
    if (view && view.webContents.canGoBack()) {
      view.webContents.goBack();
    }
  }

  public goForward(id: string): void {
    const view = this.views.get(id);
    if (view && view.webContents.canGoForward()) {
      view.webContents.goForward();
    }
  }

  public reload(id: string): void {
    const view = this.views.get(id);
    const tab = this.tabs.get(id);
    if (view && tab && !tab.url.startsWith('sentry://')) {
      view.webContents.reload();
    }
  }

  public setZoom(id: string, level: number): void {
    const view = this.views.get(id);
    const tab = this.tabs.get(id);
    if (view && tab) {
      tab.zoomLevel = level;
      view.webContents.setZoomFactor(level);
      this.notifyTabsUpdated();
    }
  }

  private updateActiveViewBounds(): void {
    if (!this.activeTabId) return;
    const activeTab = this.tabs.get(this.activeTabId);
    const activeView = this.views.get(this.activeTabId);

    if (!activeTab || !activeView || activeTab.url.startsWith('sentry://')) return;

    const bounds = this.window.getContentBounds();
    const settings = this.storage.getSettings();
    const topOffset = settings.showBookmarksBar ? 112 : 82;

    activeView.setBounds({
      x: 0,
      y: topOffset,
      width: bounds.width,
      height: Math.max(100, bounds.height - topOffset),
    });
  }

  private setupViewEvents(tabId: string, view: WebContentsView): void {
    const wc = view.webContents;

    wc.on('did-start-loading', () => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.isLoading = true;
        this.notifyTabsUpdated();
      }
    });

    wc.on('did-stop-loading', () => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.isLoading = false;
        tab.canGoBack = wc.canGoBack();
        tab.canGoForward = wc.canGoForward();
        this.notifyTabsUpdated();
      }
    });

    wc.on('page-title-updated', (_evt, title) => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.title = title;
        this.storage.addHistoryEntry(tab.url, title, tab.favicon);
        this.notifyTabsUpdated();
      }
    });

    wc.on('page-favicon-updated', (_evt, favicons) => {
      const tab = this.tabs.get(tabId);
      if (tab && favicons && favicons.length > 0 && favicons[0]) {
        tab.favicon = favicons[0];
        this.notifyTabsUpdated();
      }
    });

    wc.on('did-navigate', (_evt, url) => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.url = url;
        tab.canGoBack = wc.canGoBack();
        tab.canGoForward = wc.canGoForward();
        this.storage.addHistoryEntry(url, tab.title, tab.favicon);
        this.notifyTabsUpdated();
      }
    });

    wc.on('did-navigate-in-page', (_evt, url) => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.url = url;
        tab.canGoBack = wc.canGoBack();
        tab.canGoForward = wc.canGoForward();
        this.notifyTabsUpdated();
      }
    });
  }

  private getInternalTitle(url: string): string {
    switch (url) {
      case 'sentry://settings':
        return 'Settings';
      case 'sentry://history':
        return 'History';
      case 'sentry://bookmarks':
        return 'Bookmarks';
      case 'sentry://downloads':
        return 'Downloads';
      case 'sentry://newtab':
      default:
        return 'New Tab';
    }
  }

  private notifyTabsUpdated(): void {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send('tabs:updated', this.getTabs());
    }
  }
}
