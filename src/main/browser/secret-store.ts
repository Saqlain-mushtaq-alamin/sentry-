import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

export class SecretStore {
  private file: string;
  private data: Record<string, string> = {};

  constructor(filePath?: string) {
    if (filePath) {
      this.file = filePath;
    } else {
      let userData = '';
      try {
        userData = app.getPath('userData');
      } catch {
        userData = process.cwd();
      }
      this.file = path.join(userData, 'secrets.json');
    }

    try {
      if (fs.existsSync(this.file)) {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      }
    } catch (e) {
      console.error('[SecretStore] Failed to read secrets file:', e);
    }
  }

  set(name: string, value: string): void {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      this.data[name] = safeStorage.encryptString(value).toString('base64');
    } else {
      this.data[name] = Buffer.from(value, 'utf-8').toString('base64');
    }

    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[SecretStore] Failed to write secrets file:', e);
    }
  }

  get(name: string): string | undefined {
    const enc = this.data[name];
    if (!enc) return undefined;

    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(enc, 'base64'));
      } else {
        return Buffer.from(enc, 'base64').toString('utf-8');
      }
    } catch (e) {
      console.error(`[SecretStore] Failed to decrypt secret "${name}":`, e);
      return undefined;
    }
  }

  has(name: string): boolean {
    return !!this.data[name];
  }

  delete(name: string): boolean {
    const deleted = delete this.data[name];
    if (deleted) {
      try {
        fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8');
      } catch (e) {
        console.error('[SecretStore] Failed to write secrets file:', e);
      }
    }
    return deleted;
  }
}
