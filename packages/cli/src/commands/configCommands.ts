/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import {
  getDamieConfigPath,
  getDamieConfigDir,
  loadDamieConfig,
  DAMIE_CONFIG_ENV,
} from '../../../core/src/config/damieConfigLoader.js';
import type { ProviderConfig, ProviderName } from '../../../core/src/config/damieConfig.js';
import { PROVIDER_ENV_VARS } from '../../../core/src/config/damieConfig.js';

/**
 * Provider health check result
 */
interface HealthCheckResult {
  provider: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  latency?: number;
  suggestion?: string;
}

/**
 * Show current configuration
 */
export function showConfig(): void {
  const configPath = getDamieConfigPath();
  const config = loadDamieConfig();

  console.log('\n=== Damie Code Configuration ===\n');

  if (!config) {
    console.log('No configuration file found.');
    console.log(`Expected location: ${configPath}`);
    console.log('\nRun "damie" to start the setup wizard.');
    return;
  }

  console.log('Config file:', configPath);
  console.log('');

  // Display config as formatted output
  displayConfigSection('Security', {
    'Auth Type': config.security.auth.selectedType,
    'Use External': String(config.security.auth.useExternal ?? false),
  });

  if (config.providers) {
    const providers: Record<string, string> = {};
    for (const [name, providerValue] of Object.entries(config.providers)) {
      const provider = providerValue as ProviderConfig | undefined;
      if (provider) {
        const hasKey = provider.apiKey ? '(key set)' : '(no key)';
        const model = provider.model ? ` [${provider.model}]` : '';
        providers[name] = `${hasKey}${model}`;
      }
    }
    if (Object.keys(providers).length > 0) {
      displayConfigSection('Providers', providers);
    }
  }

  if (config.model) {
    displayConfigSection('Model', {
      'Default': config.model.default ?? '(not set)',
      'Chat Compression': String(config.model.chatCompression ?? true),
      'Max Tokens': String(config.model.maxTokens ?? 4096),
    });
  }

  if (config.ui) {
    displayConfigSection('UI', {
      'Theme': config.ui.theme ?? 'default',
      'Hide Tips': String(config.ui.hideTips ?? false),
      'Hide Banner': String(config.ui.hideBanner ?? false),
    });
  }

  // Show environment overrides
  const envOverrides: Record<string, string> = {};
  if (process.env['DEEPSEEK_API_KEY']) envOverrides['DEEPSEEK_API_KEY'] = '(set)';
  if (process.env['OPENAI_API_KEY']) envOverrides['OPENAI_API_KEY'] = '(set)';
  if (process.env['ANTHROPIC_API_KEY']) envOverrides['ANTHROPIC_API_KEY'] = '(set)';
  if (process.env['OPENROUTER_API_KEY']) envOverrides['OPENROUTER_API_KEY'] = '(set)';
  if (process.env[DAMIE_CONFIG_ENV]) envOverrides[DAMIE_CONFIG_ENV] = process.env[DAMIE_CONFIG_ENV]!;

  if (Object.keys(envOverrides).length > 0) {
    displayConfigSection('Environment Overrides', envOverrides);
  }

  console.log('');
}

/**
 * Display a config section
 */
function displayConfigSection(
  title: string,
  values: Record<string, string>,
): void {
  console.log(`[${title}]`);
  for (const [key, value] of Object.entries(values)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('');
}

/**
 * Set a configuration value
 */
export function setConfig(key: string, value: string): void {
  const configPath = getDamieConfigPath();
  const configDir = getDamieConfigDir();

  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Load existing config or create new
  let content = '';
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, 'utf8');
  }

  // Parse key path (e.g., "security.auth.selectedType")
  const keyPath = key.split('.');

  // Simple update: find and replace or append
  const updated = updateYamlValue(content, keyPath, value);

  fs.writeFileSync(configPath, updated, 'utf8');
  console.log(`Updated ${key} = ${value}`);
  console.log(`Config saved to: ${configPath}`);
}

/**
 * Update a YAML value (simple implementation)
 */
function updateYamlValue(
  content: string,
  keyPath: string[],
  value: string,
): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let found = false;
  let currentIndent = 0;
  let searchPath = [...keyPath];
  let matchedDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('#') || trimmed === '') {
      result.push(line);
      continue;
    }

    // Check indentation
    const indent = line.search(/\S/);
    const match = trimmed.match(/^([^:]+):\s*(.*)$/);

    if (match) {
      const [, lineKey] = match;
      const cleanKey = lineKey.trim();

      // Check if we're at the right depth
      if (indent <= currentIndent && matchedDepth > 0) {
        // We've moved out of the nested section
        if (matchedDepth === keyPath.length - 1 && searchPath.length === 1) {
          // Need to insert the value here
          const insertIndent = '  '.repeat(keyPath.length - 1);
          result.push(`${insertIndent}${searchPath[0]}: "${value}"`);
          found = true;
          searchPath = [];
        }
        matchedDepth = 0;
        searchPath = [...keyPath];
      }

      if (searchPath.length > 0 && cleanKey === searchPath[0]) {
        if (searchPath.length === 1) {
          // This is the key we want to update
          const newLine = `${line.substring(0, indent)}${cleanKey}: "${value}"`;
          result.push(newLine);
          found = true;
          searchPath = [];
          continue;
        } else {
          // Continue searching deeper
          searchPath.shift();
          matchedDepth++;
          currentIndent = indent;
        }
      }
    }

    result.push(line);
  }

  // If not found, append the key
  if (!found) {
    result.push('');
    let indent = '';

    for (let i = 0; i < keyPath.length - 1; i++) {
      result.push(`${indent}${keyPath[i]}:`);
      indent += '  ';
    }
    result.push(`${indent}${keyPath[keyPath.length - 1]}: "${value}"`);
  }

  return result.join('\n');
}

