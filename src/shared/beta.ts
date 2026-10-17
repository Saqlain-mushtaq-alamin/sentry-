/**
 * Phase 15 — Beta Program types
 *
 * Shared contracts for the pre-release beta channel: feedback collection,
 * consent-gated telemetry metrics, and the auto-update lifecycle.
 */

export type FeedbackCategory = 'bug' | 'suggestion' | 'compliment';

export type BetaChannel = 'beta' | 'stable';

export type BetaUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

/** Metric events emitted by the agent pipeline into the beta metrics collector. */
export type BetaMetricEvent =
  | 'task-started'
  | 'task-completed'
  | 'task-failed'
  | 'confirmation-accepted'
  | 'confirmation-denied'
  | 'injection-detected';

export interface BetaSystemInfo {
  os: string;
  osVersion: string;
  arch: string;
  ramMB: number;
}

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  contactEmail?: string;
  includeLogs?: boolean;
}

export interface FeedbackSubmission {
  id: string;
  category: FeedbackCategory;
  message: string;
  contactEmail?: string;
  includeLogs: boolean;
  appVersion: string;
  channel: BetaChannel;
  sessionId: string;
  systemInfo: BetaSystemInfo;
  createdAt: number;
}

export interface FeedbackResult {
  accepted: boolean;
  id?: string;
  pendingCount: number;
  error?: string;
}

export interface BetaConsentSettings {
  telemetryEnabled: boolean;
  crashReportingEnabled: boolean;
}

export interface BetaStatus {
  channel: BetaChannel;
  appVersion: string;
  consent: BetaConsentSettings;
  pendingFeedbackCount: number;
  lastUpdateCheck: number | null;
  updateState: BetaUpdateState;
  updateAvailableVersion?: string;
}

export interface BetaUpdateStatusEvent {
  state: BetaUpdateState;
  channel: BetaChannel;
  version?: string;
  percent?: number;
  error?: string;
}

export interface BetaMetricsDay {
  date: string;
  sessions: number;
  tasksStarted: number;
  tasksCompleted: number;
  tasksFailed: number;
  confirmationsAccepted: number;
  confirmationsDenied: number;
  injectionDetections: number;
  crashes: number;
}

export interface BetaMetricsSnapshot {
  channel: BetaChannel;
  appVersion: string;
  sessionCount: number;
  distinctActiveDays: number;
  tasksStarted: number;
  tasksCompleted: number;
  tasksFailed: number;
  taskCompletionRate: number;
  confirmationsAccepted: number;
  confirmationsDenied: number;
  confirmationAcceptRate: number;
  injectionDetections: number;
  crashes: number;
  crashesPerSession: number;
  startupTimeMs: number | null;
  memoryUsageMB: number;
  featureUsage: Record<string, number>;
  today: BetaMetricsDay;
}
