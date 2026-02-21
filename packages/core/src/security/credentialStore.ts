/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDamieConfigDir } from '../config/damieConfigLoader.js';
import type { ProviderName } from '../config/damieConfig.js';
import { PROVIDER_ENV_VARS } from '../config/damieConfig.js';

/**
 * Credential storage for API keys
 *
 * For personal use, stores API keys in ~/.damie/.env file.
 * This is a simplified approach - for production use, consider:
 * - System keychain (keytar, secret-service)
 * - Encrypted file storage
 * - Environment variables only
 */

/**
 * .env file name
 */
const ENV_FILE = '.env';

/**
 * Get path to the credentials .env file
 */
export function getCredentialsPath(): string {
  return path.join(getDamieConfigDir(), ENV_FILE);
}

/**
 * Parse a .env file content into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=value format
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Remove quotes if present
      let cleanValue = value.trim();
      if (
        (cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
        (cleanValue.startsWith("'") && cleanValue.endsWith("'"))
      ) {
        cleanValue = cleanValue.slice(1, -1);
      }
      result[key.trim()] = cleanValue;
    }
  }

  return result;
}

/**
 * Convert key-value pairs to .env file content
 */
function toEnvFile(credentials: Record<string, string>): string {
  const lines: string[] = [
    '# Damie Code API Credentials',
    '# WARNING: This file contains sensitive API keys.',
    '# Do not commit this file to version control.',
    '',
  ];

  for (const [key, value] of Object.entries(credentials)) {
    // Quote values that contain spaces or special characters
    const needsQuotes = /[\s#=]/.test(value);
    const quotedValue = needsQuotes ? `"${value}"` : value;
    lines.push(`${key}=${quotedValue}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Load all stored credentials
 */
export function loadCredentials(): Record<string, string> {
  const envPath = getCredentialsPath();

  if (!fs.existsSync(envPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    return parseEnvFile(content);
  } catch {
    return {};
  }
}

/**
 * Save all credentials to file
 */
export function saveCredentials(credentials: Record<string, string>): void {
  const configDir = getDamieConfigDir();
  const envPath = getCredentialsPath();

  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const content = toEnvFile(credentials);
  fs.writeFileSync(envPath, content, { mode: 0o600 }); // Read/write only for owner
}

/**
 * Get API key for a specific provider
 */
export function getStoredApiKey(provider: ProviderName): string | undefined {
  // Check environment first
  const envVar = PROVIDER_ENV_VARS[provider];
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }

  // Fall back to stored credentials
  const credentials = loadCredentials();
  return credentials[envVar];
}

/**
 * Store API key for a provider
 */
export function storeApiKey(provider: ProviderName, apiKey: string): void {
  const envVar = PROVIDER_ENV_VARS[provider];
  if (!envVar) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const credentials = loadCredentials();
  credentials[envVar] = apiKey;
  saveCredentials(credentials);
}

/**
 * Remove API key for a provider
 */
export function removeApiKey(provider: ProviderName): void {
  const envVar = PROVIDER_ENV_VARS[provider];
  if (!envVar) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const credentials = loadCredentials();
  delete credentials[envVar];
  saveCredentials(credentials);
}

/**
 * Check if an API key is stored for a provider
 */
export function hasStoredApiKey(provider: ProviderName): boolean {
  return getStoredApiKey(provider) !== undefined;
}

/**
 * List all stored provider keys (names only, not values)
 */
export function listStoredProviders(): ProviderName[] {
  const credentials = loadCredentials();
  const providers: ProviderName[] = [];

  for (const [provider, envVar] of Object.entries(PROVIDER_ENV_VARS)) {
    if (credentials[envVar] || process.env[envVar]) {
      providers.push(provider as ProviderName);
    }
  }

  return providers;
}

/**
 * Load stored credentials into process.env
 * Call this at startup to make stored keys available
 */
export function loadCredentialsToEnv(): void {
  const credentials = loadCredentials();

  for (const [key, value] of Object.entries(credentials)) {
    // Only set if not already in environment
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * Display security warning about credential storage
 */
export function showSecurityWarning(): void {
  console.log('\n⚠️  Security Notice:');
  console.log('API keys are stored in ~/.damie/.env');
  console.log('This file has restricted permissions (owner read/write only).');
  console.log('For enhanced security, consider:');
  console.log('  - Using environment variables instead');
  console.log('  - Setting up system keychain integration');
  console.log('  - Never committing .env files to version control\n');
}
