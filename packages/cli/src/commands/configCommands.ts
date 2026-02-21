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
import type { ProviderConfig } from '../../../core/src/config/damieConfig.js';

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
