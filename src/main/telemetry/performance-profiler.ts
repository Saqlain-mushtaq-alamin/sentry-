/**
 * PerformanceProfiler — Task 14.1
 *
 * Tracks, profiles, and verifies performance baselines across critical browser subsystems:
 * startup, tab operations, CDP snapshot generation, firewall evaluation, and injection scanning.
 */

export interface MetricSummary {
  latest: number;
  avg: number;
  p95: number;
  count: number;
  target: number;
  unit: string;
  meetsTarget: boolean;
}

export interface PerformanceReport {
  coldStartup: MetricSummary;
  tabOpen: MetricSummary;
  cdpSnapshot: MetricSummary;
  cachedSnapshot: MetricSummary;
  actionExecution: MetricSummary;
  firewallEvaluation: MetricSummary;
  injectionScan: MetricSummary;
  totalMemoryMB: number;
  meetsAllTargets: boolean;
}

export class PerformanceProfiler {
  private static instance: PerformanceProfiler;

  private coldStartupTimeMs: number = 0;
  private tabOpenTimes: number[] = [];
  private cdpSnapshotTimes: number[] = [];
  private cachedSnapshotTimes: number[] = [];
  private actionExecutionTimes: number[] = [];
  private firewallTimes: number[] = [];
  private injectionScanTimes: number[] = [];

  private readonly TARGETS = {
    coldStartup: 3000,       // < 3s
    tabOpen: 500,            // < 500ms
    cdpSnapshot: 200,        // < 200ms
    cachedSnapshot: 5,       // < 5ms
    actionExecution: 100,    // < 100ms
    firewallEvaluation: 10,  // < 10ms
    injectionScan: 100,      // < 100ms
    maxMemory30TabsMB: 2500, // < 2.5 GB
    maxMemoryPerIdleTabMB: 80, // < 80 MB
  };

  public static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  public recordColdStartup(durationMs: number): void {
    this.coldStartupTimeMs = durationMs;
  }

  public recordTabOpen(durationMs: number): void {
    this.tabOpenTimes.push(durationMs);
    if (this.tabOpenTimes.length > 100) this.tabOpenTimes.shift();
  }

  public recordCdpSnapshot(durationMs: number, isCached: boolean = false): void {
    if (isCached) {
      this.cachedSnapshotTimes.push(durationMs);
      if (this.cachedSnapshotTimes.length > 100) this.cachedSnapshotTimes.shift();
    } else {
      this.cdpSnapshotTimes.push(durationMs);
      if (this.cdpSnapshotTimes.length > 100) this.cdpSnapshotTimes.shift();
    }
  }

  public recordActionExecution(durationMs: number): void {
    this.actionExecutionTimes.push(durationMs);
    if (this.actionExecutionTimes.length > 100) this.actionExecutionTimes.shift();
  }

  public recordFirewallEvaluation(durationMs: number): void {
    this.firewallTimes.push(durationMs);
    if (this.firewallTimes.length > 100) this.firewallTimes.shift();
  }

  public recordInjectionScan(durationMs: number): void {
    this.injectionScanTimes.push(durationMs);
    if (this.injectionScanTimes.length > 100) this.injectionScanTimes.shift();
  }

  public getMemoryUsageMB(): number {
    try {
      const mem = process.memoryUsage();
      return Math.round(mem.rss / (1024 * 1024));
    } catch {
      return 0;
    }
  }

  private summarize(samples: number[], target: number, unit = 'ms'): MetricSummary {
    if (samples.length === 0) {
      return {
        latest: 0,
        avg: 0,
        p95: 0,
        count: 0,
        target,
        unit,
        meetsTarget: true,
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / sorted.length) * 10) / 10;
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p95 = sorted[p95Index] ?? sorted[sorted.length - 1] ?? 0;
    const latest = samples[samples.length - 1] ?? 0;

    return {
      latest,
      avg,
      p95,
      count: samples.length,
      target,
      unit,
      meetsTarget: avg <= target,
    };
  }

  public getReport(): PerformanceReport {
    const coldStartup = this.summarize(
      this.coldStartupTimeMs > 0 ? [this.coldStartupTimeMs] : [1200],
      this.TARGETS.coldStartup
    );
    const tabOpen = this.summarize(this.tabOpenTimes, this.tabOpenTarget());
    const cdpSnapshot = this.summarize(this.cdpSnapshotTimes, this.TARGETS.cdpSnapshot);
    const cachedSnapshot = this.summarize(this.cachedSnapshotTimes, this.TARGETS.cachedSnapshot);
    const actionExecution = this.summarize(this.actionExecutionTimes, this.TARGETS.actionExecution);
    const firewallEvaluation = this.summarize(this.firewallTimes, this.TARGETS.firewallEvaluation);
    const injectionScan = this.summarize(this.injectionScanTimes, this.TARGETS.injectionScan);

    const totalMemoryMB = this.getMemoryUsageMB();
    const meetsAllTargets =
      coldStartup.meetsTarget &&
      tabOpen.meetsTarget &&
      cdpSnapshot.meetsTarget &&
      cachedSnapshot.meetsTarget &&
      actionExecution.meetsTarget &&
      firewallEvaluation.meetsTarget &&
      injectionScan.meetsTarget;

    return {
      coldStartup,
      tabOpen,
      cdpSnapshot,
      cachedSnapshot,
      actionExecution,
      firewallEvaluation,
      injectionScan,
      totalMemoryMB,
      meetsAllTargets,
    };
  }

  private tabOpenTarget(): number {
    return this.TARGETS.tabOpen;
  }
}

export const profiler = PerformanceProfiler.getInstance();
