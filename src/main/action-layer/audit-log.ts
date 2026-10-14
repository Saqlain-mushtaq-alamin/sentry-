import { AuditEntry } from '../../shared/types';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class AuditLog {
  private entries: AuditEntry[] = [];
  private readonly MAX_AGE_MS = 60 * 60 * 1000; // 1 hour retention (Phase 14 target)
  private readonly MAX_ENTRIES = 1000;
  
  constructor(private logFilePath?: string) {
    if (logFilePath && fs.existsSync(logFilePath)) {
      try {
         const data = fs.readFileSync(logFilePath, 'utf-8');
         this.entries = JSON.parse(data);
      } catch (e) {
         console.error('Failed to load audit log', e);
      }
    }
  }

  private sanitizeAction(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Omit<AuditEntry, 'id' | 'timestamp'> {
    if (!entry.action) return entry;
    const action = { ...entry.action };
    const target = (action.target || '').toLowerCase();
    const isSensitive =
      action.riskTier === 'critical' ||
      target.includes('password') ||
      target.includes('ssn') ||
      target.includes('card') ||
      target.includes('cvv') ||
      target.includes('token') ||
      target.includes('secret') ||
      target.includes('api-key') ||
      target.includes('apikey');

    if (isSensitive && action.value) {
      action.value = '[REDACTED]';
    }

    return {
      ...entry,
      action,
    };
  }

  public log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const sanitized = this.sanitizeAction(entry);
    const fullEntry: AuditEntry = {
      ...sanitized,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    
    this.entries.push(fullEntry);
    this.pruneOldEntries();
    this.persist();
    return fullEntry;
  }

  public pruneOldEntries(maxAgeMs: number = this.MAX_AGE_MS, maxEntries: number = this.MAX_ENTRIES): number {
    const cutoff = Date.now() - maxAgeMs;
    const initialCount = this.entries.length;
    
    // Filter entries newer than cutoff
    this.entries = this.entries.filter((e) => e.timestamp >= cutoff);
    
    // If still over capacity, keep most recent entries
    if (this.entries.length > maxEntries) {
      this.entries = this.entries.slice(this.entries.length - maxEntries);
    }
    
    return initialCount - this.entries.length;
  }

  public getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  public clear(): void {
    this.entries = [];
    this.persist();
  }

  private persist(): void {
    if (this.logFilePath) {
      try {
        fs.writeFileSync(this.logFilePath, JSON.stringify(this.entries, null, 2));
      } catch (e) {
        console.error('Failed to persist audit log', e);
      }
    }
  }
}
