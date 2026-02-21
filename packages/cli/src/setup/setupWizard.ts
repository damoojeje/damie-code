/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@damie-code/damie-code-core';
import { PROVIDERS, getProviderInfo, type SetupResult } from './types.js';
import { validateApiKey, validateOllama } from './apiValidator.js';
import { writeConfig } from './configWriter.js';
import * as readline from 'node:readline';

/**
 * Run the setup wizard interactively
 * This is the main entry point for first-run setup
 */
export async function runSetupWizard(): Promise<SetupResult> {
  console.log('\n' + '='.repeat(50));
  console.log('  Welcome to Damie Code!');
  console.log('  AI-Powered CLI Coding Assistant');
  console.log('='.repeat(50) + '\n');

  try {
    // Step 1: Select providers (can select multiple)
    console.log('You can configure multiple providers for intelligent routing.\n');
    console.log('Recommended: Select at least 2 providers for automatic fallback.\n');
    
    const providers = await selectProviders();
    
    if (providers.length === 0) {
      console.error('\nError: You must select at least one provider.');
      return { success: false, error: 'No provider selected' };
    }

    // Step 2: Get API keys for selected providers
    const configs: Array<{ provider: AuthType; apiKey?: string; model?: string }> = [];
    
    for (const provider of providers) {
      const providerInfo = getProviderInfo(provider);
      let apiKey: string | undefined;
      let model: string | undefined;

      if (providerInfo?.requiresApiKey) {
        apiKey = await getApiKey(provider);

        // Validate API key
        console.log('\nValidating API key...');
        const validation = await validateApiKey(provider, apiKey);

        if (!validation.valid) {
          console.error(`\nValidation failed: ${validation.error}`);
          console.error('Please check your API key and try again.');
          return { success: false, error: validation.error };
        }

        console.log('API key validated successfully!');
        model = validation.model;
      } else if (provider === AuthType.USE_OLLAMA) {
        // Check if Ollama is running
        console.log('\nChecking Ollama...');
        const validation = await validateOllama();

        if (!validation.valid) {
          console.warn(`\nWarning: ${validation.error}`);
          console.log('You can still continue, but make sure to start Ollama before using Damie Code.');
        } else {
          console.log('Ollama is running!');
          model = validation.model;
        }
      }
      
      configs.push({ provider, apiKey, model });
    }

    // Step 3: Write config with all providers
    const configPath = await writeConfig(configs, providers[0]); // First provider is primary

    // Step 4: Show success message
    console.log('\n' + '='.repeat(50));
    console.log('  Setup Complete!');
    console.log('='.repeat(50));
    console.log(`\nConfig saved to: ${configPath}`);
    console.log(`\nConfigured providers (${configs.length}):`);
    configs.forEach(({ provider }, index) => {
      const info = getProviderInfo(provider);
      const marker = index === 0 ? ' (Primary)' : '';
      console.log(`  ✓ ${info?.name || provider}${marker}`);
    });
    console.log('\nIntelligent routing is now enabled:');
    console.log('  - Coding tasks → DeepSeek');
    console.log('  - Reasoning tasks → Anthropic');
    console.log('  - General tasks → DeepSeek');
    console.log('  - Vision tasks → OpenAI');
    console.log('\nYou can change providers anytime with /setup command');
    console.log('Or configure routing in ~/.damie/config.yaml\n');

    return { success: true, configPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nSetup failed: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Interactive provider selection (supports multiple)
 */
async function selectProviders(): Promise<AuthType[]> {
  console.log('Available providers:\n');

  PROVIDERS.forEach((provider, index) => {
    const keyReq = provider.requiresApiKey ? '(API key required)' : '(no API key needed)';
    console.log(`  ${index + 1}. ${provider.name} - ${provider.description}`);
    console.log(`     ${keyReq}`);
  });

  console.log('\nExample: Enter "1,2" to select Qwen OAuth and DeepSeek');
  console.log('         Enter "1" to select only Qwen OAuth\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const askForSelection = () => {
      rl.question('Enter provider numbers (comma-separated): ', (answer) => {
        const selections = answer.trim()
          .split(',')
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n) && n >= 1 && n <= PROVIDERS.length);

        if (selections.length === 0) {
          console.log('Invalid selection. Please enter at least one number between 1 and ' + PROVIDERS.length);
          askForSelection();
          return;
        }

        // Convert to unique AuthTypes
        const providers = Array.from(new Set(selections.map(n => PROVIDERS[n - 1].authType)));
        
        rl.close();
        resolve(providers);
      });
    };

    askForSelection();
  });
}

/**
 * Get API key with masked input
 */
async function getApiKey(provider: AuthType): Promise<string> {
  const providerInfo = getProviderInfo(provider);
  const hint = providerInfo?.apiKeyHint || 'your-api-key';

  console.log(`\nEnter your ${providerInfo?.name || 'API'} key:`);
  if (providerInfo?.docsUrl) {
    console.log(`  Get your key at: ${providerInfo.docsUrl}`);
  }
  console.log(`  Format: ${hint}`);

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Use raw mode for masked input
    const askForKey = () => {
      process.stdout.write('\nAPI Key: ');

      let apiKey = '';

      // Try to use raw mode for masking
      if (process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
        process.stdin.resume();

        const onData = (data: Buffer) => {
          const char = data.toString();

          if (char === '\r' || char === '\n') {
            process.stdin.setRawMode?.(false);
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            rl.close();

            if (apiKey.trim()) {
              resolve(apiKey.trim());
            } else {
              console.log('API key cannot be empty.');
              askForKey();
            }
          } else if (char === '\u0003') {
            // Ctrl+C
            process.exit(0);
          } else if (char === '\u007F' || char === '\b') {
            // Backspace
            if (apiKey.length > 0) {
              apiKey = apiKey.slice(0, -1);
              process.stdout.write('\b \b');
            }
          } else if (char.charCodeAt(0) >= 32) {
            apiKey += char;
            process.stdout.write('*');
          }
        };

        process.stdin.on('data', onData);
      } else {
        // Fallback to regular input (not masked)
        rl.question('', (answer) => {
          rl.close();
          if (answer.trim()) {
            resolve(answer.trim());
          } else {
            console.log('API key cannot be empty.');
            askForKey();
          }
        });
      }
    };

    askForKey();
  });
}

/**
 * Check if setup should be skipped (e.g., via environment variable)
 */
export function shouldSkipSetup(): boolean {
  return process.env['DAMIE_SKIP_SETUP'] === 'true' || process.env['CI'] === 'true';
}
