import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabUnloader } from '../../../src/main/browser/tab-unloader';
import { TabManager } from '../../../src/main/browser/tab-manager';
import { TabItem } from '../../../src/shared/types';

const NOW = 1_700_000_000_000;

function makeTab(overrides: Partial<TabItem> & { id: string }): TabItem {
  return {
    url: 'https://example.com',
    title: 'Example',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    isActive: false,
    isPinned: false,
    zoomLevel: 1.0,
    isSleeping: false,
    lastInteraction: NOW,
    ...overrides,
  };
}

function makeFakeTabManager(tabs: TabItem[]) {
  return {
    getAllTabs: () => tabs,
    getTabs: () => tabs,
    getActiveTab: () => tabs.find((t) => t.isActive) ?? null,
    unloadTab: vi.fn((id: string) => {
      const tab = tabs.find((t) => t.id === id);
      if (!tab || tab.isActive || tab.isSleeping) return false;
      if (tab.url.startsWith('sentry://')) return false;
      tab.isSleeping = true;
      tab.isLoading = false;
      return true;
    }),
  };
}

describe('TabUnloader', () => {
  let fakeManager: ReturnType<typeof makeFakeTabManager>;
  let unloader: TabUnloader;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(tabs: TabItem[], thresholdMs = 5 * 60 * 1000) {
    fakeManager = makeFakeTabManager(tabs);
    unloader = new TabUnloader(fakeManager as unknown as TabManager, thresholdMs);
    return { unloader, fakeManager };
  }

  it('unloads inactive tabs that have been idle longer than the threshold', async () => {
    const oldTab = makeTab({ id: 'old', lastInteraction: NOW - 10 * 60 * 1000 });
    setup([oldTab]);

    const unloaded = await unloader.checkAndUnload();

    expect(unloaded).toBe(1);
    expect(oldTab.isSleeping).toBe(true);
    expect(fakeManager.unloadTab).toHaveBeenCalledWith('old');
  });

  it('never unloads the active tab even when it is idle past the threshold', async () => {
    const active = makeTab({ id: 'active', isActive: true, lastInteraction: NOW - 60 * 60 * 1000 });
    setup([active]);

    const unloaded = await unloader.checkAndUnload();

    expect(unloaded).toBe(0);
    expect(active.isSleeping).toBe(false);
  });

  it('never unloads internal sentry:// tabs', async () => {
    const internal = makeTab({ id: 'internal', url: 'sentry://newtab', lastInteraction: NOW - 60 * 60 * 1000 });
    setup([internal]);

    const unloaded = await unloader.checkAndUnload();

    expect(unloaded).toBe(0);
    expect(internal.isSleeping).toBe(false);
    expect(fakeManager.unloadTab).not.toHaveBeenCalled();
  });

  it('does not unload tabs that are already sleeping', async () => {
    const sleeping = makeTab({ id: 'sleeping', isSleeping: true, lastInteraction: NOW - 60 * 60 * 1000 });
    setup([sleeping]);

    const unloaded = await unloader.checkAndUnload();

    expect(unloaded).toBe(0);
    expect(fakeManager.unloadTab).not.toHaveBeenCalled();
  });

  it('does not unload tabs that were interacted with recently', async () => {
    const recent = makeTab({ id: 'recent', lastInteraction: NOW - 1000 });
    setup([recent]);

    const unloaded = await unloader.checkAndUnload();

    expect(unloaded).toBe(0);
    expect(recent.isSleeping).toBe(false);
  });

  it('skips tabs without a lastInteraction timestamp', async () => {
    const noTs = makeTab({ id: 'no-ts', lastInteraction: undefined });
    setup([noTs]);

    const unloaded = await unloader.checkAndUnload();

    expect(unloaded).toBe(0);
  });

  it('counts only tabs whose unload actually succeeded', async () => {
    const oldTab = makeTab({ id: 'old', lastInteraction: NOW - 60 * 60 * 1000 });
    fakeManager = makeFakeTabManager([oldTab]);
    fakeManager.unloadTab.mockReturnValue(false);
    unloader = new TabUnloader(fakeManager as unknown as TabManager);

    const unloaded = await unloader.checkAndUnload();

    expect(unloaded).toBe(0);
  });

  it('aggressiveUnload keeps the keepCount most-recently-used inactive tabs in memory', () => {
    const tabs = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      makeTab({ id, lastInteraction: NOW - (5 - i) * 60_000 }), // a oldest … e newest
    );
    tabs[0]!.isActive = true; // active tab is never a candidate
    setup(tabs);

    const count = unloader.aggressiveUnload(2);

    // 4 candidates (b..e), keep 2 newest (d, e) → unload b, c
    expect(count).toBe(2);
    expect(tabs.find((t) => t.id === 'b')!.isSleeping).toBe(true);
    expect(tabs.find((t) => t.id === 'c')!.isSleeping).toBe(true);
    expect(tabs.find((t) => t.id === 'd')!.isSleeping).toBe(false);
    expect(tabs.find((t) => t.id === 'e')!.isSleeping).toBe(false);
    expect(tabs.find((t) => t.id === 'a')!.isSleeping).toBe(false);
  });

  it('aggressiveUnload excludes sleeping, active and sentry:// tabs from candidates', () => {
    const tabs = [
      makeTab({ id: 'active', isActive: true }),
      makeTab({ id: 'sleeping', isSleeping: true }),
      makeTab({ id: 'internal', url: 'sentry://downloads' }),
      makeTab({ id: 'live1', lastInteraction: NOW - 1000 }),
      makeTab({ id: 'live2', lastInteraction: NOW - 2000 }),
    ];
    setup(tabs);

    const count = unloader.aggressiveUnload(1);

    // only 2 candidates, keep 1 → unload the older one (live2)
    expect(count).toBe(1);
    expect(tabs.find((t) => t.id === 'live2')!.isSleeping).toBe(true);
    expect(tabs.find((t) => t.id === 'live1')!.isSleeping).toBe(false);
  });

  it('aggressiveUnload returns 0 when candidate count is within keepCount', () => {
    const tabs = [makeTab({ id: 'only' })];
    setup(tabs);

    expect(unloader.aggressiveUnload(10)).toBe(0);
    expect(fakeManager.unloadTab).not.toHaveBeenCalled();
  });

  it('setIdleThreshold and getIdleThreshold round-trip the configured value', () => {
    setup([], 60_000);
    expect(unloader.getIdleThreshold()).toBe(60_000);

    unloader.setIdleThreshold(120_000);
    expect(unloader.getIdleThreshold()).toBe(120_000);
  });

  it('start schedules periodic checks and stop clears the timer without leaking', async () => {
    const oldTab = makeTab({ id: 'old', lastInteraction: NOW - 60 * 60 * 1000 });
    setup([oldTab]);
    const spy = vi.spyOn(unloader, 'checkAndUnload').mockResolvedValue(0);

    unloader.start(1000);
    unloader.start(1000); // double-start must not create a second interval

    await vi.advanceTimersByTimeAsync(1000);
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(spy).toHaveBeenCalledTimes(4);

    unloader.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(spy).toHaveBeenCalledTimes(4); // no further checks after stop

    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the default 5-minute idle threshold when none is provided', () => {
    fakeManager = makeFakeTabManager([]);
    unloader = new TabUnloader(fakeManager as unknown as TabManager);
    expect(unloader.getIdleThreshold()).toBe(5 * 60 * 1000);
  });
});
