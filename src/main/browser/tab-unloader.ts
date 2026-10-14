import { TabManager } from './tab-manager';

export class TabUnloader {
  private tabManager: TabManager;
  private idleThreshold: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(tabManager: TabManager, idleThresholdMs: number = 5 * 60 * 1000) {
    this.tabManager = tabManager;
    this.idleThreshold = idleThresholdMs;
  }

  public setIdleThreshold(ms: number): void {
    this.idleThreshold = ms;
  }

  public getIdleThreshold(): number {
    return this.idleThreshold;
  }

  /**
   * Check all tabs and unload inactive tabs that have exceeded the idle threshold.
   * Returns the count of tabs unloaded during this check.
   */
  public async checkAndUnload(): Promise<number> {
    const tabs = this.tabManager.getAllTabs();
    const now = Date.now();
    let unloadedCount = 0;

    for (const tab of tabs) {
      if (
        !tab.isActive &&
        !tab.isSleeping &&
        !tab.url.startsWith('sentry://') &&
        tab.lastInteraction !== undefined &&
        tab.lastInteraction < now - this.idleThreshold
      ) {
        const success = this.tabManager.unloadTab(tab.id);
        if (success) {
          unloadedCount++;
        }
      }
    }

    return unloadedCount;
  }

  /**
   * Aggressively unload idle tabs when memory pressure is high or tab count exceeds threshold (e.g. 30+ tabs).
   * Keeps up to `keepCount` most recently used inactive tabs in memory and unloads the rest.
   */
  public aggressiveUnload(keepCount = 10): number {
    const tabs = this.tabManager.getAllTabs();
    const candidateTabs = tabs.filter(
      (t) => !t.isActive && !t.isSleeping && !t.url.startsWith('sentry://')
    );

    if (candidateTabs.length <= keepCount) {
      return 0;
    }

    // Sort ascending by last interaction (oldest first)
    candidateTabs.sort((a, b) => (a.lastInteraction ?? 0) - (b.lastInteraction ?? 0));

    const toUnload = candidateTabs.slice(0, candidateTabs.length - keepCount);
    let count = 0;
    for (const tab of toUnload) {
      if (this.tabManager.unloadTab(tab.id)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Start periodic timer to check and unload idle tabs.
   */
  public start(intervalMs = 60_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.checkAndUnload().catch((err) => {
        console.error('[TabUnloader] checkAndUnload failed:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop background timer.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
