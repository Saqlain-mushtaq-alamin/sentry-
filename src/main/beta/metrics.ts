/**
 * Phase 15 — Beta metrics collection (consent-gated).
 *
 * Tracks the beta-program KPIs from Task 15.6: daily active usage, task
 * start/completion ratio, firewall confirmation accept/deny ratio, injection
 * detections, crashes per session, startup time and feature usage.
 *
 * Counters are kept per calendar day and persisted so the beta report can
 * aggregate across sessions and days.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  BetaChannel,
  BetaMetricEvent,
  BetaMetricsDay,
  BetaMetricsSnapshot,
} from '../../shared/beta';

export interface MetricsStore {
  version: 1;
  history: Record<string, BetaMetricsDay>;
  featureUsage: Record<string, number>;
  startupTimeMs: number | null;
}

export interface BetaMetricsOptions {
  filePath: string;
  channel: BetaChannel;
  appVersion: string;
  now?: () => number;
}

function emptyDay(date: string): BetaMetricsDay {
  return {
    date,
    sessions: 0,
    tasksStarted: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    confirmationsAccepted: 0,
    confirmationsDenied: 0,
    injectionDetections: 0,
    crashes: 0,
  };
}

export class BetaMetricsCollector {
  private readonly filePath: string;
  private readonly channel: BetaChannel;
  private readonly appVersion: string;
  private readonly now: () => number;
  private history: Record<string, BetaMetricsDay> = {};
  private featureUsage: Record<string, number> = {};
  private startupTimeMs: number | null = null;
  private sessionCounted = false;

  constructor(options: BetaMetricsOptions) {
    this.filePath = options.filePath;
    this.channel = options.channel;
    this.appVersion = options.appVersion;
    this.now = options.now ?? Date.now;
    this.load();
  }

  private dateKey(): string {
    return new Date(this.now()).toISOString().slice(0, 10);
  }

  private today(): BetaMetricsDay {
    const key = this.dateKey();
    if (!this.history[key]) {
      this.history[key] = emptyDay(key);
    }
    return this.history[key];
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw) as Partial<MetricsStore>;
      if (parsed && typeof parsed === 'object') {
        if (parsed.history && typeof parsed.history === 'object') this.history = parsed.history;
        if (parsed.featureUsage && typeof parsed.featureUsage === 'object') this.featureUsage = parsed.featureUsage;
        if (typeof parsed.startupTimeMs === 'number') this.startupTimeMs = parsed.startupTimeMs;
      }
    } catch {
      // Corrupt metrics file — start fresh rather than crash the beta build.
      this.history = {};
      this.featureUsage = {};
      this.startupTimeMs = null;
    }
  }

  private persist(): void {
    try {
      const store: MetricsStore = {
        version: 1,
        history: this.history,
        featureUsage: this.featureUsage,
        startupTimeMs: this.startupTimeMs,
      };
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2), 'utf-8');
    } catch (err) {
      console.error('[BetaMetrics] Failed to persist metrics:', err);
    }
  }

  /** Called once per app launch; counts a daily-active session. */
  public startSession(): void {
    if (this.sessionCounted) return;
    this.sessionCounted = true;
    this.today().sessions += 1;
    this.persist();
  }

  public recordStartup(durationMs: number): void {
    this.startupTimeMs = durationMs;
    this.persist();
  }

  public recordEvent(event: BetaMetricEvent): void {
    const day = this.today();
    switch (event) {
      case 'task-started':
        day.tasksStarted += 1;
        break;
      case 'task-completed':
        day.tasksCompleted += 1;
        break;
      case 'task-failed':
        day.tasksFailed += 1;
        break;
      case 'confirmation-accepted':
        day.confirmationsAccepted += 1;
        break;
      case 'confirmation-denied':
        day.confirmationsDenied += 1;
        break;
      case 'injection-detected':
        day.injectionDetections += 1;
        break;
      default:
        return;
    }
    this.persist();
  }

  public recordCrash(): void {
    this.today().crashes += 1;
    this.persist();
  }

  public recordFeatureUse(feature: string): void {
    this.featureUsage[feature] = (this.featureUsage[feature] ?? 0) + 1;
    this.persist();
  }

  public getSnapshot(): BetaMetricsSnapshot {
    const days = Object.values(this.history);
    const today = this.today();

    const total = (pick: (day: BetaMetricsDay) => number): number =>
      days.reduce((sum, day) => sum + pick(day), 0);

    const sessionCount = total((d) => d.sessions);
    const tasksStarted = total((d) => d.tasksStarted);
    const tasksCompleted = total((d) => d.tasksCompleted);
    const confirmationsAccepted = total((d) => d.confirmationsAccepted);
    const confirmationsDenied = total((d) => d.confirmationsDenied);
    const crashes = total((d) => d.crashes);
    const confirmationTotal = confirmationsAccepted + confirmationsDenied;

    return {
      channel: this.channel,
      appVersion: this.appVersion,
      sessionCount,
      distinctActiveDays: days.filter((d) => d.sessions > 0).length,
      tasksStarted,
      tasksCompleted,
      tasksFailed: total((d) => d.tasksFailed),
      taskCompletionRate: tasksStarted > 0 ? Math.round((tasksCompleted / tasksStarted) * 1000) / 10 : 0,
      confirmationsAccepted,
      confirmationsDenied,
      confirmationAcceptRate:
        confirmationTotal > 0 ? Math.round((confirmationsAccepted / confirmationTotal) * 1000) / 10 : 0,
      injectionDetections: total((d) => d.injectionDetections),
      crashes,
      crashesPerSession: sessionCount > 0 ? Math.round((crashes / sessionCount) * 100) / 100 : 0,
      startupTimeMs: this.startupTimeMs,
      memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      featureUsage: { ...this.featureUsage },
      today: { ...today },
    };
  }

  public reset(): void {
    this.history = {};
    this.featureUsage = {};
    this.startupTimeMs = null;
    this.sessionCounted = false;
    this.persist();
  }
}
