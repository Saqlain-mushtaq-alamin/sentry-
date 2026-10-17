import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { TabItem, BookmarkItem, HistoryItem, DownloadItem, UserSettings, ProposedAction, FirewallDecision } from '../shared/types';
import { TabBar } from './components/TabBar';
import { AddressBar } from './components/AddressBar';
import { BookmarksBar } from './components/BookmarksBar';
import { NewTab } from './pages/NewTab';
import { Settings } from './pages/Settings';
import { History } from './pages/History';
import { Bookmarks } from './pages/Bookmarks';
import { Downloads } from './pages/Downloads';
import { TrustDashboard } from './pages/TrustDashboard';
import { ModelSettings } from './pages/ModelSettings';
import { RecipeManager } from './pages/RecipeManager';
import { DeveloperModePage } from './pages/DeveloperMode';
import { ExtensionManagerPage } from './pages/ExtensionManager';
import { Onboarding } from './pages/Onboarding';
import { AgentSidebar, AgentResultData } from './components/AgentSidebar';
import { AgentVision } from './overlays/AgentVision';
import { InjectionAlert } from './overlays/InjectionAlert';
import { MultiTabDashboard } from './overlays/MultiTabDashboard';
import { ConfirmationBar } from './components/ConfirmationBar';
import { useFrozenFrame } from './hooks/useHideNativeView';
import { speak, stop } from './services/tts';
import { TaskState, ActionLogEntry, AgentNotification, PageSnapshot, MultiTabTask, DeveloperSessionStats, TaskTrace, TraceStep } from '../shared/types';
import './styles/index.css';

declare global {
  interface Window {
    sentry?: {
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
      tabs: {
        getAll: () => Promise<TabItem[]>;
        create: (url?: string) => Promise<TabItem>;
        close: (id: string) => Promise<void>;
        switch: (id: string) => Promise<void>;
        duplicate: (id: string) => Promise<TabItem>;
        togglePin: (id: string) => Promise<void>;
      };
      nav: {
        navigate: (id: string, url: string) => Promise<void>;
        goBack: (id: string) => Promise<void>;
        goForward: (id: string) => Promise<void>;
        reload: (id: string) => Promise<void>;
      };
      bookmarks: {
        getAll: () => Promise<BookmarkItem[]>;
        add: (item: Omit<BookmarkItem, 'id' | 'createdAt' | 'position'>) => Promise<BookmarkItem>;
        remove: (id: string) => Promise<void>;
      };
      history: {
        getAll: (query?: string) => Promise<HistoryItem[]>;
        clear: () => Promise<void>;
        removeEntry: (id: string) => Promise<void>;
      };
      downloads: {
        getAll: () => Promise<DownloadItem[]>;
        openFile: (path: string) => Promise<void>;
        openFolder: (path: string) => Promise<void>;
      };
      settings: {
        get: () => Promise<UserSettings>;
        update: (settings: Partial<UserSettings>) => Promise<UserSettings>;
      };
      view: {
        setLayoutOffsets?: (offsets: { topOffset?: number; bottomOffset?: number; rightOffset?: number }) => Promise<void>;
        setBounds?: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>;
        setHidden?: (hidden: boolean) => Promise<string | null>;
      };
      extensions: {
        getAll: () => Promise<import('../shared/types').LoadedExtension[]>;
        load: (path: string) => Promise<import('../shared/types').LoadedExtension>;
        chooseAndLoad: () => Promise<import('../shared/types').LoadedExtension | null>;
        unload: (id: string) => Promise<void>;
        toggle: (id: string, enabled: boolean) => Promise<void>;
      };
      trust: {
        getAll: () => Promise<import('../shared/types').SiteTrustEntry[]>;
        setLevel: (domain: string, level: string) => Promise<boolean>;
        remove: (domain: string) => Promise<boolean>;
        getDefaults: () => Promise<string[]>;
      };
      secrets: {
        set: (name: string, value: string) => Promise<boolean>;
        has: (name: string) => Promise<boolean>;
      };
      voice: {
        transcribe: (audio: ArrayBuffer, mime: string) => Promise<string>;
      };
      agent: {
        runTask: (instruction: string) => Promise<{ success: boolean; result?: import('../shared/types').TaskResult; error?: string }>;
        pause: () => Promise<boolean>;
        resume: () => Promise<boolean>;
        stop: () => Promise<boolean>;
        getHistory: () => Promise<ActionLogEntry[]>;
        getRecipes: () => Promise<any[]>;
        saveRecipe: (instruction: string) => Promise<any>;
        deleteRecipe: (id: string) => Promise<boolean>;
        replayRecipe: (id: string, variables: Record<string, string>) => Promise<any>;
        forgetSite?: (domain?: string) => Promise<boolean>;
        clearLogs?: () => Promise<boolean>;
        forgetAll: () => Promise<boolean>;
        runMultiTab: (task: MultiTabTask) => Promise<any>;
        submitBackground: (task: any) => Promise<boolean>;
        speak: (text: string, priority?: string) => Promise<boolean>;
        stopSpeech: () => Promise<boolean>;
        getBenchmarkSuites: () => Promise<any[]>;
        runBenchmark: (suiteId: string) => Promise<any>;
        exportTrace: (trace: any, format: 'json' | 'md' | 'csv') => Promise<string>;
        getDeveloperStats: () => Promise<DeveloperSessionStats>;
        getLastTrace: () => Promise<TaskTrace | null>;
        resetDeveloperStats: () => Promise<boolean>;
        getModelConfig: () => Promise<{ localModel: string; cloudModel: string; routingMode: string }>;
        setModelConfig: (cfg: { localModel: string; cloudModel: string; routingMode: string }) => Promise<boolean>;
        listOllamaModels: () => Promise<string[]>;
        checkOllama: () => Promise<boolean>;
        onActionLogged: (callback: (entry: ActionLogEntry) => void) => () => void;
        onStateChanged: (callback: (state: TaskState) => void) => () => void;
        onInjectionDetected: (callback: (report: any) => void) => () => void;
        onRoutingDecision: (callback: (decision: any) => void) => () => void;
        onDeveloperStatsUpdated: (callback: (stats: DeveloperSessionStats) => void) => () => void;
        onStepTraceAdded: (callback: (step: TraceStep) => void) => () => void;
        onConfirmationRequired?: (callback: (data: { action: ProposedAction; decision: FirewallDecision }) => void) => () => void;
        respondConfirmation?: (actionId: string, response: 'allow_once' | 'allow_site' | 'deny') => Promise<void>;
        onToggleCommandBox?: (callback: () => void) => () => void;
        onShortcutPauseResume?: (callback: () => void) => () => void;
        onShortcutStop?: (callback: () => void) => () => void;
      };
      onTabsUpdated: (callback: (tabs: TabItem[]) => void) => () => void;
      onDownloadsUpdated: (callback: (downloads: DownloadItem[]) => void) => () => void;
      onInternalPageReload?: (callback: (url: string) => void) => () => void;
    };
  }
}


