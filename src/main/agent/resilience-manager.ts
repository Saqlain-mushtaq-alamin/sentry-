/**
 * ResilienceManager — Task 14.7
 *
 * Implements fault tolerance, retry policies, and error recovery strategies across
 * model adapters, CDP communication, network timeouts, and storage failures.
 */

export interface ErrorRecoveryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  recoveredBy?: 'retry' | 'backoff' | 'fallback_local' | 'fallback_cloud' | 'memory_mode';
  actionableMessage?: string;
}

export class ResilienceManager {
  /**
   * Execute an async function with a timeout (default 10s for responsive CDP/DOM operations)
   */
  public static async withTimeout<T>(
    promiseFn: () => Promise<T>,
    timeoutMs: number = 10_000,
    operationName = 'Operation'
  ): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms (unresponsive page/service)`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promiseFn(), timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  /**
   * Exponential backoff retry for HTTP operations (handles 429 rate limits and 500 server errors)
   */
  public static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelayMs?: number;
      isRetryable?: (err: unknown) => boolean;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 1000;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err: unknown) {
        lastError = err;
        const msg = String(err).toLowerCase();

        // Check if retryable
        const isRateLimit = msg.includes('429') || msg.includes('rate limit');
        const isServerError = msg.includes('500') || msg.includes('502') || msg.includes('503');
        const customRetry = options.isRetryable ? options.isRetryable(err) : false;

        const canRetry = (isRateLimit || (isServerError && attempt === 0) || customRetry) && attempt < maxRetries;
        if (!canRetry) {
          throw err;
        }

        const delay = isRateLimit ? baseDelayMs * Math.pow(2, attempt) : baseDelayMs;
        console.warn(`[ResilienceManager] Retryable error encountered (attempt ${attempt + 1}/${maxRetries}), waiting ${delay}ms:`, err);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError;
  }

  /**
   * Diagnose model error and determine recommended recovery strategy
   */
  public static diagnoseModelError(error: unknown): {
    isOllamaCrash: boolean;
    isRateLimit: boolean;
    isServerError: boolean;
    isOffline: boolean;
    recommendedAction: string;
  } {
    const errStr = (error instanceof Error ? error.message : String(error)).toLowerCase();

    const isOllamaCrash =
      errStr.includes('econnrefused') ||
      errStr.includes('11434') ||
      (errStr.includes('fetch failed') && !navigator?.onLine) ||
      errStr.includes('ollama error');

    const isRateLimit = errStr.includes('429') || errStr.includes('rate limit');
    const isServerError = errStr.includes('500') || errStr.includes('502') || errStr.includes('503');
    const isOffline = errStr.includes('enotfound') || errStr.includes('network') || errStr.includes('offline');

    let recommendedAction = 'Please check your connection and try again.';
    if (isOllamaCrash) {
      recommendedAction = 'Local Ollama service disconnected. You can retry with a cloud model or start Ollama.';
    } else if (isRateLimit) {
      recommendedAction = 'Cloud API rate limit reached. Waiting with exponential backoff; please try again shortly.';
    } else if (isServerError) {
      recommendedAction = 'Cloud API server returned 500 error. Retried once; if persisting, try switching models.';
    } else if (isOffline) {
      recommendedAction = 'No internet connection detected. Switch to local model in Settings > Models.';
    }

    return {
      isOllamaCrash,
      isRateLimit,
      isServerError,
      isOffline,
      recommendedAction,
    };
  }
}
