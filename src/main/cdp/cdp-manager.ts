/**
 * CDPManager — Task 3.1
 *
 * Manages one CDP debugger session per tab using Electron's built-in
 * `webContents.debugger` API.  Falls back gracefully if a session is
 * unavailable — never crashes the browser.
 */

import { WebContentsView } from 'electron';

export interface CDPConnection {
  tabId: string;
  /** Whether the debugger is currently attached */
  isConnected: boolean;
  /** Underlying webContents ID (for bookkeeping) */
  webContentsId: number;
}

export class CDPManager {
  private connections: Map<string, CDPConnection> = new Map();
  /** Reference to view lookup — injected by TabManager */
  private viewResolver: (tabId: string) => WebContentsView | undefined;

  constructor(viewResolver: (tabId: string) => WebContentsView | undefined) {
    this.viewResolver = viewResolver;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Attach a CDP debugger session to the given tab.
   * Safe to call multiple times — idempotent.
   */
  public async attach(tabId: string): Promise<boolean> {
    const view = this.viewResolver(tabId);
    if (!view) {
      console.warn(`[CDPManager] Tab ${tabId} not found — cannot attach`);
      return false;
    }

    const wc = view.webContents;
    const existing = this.connections.get(tabId);

    // If already connected (and not destroyed), do nothing
    if (existing?.isConnected && !wc.isDestroyed()) {
      return true;
    }

    try {
      if (!wc.debugger.isAttached()) {
        wc.debugger.attach('1.3');
      }

      const conn: CDPConnection = {
        tabId,
        isConnected: true,
        webContentsId: wc.id,
      };
      this.connections.set(tabId, conn);

      // Listen for detach events so we can mark the session as disconnected
      wc.debugger.on('detach', (_event, reason) => {
        console.warn(`[CDPManager] Debugger detached from tab ${tabId}: ${reason}`);
        const c = this.connections.get(tabId);
        if (c) c.isConnected = false;
      });

      // Auto-reconnect on same-process navigation (CDP sessions survive these)
      wc.on('did-navigate', () => {
        const c = this.connections.get(tabId);
        if (c) c.isConnected = wc.debugger.isAttached();
      });

      return true;
    } catch (err) {
      console.error(`[CDPManager] Failed to attach to tab ${tabId}:`, err);
      return false;
    }
  }

  /**
   * Detach and clean up the CDP session for a tab.
   * Called when the tab is closed.
   */
  public detach(tabId: string): void {
    const view = this.viewResolver(tabId);
    if (view && !view.webContents.isDestroyed()) {
      try {
        if (view.webContents.debugger.isAttached()) {
          view.webContents.debugger.detach();
        }
      } catch (err) {
        console.warn(`[CDPManager] Error detaching tab ${tabId}:`, err);
      }
    }
    this.connections.delete(tabId);
  }

  /**
   * Send a CDP command to the given tab.
   * Returns undefined and logs a warning if the session is not ready.
   */
  public async send<T = unknown>(
    tabId: string,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T | undefined> {
    // Ensure session is attached
    const attached = await this.attach(tabId);
    if (!attached) return undefined;

    const view = this.viewResolver(tabId);
    if (!view || view.webContents.isDestroyed()) return undefined;

    try {
      const result = await view.webContents.debugger.sendCommand(method, params ?? {});
      return result as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Suppress noise from harmless "not attached" or target navigation errors during rapid navigation
      if (
        !message.includes('detached') &&
        !message.includes('Cannot send') &&
        !message.includes('navigated or closed') &&
        !message.includes('Inspected target')
      ) {
        console.error(`[CDPManager] CDP error on ${method} for tab ${tabId}:`, message);
      }
      return undefined;
    }
  }

  /** Check whether a tab's CDP session is currently active */
  public isConnected(tabId: string): boolean {
    return this.connections.get(tabId)?.isConnected ?? false;
  }

  /** Returns metadata for all active connections (useful for debugging) */
  public getConnections(): CDPConnection[] {
    return Array.from(this.connections.values());
  }

  public waitForLoad(tabId: string, timeoutMs = 8000): Promise<void> {
    const wc = this.viewResolver(tabId)?.webContents;
    if (!wc || wc.isDestroyed()) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        wc.off('did-stop-loading', finish);
        setTimeout(resolve, 400); // let the page settle
      };
      const t = setTimeout(finish, timeoutMs);
      wc.on('did-stop-loading', finish);
      setTimeout(() => {
        if (!wc.isLoading()) finish();
      }, 250); // no navigation started
    });
  }
}
