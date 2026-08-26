import * as crypto from 'crypto';
import { Recipe, RecipeStep, ActionResult, TaskState, ActionLogEntry, ProposedAction, RiskTier } from '../../shared/types';
import { ActionExecutor } from '../cdp/action-executor';
import { ActionFirewall } from '../action-layer/action-firewall';
import { PageObserver } from '../cdp/page-observer';

export interface ReplayResult {
  state: TaskState;
  actionLog: ActionLogEntry[];
  error?: string;
}

export class RecipeReplayEngine {
  constructor(
    private executor: ActionExecutor,
    private firewall: ActionFirewall,
    private observer: PageObserver
  ) {}

  public async replay(tabId: string, recipe: Recipe, variables: Record<string, string>): Promise<ReplayResult> {
    const actionLog: ActionLogEntry[] = [];

    for (const step of recipe.steps) {
      let snapshot;
      try {
        snapshot = await this.observer.getPageSnapshot(tabId);
      } catch (err) {
        return { state: TaskState.FAILED, actionLog, error: 'Failed to get page snapshot.' };
      }

      // Substitute variables
      let finalValue: string | undefined;
      if (typeof step.value === 'object' && step.value !== null && 'type' in step.value && step.value.type === 'variable') {
        finalValue = variables[step.value.name] || '';
      } else if (typeof step.value === 'string') {
        finalValue = step.value;
      }

      const proposed: ProposedAction = {
        id: crypto.randomUUID(),
        type: step.actionType as any,
        target: step.target.primary,
        value: finalValue,
        riskTier: step.riskTier,
        reason: `Replaying recipe step ${step.order}`,
        timestamp: Date.now(),
        tabId,
        url: snapshot.url,
      };

      // Pass through Action Firewall
      // evaluateAction can be async? In ReactLoop it is NOT async. But the error says: Property 'riskTier' does not exist on type 'Promise<FirewallDecision>'. 
      // Ah! ActionFirewall.evaluateAction is async! Let's await it.
      const decision = await this.firewall.evaluateAction(proposed, snapshot);
      
      const logEntry: ActionLogEntry = {
        timestamp: Date.now(),
        action: proposed,
        decision: decision,
        executed: false,
      };
      actionLog.push(logEntry);

      if (!decision.allowed) {
        return { state: TaskState.FAILED, actionLog, error: `Firewall blocked action: ${decision.explanation}` };
      }

      if (decision.requiresConfirmation) {
        return { state: TaskState.PAUSED, actionLog, error: 'Recipe requires user confirmation.' };
      }

      // Execute Action
      const actionResult = await this.executor.execute(tabId, {
        type: proposed.type as any,
        target: proposed.target,
        value: proposed.value,
        direction: 'down',
        amount: 500,
      });

      if (!actionResult.success) {
        // Fallbacks would be handled here
        return { state: TaskState.FAILED, actionLog, error: `Replay failed at step ${step.order}: ${actionResult.error}` };
      }
      
      if (step.waitCondition) {
        // Handle wait conditions like networkIdle, etc. (Simulated delay for now)
        await new Promise(resolve => setTimeout(resolve, step.waitCondition!.timeoutMs));
      } else {
        await new Promise(resolve => setTimeout(resolve, 500)); // Default pause between steps
      }
    }

    return { state: TaskState.COMPLETED, actionLog };
  }
}
