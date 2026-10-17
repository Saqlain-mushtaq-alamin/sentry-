import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const safeStorageMock = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => false),
  encryptString: vi.fn((value: string) => Buffer.from(`enc:${value}`, 'utf-8')),
  decryptString: vi.fn((buf: Buffer) => buf.toString('utf-8').replace(/^enc:/, '')),
}));

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  safeStorage: safeStorageMock,
}));

import { SecretStore } from '../../../src/main/browser/secret-store';

describe('SecretStore', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-secrets-'));
    filePath = path.join(dir, 'secrets.json');
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);
    safeStorageMock.encryptString.mockClear();
    safeStorageMock.decryptString.mockClear();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('base64 fallback (safeStorage unavailable)', () => {
    it('set/get round-trips a secret through base64 encoding', () => {
      const store = new SecretStore(filePath);

      store.set('api-key', 'super-secret-123');

      expect(store.get('api-key')).toBe('super-secret-123');
      expect(safeStorageMock.encryptString).not.toHaveBeenCalled();
    });

    it('persists the encoded value to the backing json file', () => {
      const store = new SecretStore(filePath);
      store.set('token', 'abc');

      const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(onDisk.token).toBe(Buffer.from('abc', 'utf-8').toString('base64'));
    });

    it('has reports presence and delete removes the secret', () => {
      const store = new SecretStore(filePath);
      store.set('session', 'xyz');

      expect(store.has('session')).toBe(true);

      expect(store.delete('session')).toBe(true);
      expect(store.has('session')).toBe(false);
      expect(store.get('session')).toBeUndefined();
    });

    it('delete returns false for unknown secrets', () => {
      const store = new SecretStore(filePath);
      expect(store.delete('missing')).toBe(false);
    });

    it('get returns undefined for unknown secrets', () => {
      const store = new SecretStore(filePath);
      expect(store.get('missing')).toBeUndefined();
    });

    it('a new SecretStore on the same file reloads persisted secrets', () => {
      new SecretStore(filePath).set('persisted', 'value-1');

      const reopened = new SecretStore(filePath);

      expect(reopened.has('persisted')).toBe(true);
      expect(reopened.get('persisted')).toBe('value-1');
    });

    it('delete persists the removal to disk', () => {
      const store = new SecretStore(filePath);
      store.set('gone', 'v');

      store.delete('gone');

      const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(onDisk.gone).toBeUndefined();
    });
  });

  describe('safeStorage encryption available', () => {
    beforeEach(() => {
      safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    });

    it('set encrypts via safeStorage and get decrypts the roundtrip', () => {
      const store = new SecretStore(filePath);

      store.set('api-key', 'encrypted-secret');

      expect(safeStorageMock.encryptString).toHaveBeenCalledWith('encrypted-secret');
      expect(safeStorageMock.decryptString).toHaveBeenCalled();
      expect(store.get('api-key')).toBe('encrypted-secret');
      expect(store.has('api-key')).toBe(true);
    });

    it('decrypt falls back to plain base64 decoding when decryptString throws', () => {
      safeStorageMock.decryptString.mockImplementationOnce(() => {
        throw new Error('not an encrypted payload');
      });
      const store = new SecretStore(filePath);
      // store the value as if written by the fallback path
      fs.writeFileSync(filePath, JSON.stringify({ legacy: Buffer.from('plain').toString('base64') }), 'utf-8');
      const reopened = new SecretStore(filePath);

      expect(reopened.get('legacy')).toBe('plain');
    });
  });

  describe('robustness', () => {
    it('tolerates a corrupt secrets file and starts with empty storage', () => {
      fs.writeFileSync(filePath, '{definitely not json', 'utf-8');

      const store = new SecretStore(filePath);

      expect(store.has('anything')).toBe(false);
      store.set('fresh', 'after-corruption');
      expect(store.get('fresh')).toBe('after-corruption');
    });

    it('works without an explicit file path when app.getPath throws', () => {
      // constructor falls back to process.cwd() — must not crash on import/use
      const store = new SecretStore();
      store.set('no-path', 'v');
      expect(store.get('no-path')).toBe('v');
      store.delete('no-path');
    });
  });
});
