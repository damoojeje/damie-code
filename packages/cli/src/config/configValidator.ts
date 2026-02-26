/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as readline from 'node:readline';
import { AuthType } from '@damie-code/damie-code-core';
import {
  getDamieConfigPath,
  loadDamieConfig,
} from '../../../core/src/config/damieConfigLoader.js';
import { runSetupWizard } from '../setup/setupWizard.js';

/**
 * Pre-launch configuration validator
 * Checks if the configured provider and model are valid before launching
 */
export async function validateConfigBeforeLaunch(): Promise<{
  valid: boolean;
  error?: string;
}> {
  const config = loadDamieConfig();

  if (!config) {
    // No config, will trigger setup wizard
    return { valid: false, error: 'No configuration found' };
  }

  const authType = config.security.auth.selectedType;

  // For OAuth and Ollama, no validation needed
  if (authType === AuthType.QWEN_OAUTH || authType === AuthType.USE_OLLAMA) {
    return { valid: true };
  }

  // Check if API key is set
  const providerConfig =
    config.providers?.[authType.toLowerCase() as keyof typeof config.providers];
  const hasApiKey = !!(
    providerConfig?.apiKey || process.env[getEnvVarForAuthType(authType)]
  );

  if (!hasApiKey) {
    return {
      valid: false,
      error: `API key not configured for ${authType}. Please run setup or configure manually.`,
    };
  }

  // For Damie Code providers, validate model exists
  if (isDamieCodeProvider(authType)) {
    const model = providerConfig?.model || getDefaultModelForAuthType(authType);
    // We can't validate model existence without making an API call
    // But we can check if it's a reasonable model name
    if (!model || model.trim() === '') {
      return {
        valid: false,
        error: `Invalid model configured for ${authType}: "${model}". Please check your config.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get environment variable name for auth type
 */
function getEnvVarForAuthType(authType: AuthType): string {
  switch (authType) {
    case AuthType.USE_DEEPSEEK:
      return 'DEEPSEEK_API_KEY';
    case AuthType.USE_ANTHROPIC:
      return 'ANTHROPIC_API_KEY';
    case AuthType.USE_OPENROUTER:
      return 'OPENROUTER_API_KEY';
    case AuthType.USE_OPENAI:
      return 'OPENAI_API_KEY';
    default:
      return '';
  }
}

/**
 * Check if auth type is a Damie Code provider
 */
function isDamieCodeProvider(authType: AuthType): boolean {
  return [
    AuthType.USE_DEEPSEEK,
    AuthType.USE_ANTHROPIC,
    AuthType.USE_OPENROUTER,
    AuthType.USE_OPENAI,
  ].includes(authType);
}

/**
 * Get default model for auth type
 */
function getDefaultModelForAuthType(authType: AuthType): string {
  switch (authType) {
    case AuthType.USE_DEEPSEEK:
      return 'deepseek-chat';
    case AuthType.USE_ANTHROPIC:
      return 'claude-3-5-sonnet-20241022';
    case AuthType.USE_OPENROUTER:
      return 'anthropic/claude-3-5-sonnet';
    case AuthType.USE_OPENAI:
      return 'gpt-4o';
    default:
      return '';
  }
}

/**
 * Interactive configuration fixer
 * Prompts user to either re-run setup or manually fix config
 */
export async function offerConfigFix(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const config = loadDamieConfig();
  const authType = config?.security.auth.selectedType || 'unknown';

  console.log('\n' + '='.repeat(60));
  console.log('  ⚠️  Configuration Issue Detected');
  console.log('='.repeat(60));
  console.log(`\nCurrent provider: ${authType}`);
  console.log(`Config file: ${getDamieConfigPath()}\n`);
  console.log('The API key or model configuration appears to be invalid.\n');
  console.log('How would you like to fix this?\n');
  console.log('  1. Re-run setup wizard (recommended)');
  console.log('  2. Manually edit config file');
  console.log('  3. Switch to Qwen OAuth (free, no API key needed)');
  console.log('  4. Exit\n');

  return new Promise((resolve) => {
    rl.question('Enter your choice (1-4): ', async (answer) => {
      try {
        switch (answer.trim()) {
          case '1': {
            // Re-run setup wizard
            console.log('\n🔧 Starting setup wizard...\n');
            const result = await runSetupWizard();
            rl.close();
            resolve(result.success);
            break;
          }

          case '2': {
            // Manual edit
            console.log(
              `\n📝 Please edit your config file:\n   ${getDamieConfigPath()}\n`,
            );
            console.log('Example configuration:');
            console.log('```yaml');
            console.log('security:');
            console.log('  auth:');
            console.log('    selectedType: "deepseek"');
            console.log('providers:');
            console.log('  deepseek:');
            console.log('    apiKey: "sk-your-api-key-here"');
            console.log('    model: "deepseek-chat"');
            console.log('```\n');
            console.log('After editing, run `damie` again.\n');
            rl.close();
            resolve(false);
            break;
          }

          case '3': {
            // Switch to Qwen OAuth
            console.log('\n🔄 Switching to Qwen OAuth...\n');
            await switchToQwenOAuth();
            console.log('✅ Switched to Qwen OAuth successfully!\n');
            console.log('Starting Damie Code...\n');
            rl.close();
            resolve(true);
            break;
          }

          default:
            console.log('\nExiting...\n');
            rl.close();
            resolve(false);
        }
      } catch (error) {
        console.error(
          'Error:',
          error instanceof Error ? error.message : String(error),
        );
        rl.close();
        resolve(false);
      }
    });
  });
}

/**
 * Switch config to Qwen OAuth
 */
async function switchToQwenOAuth(): Promise<void> {
  const fs = await import('node:fs');
  const configPath = getDamieConfigPath();

  const configLines = [
    '# Damie Code Configuration',
    '# Switched to Qwen OAuth',
    '',
    'security:',
    '  auth:',
    '    selectedType: "qwen-oauth"',
    '',
    '# Qwen OAuth - no API key needed!',
    '# Free tier: 2,000 requests/day',
    '',
    'model:',
    '  routing:',
    '    coding: "qwen"',
    '    reasoning: "qwen"',
    '    general: "qwen"',
    '',
  ];

  fs.writeFileSync(configPath, configLines.join('\n'));
}
