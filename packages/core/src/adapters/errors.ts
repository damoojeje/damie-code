/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Base error for all adapter errors
 */
export class AdapterError extends Error {
  /** Error code for programmatic handling */
  readonly code: string;
  /** Provider that generated the error */
  readonly provider: string;
  /** Whether this error is retryable */
  readonly retryable: boolean;
  /** HTTP status code (if applicable) */
  readonly statusCode?: number;
  /** Original error (if wrapped) */
  override readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code: string;
      provider: string;
      retryable?: boolean;
      statusCode?: number;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'AdapterError';
    this.code = options.code;
    this.provider = options.provider;
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode;
    this.cause = options.cause;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      retryable: this.retryable,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Authentication failed (invalid API key, expired token, etc.)
 */
export class AuthenticationError extends AdapterError {
  constructor(provider: string, message = 'Authentication failed', cause?: Error) {
    super(message, {
      code: 'AUTHENTICATION_ERROR',
      provider,
      retryable: false,
      statusCode: 401,
      cause,
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends AdapterError {
  /** Time to wait before retrying (seconds) */
  readonly retryAfter?: number;

  constructor(
    provider: string,
    message = 'Rate limit exceeded',
    retryAfter?: number,
    cause?: Error,
  ) {
    super(message, {
      code: 'RATE_LIMIT_ERROR',
      provider,
      retryable: true,
      statusCode: 429,
      cause,
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Invalid request parameters
 */
export class InvalidRequestError extends AdapterError {
  /** Field that caused the error */
  readonly field?: string;

  constructor(
    provider: string,
    message = 'Invalid request',
    field?: string,
    cause?: Error,
  ) {
    super(message, {
      code: 'INVALID_REQUEST_ERROR',
      provider,
      retryable: false,
      statusCode: 400,
      cause,
    });
    this.name = 'InvalidRequestError';
    this.field = field;
  }
}

/**
 * Requested model not found or not available
 */
export class ModelNotFoundError extends AdapterError {
  /** The model that was requested */
  readonly model: string;

  constructor(provider: string, model: string, cause?: Error) {
    super(`Model '${model}' not found or not available`, {
      code: 'MODEL_NOT_FOUND_ERROR',
      provider,
      retryable: false,
      statusCode: 404,
      cause,
    });
    this.name = 'ModelNotFoundError';
    this.model = model;
  }
}

/**
 * Context length exceeded
 */
export class ContextLengthExceededError extends AdapterError {
  /** Maximum allowed tokens */
  readonly maxTokens?: number;
  /** Tokens in the request */
  readonly requestedTokens?: number;

  constructor(
    provider: string,
    message = 'Context length exceeded',
    maxTokens?: number,
    requestedTokens?: number,
    cause?: Error,
  ) {
    super(message, {
      code: 'CONTEXT_LENGTH_EXCEEDED_ERROR',
      provider,
      retryable: false,
      statusCode: 400,
      cause,
    });
    this.name = 'ContextLengthExceededError';
    this.maxTokens = maxTokens;
    this.requestedTokens = requestedTokens;
  }
}

/**
 * Request timed out
 */
export class TimeoutError extends AdapterError {
  /** Timeout duration in milliseconds */
  readonly timeoutMs: number;

  constructor(provider: string, timeoutMs: number, cause?: Error) {
    super(`Request timed out after ${timeoutMs}ms`, {
      code: 'TIMEOUT_ERROR',
      provider,
      retryable: true,
      statusCode: 408,
      cause,
    });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Network-level error (connection failed, DNS error, etc.)
 */
export class NetworkError extends AdapterError {
  constructor(provider: string, message = 'Network error', cause?: Error) {
    super(message, {
      code: 'NETWORK_ERROR',
      provider,
      retryable: true,
      cause,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Content was filtered by safety systems
 */
export class ContentFilterError extends AdapterError {
  /** Category of content that was filtered */
  readonly category?: string;

  constructor(
    provider: string,
    message = 'Content was filtered',
    category?: string,
    cause?: Error,
  ) {
    super(message, {
      code: 'CONTENT_FILTER_ERROR',
      provider,
      retryable: false,
      statusCode: 400,
      cause,
    });
    this.name = 'ContentFilterError';
    this.category = category;
  }
}

/**
 * Server error from the API provider
 */
export class ServerError extends AdapterError {
  constructor(
    provider: string,
    statusCode: number,
    message = 'Server error',
    cause?: Error,
  ) {
    super(message, {
      code: 'SERVER_ERROR',
      provider,
      retryable: statusCode >= 500,
      statusCode,
      cause,
    });
    this.name = 'ServerError';
  }
}

/**
 * Insufficient quota or credits
 */
export class QuotaExceededError extends AdapterError {
  constructor(provider: string, message = 'Quota exceeded', cause?: Error) {
    super(message, {
      code: 'QUOTA_EXCEEDED_ERROR',
      provider,
      retryable: false,
      statusCode: 402,
      cause,
    });
    this.name = 'QuotaExceededError';
  }
}

/**
 * Check if an error is an AdapterError
 */
export function isAdapterError(error: unknown): error is AdapterError {
  return error instanceof AdapterError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AdapterError) {
    return error.retryable;
  }
  // Network errors from fetch are generally retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  return false;
}

/**
 * Parse an HTTP error response into an appropriate AdapterError
 */
export function parseHttpError(
  provider: string,
  statusCode: number,
  body: unknown,
): AdapterError {
  const message =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)['error']?.toString() ||
        (body as Record<string, unknown>)['message']?.toString() ||
        'Unknown error'
      : String(body);

  switch (statusCode) {
    case 400:
      if (message.toLowerCase().includes('context') || message.toLowerCase().includes('token')) {
        return new ContextLengthExceededError(provider, message);
      }
      return new InvalidRequestError(provider, message);
    case 401:
      return new AuthenticationError(provider, message);
    case 402:
      return new QuotaExceededError(provider, message);
    case 404:
      return new ModelNotFoundError(provider, message);
    case 429:
      return new RateLimitError(provider, message);
    default:
      return new ServerError(provider, statusCode, message);
  }
}
