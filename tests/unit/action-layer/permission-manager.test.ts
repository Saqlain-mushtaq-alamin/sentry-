import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionManager } from '../../../src/main/action-layer/permission-manager';
import { RiskTier } from '../../../src/shared/types';

describe('PermissionManager', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
  });

  it('grant with scope "once" sets expiresAt approximately five seconds in the future', () => {
    const before = Date.now();
    const grant = pm.grant('example.com', 'click:#submit', 'once', RiskTier.HIGH);
    const after = Date.now();

    expect(grant.expiresAt).not.toBeNull();
    expect(grant.expiresAt!).toBeGreaterThanOrEqual(before + 5000);
    expect(grant.expiresAt!).toBeLessThanOrEqual(after + 5000);
    expect(grant.scope).toBe('once');
    expect(grant.grantedAt).toBeGreaterThanOrEqual(before);
  });

  it('grant with scope "site" or "session" leaves expiresAt null', () => {
    const siteGrant = pm.grant('example.com', 'click:#submit', 'site', RiskTier.HIGH);
    const sessionGrant = pm.grant('example.com', 'fill:#search', 'session', RiskTier.MEDIUM);

    expect(siteGrant.expiresAt).toBeNull();
    expect(sessionGrant.expiresAt).toBeNull();
  });

  it('grant throws when a CRITICAL action is granted with a scope other than "once"', () => {
    expect(() => pm.grant('example.com', 'type:#password', 'site', RiskTier.CRITICAL)).toThrow(
      'CRITICAL actions can only have scope="once"'
    );
    expect(() => pm.grant('example.com', 'type:#password', 'session', RiskTier.CRITICAL)).toThrow(
      'CRITICAL actions can only have scope="once"'
    );
  });

  it('grant allows CRITICAL actions when scope is "once"', () => {
    const grant = pm.grant('example.com', 'type:#password', 'once', RiskTier.CRITICAL);
    expect(grant.scope).toBe('once');
    expect(pm.getAllGrants().length).toBe(1);
  });

  it('hasGrant always returns undefined for CRITICAL riskTier even when a grant exists', () => {
    pm.grant('example.com', 'type:#password', 'once', RiskTier.CRITICAL);

    expect(pm.hasGrant('example.com', 'type:#password', RiskTier.CRITICAL)).toBeUndefined();
  });

  it('hasGrant matches on both domain and actionPattern and returns undefined on mismatch', () => {
    pm.grant('example.com', 'click:#submit', 'site', RiskTier.HIGH);

    const match = pm.hasGrant('example.com', 'click:#submit', RiskTier.HIGH);
    expect(match).toBeDefined();
    expect(match!.domain).toBe('example.com');
    expect(match!.actionPattern).toBe('click:#submit');

    expect(pm.hasGrant('other.com', 'click:#submit', RiskTier.HIGH)).toBeUndefined();
    expect(pm.hasGrant('example.com', 'click:#other', RiskTier.HIGH)).toBeUndefined();
  });

  it('consumes a "once" grant on the first hasGrant match so the second lookup returns undefined', () => {
    pm.grant('example.com', 'click:#submit', 'once', RiskTier.HIGH);

    const first = pm.hasGrant('example.com', 'click:#submit', RiskTier.HIGH);
    expect(first).toBeDefined();

    const second = pm.hasGrant('example.com', 'click:#submit', RiskTier.HIGH);
    expect(second).toBeUndefined();
    expect(pm.getAllGrants().length).toBe(0);
  });

  it('skips and cleans up an expired grant during hasGrant', () => {
    const grant = pm.grant('example.com', 'click:#submit', 'site', RiskTier.HIGH);
    expect(pm.getAllGrants().length).toBe(1);

    grant.expiresAt = Date.now() - 1000;

    expect(pm.hasGrant('example.com', 'click:#submit', RiskTier.HIGH)).toBeUndefined();
    expect(pm.getAllGrants().length).toBe(0);
  });

  it('revoke removes a grant by id', () => {
    const grant = pm.grant('example.com', 'click:#submit', 'site', RiskTier.HIGH);

    pm.revoke(grant.id);

    expect(pm.getAllGrants().length).toBe(0);
    expect(pm.hasGrant('example.com', 'click:#submit', RiskTier.HIGH)).toBeUndefined();
  });

  it('clearSessionGrants removes "session" and "once" grants but keeps "site" grants', () => {
    pm.grant('example.com', 'a', 'site', RiskTier.HIGH);
    pm.grant('example.com', 'b', 'session', RiskTier.MEDIUM);
    pm.grant('example.com', 'c', 'once', RiskTier.HIGH);
    expect(pm.getAllGrants().length).toBe(3);

    pm.clearSessionGrants();

    const remaining = pm.getAllGrants();
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.scope).toBe('site');
    expect(remaining[0]!.actionPattern).toBe('a');
  });

  it('getAllGrants returns every active grant', () => {
    pm.grant('a.com', 'click:#one', 'site', RiskTier.HIGH);
    pm.grant('b.com', 'fill:#two', 'session', RiskTier.MEDIUM);

    const grants = pm.getAllGrants();
    expect(grants.length).toBe(2);
    expect(grants.map((g) => g.domain).sort()).toEqual(['a.com', 'b.com']);
  });
});
