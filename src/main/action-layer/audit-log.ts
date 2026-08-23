import { AuditEntry } from '../../shared/types';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class AuditLog {
  private entries: AuditEntry[] = [];
  
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

  public log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const fullEntry: AuditEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    
    this.entries.push(fullEntry);
    this.persist();
    return fullEntry;
  }

  public getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  private persist(): void {
    if (this.logFilePath) {
      try {
        // In a real prod app, use append-only stream for tamper evidence
        fs.writeFileSync(this.logFilePath, JSON.stringify(this.entries, null, 2));
      } catch (e) {
        console.error('Failed to persist audit log', e);
      }
    }
  }
}
