/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { PROVIDERS } from '../setup/types.js';
import { loadDamieConfig, saveDamieConfig } from '@damie-code/damie-code-core';
import type { ProviderConfig, ProvidersConfig } from '@damie-code/damie-code-core';

import type { ProviderInfo } from '../setup/types.js';

/**
 * List all providers and their status
 */
export function listProviders(): void {
  console.log('\n=== API Providers ===\n');
  
  const config = loadDamieConfig();
  
  PROVIDERS.forEach((provider: ProviderInfo, index: number) => {
    const providerKey = provider.authType.replace('USE_', '').toLowerCase();
    const providerConfig = config?.providers?.[providerKey as keyof typeof config.providers] as ProviderConfig | undefined;
    
    const status = providerConfig?.enabled === false ? '❌ Disabled' : '✅ Enabled';
    const hasKey = providerConfig?.apiKey || process.env[provider.envVar || ''] ? '✅' : '❌';
    
    console.log(`${index + 1}. ${provider.name}`);
    console.log(`   ${provider.description}`);
    console.log(`   Status: ${status}`);
    console.log(`   API Key: ${hasKey} ${provider.requiresApiKey ? `(Env: ${provider.envVar || 'N/A'})` : '(Not required)'}`);
    
    if (providerConfig) {
      if (providerConfig.model) console.log(`   Model: ${providerConfig.model}`);
      if (providerConfig.baseUrl) console.log(`   Base URL: ${providerConfig.baseUrl}`);
      if (providerConfig.timeout) console.log(`   Timeout: ${providerConfig.timeout}ms`);
    }
    
    console.log('');
  });
  
  console.log('Use "damie provider show <name>" for detailed configuration.');
  console.log('');
}

/**
 * Show detailed provider configuration
 */
export function show_provider(providerName: string): void {
  const config = loadDamieConfig();
  const providerKey = providerName.toLowerCase();
  
  const providerInfo = PROVIDERS.find((p: ProviderInfo) => 
    p.authType.replace('USE_', '').toLowerCase() === providerKey
  );
  
  if (!providerInfo) {
    console.error(`Error: Provider "${providerName}" not found.`);
    console.log('Available providers:', PROVIDERS.map((p: ProviderInfo) => p.name).join(', '));
    return;
  }
  
  const providerConfig = config?.providers?.[providerKey as keyof typeof config.providers] as ProviderConfig | undefined;
  
  console.log(`\n=== ${providerInfo.name} Configuration ===\n`);
  console.log(`Description: ${providerInfo.description}`);
  console.log(`Status: ${providerConfig?.enabled === false ? 'Disabled' : 'Enabled'}`);
  console.log(`API Key Required: ${providerInfo.requiresApiKey ? 'Yes' : 'No'}`);
  
  if (providerInfo.requiresApiKey) {
    const hasKey = !!(providerConfig?.apiKey || process.env[providerInfo.envVar || '']);
    console.log(`API Key Configured: ${hasKey ? 'Yes' : 'No'}`);
    if (providerInfo.envVar) {
      console.log(`Environment Variable: ${providerInfo.envVar}`);
    }
  }
  
  if (providerConfig) {
    if (providerConfig.model) console.log(`Model: ${providerConfig.model}`);
    if (providerConfig.baseUrl) console.log(`Base URL: ${providerConfig.baseUrl}`);
    if (providerConfig.timeout) console.log(`Timeout: ${providerConfig.timeout}ms`);
    if (providerConfig.maxRetries) console.log(`Max Retries: ${providerConfig.maxRetries}`);
  }
  
  console.log('');
}

/**
 * Set provider configuration
 */
