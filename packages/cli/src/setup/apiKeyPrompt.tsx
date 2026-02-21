/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { AuthType } from '@damie-code/damie-code-core';
import { getProviderInfo } from './types.js';

interface ApiKeyPromptProps {
  provider: AuthType;
  onSubmit: (apiKey: string) => void;
  onCancel: () => void;
}

/**
 * Masked API key input component
 */
export function ApiKeyPrompt({ provider, onSubmit, onCancel }: ApiKeyPromptProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const providerInfo = getProviderInfo(provider);
  const hint = providerInfo?.apiKeyHint || 'Enter your API key';
  const envVar = providerInfo?.envVar || 'API_KEY';

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    } else if (key.return) {
      if (apiKey.trim()) {
        onSubmit(apiKey.trim());
      }
    } else if (key.backspace || key.delete) {
      setApiKey((prev) => prev.slice(0, -1));
    } else if (key.ctrl && input === 'v') {
      // Ctrl+V to toggle visibility
      setShowKey((prev) => !prev);
    } else if (input && !key.ctrl && !key.meta) {
      setApiKey((prev) => prev + input);
    }
  });

  const maskedKey = showKey ? apiKey : '*'.repeat(apiKey.length);
  const displayKey = apiKey.length > 0 ? maskedKey : hint;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Enter your {providerInfo?.name || 'API'} key
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          You can also set this via the {envVar} environment variable.
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          (Press Ctrl+V to toggle visibility, Escape to cancel)
        </Text>
      </Box>
      <Box>
        <Text>
          API Key: <Text color={apiKey.length > 0 ? 'green' : 'gray'}>{displayKey}</Text>
        </Text>
      </Box>
      {providerInfo?.docsUrl && (
        <Box marginTop={1}>
          <Text dimColor>
            Get your API key at: {providerInfo.docsUrl}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Simple readline-based API key input for non-Ink contexts
 */
export async function getApiKeyInteractive(provider: AuthType): Promise<string> {
  const providerInfo = getProviderInfo(provider);
  const readline = await import('node:readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const prompt = `Enter your ${providerInfo?.name || 'API'} key: `;

    // Hide input for security
    process.stdout.write(prompt);

    let apiKey = '';
    process.stdin.setRawMode?.(true);
    process.stdin.resume();

    const onData = (char: Buffer) => {
      const c = char.toString();

      if (c === '\r' || c === '\n') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(apiKey);
      } else if (c === '\u0003') {
        // Ctrl+C
        process.exit(0);
      } else if (c === '\u007F' || c === '\b') {
        // Backspace
        if (apiKey.length > 0) {
          apiKey = apiKey.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (c.charCodeAt(0) >= 32) {
        apiKey += c;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', onData);
  });
}
