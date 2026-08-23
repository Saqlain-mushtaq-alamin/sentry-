import {
  ProposedAction,
  PageSnapshot,
  FirewallDecision,
  RiskTier,
  SiteTrustLevel
} from '../../shared/types';
import { RiskClassifier } from './risk-classifier';
import { TrustManager } from './trust-manager';
import { PermissionManager } from './permission-manager';
import { AuditLog } from './audit-log';

export class ActionFirewall {
  constructor(
    private classifier: RiskClassifier,
    private trustManager: TrustManager,
    private permissionManager: PermissionManager,
    private auditLog: AuditLog
  ) {}

  public async evaluateAction(
    action: ProposedAction,
    pageSnapshot: PageSnapshot
  ): Promise<FirewallDecision> {
    const urlObj = new URL(action.url);
    const domain = urlObj.hostname;
    
    // 1. Check site trust
    const siteTrust = this.trustManager.getTrustLevel(action.url);
    
    // 2. Classify action
    const classification = this.classifier.classifyAction(action, pageSnapshot, siteTrust);
    
    const decision: FirewallDecision = {
      actionId: action.id,
      allowed: false,
      requiresConfirmation: false,
      riskTier: classification.tier,
      classification,
      siteTrust,
      explanation: '',
      detailedReason: classification.reasons.join('; ')
    };

    // 3. Check permission grants
    const actionPattern = `${action.type}:${action.target}`;
    const matchedGrant = this.permissionManager.hasGrant(domain, actionPattern, classification.tier);
    if (matchedGrant) {
      decision.matchedGrant = matchedGrant;
    }

    // 4. Make decision
    if (siteTrust === SiteTrustLevel.BLOCKED) {
      decision.allowed = false;
      decision.explanation = 'This site is blocked by your security settings. No actions are allowed.';
    } else if (siteTrust === SiteTrustLevel.READ_ONLY && classification.tier !== RiskTier.LOW) {
      decision.allowed = false;
      decision.explanation = 'This site is marked as Read-Only. State-changing actions are blocked.';
    } else if (classification.tier === RiskTier.CRITICAL) {
      decision.allowed = false;
      decision.requiresConfirmation = true;
      decision.explanation = 'CRITICAL action requires explicit approval.';
    } else if (matchedGrant) {
      decision.allowed = true;
      decision.explanation = 'Action pre-approved by user grant.';
    } else if (classification.tier === RiskTier.LOW) {
      decision.allowed = true;
      decision.explanation = 'Low risk action allowed automatically.';
    } else if (classification.tier === RiskTier.MEDIUM) {
      decision.allowed = true;
      decision.explanation = 'Medium risk action allowed with undo option.';
    } else if (classification.tier === RiskTier.HIGH) {
      decision.allowed = false;
      decision.requiresConfirmation = true;
      decision.explanation = 'HIGH risk action requires confirmation.';
    }

    // 5. Log the decision
    this.auditLog.log({
      actionId: action.id,
      action,
      decision,
      wasExecuted: decision.allowed,
      wasUndone: false
    });

    return decision;
  }
}
