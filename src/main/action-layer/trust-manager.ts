import { SiteTrustEntry, SiteTrustLevel } from '../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

export class TrustManager {
  private trustList: Map<string, SiteTrustEntry> = new Map();
  
  public readonly HIGHLY_RESTRICTED_DEFAULTS: string[] = [
    // Banking
    'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citibank.com',
    // Email
    'gmail.com', 'outlook.com', 'mail.yahoo.com', 'protonmail.com',
    // Password managers
    'bitwarden.com', '1password.com', 'lastpass.com', 'dashlane.com',
    // Payment
    'paypal.com', 'venmo.com', 'cash.app', 'stripe.com',
    // Financial
    'robinhood.com', 'fidelity.com', 'schwab.com', 'vanguard.com',
    // Social
    'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
    // Government
    'irs.gov', 'ssa.gov', 'healthcare.gov',
  ];

  constructor(private userDataPath?: string) {
    this.loadTrustList();
  }

  public getTrustLevel(url: string): SiteTrustLevel {
    const domain = this.extractDomain(url);
    
    // Check exact domain
    if (this.trustList.has(domain)) {
      return this.trustList.get(domain)!.trustLevel;
    }
    
    // Check base domain (subdomain handling)
    const baseDomain = this.extractBaseDomain(domain);
    if (baseDomain !== domain && this.trustList.has(baseDomain)) {
      return this.trustList.get(baseDomain)!.trustLevel;
    }
    
    return this.getDefaultLevel(domain);
  }

  public getDefaultLevel(domain: string): SiteTrustLevel {
    const baseDomain = this.extractBaseDomain(domain);
    if (this.HIGHLY_RESTRICTED_DEFAULTS.includes(baseDomain) || this.HIGHLY_RESTRICTED_DEFAULTS.includes(domain)) {
      return SiteTrustLevel.HIGHLY_RESTRICTED;
    }
    return SiteTrustLevel.READ_ACT;
  }

  public setTrustLevel(domain: string, level: SiteTrustLevel, notes?: string): void {
    const entry: SiteTrustEntry = {
      domain,
      trustLevel: level,
      setBy: 'user',
      lastModified: Date.now(),
      notes,
    };
    this.trustList.set(domain, entry);
    this.saveTrustList();
  }

  public getAllTrustEntries(): SiteTrustEntry[] {
    return Array.from(this.trustList.values());
  }

  private extractDomain(url: string): string {
    try {
      if (!url.startsWith('http')) return url;
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }
  
  private extractBaseDomain(domain: string): string {
    const parts = domain.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.'); // very basic, enough for most cases
    }
    return domain;
  }

  private loadTrustList() {
    if (!this.userDataPath) return;
    try {
      const file = path.join(this.userDataPath, 'trust-list.json');
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        for (const entry of data) {
          this.trustList.set(entry.domain, entry);
        }
      }
    } catch (e) {
      console.error('Failed to load trust list', e);
    }
  }

  private saveTrustList() {
    if (!this.userDataPath) return;
    try {
      const file = path.join(this.userDataPath, 'trust-list.json');
      fs.writeFileSync(file, JSON.stringify(this.getAllTrustEntries(), null, 2));
    } catch (e) {
      console.error('Failed to save trust list', e);
    }
  }
}
