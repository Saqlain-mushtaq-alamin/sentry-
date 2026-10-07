import { BrowserWindow, WebContentsView } from 'electron';
import { TabItem } from '../../shared/types';
import { StorageManager } from './storage-manager';
import { NavigationManager } from './navigation-manager';

export interface LayoutOffsets {
  topOffset: number;
  bottomOffset: number;
  rightOffset: number;
}

export class TabManager {
  private window: BrowserWindow;
  private storage: StorageManager;
  private tabs: Map<string, TabItem> = new Map();
  private views: Map<string, WebContentsView> = new Map();
  private tabOrder: string[] = [];
  private activeTabId: string | null = null;
  private tabHistory: Map<string, { entries: string[]; currentIndex: number }> = new Map();
  private layoutOffsets: LayoutOffsets = {
    topOffset: 82,
    bottomOffset: 38, // Reserve space for the agent command bar dock
    rightOffset: 0,
  };
  private contentBounds: { x: number; y: number; width: number; height: number } | null = null;
  private isViewHidden = false;
  private isNavigatingHistory = false;

  constructor(window: BrowserWindow, storage: StorageManager) {
    this.window = window;
    this.storage = storage;

    this.window.on('resize', () => {
      this.updateActiveViewBounds();
    });
  }

  public setContentBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.contentBounds = bounds;
    this.updateActiveViewBounds();
  }

  public setHidden(hidden: boolean): void {
    this.isViewHidden = hidden;
    if (!this.activeTabId) return;
    const activeView = this.views.get(this.activeTabId);
    const activeTab = this.tabs.get(this.activeTabId);
    if (!activeView || !activeTab || activeTab.url.startsWith('sentry://')) return;

    if (hidden) {
      try {
        this.window.contentView.removeChildView(activeView);
      } catch {
        // ignored
      }
    } else {
      try {
        this.window.contentView.addChildView(activeView);
      } catch {
        // ignored
      }
      this.updateActiveViewBounds();
    }
  }

  public setLayoutOffsets(offsets: Partial<LayoutOffsets>): void {
    this.layoutOffsets = { ...this.layoutOffsets, ...offsets };
    this.updateActiveViewBounds();
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

    this.tabHistory.set(id, { entries: [formattedUrl], currentIndex: 0 });
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
    this.tabHistory.delete(id);
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
      if (!this.isViewHidden) {
        try {
          this.window.contentView.addChildView(activeView);
        } catch {
          // ignored
        }
        this.updateActiveViewBounds();
      }
    }

    this.updateTabNavState(id);
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

  public navigate(id: string, rawUrl: string, fromHistory = false): void {
    const tab = this.tabs.get(id);
    const view = this.views.get(id);
    if (!tab || !view) return;

    const settings = this.storage.getSettings();
    const url = NavigationManager.formatUrl(rawUrl, settings.searchEngine);
    tab.url = url;

    if (!fromHistory) {
      const hist = this.tabHistory.get(id);
      if (hist) {
        if (hist.entries[hist.currentIndex] !== url) {
          hist.entries = hist.entries.slice(0, hist.currentIndex + 1);
          hist.entries.push(url);
          hist.currentIndex = hist.entries.length - 1;
        }
      }
    }

    if (url.startsWith('sentry://')) {
      try {
        this.window.contentView.removeChildView(view);
      } catch {
        // ignored
      }
      tab.title = this.getInternalTitle(url);
      tab.isLoading = false;
      this.updateTabNavState(id);
      this.notifyTabsUpdated();
    } else {
      if (id === this.activeTabId && !this.isViewHidden) {
        try {
          this.window.contentView.addChildView(view);
        } catch {
          // ignored
        }
        this.updateActiveViewBounds();
      }
      tab.isLoading = true;
      this.updateTabNavState(id);
      this.notifyTabsUpdated();
      view.webContents.loadURL(url).catch((err) => console.error('Failed to navigate:', err));
    }
  }

  public goBack(id: string): void {
    const tab = this.tabs.get(id);
    const view = this.views.get(id);
    const hist = this.tabHistory.get(id);
    if (!tab) return;

    if (hist && hist.currentIndex > 0) {
      this.isNavigatingHistory = true;
      hist.currentIndex--;
      const targetUrl = hist.entries[hist.currentIndex]!;
      this.navigate(id, targetUrl, true);
      this.isNavigatingHistory = false;
      return;
    }

    if (view && view.webContents.canGoBack()) {
      view.webContents.goBack();
      this.updateTabNavState(id);
    }
  }

  public goForward(id: string): void {
    const tab = this.tabs.get(id);
    const view = this.views.get(id);
    const hist = this.tabHistory.get(id);
    if (!tab) return;

    if (hist && hist.currentIndex < hist.entries.length - 1) {
      this.isNavigatingHistory = true;
      hist.currentIndex++;
      const targetUrl = hist.entries[hist.currentIndex]!;
      this.navigate(id, targetUrl, true);
      this.isNavigatingHistory = false;
      return;
    }

    if (view && view.webContents.canGoForward()) {
      view.webContents.goForward();
      this.updateTabNavState(id);
    }
  }

  public reload(id: string): void {
    const view = this.views.get(id);
    const tab = this.tabs.get(id);
    if (!tab) return;

    if (tab.isLoading && view) {
      view.webContents.stop();
      tab.isLoading = false;
      this.notifyTabsUpdated();
      return;
    }

    if (tab.url.startsWith('sentry://')) {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send('tabs:reload-internal', tab.url);
      }
      tab.isLoading = false;
      this.notifyTabsUpdated();
    } else if (view) {
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

  public updateActiveViewBounds(): void {
    if (!this.activeTabId) return;
    const activeTab = this.tabs.get(this.activeTabId);
    const activeView = this.views.get(this.activeTabId);

    if (!activeTab || !activeView || activeTab.url.startsWith('sentry://') || this.isViewHidden) return;

    if (this.contentBounds) {
      activeView.setBounds({
        x: Math.round(this.contentBounds.x),
        y: Math.round(this.contentBounds.y),
        width: Math.max(0, Math.round(this.contentBounds.width)),
        height: Math.max(0, Math.round(this.contentBounds.height)),
      });
      return;
    }

    const bounds = this.window.getContentBounds();
    const settings = this.storage.getSettings();
    const topOffset = settings.showBookmarksBar ? 112 : (this.layoutOffsets.topOffset || 82);
    const bottomOffset = this.layoutOffsets.bottomOffset || 0;
    const rightOffset = this.layoutOffsets.rightOffset || 0;

    const targetWidth = Math.max(100, bounds.width - rightOffset);
    const targetHeight = Math.max(100, bounds.height - topOffset - bottomOffset);

    activeView.setBounds({
      x: 0,
      y: topOffset,
      width: targetWidth,
      height: targetHeight,
    });
  }

  private updateTabNavState(tabId: string): void {
    const tab = this.tabs.get(tabId);
    const view = this.views.get(tabId);
    const hist = this.tabHistory.get(tabId);
    if (!tab) return;

    const wc = view?.webContents;
    const canGoBackHist = hist ? hist.currentIndex > 0 : false;
    const canGoForwardHist = hist ? hist.currentIndex < hist.entries.length - 1 : false;

    tab.canGoBack = canGoBackHist || (wc ? wc.canGoBack() : false);
    tab.canGoForward = canGoForwardHist || (wc ? wc.canGoForward() : false);
  }

  private setupViewEvents(tabId: string, view: WebContentsView): void {
    const wc = view.webContents;

    // Capture global keyboard shortcuts while focus is inside the web page
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;

      const isCtrl = process.platform === 'darwin' ? input.meta : input.control;

      // Ctrl + Shift + Space: Toggle Agent Command Box
      if (isCtrl && input.shift && (input.code === 'Space' || input.key === ' ' || input.key === 'Space')) {
        event.preventDefault();
        if (!this.window.isDestroyed()) {
          this.window.webContents.send('agent:toggle-command-box');
        }
        return;
      }

      // Ctrl + Shift + P: Pause / Resume
      if (isCtrl && input.shift && (input.key === 'P' || input.key === 'p')) {
        event.preventDefault();
        if (!this.window.isDestroyed()) {
          this.window.webContents.send('agent:shortcut-pause-resume');
        }
        return;
      }

      // Ctrl + Shift + S: Stop
      if (isCtrl && input.shift && (input.key === 'S' || input.key === 's')) {
        event.preventDefault();
        if (!this.window.isDestroyed()) {
          this.window.webContents.send('agent:shortcut-stop');
        }
        return;
      }

      // Ctrl + T: New Tab
      if (isCtrl && !input.shift && !input.alt && (input.key === 't' || input.key === 'T')) {
        event.preventDefault();
        this.createTab();
        return;
      }

      // Ctrl + W: Close Tab
      if (isCtrl && !input.shift && !input.alt && (input.key === 'w' || input.key === 'W')) {
        event.preventDefault();
        if (this.activeTabId) this.closeTab(this.activeTabId);
        return;
      }

      // Ctrl + R or F5: Reload
      if ((isCtrl && !input.shift && !input.alt && (input.key === 'r' || input.key === 'R')) || input.key === 'F5') {
        event.preventDefault();
        if (this.activeTabId) this.reload(this.activeTabId);
        return;
      }

      // Alt + Left: Go Back
      if (input.alt && input.key === 'ArrowLeft') {
        event.preventDefault();
        if (this.activeTabId) this.goBack(this.activeTabId);
        return;
      }

      // Alt + Right: Go Forward
      if (input.alt && input.key === 'ArrowRight') {
        event.preventDefault();
        if (this.activeTabId) this.goForward(this.activeTabId);
        return;
      }
    });

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
        this.updateTabNavState(tabId);
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
        if (!this.isNavigatingHistory) {
          const hist = this.tabHistory.get(tabId);
          if (hist && hist.entries[hist.currentIndex] !== url) {
            hist.entries = hist.entries.slice(0, hist.currentIndex + 1);
            hist.entries.push(url);
            hist.currentIndex = hist.entries.length - 1;
          }
        }
        this.updateTabNavState(tabId);
        this.storage.addHistoryEntry(url, tab.title, tab.favicon);
        this.notifyTabsUpdated();
      }
    });

    wc.on('did-navigate-in-page', (_evt, url) => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.url = url;
        if (!this.isNavigatingHistory) {
          const hist = this.tabHistory.get(tabId);
          if (hist && hist.entries[hist.currentIndex] !== url) {
            hist.entries = hist.entries.slice(0, hist.currentIndex + 1);
            hist.entries.push(url);
            hist.currentIndex = hist.entries.length - 1;
          }
        }
        this.updateTabNavState(tabId);
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
