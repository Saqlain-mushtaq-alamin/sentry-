/**
 * Phase 15 — Crash reporting for the beta channel (consent-gated).
 *
 * Wraps Electron's `crashReporter` so it can be unit tested with a fake
 * implementation and so it is only started when the user opted in and a
 * submit URL is configured (SENTRY_CRASH_REPORT_URL).
 */
import { crashReporter as electronCrashReporter } from 'electron';
import { BetaChannel } from '../../shared/beta';

export interface CrashReporterLike {
  start(options: {
    submitURL: string;
    uploadToServer: boolean;
    productName: string;
    companyName: string;
    compress: boolean;
    extra?: Record<string, string>;
  }): void;
}

export interface CrashReporterOptions {
  submitURL: string;
  enabled: boolean;
  channel: BetaChannel;
  appVersion: string;
}

/**
 * Starts crash reporting. Returns true when reporting was started.
 * Never throws — a beta build must boot even if the reporter rejects config.
 */
export function startCrashReporter(
  options: CrashReporterOptions,
  impl: CrashReporterLike = electronCrashReporter,
): boolean {
  if (!options.enabled) return false;
  if (!options.submitURL) return false;

  try {
    impl.start({
      submitURL: options.submitURL,
      uploadToServer: true,
      productName: 'Sentry Browser',
      companyName: 'Sentry',
      compress: true,
      extra: {
        channel: options.channel,
        version: options.appVersion,
      },
    });
    return true;
  } catch (err) {
    console.error('[CrashReporter] Failed to start crash reporting:', err);
    return false;
  }
}
