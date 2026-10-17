/**
 * Phase 15 — Beta feedback collection unit tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FeedbackService, MAX_FEEDBACK_LENGTH } from '../../../src/main/beta/feedback-service';
import { BetaSystemInfo } from '../../../src/shared/beta';

const SYSTEM_INFO: BetaSystemInfo = { os: 'win32', osVersion: '10.0.0', arch: 'x64', ramMB: 16384 };

describe('FeedbackService', () => {
  let dir: string;
  let filePath: string;
  let clock = 1_700_000_000_000;
  let service: FeedbackService;

  const makeService = (): FeedbackService =>
    new FeedbackService({
      filePath,
      appVersion: '0.1.0',
      channel: 'beta',
      sessionId: 'session-1',
      systemInfo: SYSTEM_INFO,
      now: () => clock,
    });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-feedback-'));
    filePath = path.join(dir, 'beta-feedback.json');
    clock = 1_700_000_000_000;
    service = makeService();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts valid feedback with full metadata', () => {
    const result = service.submit({
      category: 'bug',
      message: 'The confirmation bar disappears when I switch tabs.',
      contactEmail: 'qa@example.com',
      includeLogs: true,
    });

    expect(result.accepted).toBe(true);
    expect(result.id).toBeTruthy();
    expect(result.pendingCount).toBe(1);

    const entries = service.getAll();
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry?.category).toBe('bug');
    expect(entry?.appVersion).toBe('0.1.0');
    expect(entry?.channel).toBe('beta');
    expect(entry?.sessionId).toBe('session-1');
    expect(entry?.includeLogs).toBe(true);
    expect(entry?.systemInfo).toEqual(SYSTEM_INFO);
    expect(entry?.createdAt).toBe(clock);
  });

  it('rejects an empty message', () => {
    const result = service.submit({ category: 'bug', message: '   ' });
    expect(result.accepted).toBe(false);
    expect(result.error).toMatch(/required/i);
    expect(service.pendingCount()).toBe(0);
  });

  it('rejects an unknown category', () => {
    const result = service.submit({
      category: 'rant' as unknown as 'bug',
      message: 'something',
    });
    expect(result.accepted).toBe(false);
    expect(result.error).toMatch(/category/i);
  });

  it('rejects messages longer than the limit', () => {
    const result = service.submit({ category: 'bug', message: 'x'.repeat(MAX_FEEDBACK_LENGTH + 1) });
    expect(result.accepted).toBe(false);
    expect(result.error).toContain(String(MAX_FEEDBACK_LENGTH));
  });

  it('rejects a malformed contact email', () => {
    const result = service.submit({ category: 'bug', message: 'hi', contactEmail: 'not-an-email' });
    expect(result.accepted).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('trims whitespace from the stored message', () => {
    service.submit({ category: 'suggestion', message: '  dark mode toggle  ' });
    expect(service.getAll()[0]?.message).toBe('dark mode toggle');
  });

  it('persists to disk and reloads on a new instance', () => {
    service.submit({ category: 'compliment', message: 'The firewall explanations are great.' });
    service.submit({ category: 'bug', message: 'Second issue report.' });

    const reloaded = makeService();
    expect(reloaded.pendingCount()).toBe(2);
    expect(reloaded.getAll().map((e) => e.category)).toEqual(['compliment', 'bug']);
  });

  it('tolerates a corrupt feedback file', () => {
    fs.writeFileSync(filePath, '{ this is not json', 'utf-8');
    const fresh = makeService();
    expect(fresh.pendingCount()).toBe(0);
    expect(fresh.submit({ category: 'bug', message: 'after corruption' }).accepted).toBe(true);
  });

  it('clear() empties the queue and persists it', () => {
    service.submit({ category: 'bug', message: 'one' });
    service.clear();
    expect(service.pendingCount()).toBe(0);
    expect(makeService().pendingCount()).toBe(0);
  });

  it('allows feedback without a contact email', () => {
    const result = service.submit({ category: 'suggestion', message: 'add keyboard shortcut' });
    expect(result.accepted).toBe(true);
    expect(service.getAll()[0]?.contactEmail).toBeUndefined();
  });
});
