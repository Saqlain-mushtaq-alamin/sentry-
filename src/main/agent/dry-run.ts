import * as crypto from 'crypto';
import {
  TaskPlan,
  PageSnapshot,
  DryRunReport,
  DryRunStepResult,
  ProposedAction,
  RiskTier,
  SiteTrustLevel,
} from '../../shared/types';
import { ModelAdapter } from './model-adapter';
import { RiskClassifier } from '../action-layer/risk-classifier';
import { TrustManager } from '../action-layer/trust-manager';

export class DryRunEngine {
  private classifier: RiskClassifier;
  private trustManager: TrustManager;

  constructor(
    private adapter: ModelAdapter,
    classifier?: RiskClassifier,
    trustManager?: TrustManager,
  ) {
    this.classifier = classifier ?? new RiskClassifier();
    this.trustManager = trustManager ?? new TrustManager();
  }

  async executeDryRun(
    plan: TaskPlan,
    currentSnapshot: PageSnapshot,
  ): Promise<DryRunReport> {
    const simulatedSteps: DryRunStepResult[] = [];
    let highestRisk: RiskTier = RiskTier.LOW;
    const warnings: string[] = [];

    const siteTrust = this.trustManager.getTrustLevel(currentSnapshot.url);
    if (siteTrust === SiteTrustLevel.HIGHLY_RESTRICTED) {
      warnings.push(`Domain ${new URL(currentSnapshot.url).hostname} is HIGHLY_RESTRICTED. Actions may be escalated.`);
    } else if (siteTrust === SiteTrustLevel.BLOCKED) {
      warnings.push(`Domain ${new URL(currentSnapshot.url).hostname} is BLOCKED. Actions will be denied.`);
    }

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!step) continue;

      const rawAction = step.expectedActions[0] ?? '';
      const actionParts = rawAction.split(' ');
      const actionType = actionParts[0] || 'click';
      const actionTarget = actionParts[1] || `#step-${step.stepNumber}`;
      const actionValue = actionParts.length > 2 ? actionParts.slice(2).join(' ') : undefined;

      const proposedAction: ProposedAction = {
        id: crypto.randomUUID(),
        type: actionType,
        target: actionTarget,
        value: actionValue,
        riskTier: RiskTier.LOW,
        reason: step.description,
        timestamp: Date.now(),
        tabId: 'dry-run-tab',
        url: currentSnapshot.url,
      };

      const classification = this.classifier.classifyAction(
        proposedAction,
        currentSnapshot,
        siteTrust,
      );

      if (this.riskWeight(classification.tier) > this.riskWeight(highestRisk)) {
        highestRisk = classification.tier;
      }

      if (classification.tier === RiskTier.CRITICAL) {
        warnings.push(`Step ${step.stepNumber} requires a CRITICAL action ("${step.description}"). Will require explicit confirmation.`);
      }

      simulatedSteps.push({
        stepNumber: step.stepNumber,
        description: step.description,
        simulatedAction: proposedAction,
        predictedRisk: classification.tier,
        predictedUrl: currentSnapshot.url,
        explanation: classification.reasons.join('; ') || 'Simulated step safely evaluated.',
      });
    }

    return {
      steps: simulatedSteps,
      highestRisk,
      estimatedTime: plan.estimatedTime || '~30 seconds',
      warnings,
      confirmedSafe: true, // No real actions executed
    };
  }

  private riskWeight(tier: RiskTier): number {
    switch (tier) {
      case RiskTier.CRITICAL: return 4;
      case RiskTier.HIGH:     return 3;
      case RiskTier.MEDIUM:   return 2;
      case RiskTier.LOW:      return 1;
      default: return 0;
    }
  }
}
