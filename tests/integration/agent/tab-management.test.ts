/**
 * Phase 15 — Tab management integration tests.
 *
 * Electron-mocked TabManager + TabGrouper + TabUnloader +
 * BackgroundTaskRunner + MultiTabCoordinator flows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
import { TabGrouper } from '../../../src/main/browser/tab-grouper';
import { TabUnloader } from '../../../src/main/browser/tab-unloader';
import { StorageManager } from '../../../src/main/browser/storage-manager';
import { BackgroundTaskRunner } from '../../../src/main/agent/background-runner';
import { MultiTabCoordinator } from '../../../src/main/agent/multi-tab-coordinator';
import {
  BackgroundTask, MultiTabTask, TaskState,
} from '../../../src/shared/types';

const mockWindow = {
  contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
  webContents: { send: vi.fn() },
  getContentBounds: vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
  isDestroyed: vi.fn(() => false),
  on: vi.fn(),
} as unknown as BrowserWindow;

const mockStorage = {
  getSettings: vi.fn(() => ({
    searchEngine: 'google',
    startupBehavior: 'newtab',
    theme: 'dark',
    showBookmarksBar: false,
    defaultDownloadPath: '',
    askDownloadPath: false,
  })),
  addHistoryEntry: vi.fn(),
} as unknown as StorageManager;

describe('Tab management integration', () => {
  let tabManager: TabManager;

  beforeEach(() => {
    (WebContentsView as any).instances.length = 0;
    tabManager = new TabManager(mockWindow, mockStorage);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a) removes an auto-created tab group when its task completes', () => {
    const grouper = new TabGrouper();
    const t1 = tabManager.createTab('https://a.example.com');
    const t2 = tabManager.createTab('https://b.example.com');
    const t3 = tabManager.createTab('https://c.example.com');

    const group = grouper.createGroup(
      'Compare prices',
      [t1.id, t2.id, t3.id],
      'task-1',
      true,
    );

    expect(grouper.getAllGroups()).toHaveLength(1);
    expect(group.autoCreated).toBe(true);
    expect(group.autoCloseOnComplete).toBe(true);
    expect(grouper.getGroupForTab(t2.id)?.id).toBe(group.id);

    grouper.handleTaskComplete('task-1');

    expect(grouper.getAllGroups()).toHaveLength(0);
    expect(grouper.getGroupForTab(t1.id)).toBeUndefined();
    // The tabs themselves survive — only the group is removed
    expect(tabManager.getAllTabs()).toHaveLength(3);
  });

  it('b) runs a high-priority background task through confirmation to completion', async () => {
    vi.useFakeTimers();
    const runner = new BackgroundTaskRunner();

    const high: BackgroundTask = {
      id: 'bg-high',
      instruction: 'Watch flight prices',
      priority: 'high',
      status: TaskState.IDLE,
      progress: 0,
      startedAt: Date.now(),
      notifications: [],
    };
    await runner.submit(high);

    await vi.advanceTimersByTimeAsync(2100);
    expect(high.status).toBe(TaskState.AWAITING_CONFIRMATION);
    expect(high.progress).toBe(50);
    expect(high.notifications).toHaveLength(1);
    expect(high.notifications[0]!.type).toBe('confirmation');

    await vi.advanceTimersByTimeAsync(5200);
    expect(high.status).toBe(TaskState.COMPLETED);
    expect(high.progress).toBe(100);
    expect(high.notifications).toHaveLength(2);
    expect(high.notifications[1]!.type).toBe('success');

    const normal: BackgroundTask = {
      id: 'bg-normal',
      instruction: 'Summarize a page',
      priority: 'normal',
      status: TaskState.IDLE,
      progress: 0,
      startedAt: Date.now(),
      notifications: [],
    };
    await runner.submit(normal);
    await vi.advanceTimersByTimeAsync(4500);

    expect(normal.status).toBe(TaskState.COMPLETED);
    expect(normal.notifications).toHaveLength(1);
    expect(normal.notifications[0]!.type).toBe('success');
    expect(runner.getTasks().map(t => t.id).sort()).toEqual(['bg-high', 'bg-normal']);
  });

  it('c) unloads idle inactive tabs and wakes them back on demand', async () => {
    vi.useFakeTimers();
    const t1 = tabManager.createTab('https://idle.example.com/one');
    const t2 = tabManager.createTab('https://active.example.com/two');

    // t1 is inactive (t2 became active), both non-sentry http tabs
    expect(t1.isActive).toBe(false);
    expect(t2.isActive).toBe(true);

    const unloader = new TabUnloader(tabManager, 60_000);
    vi.advanceTimersByTime(90_000);

    const unloaded = await unloader.checkAndUnload();
    expect(unloaded).toBe(1);
    expect(tabManager.getView(t1.id)).toBeUndefined();
    expect(tabManager.getAllTabs().find(t => t.id === t1.id)?.isSleeping).toBe(true);
    // Active tab is never unloaded
    expect(tabManager.getView(t2.id)).toBeDefined();

    tabManager.wakeTab(t1.id);
    const restored = tabManager.getView(t1.id)!;
    expect(restored).toBeDefined();
    expect(tabManager.getAllTabs().find(t => t.id === t1.id)?.isSleeping).toBe(false);
    expect(restored.webContents.loadURL).toHaveBeenCalledWith('https://idle.example.com/one');
  });

  it('d) never drops to zero tabs — closing the last tab spawns a new one', () => {
    const t = tabManager.createTab('https://solo.example.com');
    expect(tabManager.getAllTabs()).toHaveLength(1);

    tabManager.closeTab(t.id);

    const tabs = tabManager.getAllTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.url).toBe('sentry://newtab');
    expect(tabs[0]!.isActive).toBe(true);
  });

  it('e) reorders, duplicates, and pins tabs through the TabManager API', () => {
    const a = tabManager.createTab('https://a.example.com');
    const b = tabManager.createTab('https://b.example.com');
    const c = tabManager.createTab('https://c.example.com');

    tabManager.reorderTabs([c.id, a.id, b.id]);
    expect(tabManager.getTabs().map(t => t.id)).toEqual([c.id, a.id, b.id]);

    const dup = tabManager.duplicateTab(a.id);
    expect(tabManager.getAllTabs()).toHaveLength(4);
    expect(dup.url).toBe('https://a.example.com');

    tabManager.togglePinTab(b.id);
    expect(tabManager.getTabs().find(t => t.id === b.id)?.isPinned).toBe(true);
    tabManager.togglePinTab(b.id);
    expect(tabManager.getTabs().find(t => t.id === b.id)?.isPinned).toBe(false);
  });

  it('f) executes a multi-tab task and returns per-tab results with a combined summary', async () => {
    vi.useFakeTimers();
    const coordinator = new MultiTabCoordinator();
    const task: MultiTabTask = {
      id: 'mt-1',
      instruction: 'Compare laptop prices across tabs',
      tabs: [
        { tabId: 1, subInstruction: 'Check shop A', status: 'pending' },
        { tabId: 2, subInstruction: 'Check shop B', status: 'pending' },
      ],
    };

    const p = coordinator.executeMultiTabTask(task);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await p;

    expect(result.taskId).toBe('mt-1');
    expect(result.success).toBe(true);
    expect(Object.keys(result.tabResults).sort()).toEqual(['1', '2']);
    expect(result.tabResults['1']!.success).toBe(true);
    expect(result.tabResults['2']!.success).toBe(true);
    expect(result.combinedSummary).toBe('All subtasks completed successfully.');
    expect(task.coordinatorState).toBe('completed');
    expect(task.tabs.every(t => t.status === 'completed' && t.progressPercent === 100)).toBe(true);
  });

  it('g) keeps tab groups intact when grouped tabs are unloaded', async () => {
    vi.useFakeTimers();
    const grouper = new TabGrouper();
    const t1 = tabManager.createTab('https://research.example.com/one');
    const t2 = tabManager.createTab('https://research.example.com/two');

    const group = grouper.createGroup('Research', [t1.id, t2.id], 'task-r', true);

    // Age t1 out and unload it
    const unloader = new TabUnloader(tabManager, 30_000);
    vi.advanceTimersByTime(60_000);
    const unloaded = await unloader.checkAndUnload();
    expect(unloaded).toBe(1);
    expect(tabManager.getView(t1.id)).toBeUndefined();

    // The group still references the unloaded tab
    const groups = grouper.getAllGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0]!.tabIds).toContain(t1.id);
    expect(groups[0]!.tabIds).toContain(t2.id);
    expect(grouper.getGroupForTab(t1.id)?.id).toBe(group.id);
  });
});
