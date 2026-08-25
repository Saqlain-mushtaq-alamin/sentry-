/**
 * ContextManager — Task 5.6
 *
 * Builds the message history array sent to the model on each ReAct step.
 * Manages token budgets to prevent exceeding context window limits.
 */

import { ChatMessage, ActionLogEntry, AgentTask, PageSnapshot } from '../../shared/types';
import { formatSnapshotForModel } from './prompts/system-prompt';

export class ContextManager {
  private readonly SYSTEM_PROMPT_BUDGET = 1200; // reserved tokens
  private readonly SNAPSHOT_BUDGET      = 6000;
  private readonly HISTORY_BUDGET       = 4000;

  buildMessageHistory(
    task: AgentTask,
    currentSnapshot: PageSnapshot,
    actionLog: ActionLogEntry[],
    contextLimit: number,
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // 1. User's original instruction (always first)
    messages.push({
      role: 'user',
      content: `Task: ${task.instruction}`,
    });

    // 2. Summarise previous action log (most recent 5, older ones summarised)
    if (actionLog.length > 0) {
      const recentLog = actionLog.slice(-5);
      const olderCount = actionLog.length - recentLog.length;

      const historyLines: string[] = [];
      if (olderCount > 0) {
        historyLines.push(`(${olderCount} earlier actions omitted for brevity)`);
      }
      for (const entry of recentLog) {
        const status = entry.executed ? '✅ executed' : '❌ blocked';
        historyLines.push(
          `• [${status}] ${entry.action.type} on "${entry.action.target}"` +
          ` — ${entry.action.reason}` +
          (entry.decision.explanation ? ` (${entry.decision.explanation})` : ''),
        );
      }

      messages.push({
        role: 'assistant',
        content: `Previous steps:\n${historyLines.join('\n')}`,
      });
    }

    // 3. Current page snapshot (most important — always include)
    const snapshotText = formatSnapshotForModel(currentSnapshot, this.SNAPSHOT_BUDGET);
    messages.push({
      role: 'user',
      content: `Current page state:\n${snapshotText}\n\nWhat is your next action?`,
    });

    return messages;
  }
}
