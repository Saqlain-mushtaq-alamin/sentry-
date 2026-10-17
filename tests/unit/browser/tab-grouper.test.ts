import { describe, it, expect } from 'vitest';
import { TabGrouper } from '../../../src/main/browser/tab-grouper';

describe('TabGrouper', () => {
  let grouper: TabGrouper;

  const createGrouper = () => new TabGrouper();

  it('createGroup assigns an id, color and copies the provided tab ids', () => {
    grouper = createGrouper();
    const group = grouper.createGroup('Research', ['tab-1', 'tab-2']);

    expect(group.id).toMatch(/^group_/);
    expect(group.name).toBe('Research');
    expect(group.color).toBe('blue');
    expect(group.tabIds).toEqual(['tab-1', 'tab-2']);
    expect(group.autoCreated).toBe(false);
    expect(group.autoCloseOnComplete).toBe(false);
  });

  it('createGroup sets autoCloseOnComplete only when the group is auto-created', () => {
    grouper = createGrouper();
    const manual = grouper.createGroup('Manual', ['a']);
    const auto = grouper.createGroup('Auto', ['b'], 'task-1', true);

    expect(manual.autoCreated).toBe(false);
    expect(manual.autoCloseOnComplete).toBe(false);
    expect(auto.autoCreated).toBe(true);
    expect(auto.autoCloseOnComplete).toBe(true);
    expect(auto.taskId).toBe('task-1');
  });

  it('createGroup cycles through colors for successive groups', () => {
    grouper = createGrouper();
    const first = grouper.createGroup('One', []);
    const second = grouper.createGroup('Two', []);

    expect(first.color).toBe('blue');
    expect(second.color).toBe('red');
  });

  it('addTabToGroup appends the tab and makes getGroupForTab resolve it', () => {
    grouper = createGrouper();
    const group = grouper.createGroup('G', ['tab-1']);

    grouper.addTabToGroup(group.id, 'tab-2');

    expect(group.tabIds).toContain('tab-2');
    expect(grouper.getGroupForTab('tab-2')?.id).toBe(group.id);
  });

  it('addTabToGroup ignores duplicate tab ids and unknown groups', () => {
    grouper = createGrouper();
    const group = grouper.createGroup('G', ['tab-1']);

    grouper.addTabToGroup(group.id, 'tab-1');
    grouper.addTabToGroup('missing-group', 'tab-9');

    expect(group.tabIds).toEqual(['tab-1']);
    expect(grouper.getGroupForTab('tab-9')).toBeUndefined();
  });

  it('removeTabFromGroup removes the mapping but keeps a non-empty group alive', () => {
    grouper = createGrouper();
    const group = grouper.createGroup('G', ['tab-1', 'tab-2']);

    grouper.removeTabFromGroup(group.id, 'tab-1');

    expect(group.tabIds).toEqual(['tab-2']);
    expect(grouper.getGroupForTab('tab-1')).toBeUndefined();
    expect(grouper.getAllGroups()).toHaveLength(1);
  });

  it('removeTabFromGroup auto-deletes the group when it becomes empty', () => {
    grouper = createGrouper();
    const group = grouper.createGroup('G', ['tab-1']);

    grouper.removeTabFromGroup(group.id, 'tab-1');

    expect(grouper.getAllGroups()).toHaveLength(0);
    expect(grouper.getGroupForTab('tab-1')).toBeUndefined();
  });

  it('removeTabFromGroup is a no-op for unknown groups', () => {
    grouper = createGrouper();
    expect(() => grouper.removeTabFromGroup('missing', 'tab-1')).not.toThrow();
  });

  it('getAllGroups returns every active group', () => {
    grouper = createGrouper();
    grouper.createGroup('A', ['a1']);
    grouper.createGroup('B', ['b1']);

    const groups = grouper.getAllGroups();

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.name).sort()).toEqual(['A', 'B']);
  });

  it('handleTaskComplete destroys every group created for that task and clears tab mappings', () => {
    grouper = createGrouper();
    const taskGroup = grouper.createGroup('Task tabs', ['t1', 't2'], 'task-42', true);
    const otherTaskGroup = grouper.createGroup('Other', ['o1'], 'task-99', true);
    const noTaskGroup = grouper.createGroup('Pinned', ['p1']);

    grouper.handleTaskComplete('task-42');

    expect(grouper.getAllGroups().map((g) => g.id)).toEqual([otherTaskGroup.id, noTaskGroup.id]);
    expect(grouper.getGroupForTab('t1')).toBeUndefined();
    expect(grouper.getGroupForTab('t2')).toBeUndefined();
    expect(grouper.getGroupForTab('o1')?.id).toBe(otherTaskGroup.id);
    expect(grouper.getGroupForTab('p1')?.id).toBe(noTaskGroup.id);
    expect(taskGroup.tabIds).toEqual(['t1', 't2']); // group object itself is untouched
  });

  it('handleTaskComplete is a no-op when no group matches the task id', () => {
    grouper = createGrouper();
    grouper.createGroup('G', ['g1'], 'task-1', true);

    grouper.handleTaskComplete('task-does-not-exist');

    expect(grouper.getAllGroups()).toHaveLength(1);
  });

  it('supports numeric tab ids', () => {
    grouper = createGrouper();
    const group = grouper.createGroup('Numeric', [1, 2]);

    expect(grouper.getGroupForTab(1)?.id).toBe(group.id);
    grouper.removeTabFromGroup(group.id, 1);
    expect(grouper.getGroupForTab(1)).toBeUndefined();
    expect(group.tabIds).toEqual([2]);
  });
});