/**
 * Check health of a specific provider
 */
async function checkProviderHealth(provider: ProviderName): Promise<HealthCheckResult> {
  const config = loadDamieConfig();
  const providerConfig = config?.providers?.[provider];
  
  // Check if provider is configured
  if (!providerConfig && !process.env[PROVIDER_ENV_VARS[provider]]) {
    return {
      provider,
      status: 'error',
      message: 'Not configured',
      suggestion: `Add ${provider} to ~/.damie/config.yaml or set ${PROVIDER_ENV_VARS[provider]} environment variable`,
    };
  }
  
  // Check API key
  const hasApiKey = !!(providerConfig?.apiKey || process.env[PROVIDER_ENV_VARS[provider]]);
  if (!hasApiKey && provider !== 'ollama') {
    return {
      provider,
      status: 'error',
      message: 'API key missing',
      suggestion: `Set API key in config or ${PROVIDER_ENV_VARS[provider]} environment variable`,
    };
  }
  
  // Provider-specific checks
  switch (provider) {
    case 'ollama': {
      // Check if Ollama is running
      try {
        const baseUrl = providerConfig?.baseUrl || 'http://localhost:11434';
        const startTime = Date.now();
        const response = await fetch(`${baseUrl}/api/tags`);
        const latency = Date.now() - startTime;
        
        if (!response.ok) {
          return {
            provider,
            status: 'error',
            message: `Ollama not responding (${response.status})`,
            suggestion: 'Start Ollama with: ollama serve',
          };
        }
        
        const data = await response.json();
        const models = data.models || [];
        
        if (models.length === 0) {
          return {
            provider,
            status: 'warning',
            message: 'Ollama running but no models installed',
            latency,
            suggestion: 'Install a model: ollama pull codellama',
          };
        }
        
        return {
          provider,
          status: 'ok',
          message: `Connected (${models.length} models)`,
          latency,
        };
      } catch (error) {
        return {
          provider,
          status: 'error',
          message: 'Cannot connect to Ollama',
          suggestion: 'Start Ollama: ollama serve',
        };
      }
    }
    
    case 'deepseek':
    case 'anthropic':
    case 'openrouter': {
      // For API providers, just verify config is present
      // Actual connectivity check would require API call
      const baseUrl = providerConfig?.baseUrl || 'configured';
      return {
        provider,
        status: 'ok',
        message: `Configured (${baseUrl})`,
        suggestion: 'API connectivity verified on first request',
      };
    }
    
    default:
      return {
        provider,
        status: 'warning',
        message: 'Unknown provider',
      };
  }
}

/**
 * Run health checks on all configured providers
 */
export async function runDoctorCommand(): Promise<void> {
  console.log('=== Damie Code Diagnostic Tool ===\n');
  
  const config = loadDamieConfig();
  
  // Check config file
  if (!config) {
    console.log('✗ Config file not found');
    console.log('  Fix: Run "damie" to start setup wizard\n');
    return;
  }
  
  console.log('✓ Config file found');
  console.log(`  Location: ${getDamieConfigPath()}\n`);
  
  // Check each configured provider
  const providers: ProviderName[] = ['deepseek', 'openai', 'anthropic', 'openrouter', 'ollama', 'qwen'];
  
  console.log('Provider Health:\n');
  
  for (const provider of providers) {
    const providerConfig = config.providers?.[provider];
    const hasEnvVar = !!process.env[PROVIDER_ENV_VARS[provider]];
    
    // Skip providers that aren't configured
    if (!providerConfig && !hasEnvVar) {
      continue;
    }
    
    const result = await checkProviderHealth(provider);
    
    const icon = result.status === 'ok' ? '✓' : result.status === 'warning' ? '⚠' : '✗';
    console.log(`${icon} ${provider} - ${result.message}`);
    
    if (result.latency) {
      console.log(`  Latency: ${result.latency}ms`);
    }
    
    if (result.suggestion) {
      console.log(`  ${result.suggestion}`);
    }
    console.log('');
  }
  
  // Summary
  console.log('---');
  console.log('Run "damie" to start using Damie Code');
  console.log('Use "/setup" command to change providers\n');
}

/**
 * Show config file path
 */
export function showConfigPath(): void {
  const configPath = getDamieConfigPath();
  const exists = fs.existsSync(configPath);
  const envOverride = process.env[DAMIE_CONFIG_ENV];

  console.log('\n=== Damie Code Config Path ===\n');
  console.log('Config file:', configPath);
  console.log('Exists:', exists ? 'yes' : 'no');

  if (envOverride) {
    console.log(`Environment override (${DAMIE_CONFIG_ENV}):`, envOverride);
  }

  console.log('\nConfig directory:', getDamieConfigDir());
  console.log('');
}

/**
 * Handle config subcommand
 */
export function handleConfigCommand(args: string[]): boolean {
  if (args.length === 0) {
    showConfig();
    return true;
  }

  const subcommand = args[0];

  switch (subcommand) {
    case 'show':
      showConfig();
      return true;

    case 'path':
      showConfigPath();
      return true;

    case 'set':
      if (args.length < 3) {
        console.error('Usage: damie config set <key> <value>');
        console.error('Example: damie config set security.auth.selectedType deepseek');
        return false;
      }
      setConfig(args[1], args.slice(2).join(' '));
      return true;

    default:
      console.error(`Unknown config subcommand: ${subcommand}`);
      console.error('Available: show, set, path');
      return false;
  }
}
