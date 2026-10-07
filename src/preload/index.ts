import { contextBridge, ipcRenderer } from 'electron';
import { BookmarkItem, UserSettings } from '../shared/types';

contextBridge.exposeInMainWorld('sentry', {
  // Window Controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // Tabs
  tabs: {
    getAll: () => ipcRenderer.invoke('tabs:get-all'),
    create: (url?: string) => ipcRenderer.invoke('tabs:create', url),
    close: (id: string) => ipcRenderer.invoke('tabs:close', id),
    switch: (id: string) => ipcRenderer.invoke('tabs:switch', id),
    reorder: (tabIds: string[]) => ipcRenderer.invoke('tabs:reorder', tabIds),
    duplicate: (id: string) => ipcRenderer.invoke('tabs:duplicate', id),
    togglePin: (id: string) => ipcRenderer.invoke('tabs:toggle-pin', id),
  },

  // Navigation
  nav: {
    navigate: (id: string, url: string) => ipcRenderer.invoke('nav:navigate', id, url),
    goBack: (id: string) => ipcRenderer.invoke('nav:go-back', id),
    goForward: (id: string) => ipcRenderer.invoke('nav:go-forward', id),
    reload: (id: string) => ipcRenderer.invoke('nav:reload', id),
    setZoom: (id: string, level: number) => ipcRenderer.invoke('nav:set-zoom', id, level),
  },

  // Bookmarks
  bookmarks: {
    getAll: () => ipcRenderer.invoke('bookmarks:get-all'),
    add: (item: Omit<BookmarkItem, 'id' | 'createdAt' | 'position'>) => ipcRenderer.invoke('bookmarks:add', item),
    remove: (id: string) => ipcRenderer.invoke('bookmarks:remove', id),
    isBookmarked: (url: string) => ipcRenderer.invoke('bookmarks:is-bookmarked', url),
  },

  // History
  history: {
    getAll: (query?: string) => ipcRenderer.invoke('history:get-all', query),
    clear: () => ipcRenderer.invoke('history:clear'),
    removeEntry: (id: string) => ipcRenderer.invoke('history:remove-entry', id),
  },

  // Downloads
  downloads: {
    getAll: () => ipcRenderer.invoke('downloads:get-all'),
    openFile: (path: string) => ipcRenderer.invoke('downloads:open-file', path),
    openFolder: (path: string) => ipcRenderer.invoke('downloads:open-folder', path),
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: Partial<UserSettings>) => ipcRenderer.invoke('settings:update', settings),
  },

  // View Layout
  view: {
    setLayoutOffsets: (offsets: { topOffset?: number; bottomOffset?: number; rightOffset?: number }) =>
      ipcRenderer.invoke('view:set-layout-offsets', offsets),
    setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('view:set-bounds', bounds),
    setHidden: (hidden: boolean) => ipcRenderer.invoke('view:set-hidden', hidden),
  },

  // Agent IPC
  agent: {
    onToggleCommandBox: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('agent:toggle-command-box', handler);
      return () => ipcRenderer.removeListener('agent:toggle-command-box', handler);
    },
    onShortcutPauseResume: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('agent:shortcut-pause-resume', handler);
      return () => ipcRenderer.removeListener('agent:shortcut-pause-resume', handler);
    },
    onShortcutStop: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('agent:shortcut-stop', handler);
      return () => ipcRenderer.removeListener('agent:shortcut-stop', handler);
    },

    runTask: (instruction: string) => ipcRenderer.invoke('agent:run-task', instruction),
    pause: () => ipcRenderer.invoke('agent:pause'),
    resume: () => ipcRenderer.invoke('agent:resume'),
    stop: () => ipcRenderer.invoke('agent:stop'),
    getHistory: () => ipcRenderer.invoke('agent:get-history'),
    getRecipes: () => ipcRenderer.invoke('agent:get-recipes'),
    saveRecipe: (instruction: string) => ipcRenderer.invoke('agent:save-recipe', instruction),
    deleteRecipe: (id: string) => ipcRenderer.invoke('agent:delete-recipe', id),
    replayRecipe: (id: string, variables: Record<string, string>) => ipcRenderer.invoke('agent:replay-recipe', id, variables),
    forgetAll: () => ipcRenderer.invoke('agent:forget-all'),
    runMultiTab: (task: any) => ipcRenderer.invoke('agent:run-multi-tab', task),
    submitBackground: (task: any) => ipcRenderer.invoke('agent:submit-background', task),
    speak: (text: string, priority?: 'low' | 'normal' | 'urgent') => ipcRenderer.invoke('agent:speak', text, priority || 'normal'),
    stopSpeech: () => ipcRenderer.invoke('agent:stop-speech'),
    getBenchmarkSuites: () => ipcRenderer.invoke('agent:get-benchmark-suites'),
    runBenchmark: (suiteId: string) => ipcRenderer.invoke('agent:run-benchmark', suiteId),
    exportTrace: (trace: any, format: 'json' | 'md' | 'csv') => ipcRenderer.invoke('agent:export-trace', trace, format),
    getDeveloperStats: () => ipcRenderer.invoke('agent:get-developer-stats'),
    getLastTrace: () => ipcRenderer.invoke('agent:get-last-trace'),
    resetDeveloperStats: () => ipcRenderer.invoke('agent:reset-developer-stats'),
    onActionLogged: (callback: (entry: unknown) => void) => {
      const handler = (_evt: unknown, entry: unknown) => callback(entry);
      ipcRenderer.on('agent:action-logged', handler);
      return () => ipcRenderer.removeListener('agent:action-logged', handler);
    },
    onStateChanged: (callback: (state: unknown) => void) => {
      const handler = (_evt: unknown, state: unknown) => callback(state);
      ipcRenderer.on('agent:state-changed', handler);
      return () => ipcRenderer.removeListener('agent:state-changed', handler);
    },
    onInjectionDetected: (callback: (report: unknown) => void) => {
      const handler = (_evt: unknown, report: unknown) => callback(report);
      ipcRenderer.on('agent:injection-detected', handler);
      return () => ipcRenderer.removeListener('agent:injection-detected', handler);
    },
    onRoutingDecision: (callback: (decision: any) => void) => {
      const handler = (_: any, decision: any) => callback(decision);
      ipcRenderer.on('agent:routing-decision', handler);
      return () => ipcRenderer.removeListener('agent:routing-decision', handler);
    },
    onDeveloperStatsUpdated: (callback: (stats: any) => void) => {
      const handler = (_: any, stats: any) => callback(stats);
      ipcRenderer.on('agent:developer-stats-updated', handler);
      return () => ipcRenderer.removeListener('agent:developer-stats-updated', handler);
    },
    onStepTraceAdded: (callback: (step: any) => void) => {
      const handler = (_: any, step: any) => callback(step);
      ipcRenderer.on('agent:step-trace-added', handler);
      return () => ipcRenderer.removeListener('agent:step-trace-added', handler);
    },
    getModelConfig: () => ipcRenderer.invoke('agent:get-model-config'),
    setModelConfig: (config: { localModel: string; cloudModel: string; routingMode: string }) => ipcRenderer.invoke('agent:set-model-config', config),
    listOllamaModels: () => ipcRenderer.invoke('agent:list-ollama-models'),
    checkOllama: () => ipcRenderer.invoke('agent:check-ollama'),
  },

  extensions: {
    getAll: () => ipcRenderer.invoke('extensions:get-all'),
    load: (path: string) => ipcRenderer.invoke('extensions:load', path),
    chooseAndLoad: () => ipcRenderer.invoke('extensions:choose-and-load'),
    unload: (id: string) => ipcRenderer.invoke('extensions:unload', id),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('extensions:toggle', id, enabled),
  },

  // Trust Management
  trust: {
    getAll: () => ipcRenderer.invoke('trust:get-all'),
    setLevel: (domain: string, level: string) => ipcRenderer.invoke('trust:set-level', domain, level),
    getDefaults: () => ipcRenderer.invoke('trust:get-defaults'),
  },

  // Subscriptions
  onTabsUpdated: (callback: (tabs: unknown[]) => void) => {
    const handler = (_evt: unknown, tabs: unknown[]) => callback(tabs);
    ipcRenderer.on('tabs:updated', handler);
    return () => ipcRenderer.removeListener('tabs:updated', handler);
  },
  onDownloadsUpdated: (callback: (downloads: unknown[]) => void) => {
    const handler = (_evt: unknown, downloads: unknown[]) => callback(downloads);
    ipcRenderer.on('downloads:updated', handler);
    return () => ipcRenderer.removeListener('downloads:updated', handler);
  },
  onInternalPageReload: (callback: (url: string) => void) => {
    const handler = (_evt: unknown, url: string) => callback(url);
    ipcRenderer.on('tabs:reload-internal', handler);
    return () => ipcRenderer.removeListener('tabs:reload-internal', handler);
  },
});


