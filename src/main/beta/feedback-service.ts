/**
 * Phase 15 — Beta feedback collection.
 *
 * Feedback submitted from the in-app dialog is queued locally as a JSON file
 * and uploaded by the release pipeline (or exported manually from Developer
 * Mode). Nothing leaves the machine without the user explicitly opting in.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BetaChannel,
  BetaSystemInfo,
  FeedbackCategory,
  FeedbackInput,
  FeedbackResult,
  FeedbackSubmission,
} from '../../shared/beta';

export const MAX_FEEDBACK_LENGTH = 4000;

const CATEGORIES: FeedbackCategory[] = ['bug', 'suggestion', 'compliment'];

export interface FeedbackServiceOptions {
  filePath: string;
  appVersion: string;
  channel: BetaChannel;
  sessionId?: string;
  systemInfo?: BetaSystemInfo;
  now?: () => number;
}

export function collectSystemInfo(): BetaSystemInfo {
  const mem = os.totalmem();
  return {
    os: process.platform,
    osVersion: os.release(),
    arch: process.arch,
    ramMB: Math.round(mem / (1024 * 1024)),
  };
}

export class FeedbackService {
  private readonly filePath: string;
  private readonly appVersion: string;
  private readonly channel: BetaChannel;
  private readonly sessionId: string;
  private readonly systemInfo: BetaSystemInfo;
  private readonly now: () => number;
  private entries: FeedbackSubmission[] = [];

  constructor(options: FeedbackServiceOptions) {
    this.filePath = options.filePath;
    this.appVersion = options.appVersion;
    this.channel = options.channel;
    this.sessionId = options.sessionId ?? crypto.randomUUID();
    this.systemInfo = options.systemInfo ?? collectSystemInfo();
    this.now = options.now ?? Date.now;
    this.entries = this.load();
  }

  private load(): FeedbackSubmission[] {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      if (!raw.trim()) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (entry): entry is FeedbackSubmission =>
          typeof entry === 'object' && entry !== null && typeof (entry as FeedbackSubmission).id === 'string',
      );
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch (err) {
      console.error('[FeedbackService] Failed to persist feedback:', err);
    }
  }

  public submit(input: FeedbackInput): FeedbackResult {
    const message = (input.message ?? '').trim();
    if (!CATEGORIES.includes(input.category)) {
      return { accepted: false, pendingCount: this.entries.length, error: 'Unknown feedback category.' };
    }
    if (!message) {
      return { accepted: false, pendingCount: this.entries.length, error: 'Feedback message is required.' };
    }
    if (message.length > MAX_FEEDBACK_LENGTH) {
      return {
        accepted: false,
        pendingCount: this.entries.length,
        error: `Feedback message exceeds ${MAX_FEEDBACK_LENGTH} characters.`,
      };
    }
    const email = input.contactEmail?.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { accepted: false, pendingCount: this.entries.length, error: 'Contact email is not valid.' };
    }

    const submission: FeedbackSubmission = {
      id: crypto.randomUUID(),
      category: input.category,
      message,
      contactEmail: email || undefined,
      includeLogs: input.includeLogs === true,
      appVersion: this.appVersion,
      channel: this.channel,
      sessionId: this.sessionId,
      systemInfo: this.systemInfo,
      createdAt: this.now(),
    };

    this.entries.push(submission);
    this.persist();

    return { accepted: true, id: submission.id, pendingCount: this.entries.length };
  }

  public getAll(): FeedbackSubmission[] {
    return [...this.entries];
  }

  public pendingCount(): number {
    return this.entries.length;
  }

  public clear(): void {
    this.entries = [];
    this.persist();
  }
}
