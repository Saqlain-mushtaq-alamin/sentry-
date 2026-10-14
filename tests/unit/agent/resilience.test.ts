/**
 * Task 14.7 — Error Recovery & Resilience Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { ResilienceManager } from '../../../src/main/agent/resilience-manager';

describe('Task 14.7 — Resilience & Fault Tolerance', () => {
  it('diagnoses Ollama crash or disconnection properly', () => {
    const err = new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:11434');
    const diag = ResilienceManager.diagnoseModelError(err);
    expect(diag.isOllamaCrash).toBe(true);
    expect(diag.recommendedAction).toContain('Ollama');
  });

  it('diagnoses 429 rate limit properly', () => {
    const err = new Error('OpenAI API error (429): Rate limit reached');
    const diag = ResilienceManager.diagnoseModelError(err);
    expect(diag.isRateLimit).toBe(true);
    expect(diag.recommendedAction).toContain('rate limit');
  });

  it('diagnoses 500 server error properly', () => {
    const err = new Error('Cloud provider 500 Internal Server Error');
    const diag = ResilienceManager.diagnoseModelError(err);
    expect(diag.isServerError).toBe(true);
    expect(diag.recommendedAction).toContain('500');
  });

  it('executes exponential backoff retry for 429 rate limits', async () => {
    let callCount = 0;
    const flakyApi = async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('HTTP 429: Too Many Requests');
      }
      return 'success';
    };

    const result = await ResilienceManager.executeWithRetry(flakyApi, {
      maxRetries: 3,
      baseDelayMs: 10, // Short delay for unit test speed
    });

    expect(result).toBe('success');
    expect(callCount).toBe(3);
  });

  it('retries once on 500 server error and then succeeds or fails gracefully', async () => {
    let callCount = 0;
    const serverFlake = async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('HTTP 500: Server Error');
      }
      return 'recovered';
    };

    const result = await ResilienceManager.executeWithRetry(serverFlake, {
      maxRetries: 2,
      baseDelayMs: 10,
    });

    expect(result).toBe('recovered');
    expect(callCount).toBe(2);
  });

  it('aborts operation when 10s timeout is exceeded', async () => {
    const hangingOperation = () =>
      new Promise((resolve) => setTimeout(resolve, 500));

    await expect(
      ResilienceManager.withTimeout(hangingOperation, 50, 'CDP Navigation')
    ).rejects.toThrow('timed out after 50ms');
  });
});
