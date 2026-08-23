import { PermissionGrant, RiskTier } from '../../shared/types';
import * as crypto from 'crypto';

export class PermissionManager {
  private grants: Map<string, PermissionGrant> = new Map();

  /**
   * Grant a permission
   */
  public grant(
    domain: string,
    actionPattern: string,
    scope: 'once' | 'site' | 'session',
    riskTierAtGrant: RiskTier
  ): PermissionGrant {
    // CRITICAL can technically be 'once' if user clicks 'allow once' on the dialog,
    // but the system doesn't persist 'once' grants in the manager, it just returns true immediately.
    // However, if we do store it, ensure it's 'once'.
    if (riskTierAtGrant === RiskTier.CRITICAL && scope !== 'once') {
        throw new Error('CRITICAL actions can only have scope="once"');
    }

    const grant: PermissionGrant = {
      id: crypto.randomUUID(),
      domain,
      actionPattern,
      scope,
      grantedAt: Date.now(),
      expiresAt: scope === 'once' ? Date.now() + 5000 : null, // Once expires in 5s or on use
      riskTierAtGrant
    };

    this.grants.set(grant.id, grant);
    return grant;
  }

  /**
   * Revoke a specific grant
   */
  public revoke(id: string): void {
    this.grants.delete(id);
  }

  /**
   * Check if a grant exists for the action pattern on the domain
   */
  public hasGrant(domain: string, actionPattern: string, riskTier: RiskTier): PermissionGrant | undefined {
    if (riskTier === RiskTier.CRITICAL) {
      return undefined; // Never pre-approved
    }

    for (const grant of this.grants.values()) {
      if (grant.domain === domain && grant.actionPattern === actionPattern) {
        if (grant.expiresAt && Date.now() > grant.expiresAt) {
          this.grants.delete(grant.id);
          continue;
        }
        
        // If it was a 'once' grant, consume it
        if (grant.scope === 'once') {
          this.grants.delete(grant.id);
        }
        
        return grant;
      }
    }
    return undefined;
  }

  public getAllGrants(): PermissionGrant[] {
    return Array.from(this.grants.values());
  }

  public clearSessionGrants(): void {
    for (const [id, grant] of this.grants.entries()) {
      if (grant.scope === 'session' || grant.scope === 'once') {
        this.grants.delete(id);
      }
    }
  }
}
