import { describe, it, expect } from 'vitest';
import { RiskTier, ProposedAction, ActionLogEntry, FirewallDecision } from '../../../src/shared/types';

describe('Phase 6 Agent UX Logic & Data Structures', () => {
  it('correctly constructs ActionLogEntry for timeline display', () => {
    const action: ProposedAction = {
      id: 'act-1',
      type: 'type',
      target: '#email',
      value: 'user@example.com',
      riskTier: RiskTier.MEDIUM,
      reason: 'Enter user email address',
      timestamp: Date.now(),
      tabId: 'tab-1',
      url: 'https://example.com/login',
    };

    const decision: FirewallDecision = {
      actionId: 'act-1',
      allowed: true,
      requiresConfirmation: false,
      riskTier: RiskTier.MEDIUM,
      classification: {
        tier: RiskTier.MEDIUM,
        reasons: ['Form field fill'],
        policyRulesFired: ['form-fill-rule'],
        confidence: 0.9,
      },
      explanation: 'Medium risk form fill',
    };

    const entry: ActionLogEntry = {
      action,
      decision,
      executed: true,
      timestamp: Date.now(),
    };

    expect(entry.action.type).toBe('type');
    expect(entry.decision.riskTier).toBe(RiskTier.MEDIUM);
    expect(entry.executed).toBe(true);
  });

  it('filters reversible actions for Undo functionality', () => {
    const entries: ActionLogEntry[] = [
      {
        action: { id: '1', type: 'navigate', target: 'https://example.com', riskTier: RiskTier.LOW, reason: 'nav', timestamp: 1, tabId: 't', url: 'u' },
        decision: {} as any,
        executed: true,
      },
      {
        action: { id: '2', type: 'click', target: '#submit', riskTier: RiskTier.HIGH, reason: 'click', timestamp: 2, tabId: 't', url: 'u' },
        decision: {} as any,
        executed: true,
      },
      {
        action: { id: '3', type: 'type', target: '#search', value: 'shoes', riskTier: RiskTier.LOW, reason: 'type', timestamp: 3, tabId: 't', url: 'u' },
        decision: {} as any,
        executed: true,
      },
    ];

    const reversible = entries.filter((e) =>
      e.executed && ['type', 'fill', 'navigate', 'select'].includes(e.action.type)
    );

    expect(reversible.length).toBe(2);
    expect(reversible[0]?.action.type).toBe('navigate');
    expect(reversible[1]?.action.type).toBe('type');
  });
});
