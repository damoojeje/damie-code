/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';

/**
 * Validation patterns for user input
 */
export const VALIDATION_PATTERNS = {
  /** Skill name pattern: lowercase letters, numbers, and hyphens */
  skillName: /^[a-z0-9-]+$/,
  /** Plugin name pattern: lowercase letters, numbers, and hyphens */
  pluginName: /^[a-z0-9-]+$/,
  /** Profile name pattern: lowercase letters, numbers, hyphens, and spaces */
  profileName: /^[a-z0-9-\s]+$/,
  /** Generic identifier pattern */
  identifier: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
};

/**
 * Maximum lengths for various input types
 */
export const MAX_LENGTHS = {
  skillName: 50,
  pluginName: 50,
  profileName: 50,
  description: 200,
  systemPrompt: 10000,
} as const;

/**
 * Validate a skill name
 * @param name - The skill name to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateSkillName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (!name || name.trim() === '') {
    return { isValid: false, error: 'Skill name cannot be empty' };
  }

  if (name.length > MAX_LENGTHS.skillName) {
    return {
      isValid: false,
      error: `Skill name must be ${MAX_LENGTHS.skillName} characters or less`,
    };
  }

  if (!VALIDATION_PATTERNS.skillName.test(name)) {
    return {
      isValid: false,
      error:
        'Skill name can only contain lowercase letters, numbers, and hyphens',
    };
  }

  return { isValid: true };
}

/**
 * Validate a plugin name
 * @param name - The plugin name to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validatePluginName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (!name || name.trim() === '') {
    return { isValid: false, error: 'Plugin name cannot be empty' };
  }

  if (name.length > MAX_LENGTHS.pluginName) {
    return {
      isValid: false,
      error: `Plugin name must be ${MAX_LENGTHS.pluginName} characters or less`,
    };
  }

  if (!VALIDATION_PATTERNS.pluginName.test(name)) {
    return {
      isValid: false,
      error:
        'Plugin name can only contain lowercase letters, numbers, and hyphens',
    };
  }

  return { isValid: true };
}

/**
 * Validate a profile name
 * @param name - The profile name to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateProfileName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (!name || name.trim() === '') {
    return { isValid: false, error: 'Profile name cannot be empty' };
  }

  if (name.length > MAX_LENGTHS.profileName) {
    return {
      isValid: false,
      error: `Profile name must be ${MAX_LENGTHS.profileName} characters or less`,
    };
  }

  if (!VALIDATION_PATTERNS.profileName.test(name)) {
    return {
      isValid: false,
      error:
        'Profile name can only contain lowercase letters, numbers, hyphens, and spaces',
    };
  }

  return { isValid: true };
}

/**
 * Sanitize a string by removing potentially dangerous characters
 * @param input - The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes and trim
  return input.replace(/\0/g, '').trim();
}

/**
 * Validate a file path to prevent path traversal attacks
 * @param filePath - The file path to validate
 * @param basePath - The base directory that should contain the file
 * @returns Object with isValid flag and error message if invalid
 */
export function validateFilePath(
  filePath: string,
  basePath: string,
): { isValid: boolean; error?: string } {
  if (!filePath || filePath.trim() === '') {
    return { isValid: false, error: 'File path cannot be empty' };
  }

  // Check for path traversal attempts
  if (filePath.includes('..')) {
    return {
      isValid: false,
      error: 'Invalid file path: path traversal not allowed',
    };
  }

  // Resolve the full path and ensure it's within the base directory
  const resolvedPath = path.resolve(basePath, filePath);
  const resolvedBase = path.resolve(basePath);

  if (!resolvedPath.startsWith(resolvedBase)) {
    return {
      isValid: false,
      error: 'Invalid file path: must be within the allowed directory',
    };
  }

  return { isValid: true };
}