export default function App(): React.JSX.Element {
  const frozenFrame = useFrozenFrame();
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // Agent UX State
  const [taskState, setTaskState] = useState<TaskState>(TaskState.IDLE);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [notifications, setNotifications] = useState<AgentNotification[]>([
    {
      id: 'welcome-1',
      type: 'info',
      title: 'Sentry Agentic Browser Ready',
      message: 'Press Ctrl+Shift+Space to command the AI agent.',
      timestamp: Date.now(),
      read: false,
    },
  ]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVisionActive, setIsVisionActive] = useState(false);
  const [activeSnapshot, setActiveSnapshot] = useState<PageSnapshot | undefined>(undefined);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    action: ProposedAction;
    decision: FirewallDecision;
  } | null>(null);
  const [injectionReport, setInjectionReport] = useState<any>(null);
  const [routingDecision, setRoutingDecision] = useState<any>(null);
  const [lastInstruction, setLastInstruction] = useState<string>('');
  const [multiTabTask, setMultiTabTask] = useState<MultiTabTask | null>(null);
  const [lastAgentResult, setLastAgentResult] = useState<AgentResultData | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);

  const taskStateRef = useRef<TaskState>(taskState);
  taskStateRef.current = taskState;
  const settingsRef = useRef<UserSettings | null>(settings);
  settingsRef.current = settings;

  // Apply theme dynamically
  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
  }, [settings?.theme]);

  // Voice output helper
  const speakIfEnabled = useCallback((text: string) => {
    if (settingsRef.current?.voiceOutputEnabled) {
      speak(text);
    }
  }, []);

  // Typed notification helper — keeps the AgentNotification.type union intact
  // (a bare array literal followed by .slice() would widen `type` to string).
  const addNotification = useCallback((notification: AgentNotification) => {
    setNotifications((prev) => [...prev, notification].slice(-50));
  }, []);

  // Step 2: Content measurement with ResizeObserver (no hardcoded offsets!)
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const send = () => {
      const r = el.getBoundingClientRect();
      window.sentry?.view?.setBounds?.({
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
    };

    const ro = new ResizeObserver(send);
    ro.observe(el);
    window.addEventListener('resize', send);
    send();

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', send);
    };
  }, []);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    if (!window.sentry) return;
    try {
      const allTabs: TabItem[] = await window.sentry.tabs.getAll();
      setTabs(allTabs);
      const active = allTabs.find((t) => t.isActive);
      if (active) setActiveTabId(active.id);

      const bms: BookmarkItem[] = await window.sentry.bookmarks.getAll();
      setBookmarks(bms);

      const hist: HistoryItem[] = await window.sentry.history.getAll();
      setHistory(hist);

      const dls: DownloadItem[] = await window.sentry.downloads.getAll();
      setDownloads(dls);

      const s = await window.sentry.settings.get();
      setSettings(s);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  // Toggle & focus agent sidebar
  const toggleAndFocusAgent = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (next) {
        setFocusTrigger((f) => f + 1);
      }
      return next;
    });
  }, []);

  // Agent Operations
  const handleSendTask = async (instruction: string) => {
    setLastInstruction(instruction);
    setTaskState(TaskState.EXECUTING);
    addNotification({
      id: `notif-${Date.now()}`,
      type: 'info',
      title: 'Task Started',
      message: `Agent executing: "${instruction}"`,
      timestamp: Date.now(),
      read: false,
    });

    if (window.sentry?.agent) {
      speakIfEnabled(`Executing: ${instruction}`);

      const res = await window.sentry.agent.runTask(instruction);
      if (res.success) {
        setTaskState(TaskState.COMPLETED);
        const summary = res.result?.summary;
        if (summary) {
          setLastAgentResult({
            instruction,
            summary,
            timestamp: Date.now(),
          });
          const spoken = summary.length > 120 ? `${summary.slice(0, 120)}...` : summary;
          speakIfEnabled(spoken);
        } else {
          speakIfEnabled('Task completed');
        }
        addNotification({
          id: `notif-done-${Date.now()}`,
          type: 'success',
          title: 'Task Completed',
          message: summary || `Completed task: "${instruction}"`,
          timestamp: Date.now(),
          read: false,
        });
      } else {
        setTaskState(TaskState.FAILED);
        const errMessage = res.error || res.result?.error || 'Failed to complete agent task';
        speakIfEnabled('Task failed');
        addNotification({
          id: `notif-err-${Date.now()}`,
          type: 'error',
          title: 'Task Failed',
          message: errMessage,
          timestamp: Date.now(),
          read: false,
        });
      }
    }
  };

  const handlePause = async () => {
    setTaskState(TaskState.PAUSED);
    if (window.sentry?.agent) await window.sentry.agent.pause();
  };

  const handleResume = async () => {
    setTaskState(TaskState.EXECUTING);
    if (window.sentry?.agent) await window.sentry.agent.resume();
  };

  const handleStop = async () => {
    stop();
    setTaskState(TaskState.IDLE);
    if (window.sentry?.agent) await window.sentry.agent.stop();
  };


  const handleSaveRecipe = async (instruction: string) => {
    try {
      await window.sentry?.agent?.saveRecipe(instruction);
      addNotification({
        id: `recipe-saved-${Date.now()}`,
        type: 'success',
        title: 'Recipe Saved',
        message: 'Saved to your recipes. Access via the menu.',
        timestamp: Date.now(),
        read: false,
      });
    } catch {
      addNotification({
        id: `recipe-err-${Date.now()}`,
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save recipe.',
        timestamp: Date.now(),
        read: false,
      });
    }
  };

  const handleUndoLast = async (entry: ActionLogEntry): Promise<boolean> => {
    setActionLog((prev) => prev.filter((e) => e !== entry));
    return true;
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSwitchTab = async (id: string) => {
    if (window.sentry) {
      await window.sentry.tabs.switch(id);
      setActiveTabId(id);
    }
  };

  const handleCreateTab = async (url?: string) => {
    if (window.sentry) {
      const tab = await window.sentry.tabs.create(url);
      setActiveTabId(tab.id);
    }
  };

  const handleCloseTab = async (id: string) => {
    if (window.sentry) {
      await window.sentry.tabs.close(id);
    }
  };

  const handleDuplicateTab = async (id: string) => {
    if (window.sentry) {
      await window.sentry.tabs.duplicate(id);
    }
  };

  const handleTogglePinTab = async (id: string) => {
    if (window.sentry) {
      await window.sentry.tabs.togglePin(id);
    }
  };

  // Navigation operations
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  const handleNavigate = useCallback(async (url: string) => {
    if (window.sentry && activeTabId) {
      await window.sentry.nav.navigate(activeTabId, url);
    }
  }, [activeTabId]);

  const handleGoBack = async () => {
    if (window.sentry && activeTabId) {
      await window.sentry.nav.goBack(activeTabId);
    }
  };

  const handleGoForward = async () => {
    if (window.sentry && activeTabId) {
      await window.sentry.nav.goForward(activeTabId);
    }
  };

  const handleReload = useCallback(async () => {
    if (window.sentry && activeTabId) {
      await window.sentry.nav.reload(activeTabId);
    }
  }, [activeTabId]);

  // Bookmark operations
  const handleToggleBookmark = useCallback(async (url: string, title: string) => {
    if (!window.sentry) return;
    const isBookmarked = bookmarks.some((b) => b.url === url);
    if (isBookmarked) {
      const bm = bookmarks.find((b) => b.url === url);
      if (bm) {
        await window.sentry.bookmarks.remove(bm.id);
      }
    } else {
      await window.sentry.bookmarks.add({ url, title });
    }
    const updated = await window.sentry.bookmarks.getAll();
    setBookmarks(updated);
  }, [bookmarks]);

  const handleRemoveBookmark = async (id: string) => {
    if (!window.sentry) return;
    await window.sentry.bookmarks.remove(id);
    const updated = await window.sentry.bookmarks.getAll();
    setBookmarks(updated);
  };

  // History operations
  const handleClearHistory = async () => {
    if (window.sentry) {
      await window.sentry.history.clear();
      setHistory([]);
      setNotifications((prev) => [
        ...prev,
        {
          id: `hist-clear-${Date.now()}`,
          type: 'info',
          title: 'History Cleared',
          message: 'All browsing history entries removed.',
          timestamp: Date.now(),
          read: false,
        },
      ]);
    }
  };

  const handleRemoveHistoryEntry = async (id: string) => {
    if (window.sentry) {
      await window.sentry.history.removeEntry(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    }
  };

  useEffect(() => {
    loadInitialData();

    if (window.sentry) {
      const unsubTabs = window.sentry.onTabsUpdated((updatedTabs: TabItem[]) => {
        setTabs(updatedTabs);
        const active = updatedTabs.find((t) => t.isActive);
        if (active) setActiveTabId(active.id);
      });

      const unsubDownloads = window.sentry.onDownloadsUpdated((updatedDownloads: DownloadItem[]) => {
        setDownloads(updatedDownloads);
      });

      const unsubActionLog = window.sentry.agent?.onActionLogged((entry: ActionLogEntry) => {
        setActionLog((prev) => [...prev, entry]);
      });

      const unsubState = window.sentry.agent?.onStateChanged((state: TaskState) => {
        setTaskState(state);
      });

      const unsubInjection = window.sentry.agent?.onInjectionDetected((report: any) => {
        setInjectionReport(report);
      });

      const unsubRouting = window.sentry.agent?.onRoutingDecision((decision: any) => {
        setRoutingDecision(decision);
      });

      const unsubReload = window.sentry.onInternalPageReload?.(() => {
        loadInitialData();
      });

      const unsubToggle = window.sentry.agent?.onToggleCommandBox?.(() => {
        toggleAndFocusAgent();
      });

      const unsubPause = window.sentry.agent?.onShortcutPauseResume?.(() => {
        const current = taskStateRef.current;
        if ([TaskState.PLANNING, TaskState.EXECUTING, TaskState.AWAITING_CONFIRMATION].includes(current)) {
          handlePause();
        } else if (current === TaskState.PAUSED) {
          handleResume();
        }
      });

      const unsubStop = window.sentry.agent?.onShortcutStop?.(() => {
        handleStop();
      });

      const unsubConfirm = window.sentry.agent?.onConfirmationRequired?.((payload: { action: ProposedAction; decision: FirewallDecision }) => {
        setPendingConfirmation(payload);
      });

      return () => {
        unsubTabs();
        unsubDownloads();
        if (unsubActionLog) unsubActionLog();
        if (unsubState) unsubState();
        if (unsubInjection) unsubInjection();
        if (unsubRouting) unsubRouting();
        if (unsubReload) unsubReload();
        if (unsubToggle) unsubToggle();
        if (unsubPause) unsubPause();
        if (unsubStop) unsubStop();
        if (unsubConfirm) unsubConfirm();
      };
    }
  }, [loadInitialData, toggleAndFocusAgent]);

  // Keyboard Shortcuts (single unified registry)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 't':
            e.preventDefault();
            handleCreateTab();
            break;
          case 'w':
            e.preventDefault();
            if (activeTabId) handleCloseTab(activeTabId);
            break;
          case 'h':
            e.preventDefault();
            handleCreateTab('sentry://history');
            break;
          case 'j':
            e.preventDefault();
            handleCreateTab('sentry://downloads');
            break;
          case ',':
            e.preventDefault();
            handleCreateTab('sentry://settings');
            break;
          case 'r':
            e.preventDefault();
            handleReload();
            break;
          case 'd':
            e.preventDefault();
            if (activeTab) handleToggleBookmark(activeTab.url, activeTab.title);
            break;
        }

        // Tab switching Ctrl+1 to Ctrl+9
        if (/^[1-9]$/.test(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (tabs[idx]) {
            e.preventDefault();
            handleSwitchTab(tabs[idx].id);
          }
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleReload();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, activeTab, tabs, handleNavigate, handleReload, handleToggleBookmark, toggleAndFocusAgent]);

  // Window Controls
  const handleMinimize = () => window.sentry?.window.minimize();
  const handleMaximize = () => window.sentry?.window.maximize();
  const handleCloseWindow = () => window.sentry?.window.close();

  // Bookmarks bar displays only if enabled AND has items
  const showBookmarksBar = (settings?.showBookmarksBar ?? true) && bookmarks.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-0)',
        overflow: 'hidden',
      }}
    >
      {/* ── Titlebar + Tab Strip ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-0)',
          WebkitAppRegion: 'drag',
          userSelect: 'none',
          height: '38px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        } as React.CSSProperties}
        onDoubleClick={handleMaximize}
      >
        <div style={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'drag', flexGrow: 1, minWidth: 0, overflow: 'hidden' } as React.CSSProperties}>
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitchTab={handleSwitchTab}
            onCloseTab={handleCloseTab}
            onCreateTab={() => handleCreateTab()}
            onDuplicateTab={handleDuplicateTab}
            onTogglePinTab={handleTogglePinTab}
          />
        </div>

        {/* Draggable Titlebar Spacer */}
        <div
          style={{
            flexGrow: 1,
            height: '100%',
            WebkitAppRegion: 'drag',
            cursor: 'default',
          } as React.CSSProperties}
          onDoubleClick={handleMaximize}
        />

        {/* Window Controls Only (titlebar kept clean) */}
        <div style={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={handleMinimize}
            title="Minimize"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-2)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            ─
          </button>
          <button
            onClick={handleMaximize}
            title="Maximize"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-2)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            □
          </button>
          <button
            onClick={handleCloseWindow}
            title="Close"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-2)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'background 0.12s ease, color 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--danger)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-2)';
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Toolbar (Address Bar) ──────────────────────────────── */}
      <AddressBar
        activeTab={activeTab}
        bookmarks={bookmarks}
        history={history}
        routingDecision={routingDecision}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={toggleAndFocusAgent}
        notifications={notifications}
        onDismissNotification={handleDismissNotification}
        onClearNotifications={() => setNotifications([])}
        onNavigate={handleNavigate}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        onToggleBookmark={handleToggleBookmark}
        onOpenPage={(page) => handleCreateTab(`sentry://${page}`)}
        onMarkAllNotificationsRead={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
      />

      {/* ── Bookmarks Bar (only if enabled AND has items) ──────── */}
      {showBookmarksBar && (
        <BookmarksBar
          bookmarks={bookmarks}
          onNavigate={handleNavigate}
          onRemoveBookmark={handleRemoveBookmark}
        />
      )}

      {pendingConfirmation && (
        <ConfirmationBar
          action={pendingConfirmation.action}
          riskTier={pendingConfirmation.decision.riskTier}
          explanation={pendingConfirmation.decision.explanation}
          domain={(() => {
            try {
              return new URL(pendingConfirmation.action.url).hostname;
            } catch {
              return 'this site';
            }
          })()}
          onConfirm={async (response) => {
            await window.sentry?.agent?.respondConfirmation?.(pendingConfirmation.action.id, response);
            setPendingConfirmation(null);
          }}
        />
      )}

      {/* ── Content & Docked Sidebar Row (Flex layout) ─────────── */}
      <div style={{ display: 'flex', flexGrow: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Measured Content Area (Native WebContentsView sits exactly here) */}
        <div
          ref={contentRef}
          style={{
            flexGrow: 1,
            height: '100%',
            position: 'relative',
            overflow: 'auto',
            background: 'var(--bg-0)',
          }}
        >
          {frozenFrame && (
            <img
              src={frozenFrame}
              alt=""
              draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
            />
          )}
          {activeTab?.url === 'sentry://newtab' && (
            <NewTab history={history} onNavigate={handleNavigate} />
          )}
          {activeTab?.url === 'sentry://settings' && (
            <Settings onClearHistory={handleClearHistory} />
          )}
          {activeTab?.url === 'sentry://history' && (
            <History
              history={history}
              onNavigate={handleNavigate}
              onClearHistory={handleClearHistory}
              onRemoveEntry={handleRemoveHistoryEntry}
            />
          )}
          {activeTab?.url === 'sentry://bookmarks' && (
            <Bookmarks
              bookmarks={bookmarks}
              onNavigate={handleNavigate}
              onRemoveBookmark={handleRemoveBookmark}
            />
          )}
          {activeTab?.url === 'sentry://downloads' && (
            <Downloads
              downloads={downloads}
              onOpenFile={(path) => window.sentry?.downloads.openFile(path)}
              onOpenFolder={(path) => window.sentry?.downloads.openFolder(path)}
            />
          )}
          {activeTab?.url === 'sentry://trust' && (
            <TrustDashboard />
          )}
          {activeTab?.url === 'sentry://models' && (
            <ModelSettings />
          )}
          {activeTab?.url === 'sentry://recipes' && (
            <RecipeManager />
          )}
          {activeTab?.url === 'sentry://developer' && (
            <DeveloperModePage />
          )}
          {activeTab?.url === 'sentry://extensions' && (
            <ExtensionManagerPage />
          )}
          {activeTab?.url === 'sentry://onboarding' && (
            <Onboarding
              onComplete={() => handleNavigate('sentry://newtab')}
              onTryTask={(task) => {
                handleNavigate('sentry://newtab');
                handleSendTask(task);
              }}
            />
          )}

          {/* Multi-Tab Dashboard Overlay */}
          {multiTabTask && (
            <MultiTabDashboard
              task={multiTabTask}
              onPauseAll={() => {
                const updated = { ...multiTabTask };
                updated.tabs.forEach((t) => (t.status = 'paused'));
                setMultiTabTask(updated);
              }}
              onStopAll={() => setMultiTabTask(null)}
              onSwitchToTab={(tabId) => handleSwitchTab(tabId)}
            />
          )}

          {/* Agent Vision Mode Overlay */}
          {isVisionActive && (
            <AgentVision
              snapshot={activeSnapshot}
              onClose={() => setIsVisionActive(false)}
            />
          )}

          {/* Injection Alert Modal */}
          {injectionReport && (
            <InjectionAlert
              report={injectionReport}
              onDismiss={() => setInjectionReport(null)}
              onReportFalsePositive={() => {
                setInjectionReport(null);
              }}
            />
          )}

        </div>

        {/* Docked Agent Sidebar (Normal flex child, shrinks content automatically) */}
        {isSidebarOpen && (
          <AgentSidebar
            taskState={taskState}
            actionLog={actionLog}
            lastResult={lastAgentResult}
            routingDecision={routingDecision}
            lastInstruction={lastInstruction}
            onClearResult={() => setLastAgentResult(null)}
            onSendTask={handleSendTask}
            onPause={handlePause}
            onStop={handleStop}
            onResume={handleResume}
            onUndoLast={handleUndoLast}
            onClose={() => setIsSidebarOpen(false)}
            onSaveRecipe={handleSaveRecipe}
            focusTrigger={focusTrigger}
          />
        )}
      </div>
    </div>
  );
}
