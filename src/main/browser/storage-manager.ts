import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { BookmarkItem, HistoryItem, DownloadItem, UserSettings } from '../../shared/types';

interface StoreData {
  bookmarks: BookmarkItem[];
  history: HistoryItem[];
  downloads: DownloadItem[];
  settings: UserSettings;
}

const DEFAULT_SETTINGS: UserSettings = {
  searchEngine: 'google',
  startupBehavior: 'newtab',
  theme: 'dark',
  showBookmarksBar: true,
  defaultDownloadPath: '',
  askDownloadPath: false,
};

export class StorageManager {
  private filePath: string;
  private data: StoreData;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'sentry-store.json');
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
    };
  }

  private saveData(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save store data:', err);
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
}
