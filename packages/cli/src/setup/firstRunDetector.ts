/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

/**
 * Directory name for Damie Code configuration
 */
export const DAMIE_CONFIG_DIR = '.damie';

/**
 * Config file name
 */
export const DAMIE_CONFIG_FILE = 'config.yaml';

/**
 * Get the path to the Damie config directory
 */
export function getDamieConfigDir(): string {
  return path.join(homedir(), DAMIE_CONFIG_DIR);
}

/**
 * Get the path to the Damie config file
 */
export function getDamieConfigPath(): string {
  return path.join(getDamieConfigDir(), DAMIE_CONFIG_FILE);
}

/**
 * Check if this is the first run of Damie Code
 * Returns true if no config file exists
 */
export function isFirstRun(): boolean {
  const configPath = getDamieConfigPath();
  return !fs.existsSync(configPath);
}

/**
 * Check if the config directory exists
 */
export function configDirExists(): boolean {
  return fs.existsSync(getDamieConfigDir());
}

/**
 * Ensure the config directory exists
 */
export function ensureConfigDir(): void {
  const configDir = getDamieConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}
