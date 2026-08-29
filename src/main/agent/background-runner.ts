import { BackgroundTask, TaskState, AgentNotification } from '../../shared/types';
import { ReActLoop } from './react-loop';

export class BackgroundTaskRunner {
  private taskQueue: BackgroundTask[] = [];
  private activeTasks = new Map<string, BackgroundTask>();
  private maxConcurrent = 3;
  private runningCount = 0;

  async submit(task: BackgroundTask): Promise<void> {
    this.taskQueue.push(task);
    this.processQueue();
  }

  private async processQueue() {
    if (this.runningCount >= this.maxConcurrent || this.taskQueue.length === 0) {
      return;
    }

    // Sort by priority if needed, for now just take next
    const task = this.taskQueue.shift();
    if (!task) return;

    this.activeTasks.set(task.id, task);
    this.runningCount++;
    task.status = TaskState.EXECUTING;

    this.runTask(task).finally(() => {
      this.runningCount--;
      this.processQueue();
    });
  }

  private async runTask(task: BackgroundTask) {
    try {
      // 1. In real implementation, create hidden tabs via browser CDP
      // 2. Initialize ReAct loop with context
      task.progress = 10;
      
      // Simulating some async background work
      await new Promise(resolve => setTimeout(resolve, 2000));
      task.progress = 50;
      
      // Simulate confirmation requirement
      if (task.priority === 'high') {
        task.status = TaskState.AWAITING_CONFIRMATION;
        this.sendNotification(task, {
          id: `notif_${Date.now()}`,
          type: 'confirmation',
          title: 'Background task needs attention',
          message: `"${task.instruction}" hit a CAPTCHA`,
          timestamp: Date.now()
        });
        // wait until confirmed...
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        task.status = TaskState.EXECUTING;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      task.progress = 100;
      task.status = TaskState.COMPLETED;
      
      this.sendNotification(task, {
        id: `notif_${Date.now()}`,
        type: 'success',
        title: 'Background Task Complete',
        message: `Task: ${task.instruction} finished successfully.`,
        timestamp: Date.now()
      });

    } catch (err: any) {
      task.status = TaskState.FAILED;
      this.sendNotification(task, {
        id: `notif_${Date.now()}`,
        type: 'error',
        title: 'Background Task Failed',
        message: err.message,
        timestamp: Date.now()
      });
    }
  }

  private sendNotification(task: BackgroundTask, notification: AgentNotification) {
    task.notifications.push(notification);
    // In real app, IPC send to renderer here to update UI NotificationCenter
    // ipcMain.emit('agent-notification', notification);
  }

  getTasks() {
    return Array.from(this.activeTasks.values());
  }
}
