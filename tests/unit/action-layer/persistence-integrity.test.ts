import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TrustManager } from '../../../src/main/action-layer/trust-manager';
import { SecretStore } from '../../../src/main/browser/secret-store';
import { StorageManager } from '../../../src/main/browser/storage-manager';
import { AuditLog } from '../../../src/main/action-layer/audit-log';
import { SiteTrustLevel, RiskTier, ProposedAction, FirewallDecision } from '../../../src/shared/types';

describe('Persistence and Security Integrity Tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('TrustManager Persistence & Domain Parsing', () => {
    it('persists trust levels to disk and reloads on new instance', () => {
      const tm1 = new TrustManager(tmpDir);
      tm1.setTrustLevel('example.org', SiteTrustLevel.BLOCKED, 'My blocked site');

      const tm2 = new TrustManager(tmpDir);
      expect(tm2.getTrustLevel('https://sub.example.org/path')).toBe(SiteTrustLevel.BLOCKED);
    });

    it('correctly handles multi-part TLD domains like co.uk using tldts', () => {
      const tm = new TrustManager(tmpDir);
      tm.setTrustLevel('amazon.co.uk', SiteTrustLevel.BLOCKED);

      // Both the exact domain and subdomains should resolve to the registered domain
      expect(tm.getTrustLevel('https://orders.amazon.co.uk/order-history')).toBe(SiteTrustLevel.BLOCKED);
      expect(tm.getTrustLevel('https://other.co.uk')).toBe(SiteTrustLevel.READ_ACT);
    });

    it('removes trust entries and persists removal', () => {
      const tm1 = new TrustManager(tmpDir);
      tm1.setTrustLevel('trusted-test.com', SiteTrustLevel.BLOCKED);
      expect(tm1.getTrustLevel('trusted-test.com')).toBe(SiteTrustLevel.BLOCKED);

      tm1.removeTrustEntry('trusted-test.com');
      expect(tm1.getTrustLevel('trusted-test.com')).toBe(SiteTrustLevel.READ_ACT); // default

      // Verify persistence after reload
      const tm2 = new TrustManager(tmpDir);
      expect(tm2.getTrustLevel('trusted-test.com')).toBe(SiteTrustLevel.READ_ACT);
    });
  });

  describe('SecretStore', () => {
    it('stores, retrieves, checks, and deletes secrets securely', () => {
      const secretsPath = path.join(tmpDir, 'secrets.json');
      const store1 = new SecretStore(secretsPath);

      expect(store1.has('openai')).toBe(false);
      store1.set('openai', 'sk-test-key-12345');
      expect(store1.has('openai')).toBe(true);
      expect(store1.get('openai')).toBe('sk-test-key-12345');

      // Reload in a second instance
      const store2 = new SecretStore(secretsPath);
      expect(store2.has('openai')).toBe(true);
      expect(store2.get('openai')).toBe('sk-test-key-12345');

      store2.delete('openai');
      expect(store2.has('openai')).toBe(false);
      expect(store2.get('openai')).toBeUndefined();
    });
  });

  describe('StorageManager Model Config & Site Forgetting', () => {
    it('persists model config updates across instances', () => {
      const store1 = new StorageManager(tmpDir);
      expect(store1.getModelConfig().routingMode).toBe('auto');

      store1.updateModelConfig({
        cloudModel: 'claude-sonnet-5-5',
        routingMode: 'cloud_only',
      });

      const store2 = new StorageManager(tmpDir);
      const cfg = store2.getModelConfig();
      expect(cfg.cloudModel).toBe('claude-sonnet-5-5');
      expect(cfg.routingMode).toBe('cloud_only');
      expect(cfg.localModel).toBe('qwen3:8b'); // default preserved
    });

    it('forgets site history cleanly', () => {
      const store = new StorageManager(tmpDir);
      store.addHistoryEntry('https://bank.example.com/account', 'Bank');
      store.addHistoryEntry('https://news.ycombinator.com', 'HN');

      expect(store.getHistory().length).toBe(2);
      store.forgetSite('bank.example.com');

      const remaining = store.getHistory();
      expect(remaining.length).toBe(1);
      expect(remaining[0].url).toContain('ycombinator.com');
    });
  });

  describe('AuditLog Clear', () => {
    it('records entries and clears them to disk', () => {
      const auditPath = path.join(tmpDir, 'audit.json');
      const log1 = new AuditLog(auditPath);

      const action: ProposedAction = {
        id: 'a1',
        type: 'click',
        target: '#btn',
        riskTier: RiskTier.LOW,
        reason: 'test',
        timestamp: Date.now(),
        tabId: 't1',
        url: 'https://example.com',
      };
      const decision: FirewallDecision = {
        actionId: 'a1',
        allowed: true,
        requiresConfirmation: false,
        riskTier: RiskTier.LOW,
        classification: { tier: RiskTier.LOW, reasons: [], policyRulesFired: [], confidence: 1 },
        siteTrust: SiteTrustLevel.READ_ACT,
        explanation: 'ok',
        detailedReason: 'ok',
      };

      log1.log(action, decision, 'allow_once', true);
      expect(log1.getEntries().length).toBe(1);

      log1.clear();
      expect(log1.getEntries().length).toBe(0);

      const log2 = new AuditLog(auditPath);
      expect(log2.getEntries().length).toBe(0);
    });
  });
});
