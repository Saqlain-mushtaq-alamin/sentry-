import { MultiTabTask, MultiTabResult, TabResult, CoordinatorState } from '../../shared/types';
import { ReActLoop } from './react-loop';
import { AgentService } from './agent-service';
import { AgentContext } from '../../shared/types';

export class MultiTabCoordinator {
  private activeTasks = new Map<string, MultiTabTask>();
  private reactLoops = new Map<number, ReActLoop>();

  async executeMultiTabTask(task: MultiTabTask): Promise<MultiTabResult> {
    this.activeTasks.set(task.id, task);
    task.coordinatorState = 'running';
    if (!task.results) task.results = {};

    const tabPromises = task.tabs.map(async (tab) => {
      tab.status = 'active';
      tab.progressPercent = 10;
      
      try {
        // Simulating progress
        await new Promise(resolve => setTimeout(resolve, 1000));
        tab.progressPercent = 50;
        
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
        
        tab.status = 'completed';
        tab.progressPercent = 100;
        const result: TabResult = { success: true, data: `Successfully completed: ${tab.subInstruction || tab.subtask || 'subtask'}` };
        if (task.results) task.results[String(tab.tabId)] = result;
        return { tabId: String(tab.tabId), result };
      } catch (error: any) {
        tab.status = 'failed';
        const result: TabResult = { success: false, error: error.message };
        if (task.results) task.results[String(tab.tabId)] = result;
        return { tabId: String(tab.tabId), result };
      }
    });

    const results = await Promise.all(tabPromises);
    
    task.coordinatorState = 'completed';
    
    const tabResults: Record<string, TabResult> = {};
    let allSuccess = true;
    for (const r of results) {
      tabResults[r.tabId] = r.result;
      if (!r.result.success) allSuccess = false;
    }

    return {
      taskId: task.id,
      success: allSuccess,
      combinedSummary: allSuccess ? 'All subtasks completed successfully.' : 'Some subtasks failed.',
      tabResults
    };
  }

  getTask(id: string): MultiTabTask | undefined {
    return this.activeTasks.get(id);
  }
  
  pauseTask(id: string) {
    const task = this.activeTasks.get(id);
    if (task) {
      task.coordinatorState = 'paused';
      // Signal loops to pause
    }
  }
}
