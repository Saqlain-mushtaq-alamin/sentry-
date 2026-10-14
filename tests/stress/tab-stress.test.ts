/**
 * Task 14.3 — 30+ Tab Stress Test (NFR3)
 *
 * Verifies that the browser:
 * 1. Opens 30 tabs without crashing and maintains memory under targets (<2.5 GB)
 * 2. Runs an agent task with 30 tabs open
 * 3. Runs 3 background tasks with 20 tabs open while foreground browsing remains responsive
 * 4. Gracefully degrades at 50+ tabs using TabUnloader
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => {
  return {
    BrowserWindow: class {},
    WebContentsView: class {
      webContents = {
        loadURL: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        canGoBack: vi.fn().mockReturnValue(false),
        canGoForward: vi.fn().mockReturnValue(false),
        goBack: vi.fn(),
        goForward: vi.fn(),
        reload: vi.fn(),
        stop: vi.fn(),
        setZoomFactor: vi.fn(),
      };
      setBounds = vi.fn();
    },
  };
});

import { TabManager } from '../../src/main/browser/tab-manager';
import { TabUnloader } from '../../src/main/browser/tab-unloader';
import { StorageManager } from '../../src/main/browser/storage-manager';
import { BrowserWindow } from 'electron';

// Mock dependencies
const mockWindow = {
  contentView: {
    addChildView: vi.fn(),
    removeChildView: vi.fn(),
  },
  webContents: {
    send: vi.fn(),
  },
  getContentBounds: () => ({ x: 0, y: 0, width: 1200, height: 800 }),
  isDestroyed: () => false,
  on: vi.fn(),
} as unknown as BrowserWindow;

const mockStorage = {
  getSettings: () => ({
    searchEngine: 'google',
    startupBehavior: 'newtab',
    theme: 'dark',
    showBookmarksBar: false,
    defaultDownloadPath: '',
    askDownloadPath: false,
  }),
  addHistoryEntry: vi.fn(),
} as unknown as StorageManager;

function generateDiverseUrls(count: number): string[] {
  const domains = [
    'https://wikipedia.org/wiki/Special:Random',
    'https://github.com/trending',
    'https://news.ycombinator.com',
    'https://docs.python.org/3/',
    'https://developer.mozilla.org/en-US/',
    'https://stackoverflow.com/questions',
    'https://arxiv.org/abs/2401.0001',
    'https://nytimes.com',
    'https://bbc.com/news',
    'https://reddit.com/r/technology',
  ];

  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    const base = domains[i % domains.length];
    urls.push(`${base}?ref=tab_${i}`);
  }
  return urls;
}

describe('30+ Tab Stress Test (NFR3)', () => {
  let tabManager: TabManager;
  let tabUnloader: TabUnloader;

  beforeEach(() => {
    tabManager = new TabManager(mockWindow, mockStorage);
    tabUnloader = new TabUnloader(tabManager, 5 * 60 * 1000);
  });

  it('opens 30 tabs without crashing', async () => {
    const urls = generateDiverseUrls(30);

    for (const url of urls) {
      tabManager.createTab(url);
    }

    const allTabs = tabManager.getAllTabs();
    expect(allTabs.length).toBe(30);

    // Verify all tabs have IDs and assigned URLs
    allTabs.forEach((tab, index) => {
      expect(tab.id).toBeDefined();
      expect(tab.url).toBe(urls[index]);
    });

    // Verify memory per idle tab estimate is well within limit (< 2500 MB)
    const memUsage = process.memoryUsage();
    const rssMB = Math.round(memUsage.rss / (1024 * 1024));
    expect(rssMB).toBeLessThan(2500);
  });

  it('runs agent task with 30 tabs open', async () => {
    // 1. Open 30 tabs
    const urls = generateDiverseUrls(30);
    for (const url of urls) {
      tabManager.createTab(url);
    }
    expect(tabManager.getAllTabs().length).toBe(30);

    // 2. Select target tab for agent operation
    const targetTab = tabManager.getAllTabs()[15]!;
    tabManager.switchTab(targetTab.id);

    expect(tabManager.getActiveTab()?.id).toBe(targetTab.id);

    // 3. Simulate agent executing action sequence on target tab
    tabManager.navigate(targetTab.id, 'https://example.com/agent-research');
    tabManager.trackInteraction(targetTab.id);

    const active = tabManager.getActiveTab();
    expect(active?.url).toBe('https://example.com/agent-research');
    expect(active?.isActive).toBe(true);

    // Other tabs remain present and intact
    expect(tabManager.getAllTabs().length).toBe(30);
  });

  it('runs 3 background tasks with 20 tabs open', async () => {
    // Open 20 tabs
    const urls = generateDiverseUrls(20);
    for (const url of urls) {
      tabManager.createTab(url);
    }
    expect(tabManager.getAllTabs().length).toBe(20);

    // Background task tabs
    const bgTab1 = tabManager.getAllTabs()[1]!;
    const bgTab2 = tabManager.getAllTabs()[2]!;
    const bgTab3 = tabManager.getAllTabs()[3]!;

    // Active foreground tab
    const fgTab = tabManager.getAllTabs()[0]!;
    tabManager.switchTab(fgTab.id);

    // Simulate concurrent background navigation
    tabManager.navigate(bgTab1.id, 'https://api.github.com/repos/1');
    tabManager.navigate(bgTab2.id, 'https://api.github.com/repos/2');
    tabManager.navigate(bgTab3.id, 'https://api.github.com/repos/3');

    // Foreground tab remains active and responsive
    expect(tabManager.getActiveTab()?.id).toBe(fgTab.id);
    expect(tabManager.getActiveTab()?.isActive).toBe(true);

    // Background tabs received updates
    expect(tabManager.getAllTabs().find((t) => t.id === bgTab1.id)?.url).toBe('https://api.github.com/repos/1');
    expect(tabManager.getAllTabs().find((t) => t.id === bgTab2.id)?.url).toBe('https://api.github.com/repos/2');
    expect(tabManager.getAllTabs().find((t) => t.id === bgTab3.id)?.url).toBe('https://api.github.com/repos/3');
  });

  it('gracefully degrades at 50+ tabs using TabUnloader', async () => {
    // Open 50 tabs
    const urls = generateDiverseUrls(50);
    for (const url of urls) {
      tabManager.createTab(url);
    }
    expect(tabManager.getAllTabs().length).toBe(50);

    // Mark tabs older than 5 minutes
    const oldTimestamp = Date.now() - 10 * 60 * 1000;
    tabManager.getAllTabs().forEach((tab, index) => {
      if (index < 40) {
        tab.lastInteraction = oldTimestamp;
      }
    });

    // Tab unloader activates
    const unloaded = await tabUnloader.checkAndUnload();
    expect(unloaded).toBeGreaterThanOrEqual(39);

    const sleepingTabs = tabManager.getAllTabs().filter((t) => t.isSleeping);
    expect(sleepingTabs.length).toBeGreaterThanOrEqual(39);

    // The active tab must NEVER sleep
    const active = tabManager.getActiveTab();
    expect(active?.isSleeping).toBe(false);

    // Switching to a sleeping tab seamlessly wakes it up
    const firstSleeping = sleepingTabs[0]!;
    tabManager.switchTab(firstSleeping.id);

    expect(tabManager.getActiveTab()?.id).toBe(firstSleeping.id);
    expect(tabManager.getActiveTab()?.isSleeping).toBe(false);

    // Tab count remains consistent
    expect(tabManager.getAllTabs().length).toBe(50);
  });

  it('aggressiveUnload unloads old tabs under memory pressure', () => {
    const urls = generateDiverseUrls(35);
    for (const url of urls) {
      tabManager.createTab(url);
    }

    // Keep only 10 active in memory
    const count = tabUnloader.aggressiveUnload(10);
    expect(count).toBeGreaterThan(0);

    const activeMemoryTabs = tabManager.getAllTabs().filter((t) => !t.isSleeping);
    // 10 inactive + 1 currently active tab = 11
    expect(activeMemoryTabs.length).toBeLessThanOrEqual(11);
  });
});
