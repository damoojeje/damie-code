/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as readline from 'node:readline';
import { ProviderManager, type ProviderInfo } from '../../../core/src/providers/providerManager.js';
import type { ProviderName } from '../../../core/src/config/damieConfig.js';
import { PROVIDER_DEFAULT_MODELS } from '../../../core/src/config/damieConfig.js';

/**
 * Create a readline interface for interactive input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt for user input
 */
async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Format provider status for display
 */
function formatProviderStatus(provider: ProviderInfo): string {
  const parts: string[] = [];

  // Status indicator
  if (provider.isDefault) {
    parts.push('[DEFAULT]');
  }
  if (provider.configured) {
    parts.push(provider.enabled ? '[ENABLED]' : '[DISABLED]');
  } else {
    parts.push('[NOT CONFIGURED]');
  }

  // API key status
  if (provider.configured) {
    parts.push(provider.hasApiKey ? '(key set)' : '(no key)');
  }

  // Priority
  if (provider.configured && provider.priority !== Infinity) {
    parts.push(`priority: ${provider.priority}`);
  }

  // Model
  if (provider.model) {
    parts.push(`model: ${provider.model}`);
  }

  return parts.join(' ');
}

/**
 * List all providers with their status
 */
export function listProviders(): void {
  const manager = new ProviderManager();
  const providers = manager.getConfiguredProviders();

  console.log('\n=== Damie Code Providers ===\n');

  if (providers.length === 0) {
    console.log('No configuration found.');
    console.log('Run "damie" to start the setup wizard.\n');
    return;
  }

  // Group providers
  const configured = providers.filter((p: ProviderInfo) => p.configured);
  const available = providers.filter((p: ProviderInfo) => !p.configured);

  if (configured.length > 0) {
    console.log('Configured Providers:');
    for (const provider of configured) {
      console.log(`  ${provider.displayName}`);
      console.log(`    ${formatProviderStatus(provider)}`);
    }
    console.log('');
  }

  if (available.length > 0) {
    console.log('Available Providers (not configured):');
    for (const provider of available) {
      console.log(`  ${provider.displayName}`);
    }
    console.log('');
  }

  console.log('Commands:');
  console.log('  damie provider add <name>        Add a provider');
  console.log('  damie provider remove <name>     Remove a provider');
  console.log('  damie provider set-default <name> Set default provider');
  console.log('');
}

/**
 * Add a new provider interactively
 */
export async function addProvider(providerName?: string): Promise<boolean> {
  const manager = new ProviderManager();
  manager.loadConfig();

  // Get valid provider names
  const validNames = ProviderManager.getValidProviderNames();

  // Validate provider name
  if (providerName && !ProviderManager.isValidProvider(providerName)) {
    console.error(`Invalid provider name: ${providerName}`);
    console.error(`Valid providers: ${validNames.join(', ')}`);
    return false;
  }

  const rl = createReadlineInterface();

  try {
    // If no provider name, ask for it
    let selectedProvider: ProviderName;
    if (!providerName) {
      console.log('\nAvailable providers:');
      validNames.forEach((name: ProviderName, i: number) => {
        const display = ProviderManager.getDisplayName(name);
        const configured = manager.isProviderConfigured(name);
        console.log(`  ${i + 1}. ${display}${configured ? ' (already configured)' : ''}`);
      });

      const choice = await prompt(rl, '\nSelect provider (number or name): ');
      const choiceNum = parseInt(choice, 10);

      if (choiceNum >= 1 && choiceNum <= validNames.length) {
        selectedProvider = validNames[choiceNum - 1];
      } else if (ProviderManager.isValidProvider(choice)) {
        selectedProvider = choice;
      } else {
        console.error('Invalid selection');
        return false;
      }
    } else {
      selectedProvider = providerName as ProviderName;
    }

    // Check if already configured
    if (manager.isProviderConfigured(selectedProvider)) {
      const overwrite = await prompt(
        rl,
        `Provider '${selectedProvider}' is already configured. Overwrite? (y/N): `,
      );
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        return false;
      }
    }

    // Get API key (except for Ollama)
    let apiKey: string | undefined;
    if (selectedProvider !== 'ollama') {
      apiKey = await prompt(rl, `Enter API key for ${ProviderManager.getDisplayName(selectedProvider)}: `);
      if (!apiKey) {
        console.error('API key is required');
        return false;
      }
    }

    // Get optional model
    const defaultModel = PROVIDER_DEFAULT_MODELS[selectedProvider];
    const modelInput = await prompt(rl, `Model name (default: ${defaultModel}): `);
    const model = modelInput || defaultModel;

    // Get optional base URL
    let baseUrl: string | undefined;
    if (selectedProvider === 'ollama') {
      const urlInput = await prompt(rl, 'Ollama server URL (default: http://localhost:11434): ');
      baseUrl = urlInput || 'http://localhost:11434';
    } else {
      const urlInput = await prompt(rl, 'Base URL override (leave empty for default): ');
      baseUrl = urlInput || undefined;
    }

    // Get priority
    const priorityInput = await prompt(rl, 'Priority (lower = higher priority, default: 100): ');
    const priority = priorityInput ? parseInt(priorityInput, 10) : 100;

    // Add the provider
    await manager.addProvider(selectedProvider, {
      apiKey,
      model,
      baseUrl,
      priority,
      enabled: true,
    });

    console.log(`\nProvider '${ProviderManager.getDisplayName(selectedProvider)}' added successfully.`);

    // Ask if should be default
    const setDefault = await prompt(rl, 'Set as default provider? (y/N): ');
    if (setDefault.toLowerCase() === 'y') {
      await manager.setDefaultProvider(selectedProvider);
      console.log(`Set '${ProviderManager.getDisplayName(selectedProvider)}' as default.`);
    }

    return true;
  } finally {
    rl.close();
  }
}

