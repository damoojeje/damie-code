/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin lifecycle state
 */
export enum PluginState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ERROR = 'error',
}

/**
 * Plugin manifest interface
 */
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  repository?: string;
  main?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  damieVersion?: string;
  hooks?: PluginHook[];
  commands?: PluginCommand[];
  settings?: PluginSetting[];
}

/**
 * Plugin hook definition
 */
export interface PluginHook {
  name: string;
  event: PluginEvent;
  handler: string;
  priority?: number;
}

/**
 * Plugin events that can be hooked
 */
export enum PluginEvent {
  BEFORE_GENERATE = 'before:generate',
  AFTER_GENERATE = 'after:generate',
  BEFORE_EXECUTE = 'before:execute',
  AFTER_EXECUTE = 'after:execute',
  ON_ERROR = 'on:error',
  ON_START = 'on:start',
  ON_STOP = 'on:stop',
  ON_MESSAGE = 'on:message',
  ON_TOOL_CALL = 'on:tool_call',
}

/**
 * Plugin command definition
 */
export interface PluginCommand {
  name: string;
  description: string;
  usage?: string;
  handler: string;
}

/**
 * Plugin setting definition
 */
export interface PluginSetting {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default?: unknown;
  required?: boolean;
}

/**
 * Loaded plugin info
 */
export interface LoadedPlugin {
  name: string;
  manifest: PluginManifest;
  state: PluginState;
  path: string;
  loadedAt?: Date;
  enabledAt?: Date;
  error?: string;
  settings?: Record<string, unknown>;
}

/**
 * Plugin interface that plugins must implement
 */
export interface DamiePlugin {
  name: string;
  version: string;
  initialize?(context: PluginContext): Promise<void>;
  destroy?(): Promise<void>;
  enable?(): Promise<void>;
  disable?(): Promise<void>;
  [key: string]: unknown;
}

/**
 * Plugin context passed to plugins
 */
export interface PluginContext {
  workingDirectory: string;
  config: Record<string, unknown>;
  logger: PluginLogger;
  api: PluginAPI;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Plugin API for accessing Damie functionality
 */
export interface PluginAPI {
  getConfig(key: string): unknown;
  setConfig(key: string, value: unknown): void;
  registerTool(tool: unknown): void;
  registerCommand(command: PluginCommand, handler: (...args: unknown[]) => unknown): void;
  emit(event: string, data: unknown): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * Plugin manager configuration
 */
export interface PluginManagerConfig {
  pluginsPath: string;
  autoLoad?: boolean;
  enabledPlugins?: string[];
  disabledPlugins?: string[];
}

/**
 * Hook execution result
 */
export interface HookResult {
  plugin: string;
  hook: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  plugin: string;
}

/**
 * Plugin list item for UI display
 */
export interface PluginListItem {
  name: string;
  description: string;
  version: string;
  author?: string;
  enabled: boolean;
  loaded: boolean;
  state: PluginState;
  path: string;
  hooks: string[];
  commands: string[];
  hasErrors: boolean;
  error?: string;
}

/**
 * Plugin info with full details
 */
export interface PluginInfo {
  name: string;
  manifest: PluginManifest;
  state: PluginState;
  path: string;
  loadedAt?: Date;
  enabled: boolean;
  hooks: HookInfo[];
  commands: CommandInfo[];
  logs: LogEntry[];
  error?: string;
}

/**
 * Hook information
 */
export interface HookInfo {
  event: string;
  handler: string;
  priority: number;
  plugin: string;
}

/**
 * Command information
 */
export interface CommandInfo {
  name: string;
  description: string;
  handler: string;
  plugin: string;
}

/**
 * Plugin load result
 */
export interface LoadResult {
  success: boolean;
  plugin?: LoadedPlugin;
  error?: string;
  warnings?: string[];
}

/**
 * Plugin install result
 */
export interface InstallResult {
  success: boolean;
  pluginPath?: string;
  error?: string;
  warnings?: string[];
}
