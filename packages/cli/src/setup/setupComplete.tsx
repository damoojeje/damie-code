/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import type { AuthType } from '@damie-code/damie-code-core';
import { getProviderInfo } from './types.js';

interface SetupCompleteProps {
  configPath: string;
  provider: AuthType;
  model?: string;
}

/**
 * Success message component shown after setup completes
 */
export function SetupComplete({ configPath, provider, model }: SetupCompleteProps) {
  const providerInfo = getProviderInfo(provider);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          Setup complete!
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          Configuration saved to: <Text color="cyan">{configPath}</Text>
        </Text>
        <Text>
          Provider: <Text color="cyan">{providerInfo?.name || provider}</Text>
        </Text>
        {model && (
          <Text>
            Default model: <Text color="cyan">{model}</Text>
          </Text>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Next steps:</Text>
        <Text>  1. Run <Text color="yellow">damie</Text> to start Damie Code</Text>
        <Text>  2. Type your question or request</Text>
        <Text>  3. Use <Text color="yellow">/help</Text> for available commands</Text>
      </Box>

      {providerInfo?.envVar && (
        <Box marginTop={1}>
          <Text dimColor>
            Tip: You can also set {providerInfo.envVar} in your shell profile
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Show setup complete message in console (non-Ink version)
 */
export function showSetupCompleteConsole(
  configPath: string,
  provider: AuthType,
  model?: string,
): void {
  const providerInfo = getProviderInfo(provider);

  console.log('\n' + '='.repeat(50));
  console.log('  Setup complete!');
  console.log('='.repeat(50));
  console.log(`\n  Configuration saved to: ${configPath}`);
  console.log(`  Provider: ${providerInfo?.name || provider}`);
  if (model) {
    console.log(`  Default model: ${model}`);
  }
  console.log('\n  Next steps:');
  console.log('    1. Run "damie" to start Damie Code');
  console.log('    2. Type your question or request');
  console.log('    3. Use "/help" for available commands');

  if (providerInfo?.envVar) {
    console.log(`\n  Tip: You can also set ${providerInfo.envVar} in your shell profile`);
  }

  console.log('\n');
}
