/**
 * Phase 15 — Consent-gated crash reporting unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startCrashReporter, CrashReporterLike } from '../../../src/main/beta/crash-reporter';

describe('startCrashReporter', () => {
  let start: ReturnType<typeof vi.fn>;
  let impl: CrashReporterLike;

  beforeEach(() => {
    start = vi.fn();
    impl = { start };
  });

  it('does not start when the user opted out', () => {
    const started = startCrashReporter(
      { submitURL: 'https://crash.example.test', enabled: false, channel: 'beta', appVersion: '0.1.0' },
      impl,
    );
    expect(started).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it('does not start without a submit URL', () => {
    const started = startCrashReporter(
      { submitURL: '', enabled: true, channel: 'beta', appVersion: '0.1.0' },
      impl,
    );
    expect(started).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it('starts with upload enabled and channel metadata', () => {
    const started = startCrashReporter(
      { submitURL: 'https://crash.example.test', enabled: true, channel: 'beta', appVersion: '1.2.3' },
      impl,
    );
    expect(started).toBe(true);
    expect(start).toHaveBeenCalledWith({
      submitURL: 'https://crash.example.test',
      uploadToServer: true,
      productName: 'Sentry Browser',
      companyName: 'Sentry',
      compress: true,
      extra: { channel: 'beta', version: '1.2.3' },
    });
  });

  it('never throws — returns false when the reporter rejects config', () => {
    start.mockImplementationOnce(() => {
      throw new Error('bad submitURL');
    });
    const started = startCrashReporter(
      { submitURL: 'https://crash.example.test', enabled: true, channel: 'stable', appVersion: '0.1.0' },
      impl,
    );
    expect(started).toBe(false);
  });
});
