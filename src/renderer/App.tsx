import React, { useState, useEffect, useCallback } from 'react';
import { TabItem, BookmarkItem, HistoryItem, DownloadItem, UserSettings } from '../shared/types';
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
import { AgentCommandBox } from './components/AgentCommandBox';
import { AgentSidebar } from './components/AgentSidebar';
import { NotificationCenter } from './components/NotificationCenter';
import { AgentVision } from './overlays/AgentVision';
import { InjectionAlert } from './overlays/InjectionAlert';
import { MultiTabDashboard } from './overlays/MultiTabDashboard';
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
        getDefaults: () => Promise<string[]>;
      };
      agent: {
        runTask: (instruction: string) => Promise<{ success: boolean; result?: unknown; error?: string }>;
        pause: () => Promise<boolean>;
        resume: () => Promise<boolean>;
        stop: () => Promise<boolean>;
        getHistory: () => Promise<ActionLogEntry[]>;
        getRecipes: () => Promise<any[]>;
        saveRecipe: (instruction: string) => Promise<any>;
        deleteRecipe: (id: string) => Promise<boolean>;
        replayRecipe: (id: string, variables: Record<string, string>) => Promise<any>;
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
      };
      onTabsUpdated: (callback: (tabs: TabItem[]) => void) => () => void;
      onDownloadsUpdated: (callback: (downloads: DownloadItem[]) => void) => () => void;
    };
  }
}


