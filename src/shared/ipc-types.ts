import {
  TabItem,
  BookmarkItem,
  HistoryItem,
  DownloadItem,
  UserSettings,
  DOMSnapshot,
  A11yNode,
  ActionPayload,
  TrustScore
} from './types';

export type { TabItem, BookmarkItem, HistoryItem, DownloadItem, UserSettings, DOMSnapshot, A11yNode, ActionPayload, TrustScore };

export interface IPCMessages {
  // Tabs
  'tabs:create': (url?: string) => Promise<TabItem>;
  'tabs:close': (id: string) => Promise<void>;
  'tabs:switch': (id: string) => Promise<void>;
  'tabs:reorder': (tabIds: string[]) => Promise<void>;
  'tabs:duplicate': (id: string) => Promise<TabItem>;
  'tabs:toggle-pin': (id: string) => Promise<void>;
  'tabs:get-all': () => Promise<TabItem[]>;

  // Navigation
  'nav:go-back': (id: string) => Promise<void>;
  'nav:go-forward': (id: string) => Promise<void>;
  'nav:reload': (id: string) => Promise<void>;
  'nav:stop': (id: string) => Promise<void>;
  'nav:navigate': (id: string, url: string) => Promise<void>;
  'nav:set-zoom': (id: string, level: number) => Promise<void>;

  // Bookmarks
  'bookmarks:get-all': () => Promise<BookmarkItem[]>;
  'bookmarks:add': (bookmark: Omit<BookmarkItem, 'id' | 'createdAt' | 'position'>) => Promise<BookmarkItem>;
  'bookmarks:remove': (id: string) => Promise<void>;
  'bookmarks:is-bookmarked': (url: string) => Promise<boolean>;

  // History
  'history:get-all': (query?: string) => Promise<HistoryItem[]>;
  'history:clear': () => Promise<void>;
  'history:remove-entry': (id: string) => Promise<void>;

  // Downloads
  'downloads:get-all': () => Promise<DownloadItem[]>;
  'downloads:cancel': (id: string) => Promise<void>;
  'downloads:open-file': (id: string) => Promise<void>;
  'downloads:open-folder': (id: string) => Promise<void>;

  // Settings
  'settings:get': () => Promise<UserSettings>;
  'settings:update': (settings: Partial<UserSettings>) => Promise<UserSettings>;

  // CDP (from phase 0)
  'cdp:get-dom': (tabId: string) => Promise<DOMSnapshot>;
  'cdp:get-accessibility-tree': (tabId: string) => Promise<A11yNode>;
  'cdp:execute-action': (tabId: string, action: ActionPayload) => Promise<boolean>;

  // Agent
  'agent:start-task': (prompt: string, tabId: string) => Promise<string>;
  'agent:pause-task': (taskId: string) => Promise<void>;
  'agent:stop-task': (taskId: string) => Promise<void>;
  'agent:approve-action': (taskId: string, approved: boolean) => Promise<void>;

  // Firewall
  'firewall:get-site-trust': (domain: string) => Promise<TrustScore>;
  'firewall:set-site-trust': (domain: string, level: TrustScore['level']) => Promise<void>;
}
