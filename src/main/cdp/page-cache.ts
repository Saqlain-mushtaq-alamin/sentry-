/**
 * PageCache — Task 3.6
 *
 * Caches page snapshots to avoid recomputing the DOM multiple times per tab
 * when the agent is deliberating or performing multiple actions sequentially
 * without page changes.
 */

import { PageSnapshot, CacheEntry } from '../../shared/types';
import * as crypto from 'crypto';

export class PageCache {
  private cache: Map<string, CacheEntry> = new Map();
  private snapshotHistory: Map<string, PageSnapshot[]> = new Map();
  private readonly DEFAULT_TTL = 30 * 1000; // 30 seconds
  private readonly MAX_SNAPSHOT_RETENTION = 3; // Keep last 3 per tab (Phase 14 memory target)

  /**
   * Store a snapshot in the cache.
   */
  public set(tabId: string, snapshot: PageSnapshot): void {
    const domHash = this.computeHash(snapshot);
    const entry: CacheEntry = {
      url: snapshot.url,
      urlHash: this.hashString(snapshot.url),
      snapshot,
      timestamp: Date.now(),
      ttl: this.DEFAULT_TTL,
      domHash,
    };
    this.cache.set(tabId, entry);

    // Limit retention to last 3 snapshots per tab
    const history = this.snapshotHistory.get(tabId) || [];
    history.push(snapshot);
    if (history.length > this.MAX_SNAPSHOT_RETENTION) {
      history.splice(0, history.length - this.MAX_SNAPSHOT_RETENTION);
    }
    this.snapshotHistory.set(tabId, history);
  }

  /**
   * Retrieve a cached snapshot if it is still valid.
   */
  public get(tabId: string, currentUrl: string): PageSnapshot | undefined {
    const entry = this.cache.get(tabId);
    if (!entry) return undefined;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.invalidate(tabId);
      return undefined;
    }

    // Fast URL check (navigation invalidates cache)
    if (entry.url !== currentUrl) {
      this.invalidate(tabId);
      return undefined;
    }

    return entry.snapshot;
  }

  /**
   * Get the retained snapshots (maximum 3) for a tab.
   */
  public getRecentSnapshots(tabId: string): PageSnapshot[] {
    return [...(this.snapshotHistory.get(tabId) || [])];
  }

  /**
   * Explicitly invalidate the cache for a tab.
   * Useful when an action is executed (click, type, etc.) or tab is unloaded.
   */
  public invalidate(tabId: string): void {
    this.cache.delete(tabId);
    this.snapshotHistory.delete(tabId);
  }
  
  /**
   * Clear entire cache (useful on low memory or bulk operations)
   */
  public clearAll(): void {
    this.cache.clear();
    this.snapshotHistory.clear();
  }

  private computeHash(snapshot: PageSnapshot): string {
    // A simplified hash based on interactive element counts and text length.
    // Real-world might hash the actual DOM tree string, but this is faster.
    const key = `${snapshot.interactiveElements.length}:${snapshot.visibleText.length}`;
    return this.hashString(key);
  }

  private hashString(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  }
}
