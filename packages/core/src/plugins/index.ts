/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: MIT
 */

// Export types
export type {
  PluginManifest,
  PluginHook,
  PluginCommand,
  PluginSetting,
  LoadedPlugin,
  DamiePlugin,
  PluginContext,
  PluginLogger,
  PluginAPI,
  PluginManagerConfig,
  HookResult,
  PluginListItem,
  PluginInfo,
  HookInfo,
  CommandInfo,
  LoadResult as PluginLoadResult,
  InstallResult as PluginInstallResult,
  LogEntry,
} from './types.js';

export { PluginState, PluginEvent } from './types.js';

// Export plugin manager
export { PluginManager, createPluginManager } from './pluginManager.js';

// Export plugin service
export type { PluginService } from './pluginService.js';
export { createPluginService } from './pluginService.js';