/**
 * Remove a provider
 */
export async function removeProvider(providerName: string): Promise<boolean> {
  const manager = new ProviderManager();
  manager.loadConfig();

  if (!ProviderManager.isValidProvider(providerName)) {
    console.error(`Invalid provider name: ${providerName}`);
    console.error(`Valid providers: ${ProviderManager.getValidProviderNames().join(', ')}`);
    return false;
  }

  if (!manager.isProviderConfigured(providerName)) {
    console.error(`Provider '${providerName}' is not configured.`);
    return false;
  }

  // Check if it's the default
  const providers = manager.getActiveProviders();
  const providerInfo = providers.find((p: ProviderInfo) => p.name === providerName);

  if (providerInfo?.isDefault) {
    console.log(`Warning: '${providerName}' is currently the default provider.`);
  }

  const rl = createReadlineInterface();
  try {
    const confirm = await prompt(rl, `Remove provider '${providerName}'? (y/N): `);
    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      return false;
    }

    await manager.removeProvider(providerName);
    console.log(`Provider '${providerName}' removed.`);
    return true;
  } catch (error) {
    console.error(`Failed to remove provider: ${error instanceof Error ? error.message : error}`);
    return false;
  } finally {
    rl.close();
  }
}

/**
 * Set the default provider
 */
export async function setDefaultProvider(providerName: string): Promise<boolean> {
  const manager = new ProviderManager();
  manager.loadConfig();

  if (!ProviderManager.isValidProvider(providerName)) {
    console.error(`Invalid provider name: ${providerName}`);
    console.error(`Valid providers: ${ProviderManager.getValidProviderNames().join(', ')}`);
    return false;
  }

  if (!manager.isProviderConfigured(providerName)) {
    console.error(`Provider '${providerName}' is not configured.`);
    console.error(`Add it first with: damie provider add ${providerName}`);
    return false;
  }

  try {
    await manager.setDefaultProvider(providerName);
    console.log(`Default provider set to '${ProviderManager.getDisplayName(providerName)}'.`);
    return true;
  } catch (error) {
    console.error(`Failed to set default: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Enable a provider
 */
export async function enableProvider(providerName: string): Promise<boolean> {
  const manager = new ProviderManager();
  manager.loadConfig();

  if (!ProviderManager.isValidProvider(providerName)) {
    console.error(`Invalid provider name: ${providerName}`);
    return false;
  }

  if (!manager.isProviderConfigured(providerName)) {
    console.error(`Provider '${providerName}' is not configured.`);
    return false;
  }

  try {
    await manager.enableProvider(providerName);
    console.log(`Provider '${providerName}' enabled.`);
    return true;
  } catch (error) {
    console.error(`Failed to enable provider: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Disable a provider
 */
export async function disableProvider(providerName: string): Promise<boolean> {
  const manager = new ProviderManager();
  manager.loadConfig();

  if (!ProviderManager.isValidProvider(providerName)) {
    console.error(`Invalid provider name: ${providerName}`);
    return false;
  }

  if (!manager.isProviderConfigured(providerName)) {
    console.error(`Provider '${providerName}' is not configured.`);
    return false;
  }

  try {
    await manager.disableProvider(providerName);
    console.log(`Provider '${providerName}' disabled.`);
    return true;
  } catch (error) {
    console.error(`Failed to disable provider: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Handle provider subcommand
 */
export async function handleProviderCommand(args: string[]): Promise<boolean> {
  if (args.length === 0) {
    listProviders();
    return true;
  }

  const subcommand = args[0];
  const providerName = args[1];

  switch (subcommand) {
    case 'list':
      listProviders();
      return true;

    case 'add':
      return await addProvider(providerName);

    case 'remove':
      if (!providerName) {
        console.error('Usage: damie provider remove <name>');
        return false;
      }
      return await removeProvider(providerName);

    case 'set-default':
      if (!providerName) {
        console.error('Usage: damie provider set-default <name>');
        return false;
      }
      return await setDefaultProvider(providerName);

    case 'enable':
      if (!providerName) {
        console.error('Usage: damie provider enable <name>');
        return false;
      }
      return await enableProvider(providerName);

    case 'disable':
      if (!providerName) {
        console.error('Usage: damie provider disable <name>');
        return false;
      }
      return await disableProvider(providerName);

    default:
      console.error(`Unknown provider subcommand: ${subcommand}`);
      console.error('Available: list, add, remove, set-default, enable, disable');
      return false;
  }
}
