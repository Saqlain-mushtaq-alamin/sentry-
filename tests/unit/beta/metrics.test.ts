/**
 * Phase 15 — Beta metrics collection unit tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BetaMetricsCollector } from '../../../src/main/beta/metrics';

describe('BetaMetricsCollector', () => {
  let dir: string;
  let filePath: string;
  let clock = 1_700_000_000_000; // 2023-11-14T22:13:20.000Z
  let collector: BetaMetricsCollector;

  const make = (now: () => number = () => clock): BetaMetricsCollector =>
    new BetaMetricsCollector({ filePath, channel: 'beta', appVersion: '0.1.0', now });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-metrics-'));
    filePath = path.join(dir, 'metrics', 'beta-metrics.json');
    clock = 1_700_000_000_000;
    collector = make();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('counts a session only once per launch', () => {
    collector.startSession();
    collector.startSession();
    collector.startSession();
    expect(collector.getSnapshot().sessionCount).toBe(1);
  });

  it('records startup time', () => {
    collector.recordStartup(1234);
    expect(collector.getSnapshot().startupTimeMs).toBe(1234);
  });

  it('records every known metric event', () => {
    collector.recordEvent('task-started');
    collector.recordEvent('task-started');
    collector.recordEvent('task-completed');
    collector.recordEvent('task-failed');
    collector.recordEvent('confirmation-accepted');
    collector.recordEvent('confirmation-denied');
    collector.recordEvent('injection-detected');

    const snap = collector.getSnapshot();
    expect(snap.tasksStarted).toBe(2);
    expect(snap.tasksCompleted).toBe(1);
    expect(snap.tasksFailed).toBe(1);
    expect(snap.confirmationsAccepted).toBe(1);
    expect(snap.confirmationsDenied).toBe(1);
    expect(snap.injectionDetections).toBe(1);
  });

  it('ignores unknown events instead of throwing', () => {
    collector.recordEvent('not-a-real-event' as 'task-started');
    const snap = collector.getSnapshot();
    expect(snap.tasksStarted).toBe(0);
    expect(snap.today.tasksStarted).toBe(0);
  });

  it('computes task completion and confirmation accept rates', () => {
    collector.recordEvent('task-started');
    collector.recordEvent('task-started');
    collector.recordEvent('task-started');
    collector.recordEvent('task-started');
    collector.recordEvent('task-completed');
    collector.recordEvent('task-completed');
    collector.recordEvent('task-completed');
    collector.recordEvent('confirmation-accepted');
    collector.recordEvent('confirmation-accepted');
    collector.recordEvent('confirmation-accepted');
    collector.recordEvent('confirmation-denied');

    const snap = collector.getSnapshot();
    expect(snap.taskCompletionRate).toBe(75); // 3/4
    expect(snap.confirmationAcceptRate).toBe(75); // 3/4
  });

  it('returns zero rates when there is no activity', () => {
    const snap = collector.getSnapshot();
    expect(snap.taskCompletionRate).toBe(0);
    expect(snap.confirmationAcceptRate).toBe(0);
    expect(snap.crashesPerSession).toBe(0);
  });

  it('tracks crashes per session across launches', () => {
    collector.startSession();
    collector.recordCrash();
    // A second launch on the same store counts another daily-active session.
    const secondLaunch = make();
    secondLaunch.startSession();

    const snap = secondLaunch.getSnapshot();
    expect(snap.crashes).toBe(1);
    expect(snap.crashesPerSession).toBe(0.5);
  });

  it('accumulates feature usage and exposes a copy', () => {
    collector.recordFeatureUse('recipes');
    collector.recordFeatureUse('recipes');
    collector.recordFeatureUse('voice');
    const snap = collector.getSnapshot();
    expect(snap.featureUsage).toEqual({ recipes: 2, voice: 1 });
    snap.featureUsage.recipes = 99;
    expect(collector.getSnapshot().featureUsage.recipes).toBe(2);
  });

  it('buckets activity per calendar day and counts distinct active days', () => {
    const day1 = 1_700_000_000_000;
    const day2 = day1 + 24 * 60 * 60 * 1000;
    let now = day1;

    // Two separate launches (a session is counted once per collector instance).
    const launch1 = make(() => now);
    launch1.startSession();
    launch1.recordEvent('task-started');

    now = day2;
    const launch2 = make(() => now);
    launch2.startSession();
    launch2.recordEvent('task-completed');

    const snap = launch2.getSnapshot();
    expect(snap.sessionCount).toBe(2);
    expect(snap.distinctActiveDays).toBe(2);
    expect(snap.tasksStarted).toBe(1);
    expect(snap.tasksCompleted).toBe(1);
    expect(snap.today.date).toBe(new Date(day2).toISOString().slice(0, 10));
  });

  it('persists history and reloads it in a new collector', () => {
    collector.startSession();
    collector.recordEvent('task-started');
    collector.recordEvent('task-completed');
    collector.recordStartup(400);
    collector.recordFeatureUse('voice');

    const reloaded = make();
    const snap = reloaded.getSnapshot();
    expect(snap.sessionCount).toBe(1);
    expect(snap.tasksStarted).toBe(1);
    expect(snap.tasksCompleted).toBe(1);
    expect(snap.startupTimeMs).toBe(400);
    expect(snap.featureUsage.voice).toBe(1);
  });

  it('survives a corrupt metrics file', () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'not json at all', 'utf-8');
    const fresh = make();
    expect(() => fresh.startSession()).not.toThrow();
    expect(fresh.getSnapshot().sessionCount).toBe(1);
  });

  it('reset() clears everything and persists the empty state', () => {
    collector.startSession();
    collector.recordEvent('task-started');
    collector.recordFeatureUse('x');
    collector.reset();

    const snap = collector.getSnapshot();
    expect(snap.sessionCount).toBe(0);
    expect(snap.tasksStarted).toBe(0);
    expect(snap.featureUsage).toEqual({});
    expect(make().getSnapshot().sessionCount).toBe(0);
    // session can be counted again after reset
    collector.startSession();
    expect(collector.getSnapshot().sessionCount).toBe(1);
  });

  it('includes channel and app version in the snapshot', () => {
    const snap = collector.getSnapshot();
    expect(snap.channel).toBe('beta');
    expect(snap.appVersion).toBe('0.1.0');
  });
});
