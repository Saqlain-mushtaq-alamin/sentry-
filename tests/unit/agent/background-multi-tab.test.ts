import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackgroundTaskRunner } from '../../../src/main/agent/background-runner';
import { MultiTabCoordinator } from '../../../src/main/agent/multi-tab-coordinator';
import { BackgroundTask, MultiTabTask, TaskState } from '../../../src/shared/types';

function makeBackgroundTask(over: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: `bg-${Math.random().toString(36).slice(2, 10)}`,
    instruction: 'Monitor flight prices',
    priority: 'normal',
    status: TaskState.IDLE,
    progress: 0,
    startedAt: Date.now(),
    notifications: [],
    ...over,
  };
}

function makeMultiTabTask(over: Partial<MultiTabTask> = {}): MultiTabTask {
  return {
    id: `mt-${Math.random().toString(36).slice(2, 10)}`,
    instruction: 'Compare two shops',
    tabs: [
      { tabId: 1, url: 'https://shop-a.com', subInstruction: 'Read shop A', status: 'pending' },
      { tabId: 2, url: 'https://shop-b.com', subInstruction: 'Read shop B', status: 'pending' },
    ],
    ...over,
  };
}

describe('BackgroundTaskRunner', () => {
  let runner: BackgroundTaskRunner;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    runner = new BackgroundTaskRunner();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submit() registers the task, starts executing it, and completes it after the simulated delays', async () => {
    const task = makeBackgroundTask();
    await runner.submit(task);

    expect(runner.getTasks()).toHaveLength(1);
    expect(runner.getTasks()[0]!.id).toBe(task.id);
    expect(task.status).toBe(TaskState.EXECUTING);
    expect(task.progress).toBe(10);

    await vi.advanceTimersByTimeAsync(2000);
    expect(task.progress).toBe(50);
    expect(task.status).toBe(TaskState.EXECUTING);

    await vi.advanceTimersByTimeAsync(2000);
    expect(task.progress).toBe(100);
    expect(task.status).toBe(TaskState.COMPLETED);
    expect(task.notifications.some(n => n.type === 'success')).toBe(true);
  });

  it('high-priority tasks flip to AWAITING_CONFIRMATION with a notification, then resume and finish', async () => {
    const task = makeBackgroundTask({ priority: 'high' });
    await runner.submit(task);
    expect(task.status).toBe(TaskState.EXECUTING);

    await vi.advanceTimersByTimeAsync(2000);
    expect(task.status).toBe(TaskState.AWAITING_CONFIRMATION);
    const confirmation = task.notifications.find(n => n.type === 'confirmation');
    expect(confirmation).toBeDefined();
    expect(confirmation!.message).toContain('CAPTCHA');

    await vi.advanceTimersByTimeAsync(3000);
    expect(task.status).toBe(TaskState.EXECUTING);

    await vi.advanceTimersByTimeAsync(2000);
    expect(task.status).toBe(TaskState.COMPLETED);
    expect(task.notifications.some(n => n.type === 'success')).toBe(true);
  });

  it('caps concurrency at 3 and queues the extras until slots free up', async () => {
    const tasks = [1, 2, 3, 4, 5].map(i => makeBackgroundTask({ id: `task-${i}` }));
    for (const t of tasks) {
      await runner.submit(t);
    }

    // Only 3 run immediately; the other 2 remain queued (never added to activeTasks)
    expect(runner.getTasks()).toHaveLength(3);
    expect(tasks.slice(0, 3).every(t => t.status === TaskState.EXECUTING)).toBe(true);
    expect(tasks.slice(3).every(t => t.status === TaskState.IDLE)).toBe(true);

    // All three of the first batch complete at t=4000 -> the queued tasks 4 and 5 start
    await vi.advanceTimersByTimeAsync(4000);
    expect(runner.getTasks()).toHaveLength(5);
    expect(tasks[3]!.status).toBe(TaskState.EXECUTING);
    expect(tasks[4]!.status).toBe(TaskState.EXECUTING);

    // Second batch runs its own simulated delays and finishes at t=8000
    await vi.advanceTimersByTimeAsync(4000);
    expect(tasks.every(t => t.status === TaskState.COMPLETED)).toBe(true);
  });
});

describe('MultiTabCoordinator', () => {
  let coordinator: MultiTabCoordinator;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    coordinator = new MultiTabCoordinator();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executeMultiTabTask runs every tab and returns per-tab results with a combined summary', async () => {
    const task = makeMultiTabTask();
    const pending = coordinator.executeMultiTabTask(task);

    expect(coordinator.getTask(task.id)).toBe(task);
    expect(task.coordinatorState).toBe('running');
    expect(task.tabs[0]!.status).toBe('active');
    expect(task.tabs[0]!.progressPercent).toBe(10);

    await vi.advanceTimersByTimeAsync(1000);
    expect(task.tabs[0]!.progressPercent).toBe(50);

    // Worst case per tab: 1000 + 1500 + 2000 = 4500ms
    await vi.advanceTimersByTimeAsync(3500);
    const result = await pending;

    expect(result.taskId).toBe(task.id);
    expect(result.success).toBe(true);
    expect(result.combinedSummary).toBe('All subtasks completed successfully.');
    expect(Object.keys(result.tabResults).sort()).toEqual(['1', '2']);
    expect(result.tabResults['1']).toEqual({ success: true, data: 'Successfully completed: Read shop A' });
    expect(result.tabResults['2']!.success).toBe(true);

    expect(task.tabs[0]!.status).toBe('completed');
    expect(task.tabs[0]!.progressPercent).toBe(100);
    expect(task.tabs[1]!.status).toBe('completed');
    expect(task.coordinatorState).toBe('completed');
    expect(task.results?.['1']!.success).toBe(true);
  });

  it('getTask returns the registered task by id', async () => {
    const task = makeMultiTabTask({ id: 'mt-lookup' });
    const pending = coordinator.executeMultiTabTask(task);
    expect(coordinator.getTask('mt-lookup')).toBe(task);
    expect(coordinator.getTask('missing-id')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
  });

  it('pauseTask sets the coordinator state to paused', async () => {
    const task = makeMultiTabTask();
    const pending = coordinator.executeMultiTabTask(task);

    coordinator.pauseTask(task.id);
    expect(coordinator.getTask(task.id)?.coordinatorState).toBe('paused');

    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    // Execution continues and finishes (pause is a UI-level signal in this implementation)
    expect(task.coordinatorState).toBe('completed');
  });

  it('pauseTask on an unknown id is a no-op', () => {
    expect(() => coordinator.pauseTask('does-not-exist')).not.toThrow();
  });
});
