import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionFirewall } from '../../../src/main/action-layer/action-firewall';
import { RiskClassifier } from '../../../src/main/action-layer/risk-classifier';
import { TrustManager } from '../../../src/main/action-layer/trust-manager';
import { PermissionManager } from '../../../src/main/action-layer/permission-manager';
import { AuditLog } from '../../../src/main/action-layer/audit-log';
import { ProposedAction, RiskTier, SiteTrustLevel, PageSnapshot } from '../../../src/shared/types';

describe('ActionFirewall', () => {
  let firewall: ActionFirewall;
  let classifier: RiskClassifier;
  let trustManager: TrustManager;
  let permissionManager: PermissionManager;
  let auditLog: AuditLog;
  let mockSnapshot: PageSnapshot;

  beforeEach(() => {
    classifier = new RiskClassifier();
    trustManager = new TrustManager();
    permissionManager = new PermissionManager();
    auditLog = new AuditLog(); // In-memory
    firewall = new ActionFirewall(classifier, trustManager, permissionManager, auditLog);

    mockSnapshot = {
      url: 'https://example.com',
      title: 'Test',
      timestamp: Date.now(),
      dom: { tag: 'body', children: [] },
      accessibilityTree: [],
      visibleText: '',
      forms: [],
      links: [],
      interactiveElements: [],
      estimatedTokenCount: 10
    };
  });

  const createAction = (type: string, target: string): ProposedAction => ({
    id: 'test-action-1',
    type,
    target,
    riskTier: RiskTier.LOW,
    reason: 'Testing',
    timestamp: Date.now(),
    tabId: 'tab-1',
    url: 'https://example.com'
  });

  it('allows LOW risk actions immediately', async () => {
    // Mock classifier to return LOW
    vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.LOW, reasons: [], policyRulesFired: [], confidence: 1
    });

    const action = createAction('scroll', '');
    const decision = await firewall.evaluateAction(action, mockSnapshot);

    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(false);
  });

  it('allows MEDIUM risk actions immediately with undo option noted', async () => {
    vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.MEDIUM, reasons: [], policyRulesFired: [], confidence: 1
    });

    const action = createAction('type', '#search');
    const decision = await firewall.evaluateAction(action, mockSnapshot);

    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(false);
  });

  it('blocks HIGH risk actions and requires confirmation', async () => {
    vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.HIGH, reasons: [], policyRulesFired: [], confidence: 1
    });

    const action = createAction('click', '#submit');
    const decision = await firewall.evaluateAction(action, mockSnapshot);

    expect(decision.allowed).toBe(false);
    expect(decision.requiresConfirmation).toBe(true);
  });

  it('blocks CRITICAL risk actions and requires confirmation', async () => {
    vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.CRITICAL, reasons: [], policyRulesFired: [], confidence: 1
    });

    const action = createAction('type', '#password');
    const decision = await firewall.evaluateAction(action, mockSnapshot);

    expect(decision.allowed).toBe(false);
    expect(decision.requiresConfirmation).toBe(true);
  });

  it('allows HIGH actions if pre-approved by user grant', async () => {
    vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.HIGH, reasons: [], policyRulesFired: [], confidence: 1
    });

    permissionManager.grant('example.com', 'click:#submit', 'site', RiskTier.HIGH);

    const action = createAction('click', '#submit');
    const decision = await firewall.evaluateAction(action, mockSnapshot);

    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(false);
  });

  it('never allows CRITICAL actions via pre-approval', async () => {
    vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.CRITICAL, reasons: [], policyRulesFired: [], confidence: 1
    });

    // Attempting to grant CRITICAL in bulk should throw
    expect(() => {
        permissionManager.grant('example.com', 'type:#password', 'site', RiskTier.CRITICAL);
    }).toThrow();

    const action = createAction('type', '#password');
    const decision = await firewall.evaluateAction(action, mockSnapshot);

    expect(decision.allowed).toBe(false);
    expect(decision.requiresConfirmation).toBe(true);
  });

  it('blocks everything on BLOCKED domains', async () => {
    vi.spyOn(trustManager, 'getTrustLevel').mockReturnValue(SiteTrustLevel.BLOCKED);
    
    // Even a LOW action is blocked
    vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.LOW, reasons: [], policyRulesFired: [], confidence: 1
    });

    const action = createAction('scroll', '');
    const decision = await firewall.evaluateAction(action, mockSnapshot);

    expect(decision.allowed).toBe(false);
    expect(decision.explanation).toContain('blocked by your security settings');
  });

  it('blocks state-changing actions on READ_ONLY domains', async () => {
    vi.spyOn(trustManager, 'getTrustLevel').mockReturnValue(SiteTrustLevel.READ_ONLY);
    
    // Medium action
    vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.MEDIUM, reasons: [], policyRulesFired: [], confidence: 1
    });

    const action = createAction('type', '#search');
    const decision = await firewall.evaluateAction(action, mockSnapshot);

    expect(decision.allowed).toBe(false);
    expect(decision.explanation).toContain('Read-Only');
  });
  
  it('logs decisions to the audit log', async () => {
     vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.LOW, reasons: [], policyRulesFired: [], confidence: 1
    });

    const action = createAction('scroll', '');
    await firewall.evaluateAction(action, mockSnapshot);
    
    const logs = auditLog.getEntries();
    expect(logs.length).toBe(1);
    expect(logs[0].actionId).toBe('test-action-1');
  });

  it('allows navigation from sentry://newtab to external web URL', async () => {
    vi.spyOn(classifier, 'classifyAction').mockReturnValue({
      tier: RiskTier.LOW, reasons: [], policyRulesFired: [], confidence: 1
    });

    const action: ProposedAction = {
      id: 'nav-test-1',
      type: 'navigate',
      target: 'https://google.com',
      value: 'https://google.com',
      riskTier: RiskTier.LOW,
      reason: 'Go to Google',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'sentry://newtab',
    };

    const decision = await firewall.evaluateAction(action, mockSnapshot);
    expect(decision.allowed).toBe(true);
    expect(decision.riskTier).not.toBe(RiskTier.CRITICAL);
  });

  it('blocks navigation targeting internal sentry:// or chrome:// destinations', async () => {
    const action: ProposedAction = {
      id: 'nav-test-2',
      type: 'navigate',
      target: 'sentry://settings',
      value: 'sentry://settings',
      riskTier: RiskTier.LOW,
      reason: 'Open settings',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'https://example.com',
    };

    const decision = await firewall.evaluateAction(action, mockSnapshot);
    expect(decision.allowed).toBe(false);
    expect(decision.riskTier).toBe(RiskTier.CRITICAL);
  });
});
