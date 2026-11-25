/**
 * Sentry Browser — Production Auto-Updater types (Phase 16)
 */

export type UpdateChannel = 'stable' | 'beta' | 'canary';

export type UpdateLifecycleState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateInfoPayload {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
  channel?: UpdateChannel;
}

export interface DownloadProgressPayload {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateStatusEvent {
  state: UpdateLifecycleState;
  channel: UpdateChannel;
  version?: string;
  releaseDate?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
  progress?: DownloadProgressPayload;
  error?: string;
  lastCheck?: number;
}
