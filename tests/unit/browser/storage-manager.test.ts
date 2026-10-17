import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
}));

import { StorageManager } from '../../../src/main/browser/storage-manager';

describe('StorageManager', () => {
  let dir: string;
  let storePath: string;
  let storage: StorageManager;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-storage-'));
    storePath = path.join(dir, 'sentry-store.json');
    storage = new StorageManager(storePath);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('first-run seeding', () => {
    it('seeds three default bookmarks on first run', () => {
      const bookmarks = storage.getBookmarks();

      expect(bookmarks).toHaveLength(3);
      expect(bookmarks.map((b) => b.title)).toEqual(['Google', 'GitHub', 'Wikipedia']);
      expect(bookmarks[0]!.url).toBe('https://google.com');
      expect(bookmarks[0]!.position).toBe(0);
    });

    it('starts with empty history and downloads', () => {
      expect(storage.getHistory()).toEqual([]);
      expect(storage.getDownloads()).toEqual([]);
    });

    it('starts with default settings and model config', () => {
      const settings = storage.getSettings();

      expect(settings.searchEngine).toBe('google');
      expect(settings.startupBehavior).toBe('newtab');
      expect(settings.theme).toBe('dark');
      expect(settings.showBookmarksBar).toBe(true);
      expect(settings.tabUnloadTimeoutMinutes).toBe(5);

      const modelConfig = storage.getModelConfig();
      expect(modelConfig.localModel).toBe('qwen3:8b');
      expect(modelConfig.cloudModel).toBe('gpt-4o');
      expect(modelConfig.routingMode).toBe('auto');
    });

    it('accepts a directory path and stores sentry-store.json inside it', () => {
      const nested = new StorageManager(dir);

      nested.addBookmark({ title: 'X', url: 'https://x.com' });

      expect(fs.existsSync(path.join(dir, 'sentry-store.json'))).toBe(true);
      expect(nested.getBookmarks().some((b) => b.url === 'https://x.com')).toBe(true);
    });
  });

  describe('bookmarks', () => {
    it('addBookmark appends with generated id, timestamp and position', () => {
      const created = storage.addBookmark({ title: 'Docs', url: 'https://docs.example.com' });

      expect(created.id).toMatch(/^bm-/);
      expect(created.createdAt).toBeGreaterThan(0);
      expect(created.position).toBe(3); // after the 3 seeded bookmarks
      expect(storage.getBookmarks()).toHaveLength(4);
      expect(storage.isBookmarked('https://docs.example.com')).toBe(true);
    });

    it('removeBookmark deletes by id and persists the change', () => {
      const created = storage.addBookmark({ title: 'Docs', url: 'https://docs.example.com' });

      storage.removeBookmark(created.id);

      expect(storage.isBookmarked('https://docs.example.com')).toBe(false);
      expect(storage.getBookmarks()).toHaveLength(3);
    });

    it('isBookmarked is false for unknown urls', () => {
      expect(storage.isBookmarked('https://nope.com')).toBe(false);
    });
  });

  describe('history', () => {
    it('skips sentry:// and about:blank entries entirely', () => {
      const a = storage.addHistoryEntry('sentry://newtab', 'New Tab');
      const b = storage.addHistoryEntry('about:blank', 'Blank');

      expect(a.id).toBe('');
      expect(a.visitCount).toBe(0);
      expect(b.id).toBe('');
      expect(storage.getHistory()).toHaveLength(0);
    });

    it('addHistoryEntry creates an entry and increments visitCount for repeat urls', () => {
      const first = storage.addHistoryEntry('https://example.com', 'Example');
      expect(first.visitCount).toBe(1);
      expect(storage.getHistory()).toHaveLength(1);

      const again = storage.addHistoryEntry('https://example.com', 'Example Domain');
      expect(again.visitCount).toBe(2);
      expect(again.title).toBe('Example Domain');
      expect(storage.getHistory()).toHaveLength(1);
    });

    it('newest entries are placed first', () => {
      storage.addHistoryEntry('https://a.com', 'A');
      storage.addHistoryEntry('https://b.com', 'B');

      expect(storage.getHistory().map((h) => h.url)).toEqual(['https://b.com', 'https://a.com']);
    });

    it('getHistory(query) filters by substring over title and url (case-insensitive)', () => {
      storage.addHistoryEntry('https://example.com', 'Example Site');
      storage.addHistoryEntry('https://other.org', 'Different');

      expect(storage.getHistory('EXAMPLE').map((h) => h.url)).toEqual(['https://example.com']);
      expect(storage.getHistory('other.org').map((h) => h.url)).toEqual(['https://other.org']);
      expect(storage.getHistory('missing')).toEqual([]);
    });

    it('getHistory() without a query returns everything', () => {
      storage.addHistoryEntry('https://a.com', 'A');
      storage.addHistoryEntry('https://b.com', 'B');

      expect(storage.getHistory()).toHaveLength(2);
    });

    it('clearHistory wipes all entries', () => {
      storage.addHistoryEntry('https://a.com', 'A');
      storage.addHistoryEntry('https://b.com', 'B');

      storage.clearHistory();

      expect(storage.getHistory()).toEqual([]);
    });

    it('removeHistoryEntry removes a single entry by id', () => {
      const first = storage.addHistoryEntry('https://a.com', 'A');
      storage.addHistoryEntry('https://b.com', 'B');

      storage.removeHistoryEntry(first.id);

      expect(storage.getHistory().map((h) => h.url)).toEqual(['https://b.com']);
    });

    it('removeHistoryEntry ignores unknown ids', () => {
      storage.addHistoryEntry('https://a.com', 'A');
      storage.removeHistoryEntry('missing');
      expect(storage.getHistory()).toHaveLength(1);
    });
  });

  describe('downloads', () => {
    const makeSample = () => ({
      id: 'dl-1',
      filename: 'report.pdf',
      url: 'https://example.com/report.pdf',
      savePath: '/tmp/report.pdf',
      receivedBytes: 0,
      totalBytes: 100,
      state: 'progressing' as const,
      startTime: 1,
    });

    it('addDownload prepends the item to the list', () => {
      storage.addDownload(makeSample());
      storage.addDownload({ ...makeSample(), id: 'dl-2', filename: 'second.zip' });

      expect(storage.getDownloads().map((d) => d.id)).toEqual(['dl-2', 'dl-1']);
    });

    it('updateDownload merges partial updates into an existing item', () => {
      storage.addDownload(makeSample());

      storage.updateDownload('dl-1', { state: 'completed', receivedBytes: 100, endTime: 42 });

      const updated = storage.getDownloads()[0]!;
      expect(updated.state).toBe('completed');
      expect(updated.receivedBytes).toBe(100);
      expect(updated.endTime).toBe(42);
      expect(updated.filename).toBe('report.pdf');
    });

    it('updateDownload ignores unknown ids', () => {
      storage.addDownload(makeSample());
      expect(() => storage.updateDownload('missing', { state: 'completed' })).not.toThrow();
      expect(storage.getDownloads()[0]!.state).toBe('progressing');
    });
  });

  describe('settings and model config', () => {
    it('updateSettings merges partial settings over the defaults', () => {
      const updated = storage.updateSettings({ theme: 'light', askDownloadPath: true });

      expect(updated.theme).toBe('light');
      expect(updated.askDownloadPath).toBe(true);
      expect(updated.searchEngine).toBe('google'); // untouched default
      expect(storage.getSettings().theme).toBe('light');
    });

    it('updateModelConfig merges partial model config', () => {
      const updated = storage.updateModelConfig({ localModel: 'llama3:8b', routingMode: 'local_only' });

      expect(updated.localModel).toBe('llama3:8b');
      expect(updated.routingMode).toBe('local_only');
      expect(updated.cloudModel).toBe('gpt-4o');
    });
  });

  describe('forgetSite', () => {
    it('removes every history entry belonging to the given domain', () => {
      storage.addHistoryEntry('https://example.com/a', 'A');
      storage.addHistoryEntry('https://example.com/b', 'B');
      storage.addHistoryEntry('https://keep.org/x', 'Keep');

      storage.forgetSite('example.com');

      expect(storage.getHistory().map((h) => h.url)).toEqual(['https://keep.org/x']);
    });

    it('accepts a full url and strips the protocol', () => {
      storage.addHistoryEntry('https://example.com/a', 'A');
      storage.addHistoryEntry('https://keep.org/x', 'Keep');

      storage.forgetSite('https://example.com/path/page');

      expect(storage.getHistory().map((h) => h.url)).toEqual(['https://keep.org/x']);
    });

    it('is a no-op for empty input', () => {
      storage.addHistoryEntry('https://example.com/a', 'A');
      storage.forgetSite('');
      expect(storage.getHistory()).toHaveLength(1);
    });
  });

  describe('persistence', () => {
    it('reloads bookmarks, history, downloads, settings and model config from disk', () => {
      storage.addBookmark({ title: 'Mine', url: 'https://mine.com' });
      storage.addHistoryEntry('https://example.com', 'Example');
      storage.addDownload({
        id: 'dl-9',
        filename: 'f.bin',
        url: 'https://example.com/f.bin',
        savePath: '/tmp/f.bin',
        receivedBytes: 1,
        totalBytes: 2,
        state: 'completed',
        startTime: 1,
      });
      storage.updateSettings({ theme: 'light', searchEngine: 'bing' });
      storage.updateModelConfig({ localModel: 'phi3' });

      const reloaded = new StorageManager(storePath);

      expect(reloaded.getBookmarks().some((b) => b.url === 'https://mine.com')).toBe(true);
      expect(reloaded.getHistory().map((h) => h.url)).toEqual(['https://example.com']);
      expect(reloaded.getDownloads()[0]!.state).toBe('completed');
      expect(reloaded.getSettings().theme).toBe('light');
      expect(reloaded.getSettings().searchEngine).toBe('bing');
      expect(reloaded.getModelConfig().localModel).toBe('phi3');
    });

    it('corrupt store files fall back to the seeded defaults instead of crashing', () => {
      fs.writeFileSync(storePath, '{not valid json', 'utf-8');

      const recovered = new StorageManager(storePath);

      expect(recovered.getBookmarks()).toHaveLength(3);
      expect(recovered.getSettings().searchEngine).toBe('google');
    });
  });
});
