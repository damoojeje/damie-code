/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: MIT
 */

import { createPluginManager, createPluginService } from '@damie-code/damie-code-core';
import type { PluginService, PluginListItem } from '@damie-code/damie-code-core';

let pluginServiceInstance: PluginService | null = null;

/**
 * Get or create the PluginService singleton
 */
export function getPluginService(): PluginService {
  if (!pluginServiceInstance) {
    const pluginManager = createPluginManager();
    pluginServiceInstance = createPluginService(pluginManager);
  }
  return pluginServiceInstance;
}

export type { PluginService, PluginListItem };
