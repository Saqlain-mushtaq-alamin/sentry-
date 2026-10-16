import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { BookmarkItem, HistoryItem, DownloadItem, UserSettings } from '../../shared/types';

export interface ModelConfig {
  localModel: string;
  cloudModel: string;
  routingMode: 'auto' | 'local_only' | 'prefer_local' | 'cloud_only';
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  localModel: 'qwen3:8b',
  cloudModel: 'gpt-4o',
  routingMode: 'auto',
};

interface StoreData {
  bookmarks: BookmarkItem[];
  history: HistoryItem[];
  downloads: DownloadItem[];
  settings: UserSettings;
  modelConfig: ModelConfig;
}

const DEFAULT_SETTINGS: UserSettings = {
  searchEngine: 'google',
  startupBehavior: 'newtab',
  theme: 'dark',
  showBookmarksBar: true,
  defaultDownloadPath: '',
  askDownloadPath: false,
  voiceOutputEnabled: false,
  hasCompletedOnboarding: false,
  tabUnloadTimeoutMinutes: 5,
};

export class StorageManager {
  private filePath: string;
  private data: StoreData;
  private isMemoryOnly = false;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath.endsWith('.json') ? customPath : path.join(customPath, 'sentry-store.json');
    } else {
      let userDataPath = '';
      try {
        userDataPath = app.getPath('userData');
      } catch {
        userDataPath = process.cwd();
      }
      this.filePath = path.join(userDataPath, 'sentry-store.json');
    }
    this.data = this.loadData();
  }

  private loadData(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          bookmarks: parsed.bookmarks || [],
          history: parsed.history || [],
          downloads: parsed.downloads || [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          modelConfig: { ...DEFAULT_MODEL_CONFIG, ...(parsed.modelConfig || {}) },
        };
      }
    } catch (err) {
      console.error('Failed to load store data:', err);
    }
    return {
      bookmarks: [
        { id: 'bm-1', title: 'Google', url: 'https://google.com', createdAt: Date.now(), position: 0 },
        { id: 'bm-2', title: 'GitHub', url: 'https://github.com', createdAt: Date.now(), position: 1 },
        { id: 'bm-3', title: 'Wikipedia', url: 'https://wikipedia.org', createdAt: Date.now(), position: 2 },
      ],
      history: [],
      downloads: [],
      settings: DEFAULT_SETTINGS,
      modelConfig: DEFAULT_MODEL_CONFIG,
    };
  }

  private saveData(): void {
    if (this.isMemoryOnly) return;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      this.isMemoryOnly = true;
      console.warn('[StorageManager] Disk full or write error; continuing in memory-only mode:', err);
    }
  }

  // Bookmarks
  public getBookmarks(): BookmarkItem[] {
    return this.data.bookmarks;
  }

  public addBookmark(item: Omit<BookmarkItem, 'id' | 'createdAt' | 'position'>): BookmarkItem {
    const newBookmark: BookmarkItem = {
      ...item,
      id: `bm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: Date.now(),
      position: this.data.bookmarks.length,
    };
    this.data.bookmarks.push(newBookmark);
    this.saveData();
    return newBookmark;
  }

  public removeBookmark(id: string): void {
    this.data.bookmarks = this.data.bookmarks.filter((b) => b.id !== id);
    this.saveData();
  }

  public isBookmarked(url: string): boolean {
    return this.data.bookmarks.some((b) => b.url === url);
  }

  // History
  public getHistory(query?: string): HistoryItem[] {
    if (!query) return this.data.history;
    const lower = query.toLowerCase();
    return this.data.history.filter(
      (h) => h.title.toLowerCase().includes(lower) || h.url.toLowerCase().includes(lower)
    );
  }

  public addHistoryEntry(url: string, title: string, favicon?: string): HistoryItem {
    if (url.startsWith('sentry://') || url === 'about:blank') {
      return { id: '', url, title, timestamp: Date.now(), visitCount: 0 };
    }
    const existing = this.data.history.find((h) => h.url === url);
    if (existing) {
      existing.title = title || existing.title;
      existing.favicon = favicon || existing.favicon;
      existing.timestamp = Date.now();
      existing.visitCount += 1;
      this.saveData();
      return existing;
    }
    const newEntry: HistoryItem = {
      id: `his-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      url,
      title: title || url,
      favicon,
      timestamp: Date.now(),
      visitCount: 1,
    };
    this.data.history.unshift(newEntry);
    if (this.data.history.length > 5000) {
      this.data.history.pop();
    }
    this.saveData();
    return newEntry;
  }

  public clearHistory(): void {
    this.data.history = [];
    this.saveData();
  }

  public removeHistoryEntry(id: string): void {
    this.data.history = this.data.history.filter((h) => h.id !== id);
    this.saveData();
  }

  // Downloads
  public getDownloads(): DownloadItem[] {
    return this.data.downloads;
  }

  public addDownload(item: DownloadItem): void {
    this.data.downloads.unshift(item);
    this.saveData();
  }

  public updateDownload(id: string, updates: Partial<DownloadItem>): void {
    const d = this.data.downloads.find((x) => x.id === id);
    if (d) {
      Object.assign(d, updates);
      this.saveData();
    }
  }

  // Settings
  public getSettings(): UserSettings {
    return this.data.settings;
  }

  public updateSettings(settings: Partial<UserSettings>): UserSettings {
    this.data.settings = { ...this.data.settings, ...settings };
    this.saveData();
    return this.data.settings;
  }

  // Model Configuration
  public getModelConfig(): ModelConfig {
    return this.data.modelConfig;
  }

  public updateModelConfig(cfg: Partial<ModelConfig>): ModelConfig {
    this.data.modelConfig = { ...this.data.modelConfig, ...cfg };
    this.saveData();
    return this.data.modelConfig;
  }

  // Site Forgetting
  public forgetSite(domainOrUrl: string): void {
    const clean = (domainOrUrl || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0] || '';
    if (!clean) return;
    this.data.history = this.data.history.filter((h) => {
      try {
        const itemDomain = new URL(h.url).hostname.toLowerCase();
        return !itemDomain.includes(clean);
      } catch {
        return !(h.url || '').toLowerCase().includes(clean);
      }
    });
    this.saveData();
  }
}

