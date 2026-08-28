import React, { useState, useEffect } from 'react';
import { DeveloperSessionStats, BenchmarkResults, TaskTrace } from '../../shared/types';
import { PromptInspector } from '../components/PromptInspector';
import { TraceExporter } from '../../main/agent/trace-exporter';
import './DeveloperMode.css';

export const DeveloperModePage: React.FC = () => {
  const [developerEnabled, setDeveloperEnabled] = useState<boolean>(true);
  const [stats, setStats] = useState<DeveloperSessionStats>({
    tasksCompleted: 0,
    actionsExecuted: 0,
    firewallBlocks: 0,
    confirmationsAsked: 0,
    injectionsDetected: 0,
    falsePositives: 0,
    totalTokens: 0,
    estimatedCost: 0,
    avgActionLatencyMs: 0,
    lastModelInfo: {
      activeModel: 'ollama:llama3.1:8b (local)',
      providerId: 'ollama',
      isLocal: true,
      routerDecision: 'Local-first mode (Default)',
      contextUsageTokens: 0,
      contextLimitTokens: 8192,
      lastLatencyMs: 0,
      avgLatencyMs: 0,
    },
  });

  const [activeTrace, setActiveTrace] = useState<TaskTrace | null>(null);
  const [selectedSuite, setSelectedSuite] = useState<string>('basic-navigation');
  const [benchmarkRunning, setBenchmarkRunning] = useState<boolean>(false);
  const [lastBenchmarkResult, setLastBenchmarkResult] = useState<BenchmarkResults | null>(null);

  useEffect(() => {
    // 1. Fetch user settings for developer mode toggle
    if ((window as any).sentry?.settings?.get) {
      (window as any).sentry.settings.get().then((settings: any) => {
        if (settings?.developerMode !== undefined) {
          setDeveloperEnabled(settings.developerMode);
        }
      });
    }

    // 2. Load live developer session stats from main process
    if ((window as any).sentry?.agent?.getDeveloperStats) {
      (window as any).sentry.agent.getDeveloperStats().then((liveStats: DeveloperSessionStats) => {
        if (liveStats) setStats(liveStats);
      });
    }

    // 3. Load last active task trace
    if ((window as any).sentry?.agent?.getLastTrace) {
      (window as any).sentry.agent.getLastTrace().then((trace: TaskTrace | null) => {
        if (trace) setActiveTrace(trace);
      });
    }

    // 4. Subscribe to live developer stats updates
    const unsubStats = (window as any).sentry?.agent?.onDeveloperStatsUpdated?.((newStats: DeveloperSessionStats) => {
      setStats(newStats);
    });

    // 5. Subscribe to live step traces
    const unsubSteps = (window as any).sentry?.agent?.onStepTraceAdded?.((newStep: any) => {
      setActiveTrace((prev) => {
        if (!prev) {
          return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            sentryVersion: '0.1.0',
            task: {
              id: 'task-live',
              instruction: 'Active ReAct Execution Task',
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              state: 'executing' as any,
              totalSteps: 1,
            },
            model: {
              providerId: 'ollama',
              modelId: 'llama3.1:8b',
              isLocal: true,
              totalTokens: (newStep.rawPrompt?.tokensIn || 0) + (newStep.rawPrompt?.tokensOut || 0),
              estimatedCost: 0,
            },
            steps: [newStep],
            firewallSummary: { totalDecisions: 1, allowed: newStep.firewallDecision.allowed ? 1 : 0, blocked: newStep.firewallDecision.allowed ? 0 : 1, confirmationsAsked: 0, confirmationsDenied: 0 },
            injectionSummary: { totalScans: 1, detectionsFound: newStep.injectionScanResult?.isClean ? 0 : 1, falsePositives: 0 },
            performance: { totalDurationMs: newStep.latency.model + newStep.latency.execution, avgStepLatencyMs: newStep.latency.model, avgModelLatencyMs: newStep.latency.model, avgActionLatencyMs: newStep.latency.execution },
          };
        }
        return {
          ...prev,
          task: { ...prev.task, totalSteps: prev.steps.length + 1 },
          steps: [...prev.steps, newStep],
        };
      });
    });

    return () => {
      if (unsubStats) unsubStats();
      if (unsubSteps) unsubSteps();
    };
  }, []);

  const handleToggleDevMode = (enabled: boolean) => {
    setDeveloperEnabled(enabled);
    if ((window as any).sentry?.settings?.update) {
      (window as any).sentry.settings.update({ developerMode: enabled });
    }
  };

  const handleDownloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRunBenchmark = async () => {
    setBenchmarkRunning(true);
    try {
      if ((window as any).sentry?.agent?.runBenchmark) {
        const result = await (window as any).sentry.agent.runBenchmark(selectedSuite);
        setLastBenchmarkResult(result);
      }
    } catch (err) {
      console.error('Failed to run benchmark suite:', err);
    } finally {
      setBenchmarkRunning(false);
    }
  };

  const handleResetStats = async () => {
    if ((window as any).sentry?.agent?.resetDeveloperStats) {
      await (window as any).sentry.agent.resetDeveloperStats();
    }
    setStats({
      tasksCompleted: 0,
      actionsExecuted: 0,
      firewallBlocks: 0,
      confirmationsAsked: 0,
      injectionsDetected: 0,
      falsePositives: 0,
      totalTokens: 0,
      estimatedCost: 0,
      avgActionLatencyMs: 0,
      lastModelInfo: {
        activeModel: 'ollama:llama3.1:8b (local)',
        providerId: 'ollama',
        isLocal: true,
        routerDecision: 'Local-first mode (Default)',
        contextUsageTokens: 0,
        contextLimitTokens: 8192,
        lastLatencyMs: 0,
        avgLatencyMs: 0,
      },
    });
    setActiveTrace(null);
  };

  return (
    <div className="developer-mode-page">
      <div className="dev-header">
        <div className="dev-title">
          <span>🔧 Developer / Research Mode</span>
          <span className={`dev-badge ${developerEnabled ? 'dev-badge-green' : 'dev-badge-amber'}`}>
            {developerEnabled ? 'ACTIVE' : 'DISABLED'}
          </span>
        </div>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={developerEnabled}
              onChange={(e) => handleToggleDevMode(e.target.checked)}
            />
            Enable Developer Mode
          </label>
        </div>
      </div>

      {!developerEnabled ? (
        <div className="dev-warning-banner" style={{ background: '#1e293b', borderColor: '#334155' }}>
          <strong>Developer Mode is currently OFF.</strong> Enable it above to expose real-time model telemetry, prompt inspector, task traces, and benchmark suites.
        </div>
      ) : (
        <>
          <div className="dev-warning-banner">
            ⚠️ <strong>Advanced Feature Warning:</strong> Developer Mode exposes internal prompts, live execution traces, model latency, and security statistics. Ideal for researchers, benchmarking, and debugging.
          </div>

          <div className="dev-panels-grid">
            {/* Panel 1: Model Info */}
            <div className="dev-panel">
              <div className="dev-panel-title">
                <span>🤖 Model Info & Telemetry</span>
                <span className="dev-badge dev-badge-blue">
                  {stats.lastModelInfo?.isLocal ? 'LOCAL' : 'CLOUD'}
                </span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Active Model:</span>
                <span className="dev-info-value">{stats.lastModelInfo?.activeModel}</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Router Decision:</span>
                <span className="dev-info-value">{stats.lastModelInfo?.routerDecision}</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Context Usage:</span>
                <span className="dev-info-value">
                  {stats.lastModelInfo?.contextUsageTokens.toLocaleString()} / {stats.lastModelInfo?.contextLimitTokens.toLocaleString()} (
                  {((stats.lastModelInfo!.contextUsageTokens / stats.lastModelInfo!.contextLimitTokens) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Request Latency:</span>
                <span className="dev-info-value">
                  {stats.lastModelInfo?.lastLatencyMs}ms (last), {stats.lastModelInfo?.avgLatencyMs}ms (avg)
                </span>
              </div>
            </div>

            {/* Panel 2: Last Action Analysis */}
            <div className="dev-panel">
              <div className="dev-panel-title">
                <span>🔍 Last Action Analysis</span>
                <span className="dev-badge dev-badge-green">
                  {stats.lastActionAnalysis?.firewallDecision}
                </span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Action Target:</span>
                <span className="dev-info-value">{stats.lastActionAnalysis?.actionType} → {stats.lastActionAnalysis?.target}</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Risk Score / Tier:</span>
                <span className="dev-info-value">{stats.lastActionAnalysis?.riskScore} ({stats.lastActionAnalysis?.riskTier.toUpperCase()})</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Policy Rules Fired:</span>
                <span className="dev-info-value">[{stats.lastActionAnalysis?.policyRulesFired.join(', ')}]</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Injection Scan:</span>
                <span className="dev-info-value">
                  {stats.lastActionAnalysis?.injectionScanClean ? 'CLEAN' : '⚠️ DETECTED'} ({stats.lastActionAnalysis?.injectionScanTimeMs}ms)
                </span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Execution Time:</span>
                <span className="dev-info-value">{stats.lastActionAnalysis?.executionTimeMs}ms</span>
              </div>
            </div>

            {/* Panel 3: Session Stats */}
            <div className="dev-panel">
              <div className="dev-panel-title">
                <span>📊 Session Stats</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Tasks Completed / Actions:</span>
                <span className="dev-info-value">{stats.tasksCompleted} tasks | {stats.actionsExecuted} actions</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Firewall Blocks / Confirmations:</span>
                <span className="dev-info-value">{stats.firewallBlocks} blocks | {stats.confirmationsAsked} asked</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Injections Detected / FPs:</span>
                <span className="dev-info-value">{stats.injectionsDetected} detected | {stats.falsePositives} FPs</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Total Tokens / Est. Cost:</span>
                <span className="dev-info-value">{stats.totalTokens.toLocaleString()} tokens | ${stats.estimatedCost.toFixed(2)}</span>
              </div>
              <div className="dev-info-row">
                <span className="dev-info-label">Avg Action Latency:</span>
                <span className="dev-info-value">{stats.avgActionLatencyMs}ms</span>
              </div>
            </div>

            {/* Panel 4: Benchmarking Suite */}
            <div className="dev-panel">
              <div className="dev-panel-title">
                <span>🎯 Benchmarking Hooks</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <select
                  className="inspector-step-select"
                  style={{ flex: 1 }}
                  value={selectedSuite}
                  onChange={(e) => setSelectedSuite(e.target.value)}
                >
                  <option value="basic-navigation">1. Basic Navigation (10 tasks)</option>
                  <option value="form-filling">2. Form Filling (10 tasks)</option>
                  <option value="adversarial-security">3. Adversarial Security (20 tasks)</option>
                  <option value="multi-tab">4. Multi-Tab Orchestration (5 tasks)</option>
                  <option value="model-comparison">5. Model Comparison (Local vs Cloud)</option>
                </select>
                <button
                  className="dev-btn dev-btn-accent"
                  disabled={benchmarkRunning}
                  onClick={handleRunBenchmark}
                >
                  {benchmarkRunning ? 'Running...' : 'Run Benchmark'}
                </button>
              </div>

              {lastBenchmarkResult && (
                <div className="benchmark-card">
                  <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '8px' }}>
                    Results: {lastBenchmarkResult.suiteName}
                  </div>
                  <div className="dev-info-row">
                    <span className="dev-info-label">Success Rate:</span>
                    <span className="dev-info-value" style={{ color: '#4ade80' }}>{lastBenchmarkResult.taskSuccessRate}%</span>
                  </div>
                  <div className="dev-info-row">
                    <span className="dev-info-label">Avg Task Duration:</span>
                    <span className="dev-info-value">{lastBenchmarkResult.avgTaskDuration}ms</span>
                  </div>
                  <div className="dev-info-row">
                    <span className="dev-info-label">Injection Detection Rate:</span>
                    <span className="dev-info-value">{lastBenchmarkResult.injectionDetectionRate}%</span>
                  </div>
                  <div className="dev-info-row">
                    <span className="dev-info-label">Avg Tokens & Cost / Task:</span>
                    <span className="dev-info-value">{lastBenchmarkResult.avgTokensPerTask} tok | ${lastBenchmarkResult.avgCostPerTask}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Raw Prompt Inspector Component */}
          <PromptInspector steps={activeTrace?.steps || []} />

          {/* Export Controls Bar */}
          <div className="dev-actions-bar">
            <button
              className="dev-btn dev-btn-accent"
              disabled={!activeTrace}
              onClick={async () => {
                if (!activeTrace) return;
                const jsonStr = (window as any).sentry?.agent?.exportTrace
                  ? await (window as any).sentry.agent.exportTrace(activeTrace, 'json')
                  : TraceExporter.exportToJson(activeTrace);
                const fname = TraceExporter.generateFilename(activeTrace.task.instruction, 'json');
                handleDownloadFile(jsonStr, fname);
              }}
            >
              Export Full Trace (JSON)
            </button>

            <button
              className="dev-btn"
              disabled={!activeTrace}
              onClick={async () => {
                if (!activeTrace) return;
                const mdStr = (window as any).sentry?.agent?.exportTrace
                  ? await (window as any).sentry.agent.exportTrace(activeTrace, 'md')
                  : TraceExporter.exportToMarkdown(activeTrace);
                const fname = TraceExporter.generateFilename(activeTrace.task.instruction, 'md');
                handleDownloadFile(mdStr, fname);
              }}
            >
              Export Full Trace (Markdown)
            </button>

            <button
              className="dev-btn"
              disabled={!activeTrace}
              onClick={async () => {
                if (!activeTrace) return;
                const csvStr = (window as any).sentry?.agent?.exportTrace
                  ? await (window as any).sentry.agent.exportTrace(activeTrace, 'csv')
                  : TraceExporter.exportToCsv(activeTrace);
                const fname = TraceExporter.generateFilename(activeTrace.task.instruction, 'csv');
                handleDownloadFile(csvStr, fname);
              }}
            >
              Export Full Trace (CSV)
            </button>

            <button
              className="dev-btn"
              onClick={() => {
                const statsStr = JSON.stringify(stats, null, 2);
                handleDownloadFile(statsStr, `sentry_session_stats_${new Date().toISOString().slice(0, 10)}.json`);
              }}
            >
              Export Session Stats
            </button>

            <button
              className="dev-btn dev-btn-danger"
              onClick={handleResetStats}
            >
              Reset Session Stats
            </button>
          </div>
        </>
      )}
    </div>
  );
};
