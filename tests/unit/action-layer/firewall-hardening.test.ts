import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionFirewall } from '../../../src/main/action-layer/action-firewall';
import { RiskClassifier } from '../../../src/main/action-layer/risk-classifier';
import { TrustManager } from '../../../src/main/action-layer/trust-manager';
import { PermissionManager } from '../../../src/main/action-layer/permission-manager';
import { AuditLog } from '../../../src/main/action-layer/audit-log';
import {
  ProposedAction,
  PageSnapshot,
  RiskTier,
  SiteTrustLevel,
} from '../../../src/shared/types';

describe('Task 14.4 — Action Firewall & Security Hardening Audit', () => {
  let classifier: RiskClassifier;
  let trustManager: TrustManager;
  let permissionManager: PermissionManager;
  let auditLog: AuditLog;
  let firewall: ActionFirewall;

  const mockSnapshot: PageSnapshot = {
    url: 'https://example.com/checkout',
    title: 'Example Store',
    timestamp: Date.now(),
    dom: { tag: 'body', children: [] },
    accessibilityTree: [],
    visibleText: 'Order summary',
    forms: [],
    links: [],
    interactiveElements: [
      { index: 0, tag: 'input', role: 'textbox', label: 'CVV code', selector: '#cvv', isVisible: true, isEnabled: true, type: 'password' },
      { index: 1, tag: 'input', role: 'checkbox', label: 'Agree to terms', selector: '#agree', isVisible: true, isEnabled: true, type: 'checkbox' },
      { index: 2, tag: 'input', role: 'file', label: 'Upload verification document', selector: '#upload', isVisible: true, isEnabled: true, type: 'file' },
      { index: 3, tag: 'button', role: 'button', label: 'Submit payment', selector: '#pay', isVisible: true, isEnabled: true, type: 'submit' },
    ],
  };

  beforeEach(() => {
    classifier = new RiskClassifier();
    trustManager = new TrustManager();
    permissionManager = new PermissionManager();
    auditLog = new AuditLog();
    firewall = new ActionFirewall(classifier, trustManager, permissionManager, auditLog);
  });

  it('blocks actions targeting Sentry internal UI or schemes', async () => {
    const maliciousAction1: ProposedAction = {
      id: 'act-ui-1',
      type: 'click',
      target: '#sentry-command-box',
      riskTier: RiskTier.LOW,
      reason: 'Manipulate browser UI',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'sentry://settings',
    };

    const decision1 = await firewall.evaluateAction(maliciousAction1, mockSnapshot);
    expect(decision1.allowed).toBe(false);
    expect(decision1.riskTier).toBe(RiskTier.CRITICAL);
    expect(decision1.explanation).toContain('Security violation');

    const maliciousAction2: ProposedAction = {
      id: 'act-ui-2',
      type: 'navigate',
      target: 'javascript:alert(1)',
      riskTier: RiskTier.LOW,
      reason: 'Run javascript pseudo-protocol',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'javascript:alert(1)',
    };

    const decision2 = await firewall.evaluateAction(maliciousAction2, mockSnapshot);
    expect(decision2.allowed).toBe(false);
    expect(decision2.riskTier).toBe(RiskTier.CRITICAL);
  });

  it('ignores model attempt to set its own low risk level for critical actions', async () => {
    const criticalAction: ProposedAction = {
      id: 'act-spoof-risk',
      type: 'click',
      target: '#pay', // Payment is CRITICAL
      riskTier: RiskTier.LOW, // Model maliciously claims it is LOW
      reason: 'Click the button',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'https://example.com/checkout',
    };

    const decision = await firewall.evaluateAction(criticalAction, mockSnapshot);
    expect(decision.riskTier).toBe(RiskTier.CRITICAL);
    expect(decision.allowed).toBe(false);
    expect(decision.requiresConfirmation).toBe(true);
  });

  it('rate limits rapid-fire action execution to prevent bypass attempts', async () => {
    const action1: ProposedAction = {
      id: 'act-rapid-1',
      type: 'click',
      target: '#agree',
      riskTier: RiskTier.LOW,
      reason: 'Accept terms',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'https://example.com/checkout',
    };

    const action2: ProposedAction = {
      id: 'act-rapid-2',
      type: 'click',
      target: '#agree',
      riskTier: RiskTier.LOW,
      reason: 'Accept terms rapidly',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'https://example.com/checkout',
    };

    // First action evaluates normally
    const decision1 = await firewall.evaluateAction(action1, mockSnapshot);
    expect(decision1.riskTier).toBeDefined();

    // Second action fired immediately within < 25ms
    const decision2 = await firewall.evaluateAction(action2, mockSnapshot);
    expect(decision2.allowed).toBe(false);
    expect(decision2.explanation).toContain('rate limit exceeded');
  });

  it('strictly rejects pre-approval or bulk-approval for CRITICAL actions', () => {
    // Attempting to grant permanent or site-level permission for CRITICAL tier must throw
    expect(() => {
      permissionManager.grant('example.com', 'click:#pay', 'site', RiskTier.CRITICAL);
    }).toThrow('CRITICAL actions can only have scope="once"');

    // hasGrant must never return pre-approval for CRITICAL risk
    const grant = permissionManager.hasGrant('example.com', 'click:#pay', RiskTier.CRITICAL);
    expect(grant).toBeUndefined();
  });

  it('verifies HIGHLY_RESTRICTED domain escalates all state-changing actions', async () => {
    trustManager.setTrustLevel('restricted.com', SiteTrustLevel.HIGHLY_RESTRICTED);

    const restrictedSnapshot: PageSnapshot = {
      ...mockSnapshot,
      url: 'https://restricted.com/account',
    };

    // MEDIUM risk action (checking checkbox)
    const mediumAction: ProposedAction = {
      id: 'act-med',
      type: 'click',
      target: '#agree',
      riskTier: RiskTier.MEDIUM,
      reason: 'Toggle checkbox',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'https://restricted.com/account',
    };

    // Wait a brief tick to avoid rate limiter
    await new Promise((r) => setTimeout(r, 30));

    const decisionMed = await firewall.evaluateAction(mediumAction, restrictedSnapshot);
    // Escalated from MEDIUM to HIGH
    expect(decisionMed.riskTier).toBe(RiskTier.HIGH);
    expect(decisionMed.requiresConfirmation).toBe(true);

    // Wait 30ms
    await new Promise((r) => setTimeout(r, 30));

    // File upload action (HIGH risk normally)
    const highAction: ProposedAction = {
      id: 'act-file',
      type: 'click',
      target: '#upload',
      riskTier: RiskTier.HIGH,
      reason: 'Upload file',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'https://restricted.com/account',
    };

    const decisionHigh = await firewall.evaluateAction(highAction, restrictedSnapshot);
    // Escalated from HIGH to CRITICAL
    expect(decisionHigh.riskTier).toBe(RiskTier.CRITICAL);
    expect(decisionHigh.requiresConfirmation).toBe(true);
  });

  it('redacts sensitive values in AuditLog entries', () => {
    const sensitiveAction: ProposedAction = {
      id: 'act-pwd',
      type: 'type',
      target: '#password-field',
      value: 'SuperSecret123!',
      riskTier: RiskTier.CRITICAL,
      reason: 'Enter password',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'https://example.com/login',
    };

    const logEntry = auditLog.log({
      actionId: sensitiveAction.id,
      action: sensitiveAction,
      decision: {
        actionId: sensitiveAction.id,
        allowed: false,
        requiresConfirmation: true,
        riskTier: RiskTier.CRITICAL,
        classification: { tier: RiskTier.CRITICAL, reasons: [], policyRulesFired: [], confidence: 1 },
        siteTrust: SiteTrustLevel.READ_ACT,
        explanation: 'Sensitive password',
      },
      wasExecuted: false,
      wasUndone: false,
    });

    expect(logEntry.action.value).toBe('[REDACTED]');
  });
});
