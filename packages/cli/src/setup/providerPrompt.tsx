/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { AuthType } from '@damie-code/damie-code-core';
import { PROVIDERS, type ProviderInfo } from './types.js';

interface ProviderPromptProps {
  onSelect: (provider: AuthType) => void;
}

/**
 * Provider selection component for the setup wizard
 */
export function ProviderPrompt({ onSelect }: ProviderPromptProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : PROVIDERS.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < PROVIDERS.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSelect(PROVIDERS[selectedIndex].authType);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Welcome to Damie Code!
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text>Select your API provider:</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>(Use arrow keys to navigate, Enter to select)</Text>
      </Box>
      <Box flexDirection="column">
        {PROVIDERS.map((provider, index) => (
          <ProviderOption
            key={provider.authType}
            provider={provider}
            isSelected={index === selectedIndex}
          />
        ))}
      </Box>
    </Box>
  );
}

interface ProviderOptionProps {
  provider: ProviderInfo;
  isSelected: boolean;
}

function ProviderOption({ provider, isSelected }: ProviderOptionProps) {
  return (
    <Box>
      <Text color={isSelected ? 'green' : undefined}>
        {isSelected ? '> ' : '  '}
        <Text bold={isSelected}>{provider.name}</Text>
        <Text dimColor> - {provider.description}</Text>
      </Text>
    </Box>
  );
}

/**
 * Run the provider selection as a standalone prompt
 * This is a simpler version for non-Ink contexts
 */
export async function selectProviderInteractive(): Promise<AuthType> {
  return new Promise((resolve) => {
    // For simple CLI contexts, default to first provider
    // The full Ink version will be used in the main app
    console.log('\nAvailable providers:');
    PROVIDERS.forEach((provider, index) => {
      console.log(`  ${index + 1}. ${provider.name} - ${provider.description}`);
    });
    console.log('\nDefaulting to Qwen OAuth for interactive setup.\n');
    resolve(AuthType.QWEN_OAUTH);
  });
}