export function set_provider_config(providerName: string, key: string, value: string): void {
  const config = loadDamieConfig();
  const providerKey = providerName.toLowerCase() as keyof ProvidersConfig;
  
  const providerInfo = PROVIDERS.find((p: ProviderInfo) => 
    p.authType.replace('USE_', '').toLowerCase() === providerName.toLowerCase()
  );
  
  if (!providerInfo) {
    console.error(`Error: Provider "${providerName}" not found.`);
    return;
  }
  
  if (!config) {
    console.error('Error: No configuration found. Run setup first.');
    return;
  }
  
  if (!config.providers) {
    config.providers = {};
  }
  
  const currentConfig = config.providers[providerKey] as ProviderConfig | undefined || {};
  
  const validKeys = ['apiKey', 'baseUrl', 'model', 'timeout', 'maxRetries'];
  if (!validKeys.includes(key)) {
    console.error(`Error: Invalid configuration key "${key}".`);
    console.log(`Valid keys: ${validKeys.join(', ')}`);
    return;
  }
  
  // Type conversion
  let typedValue: string | number = value;
  if (key === 'timeout' || key === 'maxRetries') {
    typedValue = parseInt(value, 10);
    if (isNaN(typedValue as number)) {
      console.error(`Error: ${key} must be a number.`);
      return;
    }
  }
  
  (currentConfig as any)[key] = typedValue;
  config.providers[providerKey] = currentConfig;
  
  saveDamieConfig(config);
  
  console.log(`\n✅ Updated ${providerInfo.name} configuration:`);
  console.log(`   ${key} = ${value}`);
  console.log('');
}

/**
 * Enable or disable provider
 */
export function set_provider_enabled(providerName: string, enabled: boolean): void {
  const config = loadDamieConfig();
  const providerKey = providerName.toLowerCase() as keyof ProvidersConfig;
  
  const providerInfo = PROVIDERS.find((p: ProviderInfo) => 
    p.authType.replace('USE_', '').toLowerCase() === providerName.toLowerCase()
  );
  
  if (!providerInfo) {
    console.error(`Error: Provider "${providerName}" not found.`);
    return;
  }
  
  if (!config) {
    console.error('Error: No configuration found.');
    return;
  }
  
  if (!config.providers) {
    config.providers = {};
  }
  
  const currentConfig = config.providers[providerKey] as ProviderConfig | undefined || {};
  currentConfig.enabled = enabled;
  config.providers[providerKey] = currentConfig;
  
  saveDamieConfig(config);
  
  console.log(`\n✅ ${providerInfo.name} ${enabled ? 'enabled' : 'disabled'}.`);
  console.log('');
}

/**
 * Handle provider subcommand
 */
export function handleProviderCommand(args: string[]): void {
  if (args.length === 0) {
    console.log('Usage: damie provider <subcommand> [options]');
    console.log('');
    console.log('Subcommands:');
    console.log('  list                      List all providers');
    console.log('  show <provider>           Show provider configuration');
    console.log('  set <provider> <key> <value>  Set provider configuration');
    console.log('  enable <provider>         Enable provider');
    console.log('  disable <provider>        Disable provider');
    console.log('');
    console.log('Examples:');
    console.log('  damie provider list');
    console.log('  damie provider show deepseek');
    console.log('  damie provider set deepseek model deepseek-coder');
    console.log('  damie provider set anthropic timeout 60000');
    console.log('  damie provider enable openrouter');
    console.log('  damie provider disable ollama');
    console.log('');
    return;
  }
  
  const subcommand = args[0].toLowerCase();
  
  switch (subcommand) {
    case 'list':
      listProviders();
      break;
      
    case 'show':
      if (!args[1]) {
        console.error('Error: Provider name required.');
        console.log('Usage: damie provider show <provider>');
        return;
      }
      show_provider(args[1]);
      break;
      
    case 'set':
      if (args.length < 4) {
        console.error('Error: Usage: damie provider set <provider> <key> <value>');
        return;
      }
      set_provider_config(args[1], args[2], args[3]);
      break;
      
    case 'enable':
      if (!args[1]) {
        console.error('Error: Provider name required.');
        console.log('Usage: damie provider enable <provider>');
        return;
      }
      set_provider_enabled(args[1], true);
      break;
      
    case 'disable':
      if (!args[1]) {
        console.error('Error: Provider name required.');
        console.log('Usage: damie provider disable <provider>');
        return;
      }
      set_provider_enabled(args[1], false);
      break;
      
    default:
      console.error(`Error: Unknown subcommand "${subcommand}".`);
      console.log('Run "damie provider" for usage.');
  }
}
