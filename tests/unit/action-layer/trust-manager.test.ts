import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TrustManager } from '../../../src/main/action-layer/trust-manager';
import { SiteTrustLevel } from '../../../src/shared/types';

describe('TrustManager', () => {
  let tm: TrustManager;
  let tmpDir: string;

  beforeEach(() => {
    tm = new TrustManager();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('HIGHLY_RESTRICTED_DEFAULTS lists well-known finance, mail, and password-manager domains', () => {
    expect(tm.HIGHLY_RESTRICTED_DEFAULTS).toContain('chase.com');
    expect(tm.HIGHLY_RESTRICTED_DEFAULTS).toContain('bankofamerica.com');
    expect(tm.HIGHLY_RESTRICTED_DEFAULTS).toContain('gmail.com');
    expect(tm.HIGHLY_RESTRICTED_DEFAULTS).toContain('bitwarden.com');
    expect(tm.HIGHLY_RESTRICTED_DEFAULTS).toContain('paypal.com');
    expect(tm.HIGHLY_RESTRICTED_DEFAULTS).toContain('1password.com');
  });

  it('getDefaultLevel returns HIGHLY_RESTRICTED for default domains and READ_ACT for others', () => {
    expect(tm.getDefaultLevel('chase.com')).toBe(SiteTrustLevel.HIGHLY_RESTRICTED);
    expect(tm.getDefaultLevel('gmail.com')).toBe(SiteTrustLevel.HIGHLY_RESTRICTED);
    expect(tm.getDefaultLevel('bitwarden.com')).toBe(SiteTrustLevel.HIGHLY_RESTRICTED);
    expect(tm.getDefaultLevel('example.com')).toBe(SiteTrustLevel.READ_ACT);
  });

  it('getTrustLevel returns READ_ACT for internal sentry:// and about: pages', () => {
    expect(tm.getTrustLevel('sentry://newtab')).toBe(SiteTrustLevel.READ_ACT);
    expect(tm.getTrustLevel('about:blank')).toBe(SiteTrustLevel.READ_ACT);
    expect(tm.getTrustLevel('')).toBe(SiteTrustLevel.READ_ACT);
  });

  it('getTrustLevel returns HIGHLY_RESTRICTED for default banking domains and their subdomains', () => {
    expect(tm.getTrustLevel('https://www.chase.com/login')).toBe(SiteTrustLevel.HIGHLY_RESTRICTED);
    expect(tm.getTrustLevel('https://login.chase.com/authorize')).toBe(
      SiteTrustLevel.HIGHLY_RESTRICTED
    );
    expect(tm.getTrustLevel('https://mail.yahoo.com/inbox')).toBe(
      SiteTrustLevel.HIGHLY_RESTRICTED
    );
  });

  it('getTrustLevel returns READ_ACT for unconfigured multi-part TLD domains like amazon.co.uk', () => {
    expect(tm.getTrustLevel('https://www.amazon.co.uk/product/123')).toBe(SiteTrustLevel.READ_ACT);
    expect(tm.getTrustLevel('https://other.co.uk')).toBe(SiteTrustLevel.READ_ACT);
  });

  it('setTrustLevel is reflected immediately by getTrustLevel for the domain and its subdomains', () => {
    tm.setTrustLevel('mybank.example', SiteTrustLevel.READ_ONLY, 'user downgrade');
    expect(tm.getTrustLevel('https://mybank.example/account')).toBe(SiteTrustLevel.READ_ONLY);

    tm.setTrustLevel('evil.com', SiteTrustLevel.BLOCKED);
    expect(tm.getTrustLevel('https://evil.com/')).toBe(SiteTrustLevel.BLOCKED);
    expect(tm.getTrustLevel('https://sub.evil.com/path')).toBe(SiteTrustLevel.BLOCKED);
  });

  it('removeTrustEntry returns true when a domain was removed and false for unknown domains', () => {
    tm.setTrustLevel('example.org', SiteTrustLevel.BLOCKED);
    expect(tm.removeTrustEntry('example.org')).toBe(true);
    expect(tm.getTrustLevel('https://example.org')).toBe(SiteTrustLevel.READ_ACT);

    expect(tm.removeTrustEntry('never-configured.com')).toBe(false);
  });

  it('getAllTrustEntries returns every configured trust entry', () => {
    tm.setTrustLevel('a.com', SiteTrustLevel.BLOCKED);
    tm.setTrustLevel('b.com', SiteTrustLevel.READ_ONLY, 'note');

    const entries = tm.getAllTrustEntries();
    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.domain).sort()).toEqual(['a.com', 'b.com']);
    expect(entries.find((e) => e.domain === 'b.com')!.notes).toBe('note');
  });

  it('persists trust levels to disk so a new TrustManager on the same directory reloads them', () => {
    const tm1 = new TrustManager(tmpDir);
    tm1.setTrustLevel('example.org', SiteTrustLevel.BLOCKED, 'blocked by user');

    const tm2 = new TrustManager(tmpDir);
    expect(tm2.getTrustLevel('https://example.org/path')).toBe(SiteTrustLevel.BLOCKED);
    expect(tm2.getAllTrustEntries().length).toBe(1);
  });

  it('handles a corrupted trust-list.json without throwing', () => {
    fs.writeFileSync(path.join(tmpDir, 'trust-list.json'), '{{{not json', 'utf-8');

    let corrupted: TrustManager | undefined;
    expect(() => {
      corrupted = new TrustManager(tmpDir);
    }).not.toThrow();
    expect(corrupted!.getTrustLevel('https://example.com')).toBe(SiteTrustLevel.READ_ACT);
  });
});