export default function App(): React.JSX.Element {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

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
  const [injectionReport, setInjectionReport] = useState<any>(null);
  const [routingDecision, setRoutingDecision] = useState<any>(null);
  const [lastInstruction, setLastInstruction] = useState<string>('');
  const [multiTabTask, setMultiTabTask] = useState<MultiTabTask | null>(null);

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
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

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

      return () => {
        unsubTabs();
        unsubDownloads();
        if (unsubActionLog) unsubActionLog();
        if (unsubState) unsubState();
        if (unsubInjection) unsubInjection();
        if (unsubRouting) unsubRouting();
      };
    }
  }, [loadInitialData]);

  // Agent Operations
  const handleSendTask = async (instruction: string) => {
    setLastInstruction(instruction);
    setTaskState(TaskState.EXECUTING);
    setNotifications((prev) => [
      ...prev,
      {
        id: `notif-${Date.now()}`,
        type: 'info',
        title: 'Task Started',
        message: `Agent executing: "${instruction}"`,
        timestamp: Date.now(),
        read: false,
      },
    ]);

    if (window.sentry?.agent) {
      window.sentry.agent.speak?.(`Executing: ${instruction}`);

      if (instruction.toLowerCase().includes('compare') || instruction.toLowerCase().includes('multi-tab')) {
        const dummyMultiTab: MultiTabTask = {
          id: `mt-${Date.now()}`,
          instruction,
          createdAt: Date.now(),
          tabs: [
            { tabId: 'tab-1', subInstruction: `${instruction} on site A`, status: 'running', progressPercent: 30 },
            { tabId: 'tab-2', subInstruction: `${instruction} on site B`, status: 'pending', progressPercent: 0 }
          ],
          results: {}
        };
        setMultiTabTask(dummyMultiTab);
        try {
          await window.sentry.agent.runMultiTab(dummyMultiTab);
          setTaskState(TaskState.COMPLETED);
          window.sentry.agent.speak?.('Multi-tab task completed successfully');
        } catch (e: any) {
          setTaskState(TaskState.FAILED);
          window.sentry.agent.speak?.('Multi-tab task failed');
        }
        return;
      }

      const res = await window.sentry.agent.runTask(instruction);
      if (res.success) {
        setTaskState(TaskState.COMPLETED);
        window.sentry.agent.speak?.('Task completed');
        setNotifications((prev) => [
          ...prev,
          {
            id: `notif-done-${Date.now()}`,
            type: 'success',
            title: 'Task Completed',
            message: `Completed task: "${instruction}"`,
            timestamp: Date.now(),
            read: false,
          },
        ]);
      } else {
        setTaskState(TaskState.FAILED);
        window.sentry.agent.speak?.('Task failed');
        setNotifications((prev) => [
          ...prev,
          {
            id: `notif-err-${Date.now()}`,
            type: 'error',
            title: 'Task Failed',
            message: res.error || 'Failed to complete agent task',
            timestamp: Date.now(),
            read: false,
          },
        ]);
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
    setTaskState(TaskState.IDLE);
    if (window.sentry?.agent) await window.sentry.agent.stop();
  };

  const handleSaveRecipe = async (instruction: string) => {
    try {
      await window.sentry?.agent?.saveRecipe(instruction);
      alert('Recipe saved! View it in the Recipes dashboard.');
    } catch (e) {
      alert('Failed to save recipe.');
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
    }
  };

  const handleRemoveHistoryEntry = async (id: string) => {
    if (window.sentry) {
      await window.sentry.history.removeEntry(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    }
  };

  // Keyboard Shortcuts (Task 2.10)
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
            handleNavigate('sentry://history');
            break;
          case 'j':
            e.preventDefault();
            handleNavigate('sentry://downloads');
            break;
          case ',':
            e.preventDefault();
            handleNavigate('sentry://settings');
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
  }, [activeTabId, activeTab, tabs, handleNavigate, handleReload, handleToggleBookmark]);

  // Window Controls
  const handleMinimize = () => window.sentry?.window.minimize();
  const handleMaximize = () => window.sentry?.window.maximize();
  const handleCloseWindow = () => window.sentry?.window.close();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#0f172a' }}>
      {/* Titlebar & Tab Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#0d1117',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <div style={{ flexGrow: 1, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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

        {/* Notification Bell & Companion Sidebar Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag', paddingRight: '8px' } as React.CSSProperties}>
          <NotificationCenter
            notifications={notifications}
            onDismiss={handleDismissNotification}
            onClearAll={() => setNotifications([])}
            onActionClick={(notifId, actionId) => {
              console.log(`Action ${actionId} clicked on notification ${notifId}`);
              if (actionId === 'dismiss') {
                handleDismissNotification(notifId);
              }
            }}
          />
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Toggle Agent Sidebar Companion"
            style={{
              background: isSidebarOpen ? '#cba6f7' : '#1e1e2e',
              color: isSidebarOpen ? '#11111b' : '#cba6f7',
              border: '1px solid #cba6f7',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            🤖 Sidebar
          </button>
          <button
            onClick={handleMinimize}
            style={{ border: 'none', background: 'transparent', color: '#9ca3af', padding: '6px 10px', cursor: 'pointer' }}
          >
            ─
          </button>
          <button
            onClick={handleMaximize}
            style={{ border: 'none', background: 'transparent', color: '#9ca3af', padding: '6px 10px', cursor: 'pointer' }}
          >
            □
          </button>
          <button
            onClick={handleCloseWindow}
            style={{ border: 'none', background: 'transparent', color: '#9ca3af', padding: '6px 10px', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Address Bar */}
      <AddressBar
        activeTab={activeTab}
        bookmarks={bookmarks}
        history={history}
        routingDecision={routingDecision}
        onNavigate={handleNavigate}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        onToggleBookmark={handleToggleBookmark}
        onOpenPage={(page) => handleNavigate(`sentry://${page}`)}
      />

      {/* Bookmarks Bar */}
      <BookmarksBar
        bookmarks={bookmarks}
        onNavigate={handleNavigate}
        onRemoveBookmark={handleRemoveBookmark}
      />

      {/* Main Content Area */}
      <div style={{ flexGrow: 1, position: 'relative', overflow: 'auto' }}>
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

        {/* Multi-Tab Dashboard Overlay */}
        {multiTabTask && (
          <MultiTabDashboard
            task={multiTabTask}
            onPauseAll={() => {
              const updated = { ...multiTabTask };
              updated.tabs.forEach(t => t.status = 'paused');
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

        {injectionReport && (
          <InjectionAlert
            report={injectionReport}
            onDismiss={() => setInjectionReport(null)}
            onReportFalsePositive={() => {
              console.log('False positive reported:', injectionReport.detections[0].id);
              setInjectionReport(null);
            }}
          />
        )}

        {/* Agent Companion Sidebar */}
        {isSidebarOpen && (
          <AgentSidebar
            taskState={taskState}
            actionLog={actionLog}
            onSendTask={handleSendTask}
            onPause={handlePause}
            onStop={handleStop}
            onResume={handleResume}
            onUndoLast={handleUndoLast}
            onToggleVisionMode={() => setIsVisionActive(!isVisionActive)}
            isVisionModeActive={isVisionActive}
          />
        )}

        {/* Floating Agent Command Box (Ctrl+Shift+Space) */}
        <AgentCommandBox
          onSendTask={handleSendTask}
          onPause={handlePause}
          onStop={handleStop}
          onResume={handleResume}
          taskState={taskState}
          lastInstruction={lastInstruction}
          onSaveRecipe={handleSaveRecipe}
        />
      </div>
    </div>
  );
}
