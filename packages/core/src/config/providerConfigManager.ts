/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import type { ProviderConfig, ProviderName } from './damieConfig.js';
import { getDamieConfigPath, getDamieConfigDir } from './damieConfigLoader.js';

/**
 * Validation result for provider configuration
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * ProviderConfigManager - Manages provider configuration persistence
 * 
 * Provides:
 * - Load/save provider configurations to config.yaml
 * - Validation of provider settings
 * - Model mapping management (coding, reasoning, general, vision)
 * - Config file backup and recovery
 */
export class ProviderConfigManager {
  private configPath: string;
  private configDir: string;

  constructor() {
    this.configPath = getDamieConfigPath();
    this.configDir = getDamieConfigDir();
  }

  /**
   * Ensure config directory exists
   */
  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * Load provider configuration from config file
   */
  async loadProviderConfig(provider: ProviderName): Promise<ProviderConfig | null> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      const config = this.parseYamlConfig(configContent);
      
      if (!config.providers || !config.providers[provider]) {
        return null;
      }

      return config.providers[provider] as ProviderConfig;
    } catch (error) {
      console.error(`Failed to load provider config for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Save provider configuration to config file
   */
  async saveProviderConfig(provider: ProviderName, config: ProviderConfig): Promise<void> {
    try {
      this.ensureConfigDir();

      // Load existing config or create new
      let existingConfig: any = {};
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf-8');
        existingConfig = this.parseYamlConfig(configContent);
      }

      // Ensure providers section exists
      if (!existingConfig.providers) {
        existingConfig.providers = {};
      }

      // Update provider config
      existingConfig.providers[provider] = this.sanitizeProviderConfig(config);

      // Write updated config
      const yamlContent = this.generateYamlConfig(existingConfig);
      fs.writeFileSync(this.configPath, yamlContent, 'utf-8');
    } catch (error) {
      console.error(`Failed to save provider config for ${provider}:`, error);
      throw new Error(`Failed to save provider configuration: ${error}`);
    }
  }

  /**
   * Update specific model mapping for a provider
   */
  async updateModelMapping(
    provider: ProviderName,
    taskType: 'coding' | 'reasoning' | 'general' | 'vision',
    model: string,
  ): Promise<void> {
    const config = await this.loadProviderConfig(provider) || {};
    
    const modelKey = `${taskType}Model` as keyof ProviderConfig;
    (config as any)[modelKey] = model;
    
    await this.saveProviderConfig(provider, config);
  }

  /**
   * Validate provider configuration
   */
  async validateConfig(provider: ProviderName, config: ProviderConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check API key if required
    if (provider !== 'qwen' && provider !== 'ollama') {
      if (!config.apiKey && !process.env[this.getProviderEnvVar(provider)]) {
        errors.push(`API key required for ${provider}. Set apiKey or ${this.getProviderEnvVar(provider)} environment variable.`);
      }
    }

    // Validate model names
    const modelFields = ['model', 'codingModel', 'reasoningModel', 'generalModel', 'visionModel'];
    for (const field of modelFields) {
      const model = (config as any)[field];
      if (model && typeof model === 'string') {
        if (!this.isValidModelName(model)) {
          warnings.push(`Model name "${model}" in ${field} may be invalid`);
        }
      }
    }

    // Validate timeout
    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout < 1000) {
        errors.push('Timeout must be at least 1000ms');
      } else if (config.timeout > 300000) {
        warnings.push('Timeout > 300000ms (5 minutes) is unusually high');
      }
    }

    // Validate maxRetries
    if (config.maxRetries !== undefined) {
      if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
        errors.push('maxRetries must be a non-negative number');
      } else if (config.maxRetries > 10) {
        warnings.push('maxRetries > 10 is unusually high');
      }
    }

    // Check base URL format
    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push(`Invalid base URL format: ${config.baseUrl}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Load all provider configurations
   */
  async loadAllProviders(): Promise<Record<ProviderName, ProviderConfig | undefined>> {
    const providers: ProviderName[] = ['deepseek', 'openai', 'anthropic', 'openrouter', 'ollama', 'qwen'];
    const result: Record<ProviderName, ProviderConfig | undefined> = {} as any;

    for (const provider of providers) {
      const config = await this.loadProviderConfig(provider);
      if (config) {
        result[provider] = config;
      }
    }

    return result;
  }

  /**
   * Delete provider configuration
   */
  async deleteProviderConfig(provider: ProviderName): Promise<void> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return;
      }

      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      const config = this.parseYamlConfig(configContent);

      if (config.providers && config.providers[provider]) {
        delete config.providers[provider];
        
        const yamlContent = this.generateYamlConfig(config);
        fs.writeFileSync(this.configPath, yamlContent, 'utf-8');
      }
    } catch (error) {
      console.error(`Failed to delete provider config for ${provider}:`, error);
      throw new Error(`Failed to delete provider configuration: ${error}`);
    }
  }

  /**
   * Create backup of config file
   */
  async createBackup(): Promise<string> {
    if (!fs.existsSync(this.configPath)) {
      return '';
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.configPath}.backup-${timestamp}`;
    
    fs.copyFileSync(this.configPath, backupPath);
    return backupPath;
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    this.ensureConfigDir();
    fs.copyFileSync(backupPath, this.configPath);
  }

  /**
   * Simple YAML parser (handles our specific config format)
   */
  private parseYamlConfig(content: string): any {
    // Simple YAML-like parser for our config format
    // In production, consider using a proper YAML library
    const result: any = {};
    const lines = content.split('\n');
    const stack: Array<{ obj: any; indent: number }> = [{ obj: result, indent: -1 }];

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') {
        continue;
      }

      const match = line.match(/^(\s*)([\w]+):\s*(.*)$/);
      if (!match) {
        continue;
      }

      const [, spaces, key, value] = match;
      const indent = spaces.length;

      // Pop stack until we find parent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;

      if (value === '' || value.startsWith('#')) {
        // Nested object
        parent[key] = {};
        stack.push({ obj: parent[key], indent });
      } else {
        // Value
        parent[key] = this.parseYamlValue(value);
      }
    }

    return result;
  }

  /**
   * Generate YAML config string
   */
  private generateYamlConfig(config: any): string {
    const lines: string[] = [
      '# Damie Code Configuration',
      '# Generated by ProviderConfigManager',
      '',
    ];

    this.writeObjectToYaml(lines, config, 0);
    return lines.join('\n') + '\n';
  }

  /**
   * Recursively write object to YAML lines
   */
  private writeObjectToYaml(lines: string[], obj: any, indent: number): void {
    const indentStr = '  '.repeat(indent);

    if (!obj || typeof obj !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_') || value === undefined) {
        continue; // Skip private/undefined values
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`${indentStr}${key}:`);
        this.writeObjectToYaml(lines, value, indent + 1);
      } else {
        const yamlValue = this.toYamlValue(value);
        lines.push(`${indentStr}${key}: ${yamlValue}`);
      }
    }
  }

  /**
   * Convert value to YAML string representation
   */
  private toYamlValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'string') {
      // Quote strings with special characters
      if (value.includes(':') || value.includes('#') || value.includes('"') || value.startsWith('env:')) {
        return `"${value}"`;
      }
      return value;
    }
    
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    
    if (typeof value === 'number') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return `[${value.map(v => this.toYamlValue(v)).join(', ')}]`;
    }

    return String(value);
  }

  /**
   * Parse YAML value string to appropriate type
   */
  private parseYamlValue(value: string): any {
    const trimmed = value.trim();
    
    // Remove quotes if present
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Boolean
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    
    // Null
    if (trimmed.toLowerCase() === 'null' || trimmed === '~') return null;
    
    // Number
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    
    // String (default)
    return trimmed;
  }

  /**
   * Sanitize provider config before saving
   */
  private sanitizeProviderConfig(config: ProviderConfig): ProviderConfig {
    const sanitized: any = {};
    
    // Only save defined fields
    const validFields = [
      'apiKey', 'baseUrl', 'model', 'codingModel', 'reasoningModel', 
      'generalModel', 'visionModel', 'timeout', 'maxRetries', 'enabled', 'priority'
    ];
    
    for (const field of validFields) {
      const value = (config as any)[field];
      if (value !== undefined && value !== null) {
        sanitized[field] = value;
      }
    }
    
    return sanitized as ProviderConfig;
  }

  /**
   * Get environment variable name for provider API key
   */
  private getProviderEnvVar(provider: ProviderName): string {
    const envVars: Record<ProviderName, string> = {
      deepseek: 'DEEPSEEK_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      ollama: 'OLLAMA_BASE_URL',
      qwen: 'QWEN_API_KEY',
    };
    return envVars[provider] || '';
  }

  /**
   * Validate model name format
   */
  private isValidModelName(model: string): boolean {
    // Basic validation - model names should be non-empty and not contain invalid chars
    if (!model || model.length === 0) return false;
    if (model.length > 100) return false;
    // Allow alphanumeric, dash, underscore, dot, slash (for openrouter format)
    return /^[a-zA-Z0-9\-_./]+$/.test(model);
  }
}

// Singleton instance
let instance: ProviderConfigManager | null = null;

export function getProviderConfigManager(): ProviderConfigManager {
  if (!instance) {
    instance = new ProviderConfigManager();
  }
  return instance;
}
