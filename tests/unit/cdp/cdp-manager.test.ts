import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron', () => ({
  WebContentsView: class {},
}));

import { CDPManager } from '../../../src/main/cdp/cdp-manager';

function makeFakeView() {
  const wcHandlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  const debuggerHandlers: Record<string, Array<(...args: unknown[]) => void>> = {};

  let attached = false;
  const debuggerObj = {
    isAttached: vi.fn(() => attached),
    attach: vi.fn(() => {
      attached = true;
    }),
    detach: vi.fn(() => {
      attached = false;
    }),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      (debuggerHandlers[event] ||= []).push(handler);
    }),
    sendCommand: vi.fn(async () => ({ ok: true })),
  };

  const webContents = {
    isDestroyed: vi.fn(() => false),
    id: 42,
    isLoading: vi.fn(() => false),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      (wcHandlers[event] ||= []).push(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      wcHandlers[event] = (wcHandlers[event] ?? []).filter((h) => h !== handler);
    }),
    debugger: debuggerObj,
  };

  return { view: { webContents } as any, webContents, debuggerObj, wcHandlers, debuggerHandlers };
}

describe('CDPManager', () => {
  let fake: ReturnType<typeof makeFakeView>;
  let resolver: (tabId: string) => any;
  let cdp: CDPManager;

  beforeEach(() => {
    vi.useFakeTimers();
    fake = makeFakeView();
    resolver = vi.fn(() => fake.view);
    cdp = new CDPManager(resolver);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('attach', () => {
    it('attaches the debugger with protocol 1.3 and records the connection', async () => {
      const ok = await cdp.attach('tab-1');

      expect(ok).toBe(true);
      expect(fake.debuggerObj.attach).toHaveBeenCalledWith('1.3');
      expect(cdp.isConnected('tab-1')).toBe(true);
      expect(cdp.getConnections()).toEqual([
        { tabId: 'tab-1', isConnected: true, webContentsId: 42 },
      ]);
    });

    it('is idempotent — a second attach does not re-attach the debugger', async () => {
      await cdp.attach('tab-1');
      const second = await cdp.attach('tab-1');

      expect(second).toBe(true);
      expect(fake.debuggerObj.attach).toHaveBeenCalledTimes(1);
      expect(cdp.isConnected('tab-1')).toBe(true);
    });

    it('returns false when the view resolver has no view for the tab', async () => {
      resolver = vi.fn(() => undefined);
      cdp = new CDPManager(resolver);

      expect(await cdp.attach('ghost')).toBe(false);
      expect(cdp.isConnected('ghost')).toBe(false);
      expect(cdp.getConnections()).toHaveLength(0);
    });

    it('adopts an externally attached debugger session without re-attaching', async () => {
      // attach() sees isAttached() === true and skips debugger.attach, still recording the connection
      fake.debuggerObj.isAttached.mockReturnValue(true);

      expect(await cdp.attach('tab-1')).toBe(true);
      expect(fake.debuggerObj.attach).not.toHaveBeenCalled();
      expect(cdp.isConnected('tab-1')).toBe(true);
    });

    it('returns false for a destroyed webContents when a prior connection exists', async () => {
      await cdp.attach('tab-1');
      fake.webContents.isDestroyed.mockReturnValue(true);
      fake.debuggerObj.isAttached.mockReturnValue(false);
      fake.debuggerObj.attach.mockImplementation(() => {
        throw new Error('Session is already attached! Or the page is navigating.');
      });

      expect(await cdp.attach('tab-1')).toBe(false);
    });

    it('marks the connection disconnected when the debugger detaches', async () => {
      await cdp.attach('tab-1');
      const detachHandlers = fake.debuggerHandlers['detach'] ?? [];

      detachHandlers[0]!({}, 'target crashed');

      expect(cdp.isConnected('tab-1')).toBe(false);
    });

    it('refreshes connection state after in-page navigation', async () => {
      await cdp.attach('tab-1');
      const navHandlers = fake.wcHandlers['did-navigate'] ?? [];

      fake.debuggerObj.isAttached.mockReturnValue(false);
      navHandlers[0]!({});

      expect(cdp.isConnected('tab-1')).toBe(false);
    });
  });

  describe('send', () => {
    it('attaches first, then forwards the command with params and returns the result', async () => {
      fake.debuggerObj.sendCommand.mockResolvedValue({ node: { nodeId: 7 } });

      const result = await cdp.send('tab-1', 'DOM.getDocument', { depth: -1 });

      expect(fake.debuggerObj.attach).toHaveBeenCalledWith('1.3');
      expect(fake.debuggerObj.sendCommand).toHaveBeenCalledWith('DOM.getDocument', { depth: -1 });
      expect(result).toEqual({ node: { nodeId: 7 } });
    });

    it('defaults params to an empty object', async () => {
      await cdp.send('tab-1', 'Runtime.enable');

      expect(fake.debuggerObj.sendCommand).toHaveBeenCalledWith('Runtime.enable', {});
    });

    it('returns undefined without throwing when sendCommand rejects', async () => {
      fake.debuggerObj.sendCommand.mockRejectedValue(new Error('Protocol error: detached'));

      await expect(cdp.send('tab-1', 'Page.captureScreenshot')).resolves.toBeUndefined();
    });

    it('returns undefined when there is no view to talk to', async () => {
      await cdp.attach('tab-1');
      resolver = vi.fn(() => undefined);
      cdp = new CDPManager(resolver);

      await expect(cdp.send('tab-1', 'Runtime.evaluate')).resolves.toBeUndefined();
    });

    it('returns undefined when attach itself fails', async () => {
      resolver = vi.fn(() => undefined);
      cdp = new CDPManager(resolver);

      await expect(cdp.send('ghost', 'Runtime.evaluate')).resolves.toBeUndefined();
      expect(fake.debuggerObj.sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('detach', () => {
    it('detaches an attached debugger and forgets the connection', async () => {
      await cdp.attach('tab-1');

      cdp.detach('tab-1');

      expect(fake.debuggerObj.detach).toHaveBeenCalled();
      expect(cdp.isConnected('tab-1')).toBe(false);
      expect(cdp.getConnections()).toHaveLength(0);
    });

    it('is a safe no-op for unknown tabs and detached debuggers', () => {
      expect(() => cdp.detach('missing')).not.toThrow();

      expect(() => cdp.detach('tab-1')).not.toThrow(); // no connection, isAttached false
      expect(fake.debuggerObj.detach).not.toHaveBeenCalled();
    });

    it('skips detach for destroyed webContents but still clears the connection', async () => {
      await cdp.attach('tab-1');
      fake.webContents.isDestroyed.mockReturnValue(true);

      cdp.detach('tab-1');

      expect(fake.debuggerObj.detach).not.toHaveBeenCalled();
      expect(cdp.isConnected('tab-1')).toBe(false);
    });

    it('tolerates a throwing debugger.detach', async () => {
      await cdp.attach('tab-1');
      fake.debuggerObj.detach.mockImplementation(() => {
        throw new Error('detach failed');
      });

      expect(() => cdp.detach('tab-1')).not.toThrow();
      expect(cdp.isConnected('tab-1')).toBe(false);
    });
  });

  describe('getConnections', () => {
    it('returns metadata for every active connection', async () => {
      const other = makeFakeView();
      other.webContents.id = 77;
      resolver = vi.fn((tabId: string) => (tabId === 'tab-a' ? fake.view : other.view));
      cdp = new CDPManager(resolver);

      await cdp.attach('tab-a');
      await cdp.attach('tab-b');

      const connections = cdp.getConnections();
      expect(connections).toHaveLength(2);
      expect(connections.map((c) => c.webContentsId).sort()).toEqual([42, 77]);
      expect(connections.every((c) => c.isConnected)).toBe(true);
    });
  });

  describe('waitForLoad', () => {
    it('resolves quickly when the page is not loading (250ms probe + settle)', async () => {
      fake.webContents.isLoading.mockReturnValue(false);

      const pending = cdp.waitForLoad('tab-1');
      await vi.advanceTimersByTimeAsync(700);

      await expect(pending).resolves.toBeUndefined();
    });

    it('resolves on did-stop-loading followed by the settle delay', async () => {
      fake.webContents.isLoading.mockReturnValue(true);

      const pending = cdp.waitForLoad('tab-1');
      const stopHandlers = fake.wcHandlers['did-stop-loading'] ?? [];
      expect(stopHandlers.length).toBeGreaterThan(0);

      stopHandlers[0]!({});
      await vi.advanceTimersByTimeAsync(500);

      await expect(pending).resolves.toBeUndefined();
      // the listener is cleaned up after finishing
      expect(fake.webContents.off).toHaveBeenCalledWith('did-stop-loading', expect.any(Function));
    });

    it('returns on the timeout when loading never stops', async () => {
      fake.webContents.isLoading.mockReturnValue(true);

      const pending = cdp.waitForLoad('tab-1', 1000);
      await vi.advanceTimersByTimeAsync(2000);

      await expect(pending).resolves.toBeUndefined();
    });

    it('resolves immediately when the webContents is missing or destroyed', async () => {
      resolver = vi.fn(() => undefined);
      cdp = new CDPManager(resolver);
      await expect(cdp.waitForLoad('ghost')).resolves.toBeUndefined();

      fake.webContents.isDestroyed.mockReturnValue(true);
      await expect(cdp.waitForLoad('tab-1')).resolves.toBeUndefined();
    });
  });
});
