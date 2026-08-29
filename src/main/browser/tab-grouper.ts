import { TabGroup } from '../../shared/types';

export class TabGrouper {
  private groups = new Map<string, TabGroup>();
  private tabToGroupMap = new Map<string | number, string>();
  
  private colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  private colorIndex = 0;

  createGroup(name: string, tabIds: (string | number)[], taskId?: string, autoCreated = false): TabGroup {
    const id = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const color = this.colors[this.colorIndex % this.colors.length] || 'blue';
    this.colorIndex++;
    
    const group: TabGroup = {
      id,
      name,
      color,
      tabIds: [...tabIds],
      taskId,
      autoCreated,
      autoCloseOnComplete: autoCreated
    };
    
    this.groups.set(id, group);
    tabIds.forEach(tabId => this.tabToGroupMap.set(tabId, id));
    
    return group;
  }

  addTabToGroup(groupId: string, tabId: string | number) {
    const group = this.groups.get(groupId);
    if (group && !group.tabIds.includes(tabId)) {
      group.tabIds.push(tabId);
      this.tabToGroupMap.set(tabId, groupId);
    }
  }

  removeTabFromGroup(groupId: string, tabId: string | number) {
    const group = this.groups.get(groupId);
    if (group) {
      group.tabIds = group.tabIds.filter(id => id !== tabId);
      this.tabToGroupMap.delete(tabId);
      
      if (group.tabIds.length === 0) {
        this.groups.delete(groupId);
      }
    }
  }

  getGroupForTab(tabId: string | number): TabGroup | undefined {
    const groupId = this.tabToGroupMap.get(tabId);
    return groupId ? this.groups.get(groupId) : undefined;
  }

  getAllGroups(): TabGroup[] {
    return Array.from(this.groups.values());
  }

  handleTaskComplete(taskId: string) {
    for (const [id, group] of this.groups.entries()) {
      if (group.taskId === taskId) {
        group.tabIds.forEach(tabId => this.tabToGroupMap.delete(tabId));
        this.groups.delete(id);
      }
    }
  }
}
