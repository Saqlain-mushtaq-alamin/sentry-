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
  private navigatingHistoryTabs: Set<string> = new Set();

  private safeLoadURL(view: WebContentsView, url: string, context = 'Failed to navigate'): void {
    view.webContents.loadURL(url).catch((err: any) => {
      const code = err?.code;
      const errno = err?.errno;
      const msg = err instanceof Error ? err.message : String(err);
      if (code === 'ERR_ABORTED' || errno === -3 || msg.includes('ERR_ABORTED') || msg.includes('(-3)')) {
        return;
      }
      console.error(`${context}:`, err);
    });
  }

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

  public async setHidden(hidden: boolean): Promise<string | null> {
    this.isViewHidden = hidden;
    const id = this.activeTabId;
    if (!id) return null;
    const view = this.views.get(id);
    const tab = this.tabs.get(id);
    if (!view || !tab || tab.url.startsWith('sentry://')) return null;

    if (!hidden) {
      try { this.window.contentView.addChildView(view); } catch {}
      this.updateActiveViewBounds();
      return null;
    }

    let frame: string | null = null;
    try {
      if (!view.webContents.isDestroyed()) {
        const img = await view.webContents.capturePage();
        frame = 'data:image/jpeg;base64,' + img.toJPEG(70).toString('base64');
      }
    } catch {}
    if (!this.isViewHidden) return null; // closed again while capturing
    try { this.window.contentView.removeChildView(view); } catch {}
    return frame;
  }

  public setLayoutOffsets(offsets: Partial<LayoutOffsets>): void {
    this.layoutOffsets = { ...this.layoutOffsets, ...offsets };
    this.updateActiveViewBounds();
  }

  public getTabs(): TabItem[] {
    return this.tabOrder.map((id) => this.tabs.get(id)!).filter(Boolean);
  }

  public getAllTabs(): TabItem[] {
    return this.getTabs();
  }

  public getActiveTab(): TabItem | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  public getView(tabId: string): WebContentsView | undefined {
    return this.views.get(tabId);
  }

  public trackInteraction(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.lastInteraction = Date.now();
    }
  }

  public unloadTab(id: string): boolean {
    if (!this.tabs.has(id)) return false;
    const tab = this.tabs.get(id)!;
    if (tab.isActive) return false;
    if (tab.url.startsWith('sentry://')) return false;
    if (tab.isSleeping) return false;

    const view = this.views.get(id);
    if (view) {
      try {
        this.window.contentView.removeChildView(view);
      } catch {
        // ignored
      }
      this.views.delete(id);
    }

    tab.isSleeping = true;
    tab.isLoading = false;
    this.notifyTabsUpdated();
    return true;
  }

  public wakeTab(id: string): void {
    if (!this.tabs.has(id)) return;
    const tab = this.tabs.get(id)!;
    if (!tab.isSleeping && this.views.has(id)) return;

    tab.isSleeping = false;
    tab.lastInteraction = Date.now();

    if (!tab.url.startsWith('sentry://')) {
      const view = new WebContentsView({
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
        },
      });

      this.setupViewEvents(id, view);
      this.views.set(id, view);
      this.safeLoadURL(view, tab.url, 'Wake tab loadURL failed');
    }

    this.notifyTabsUpdated();
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
      title: formattedUrl.startsWith('sentry://') ? this.getInternalTitle(formattedUrl) : formattedUrl,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isActive: false,
      isPinned: false,
      zoomLevel: 1.0,
      isSleeping: false,
      lastInteraction: Date.now(),
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
      this.safeLoadURL(view, formattedUrl, 'Load URL failed');
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
    this.navigatingHistoryTabs.delete(id);
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

    const tab = this.tabs.get(id);
    if (tab?.isSleeping) {
      this.wakeTab(id);
    }
    if (tab) {
      tab.lastInteraction = Date.now();
    }

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
        const norm = (u: string) => u.replace(/\/+$/, '');
        if (norm(hist.entries[hist.currentIndex] || '') !== norm(url)) {
          hist.entries = hist.entries.slice(0, hist.currentIndex + 1);
          hist.entries.push(url);
          hist.currentIndex = hist.entries.length - 1;
        }
      }
    }

    if (url.startsWith('sentry://')) {
      this.navigatingHistoryTabs.delete(id);
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
      this.safeLoadURL(view, url, 'Failed to navigate');
    }
  }

  public goBack(id: string): void {
    const tab = this.tabs.get(id);
    const view = this.views.get(id);
    const hist = this.tabHistory.get(id);
    if (!tab) return;

    // 1. If currently on a web page and webContents can go back natively, use it!
    if (view && !tab.url.startsWith('sentry://') && view.webContents.canGoBack()) {
      this.navigatingHistoryTabs.add(id);
      view.webContents.goBack();
      if (hist && hist.currentIndex > 0) {
        hist.currentIndex--;
      }
      this.updateTabNavState(id);
      this.notifyTabsUpdated();
      return;
    }

    // 2. Otherwise walk the internal tab history (e.g. returning to sentry://newtab or across internal pages)
    if (hist && hist.currentIndex > 0) {
      this.navigatingHistoryTabs.add(id);
      hist.currentIndex--;
      const targetUrl = hist.entries[hist.currentIndex]!;
      this.navigate(id, targetUrl, true);
      return;
    }

    // 3. Fallback to webContents if available
    if (view && view.webContents.canGoBack()) {
      this.navigatingHistoryTabs.add(id);
      view.webContents.goBack();
      this.updateTabNavState(id);
      this.notifyTabsUpdated();
    }
  }

  public goForward(id: string): void {
    const tab = this.tabs.get(id);
    const view = this.views.get(id);
    const hist = this.tabHistory.get(id);
    if (!tab) return;

    // 1. If currently on a web page and webContents can go forward natively, use it!
    if (view && !tab.url.startsWith('sentry://') && view.webContents.canGoForward()) {
      this.navigatingHistoryTabs.add(id);
      view.webContents.goForward();
      if (hist && hist.currentIndex < hist.entries.length - 1) {
        hist.currentIndex++;
      }
      this.updateTabNavState(id);
      this.notifyTabsUpdated();
      return;
    }

    // 2. Otherwise walk forward through internal tab history (e.g. from sentry://newtab forward to web page)
    if (hist && hist.currentIndex < hist.entries.length - 1) {
      this.navigatingHistoryTabs.add(id);
      hist.currentIndex++;
      const targetUrl = hist.entries[hist.currentIndex]!;
      this.navigate(id, targetUrl, true);
      return;
    }

    // 3. Fallback to webContents if available
    if (view && view.webContents.canGoForward()) {
      this.navigatingHistoryTabs.add(id);
      view.webContents.goForward();
      this.updateTabNavState(id);
      this.notifyTabsUpdated();
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

    const wcCanGoBack = Boolean(wc && !wc.isDestroyed() && wc.canGoBack());
    const wcCanGoForward = Boolean(wc && !wc.isDestroyed() && wc.canGoForward());

    tab.canGoBack = canGoBackHist || wcCanGoBack;
    tab.canGoForward = canGoForwardHist || wcCanGoForward;
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

    wc.on('did-fail-load', (_evt, _errorCode, _errorDescription, _validatedURL, isMainFrame) => {
      if (isMainFrame) {
        this.navigatingHistoryTabs.delete(tabId);
        const tab = this.tabs.get(tabId);
        if (tab) {
          tab.isLoading = false;
          this.updateTabNavState(tabId);
          this.notifyTabsUpdated();
        }
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

    const handleNavigation = (url: string, inPage = false) => {
      const tab = this.tabs.get(tabId);
      if (!tab) return;

      tab.url = url;
      const isHistory = this.navigatingHistoryTabs.has(tabId);
      this.navigatingHistoryTabs.delete(tabId);

      const hist = this.tabHistory.get(tabId);
      if (hist) {
        const norm = (u: string) => u.replace(/\/+$/, '');
        const currentEntry = hist.entries[hist.currentIndex];

        if (isHistory) {
          // Keep current index, update canonical url if same page
          if (currentEntry && norm(currentEntry) === norm(url)) {
            hist.entries[hist.currentIndex] = url;
          }
        } else {
          // New navigation: only record if destination is genuinely different
          if (!currentEntry || norm(currentEntry) !== norm(url)) {
            hist.entries = hist.entries.slice(0, hist.currentIndex + 1);
            hist.entries.push(url);
            hist.currentIndex = hist.entries.length - 1;
          }
        }
      }

      this.updateTabNavState(tabId);
      if (!inPage) {
        this.storage.addHistoryEntry(url, tab.title, tab.favicon);
      }
      this.notifyTabsUpdated();
    };

    wc.on('did-navigate', (_evt, url) => {
      handleNavigation(url, false);
    });

    wc.on('did-navigate-in-page', (_evt, url) => {
      handleNavigation(url, true);
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
      case 'sentry://trust':
        return 'Trust & Permissions';
      case 'sentry://models':
        return 'Model Settings';
      case 'sentry://recipes':
        return 'Recipes';
      case 'sentry://developer':
        return 'Developer Mode';
      case 'sentry://extensions':
        return 'Extensions';
      case 'sentry://onboarding':
        return 'Welcome to Sentry';
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
