/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RetryConfig } from './types.js';
import { DEFAULT_RETRY_CONFIG } from './types.js';
import { isRetryableError, RateLimitError } from './errors.js';

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig,
  retryAfter?: number,
): number {
  // If server specified retry-after, use that
  if (retryAfter !== undefined && retryAfter > 0) {
    return retryAfter * 1000;
  }

  // Calculate exponential backoff
  let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at max delay
  delay = Math.min(delay, config.maxDelayMs);

  // Add jitter if enabled (±25%)
  if (config.jitter) {
    const jitterRange = delay * 0.25;
    delay = delay + (Math.random() * jitterRange * 2 - jitterRange);
  }

  return Math.floor(delay);
}

/**
 * Retry context passed to callbacks
 */
export interface RetryContext {
  /** Current attempt number (0-indexed) */
  attempt: number;
  /** Total attempts that will be made */
  maxAttempts: number;
  /** Error from the last attempt */
  lastError?: Error;
  /** Delay before the next retry (ms) */
  delayMs?: number;
}

/**
 * Options for retry operation
 */
export interface RetryOptions {
  /** Retry configuration */
  config?: Partial<RetryConfig>;
  /** Called before each retry attempt */
  onRetry?: (context: RetryContext) => void;
  /** Called when all retries are exhausted */
  onExhausted?: (context: RetryContext) => void;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Execute a function with retry logic
 *
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Result from the function
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...options.config,
  };

  const maxAttempts = config.maxRetries + 1;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check for abort signal
    if (options.signal?.aborted) {
      throw new Error('Operation aborted');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry =
        attempt < maxAttempts - 1 &&
        (options.isRetryable?.(lastError) ?? isRetryableError(lastError));

      if (!shouldRetry) {
        throw lastError;
      }

      // Calculate delay
      const retryAfter =
        lastError instanceof RateLimitError ? lastError.retryAfter : undefined;
      const delayMs = calculateDelay(attempt, config, retryAfter);

      // Call onRetry callback
      if (options.onRetry) {
        options.onRetry({
          attempt,
          maxAttempts,
          lastError,
          delayMs,
        });
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // All retries exhausted
  if (options.onExhausted) {
    options.onExhausted({
      attempt: maxAttempts - 1,
      maxAttempts,
      lastError,
    });
  }

  throw lastError;
}

/**
 * Create a retryable version of an async function
 */
export function createRetryableFunction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {},
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Retry decorator for class methods
 *
 * Usage:
 * ```typescript
 * class MyAdapter {
 *   @retry({ maxRetries: 3 })
 *   async generateContent(request: AdapterRequest): Promise<AdapterResponse> {
 *     // ...
 *   }
 * }
 * ```
 */
export function retry(options: RetryOptions = {}) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return descriptor;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    } as T;

    return descriptor;
  };
}

/**
 * Execute multiple operations with retry, failing fast if any fails
 */
export async function withRetryAll<T>(
  fns: Array<() => Promise<T>>,
  options: RetryOptions = {},
): Promise<T[]> {
  return Promise.all(fns.map((fn) => withRetry(fn, options)));
}

/**
 * Execute multiple operations with retry, settling all
 */
export async function withRetryAllSettled<T>(
  fns: Array<() => Promise<T>>,
  options: RetryOptions = {},
): Promise<Array<PromiseSettledResult<T>>> {
  return Promise.allSettled(fns.map((fn) => withRetry(fn, options)));
}
