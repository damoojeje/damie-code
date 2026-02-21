/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StreamChunk, AdapterResponse, TokenUsage, FinishReason, AdapterToolCall } from './types.js';

/**
 * Server-Sent Events (SSE) message
 */
export interface SSEMessage {
  /** Event type (defaults to 'message') */
  event?: string;
  /** Message data */
  data: string;
  /** Optional message ID */
  id?: string;
  /** Retry interval in milliseconds */
  retry?: number;
}

/**
 * Parse a single SSE message from text
 */
export function parseSSEMessage(text: string): SSEMessage | null {
  const lines = text.split('\n');
  const message: SSEMessage = { data: '' };
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      message.event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    } else if (line.startsWith('id:')) {
      message.id = line.slice(3).trim();
    } else if (line.startsWith('retry:')) {
      const retry = parseInt(line.slice(6).trim(), 10);
      if (!isNaN(retry)) {
        message.retry = retry;
      }
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  message.data = dataLines.join('\n');
  return message;
}

/**
 * Parse SSE stream from a ReadableStream
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEMessage> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const message = parseSSEMessage(buffer);
          if (message) {
            yield message;
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Split on double newline (SSE message separator)
      const messages = buffer.split('\n\n');

      // Keep the last incomplete message in buffer
      buffer = messages.pop() || '';

      for (const messageText of messages) {
        if (messageText.trim()) {
          const message = parseSSEMessage(messageText);
          if (message) {
            yield message;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse JSON from SSE data field
 */
export function parseSSEData<T>(data: string): T | null {
  // Handle [DONE] signal
  if (data === '[DONE]') {
    return null;
  }

  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Create an async iterator from a ReadableStream
 */
export async function* streamToAsyncIterator<T>(
  stream: ReadableStream<T>,
): AsyncGenerator<T> {
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Aggregate stream chunks into a complete response
 */
export async function aggregateStreamChunks(
  chunks: AsyncIterable<StreamChunk>,
): Promise<AdapterResponse> {
  let content = '';
  let finishReason: FinishReason = 'stop';
  let usage: TokenUsage | undefined;
  const toolCalls: Map<number, AdapterToolCall> = new Map();

  for await (const chunk of chunks) {
    content += chunk.delta;

    if (chunk.finishReason) {
      finishReason = chunk.finishReason;
    }

    if (chunk.usage) {
      usage = chunk.usage;
    }

    // Aggregate tool calls
    if (chunk.toolCalls) {
      for (let i = 0; i < chunk.toolCalls.length; i++) {
        const partial = chunk.toolCalls[i];
        const existing = toolCalls.get(i) || { id: '', name: '', arguments: '' };

        if (partial.id) existing.id = partial.id;
        if (partial.name) existing.name = partial.name;
        if (partial.arguments) existing.arguments += partial.arguments;

        toolCalls.set(i, existing);
      }
    }
  }

  return {
    content,
    finishReason,
    usage,
    model: '',
    toolCalls:
      toolCalls.size > 0
        ? Array.from(toolCalls.values()).filter((tc) => tc.id && tc.name)
        : undefined,
  };
}

/**
 * Transform an async iterator with a mapping function
 */
export async function* mapAsyncIterator<T, U>(
  iterator: AsyncIterable<T>,
  fn: (value: T) => U | Promise<U>,
): AsyncGenerator<U> {
  for await (const value of iterator) {
    yield await fn(value);
  }
}

/**
 * Filter an async iterator
 */
export async function* filterAsyncIterator<T>(
  iterator: AsyncIterable<T>,
  predicate: (value: T) => boolean | Promise<boolean>,
): AsyncGenerator<T> {
  for await (const value of iterator) {
    if (await predicate(value)) {
      yield value;
    }
  }
}

/**
 * Take first N items from an async iterator
 */
export async function* takeAsyncIterator<T>(
  iterator: AsyncIterable<T>,
  count: number,
): AsyncGenerator<T> {
  let taken = 0;
  for await (const value of iterator) {
    if (taken >= count) break;
    yield value;
    taken++;
  }
}

/**
 * Collect all values from an async iterator into an array
 */
export async function collectAsyncIterator<T>(
  iterator: AsyncIterable<T>,
): Promise<T[]> {
  const results: T[] = [];
  for await (const value of iterator) {
    results.push(value);
  }
  return results;
}

/**
 * Create a tee (split) of an async iterator
 * Warning: Both iterators must be consumed at similar rates to avoid memory buildup
 */
export function teeAsyncIterator<T>(
  iterator: AsyncIterator<T>,
): [AsyncGenerator<T>, AsyncGenerator<T>] {
  const buffer1: T[] = [];
  const buffer2: T[] = [];
  let done = false;
  let currentPromise: Promise<IteratorResult<T>> | null = null;

  async function getNext(): Promise<IteratorResult<T>> {
    if (!currentPromise) {
      currentPromise = iterator.next();
    }
    const result = await currentPromise;
    currentPromise = null;
    return result;
  }

  async function* createIterator(myBuffer: T[], otherBuffer: T[]): AsyncGenerator<T> {
    while (true) {
      if (myBuffer.length > 0) {
        yield myBuffer.shift()!;
      } else if (done) {
        break;
      } else {
        const result = await getNext();
        if (result.done) {
          done = true;
          break;
        }
        otherBuffer.push(result.value);
        yield result.value;
      }
    }
  }

  return [createIterator(buffer1, buffer2), createIterator(buffer2, buffer1)];
}

/**
 * Create a readable stream from an async generator
 */
export function asyncGeneratorToStream<T>(
  generator: AsyncGenerator<T>,
): ReadableStream<T> {
  return new ReadableStream<T>({
    async pull(controller) {
      const { done, value } = await generator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    cancel() {
      generator.return(undefined);
    },
  });
}
