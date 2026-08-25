/**
 * TaskStateMachine — Task 5.9
 *
 * Manages the lifecycle of a single agent task.
 * Transitions: IDLE → PLANNING → AWAITING_APPROVAL → EXECUTING ↔ AWAITING_CONFIRMATION
 *                                                            ↓
 *                                                    PAUSED ↔ COMPLETED / FAILED
 */

import { TaskState } from '../../shared/types';

export class TaskStateMachine {
  private state: TaskState = TaskState.IDLE;
  private pausedPromiseResolve?: () => void;
  private stoppedFlag = false;

  getState(): TaskState { return this.state; }

  transition(next: TaskState): void {
    console.debug(`[TaskSM] ${this.state} → ${next}`);
    this.state = next;
  }

  pause(): void {
    if (this.state === TaskState.EXECUTING) {
      this.transition(TaskState.PAUSED);
    }
  }

  stop(): void {
    this.stoppedFlag = true;
    this.pausedPromiseResolve?.(); // unblock waitForResume if paused
    this.transition(TaskState.FAILED);
  }

  resume(): void {
    if (this.state === TaskState.PAUSED) {
      this.transition(TaskState.EXECUTING);
      this.pausedPromiseResolve?.();
    }
  }

  isPaused(): boolean  { return this.state === TaskState.PAUSED; }
  isStopped(): boolean { return this.stoppedFlag; }

  async waitForResume(): Promise<void> {
    if (!this.isPaused()) return;
    await new Promise<void>(resolve => {
      this.pausedPromiseResolve = resolve;
    });
    this.pausedPromiseResolve = undefined;
  }

  reset(): void {
    this.state = TaskState.IDLE;
    this.stoppedFlag = false;
    this.pausedPromiseResolve = undefined;
  }
}
