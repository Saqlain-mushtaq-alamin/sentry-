import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AuditLog } from '../../../src/main/action-layer/audit-log';
import {
  AuditEntry,
  FirewallDecision,
  ProposedAction,
  RiskTier,
  SiteTrustLevel,
} from '../../../src/shared/types';

describe('AuditLog', () => {
  let auditLog: AuditLog;
  let tmpDir: string;
  let auditPath: string;

  const makeAction = (overrides: Partial<ProposedAction> = {}): ProposedAction => ({
    id: 'action-1',
    type: 'click',
    target: '#btn',
    riskTier: RiskTier.LOW,
    reason: 'testing',
    timestamp: Date.now(),
    tabId: 'tab-1',
    url: 'https://example.com',
    ...overrides,
  });

  const makeDecision = (
    actionId: string,
    overrides: Partial<FirewallDecision> = {}
  ): FirewallDecision => ({
    actionId,
    allowed: true,
    requiresConfirmation: false,
    riskTier: RiskTier.LOW,
    classification: { tier: RiskTier.LOW, reasons: [], policyRulesFired: [], confidence: 1 },
    siteTrust: SiteTrustLevel.READ_ACT,
    explanation: 'ok',
    detailedReason: 'ok',
    ...overrides,
  });

  const makeEntryInput = (overrides: Partial<Omit<AuditEntry, 'id' | 'timestamp'>> = {}) => ({
    actionId: 'action-1',
    action: makeAction(),
    decision: makeDecision('action-1'),
    wasExecuted: false,
    wasUndone: false,
    ...overrides,
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-test-'));
    auditPath = path.join(tmpDir, 'audit.json');
    auditLog = new AuditLog(auditPath);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('log() returns an entry with a generated id and timestamp and appends it to getEntries()', () => {
    const entry = auditLog.log(makeEntryInput());

    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.actionId).toBe('action-1');

    const entries = auditLog.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0]!.id).toBe(entry.id);
    expect(entries[0]!.timestamp).toBe(entry.timestamp);
  });

  it('redacts the value of actions with riskTier critical even when the target looks safe', () => {
    const entry = auditLog.log(
      makeEntryInput({
        action: makeAction({
          type: 'type',
          target: '#innocuous',
          value: 'hunter2secret',
          riskTier: RiskTier.CRITICAL,
        }),
      })
    );

    expect(entry.action.value).toBe('[REDACTED]');
  });

  it('redacts values whose target contains sensitive keywords (password, ssn, card, cvv, token, secret, api-key)', () => {
    const sensitiveTargets = [
      '#user-password',
      '#ssn',
      '#card-number',
      '#cvv',
      '#csrf-token',
      '#client-secret',
      '#api-key',
    ];

    for (const target of sensitiveTargets) {
      const entry = auditLog.log(
        makeEntryInput({
          actionId: `action-${target}`,
          action: makeAction({ type: 'type', target, value: 'sensitive-value' }),
        })
      );
      expect(entry.action.value, `target ${target} should be redacted`).toBe('[REDACTED]');
    }
  });

  it('preserves values for non-sensitive actions and keeps userResponse and execution flags', () => {
    const entry = auditLog.log(
      makeEntryInput({
        action: makeAction({ type: 'type', target: '#search', value: 'weather today' }),
        decision: makeDecision('action-1', { riskTier: RiskTier.MEDIUM }),
        userResponse: 'allow_once',
        wasExecuted: true,
        wasUndone: true,
      })
    );

    expect(entry.action.value).toBe('weather today');
    expect(entry.userResponse).toBe('allow_once');
    expect(entry.wasExecuted).toBe(true);
    expect(entry.wasUndone).toBe(true);
  });

  it('pruneOldEntries removes entries older than maxAgeMs and reports the number removed', () => {
    auditLog.log(makeEntryInput({ actionId: 'old-1' }));
    auditLog.log(makeEntryInput({ actionId: 'old-2' }));

    // Negative maxAge puts the cutoff in the future, so every existing entry is "old"
    const removed = auditLog.pruneOldEntries(-1);

    expect(removed).toBe(2);
    expect(auditLog.getEntries().length).toBe(0);
  });

  it('pruneOldEntries keeps entries newer than maxAgeMs', () => {
    auditLog.log(makeEntryInput({ actionId: 'fresh-1' }));
    auditLog.log(makeEntryInput({ actionId: 'fresh-2' }));

    const removed = auditLog.pruneOldEntries(60 * 60 * 1000, 1000);

    expect(removed).toBe(0);
    expect(auditLog.getEntries().length).toBe(2);
  });

  it('pruneOldEntries enforces the maxEntries cap by dropping the oldest entries', () => {
    for (let i = 0; i < 5; i++) {
      auditLog.log(makeEntryInput({ actionId: `action-${i}` }));
    }

    const removed = auditLog.pruneOldEntries(60 * 60 * 1000, 3);

    expect(removed).toBe(2);
    const entries = auditLog.getEntries();
    expect(entries.length).toBe(3);
    expect(entries.map((e) => e.actionId)).toEqual(['action-2', 'action-3', 'action-4']);
  });

  it('getEntries returns a copy of the array so structural mutations do not affect internal state', () => {
    auditLog.log(makeEntryInput());

    const copy = auditLog.getEntries();
    expect(copy).not.toBe(auditLog.getEntries());
    copy.push({} as AuditEntry);
    copy.splice(0, 1);

    const fresh = auditLog.getEntries();
    expect(fresh.length).toBe(1);
    expect(fresh[0]!.actionId).toBe('action-1');
  });

  it('clear() empties the log and persists the empty state to disk', () => {
    auditLog.log(makeEntryInput());
    expect(auditLog.getEntries().length).toBe(1);

    auditLog.clear();
    expect(auditLog.getEntries().length).toBe(0);

    const reloaded = new AuditLog(auditPath);
    expect(reloaded.getEntries().length).toBe(0);
  });

  it('persists entries so a second AuditLog on the same path reloads them', () => {
    auditLog.log(makeEntryInput({ actionId: 'persisted-1' }));

    const reloaded = new AuditLog(auditPath);
    const entries = reloaded.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0]!.actionId).toBe('persisted-1');
    expect(entries[0]!.id).toBeTruthy();
  });

  it('does not throw when constructed on a corrupted JSON file', () => {
    fs.writeFileSync(auditPath, '{this is not valid json', 'utf-8');

    let log: AuditLog | undefined;
    expect(() => {
      log = new AuditLog(auditPath);
    }).not.toThrow();
    expect(log!.getEntries()).toEqual([]);
  });
});
