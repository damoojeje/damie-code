/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import type { PluginService, PluginListItem } from '../../services/pluginService.js';

interface PluginsDialogProps {
  pluginService: PluginService;
  onExit: () => void;
}

export function PluginsDialog({ pluginService, onExit }: PluginsDialogProps): React.JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);
  const [plugins, setPlugins] = useState<PluginListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginListItem | null>(null);

  // Load plugins on mount
  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const pluginList = await pluginService.listPlugins();
      setPlugins(pluginList);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
      setLoading(false);
    }
  };

  const togglePluginEnabled = async (index: number) => {
    const plugin = plugins[index];
    try {
      setActionMessage(`Toggling ${plugin.name}...`);
      
      if (plugin.enabled) {
        await pluginService.disablePlugin(plugin.name);
      } else {
        await pluginService.enablePlugin(plugin.name);
      }
      
      // Reload plugins to get updated state
      await loadPlugins();
      setActionMessage(`${plugin.name} ${plugin.enabled ? 'disabled' : 'enabled'}`);
      
      // Clear message after 2 seconds
      setTimeout(() => setActionMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to toggle ${plugin.name}`);
    }
  };

  const loadUnloadPlugin = async (index: number) => {
    const plugin = plugins[index];
    try {
      setActionMessage(`${plugin.loaded ? 'Unloading' : 'Loading'} ${plugin.name}...`);
      
      if (plugin.loaded) {
        await pluginService.unloadPlugin(plugin.name);
      } else {
        await pluginService.loadPlugin(plugin.name);
      }
      
      // Reload plugins to get updated state
      await loadPlugins();
      setActionMessage(`${plugin.name} ${plugin.loaded ? 'unloaded' : 'loaded'}`);
      
      // Clear message after 2 seconds
      setTimeout(() => setActionMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to toggle ${plugin.name}`);
    }
  };

  const viewPluginDetails = async (index: number) => {
    const plugin = plugins[index];
    try {
      const info = await pluginService.getPluginInfo(plugin.name);
      if (info) {
        setSelectedPlugin(plugin);
        setShowDetails(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to get details for ${plugin.name}`);
    }
  };

  useKeypress(
    (key) => {
      if (showDetails) {
        if (key.name === 'escape') {
          setShowDetails(false);
          setSelectedPlugin(null);
        }
        return;
      }

      if (key.name === 'escape') {
        onExit();
      } else if (key.name === 'up' || key.name === 'k') {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : plugins.length - 1));
      } else if (key.name === 'down' || key.name === 'j') {
        setActiveIndex((prev) => (prev < plugins.length - 1 ? prev + 1 : 0));
      } else if (key.name === 'space' || key.name === 'return') {
        if (plugins.length > 0) {
          togglePluginEnabled(activeIndex);
        }
      } else if (key.name === 'l') {
        // Load/Unload
        if (plugins.length > 0) {
          loadUnloadPlugin(activeIndex);
        }
      } else if (key.name === 'd' || key.name === 'i') {
        // View details
        if (plugins.length > 0) {
          viewPluginDetails(activeIndex);
        }
      } else if (key.name === 'r') {
        // Refresh
        loadPlugins();
        setActionMessage('Plugins refreshed');
        setTimeout(() => setActionMessage(null), 2000);
      }
    },
    { isActive: true },
  );

  if (loading) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border.default}
        flexDirection="column"
        padding={1}
        minWidth={80}
      >
        <Text color={theme.text.secondary}>Loading plugins...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.status.error}
        flexDirection="column"
        padding={1}
        minWidth={80}
      >
        <Text color={theme.status.error}>Error: {error}</Text>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Press Esc to exit, 'r' to retry</Text>
        </Box>
      </Box>
    );
  }

  if (showDetails && selectedPlugin) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border.default}
        flexDirection="column"
        padding={1}
        minWidth={80}
      >
        <Text bold color={theme.status.success}>
          Plugin Details: {selectedPlugin.name}
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Box flexDirection="row">
            <Box width={15}>
              <Text color={theme.text.secondary}>Name:</Text>
            </Box>
            <Text color={theme.text.primary}>{selectedPlugin.name}</Text>
          </Box>
          <Box flexDirection="row">
            <Box width={15}>
              <Text color={theme.text.secondary}>Version:</Text>
            </Box>
            <Text color={theme.text.primary}>v{selectedPlugin.version}</Text>
          </Box>
          <Box flexDirection="row">
            <Box width={15}>
              <Text color={theme.text.secondary}>Description:</Text>
            </Box>
            <Text color={theme.text.primary}>{selectedPlugin.description}</Text>
          </Box>
          <Box flexDirection="row">
            <Box width={15}>
              <Text color={theme.text.secondary}>Status:</Text>
            </Box>
            <Text color={selectedPlugin.enabled ? theme.status.success : theme.text.secondary}>
              {selectedPlugin.enabled ? '✅ Enabled' : '❌ Disabled'}
            </Text>
            <Text color={theme.text.secondary}> | </Text>
            <Text color={selectedPlugin.loaded ? theme.status.success : theme.text.secondary}>
              {selectedPlugin.loaded ? '📦 Loaded' : '⭕ Unloaded'}
            </Text>
          </Box>
          {selectedPlugin.hooks.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Box>
                <Text bold color={theme.text.secondary}>Hooks ({selectedPlugin.hooks.length}):</Text>
              </Box>
              {selectedPlugin.hooks.slice(0, 5).map((hook) => (
                <Box key={hook} paddingLeft={2}>
                  <Text color={theme.text.secondary}>• {hook}</Text>
                </Box>
              ))}
              {selectedPlugin.hooks.length > 5 && (
                <Box paddingLeft={2}>
                  <Text color={theme.text.secondary}>... and {selectedPlugin.hooks.length - 5} more</Text>
                </Box>
              )}
            </Box>
          )}
          {selectedPlugin.commands.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Box>
                <Text bold color={theme.text.secondary}>Commands ({selectedPlugin.commands.length}):</Text>
              </Box>
              {selectedPlugin.commands.slice(0, 5).map((cmd) => (
                <Box key={cmd} paddingLeft={2}>
                  <Text color={theme.text.secondary}>• /{cmd}</Text>
                </Box>
              ))}
              {selectedPlugin.commands.length > 5 && (
                <Box paddingLeft={2}>
                  <Text color={theme.text.secondary}>... and {selectedPlugin.commands.length - 5} more</Text>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Press Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      minWidth={80}
    >
      <Text bold color={theme.status.success}>
        Plugin Manager
      </Text>

      <Box marginTop={1} flexDirection="column">
        {plugins.length === 0 ? (
          <Box>
            <Text color={theme.text.secondary}>No plugins found.</Text>
          </Box>
        ) : (
          plugins.map((plugin, index) => {
            const isActive = index === activeIndex;
            return (
              <Box key={plugin.name} flexDirection="row" alignItems="center">
                <Box width={3}>
                  <Text
                    color={
                      isActive ? theme.status.success : theme.text.secondary
                    }
                  >
                    {isActive ? '●' : ' '}
                  </Text>
                </Box>
                <Box width={2}>
                  <Text
                    color={
                      plugin.enabled ? theme.status.success : theme.text.secondary
                    }
                  >
                    {plugin.enabled ? '✅' : '❌'}
                  </Text>
                </Box>
                <Box width={2}>
                  <Text
                    color={
                      plugin.loaded ? theme.status.success : theme.text.secondary
                    }
                  >
                    {plugin.loaded ? '📦' : '⭕'}
                  </Text>
                </Box>
                <Box width={2}>
                  {plugin.hasErrors && (
                    <Text color={theme.status.error}>⚠️</Text>
                  )}
                </Box>
                <Box width={20}>
                  <Text
                    color={isActive ? theme.status.success : theme.text.primary}
                  >
                    {plugin.name}
                  </Text>
                </Box>
                <Box width={10}>
                  <Text color={theme.text.secondary}>v{plugin.version}</Text>
                </Box>
                <Box width={30}>
                  <Text color={theme.text.secondary}>{plugin.description}</Text>
                </Box>
                <Box width={1}>
                  {plugin.hooks.length > 0 && (
                    <Text color={theme.text.secondary}>🔗</Text>
                  )}
                </Box>
                <Box width={1}>
                  {plugin.commands.length > 0 && (
                    <Text color={theme.text.secondary}>⚡</Text>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          Press ↑↓ to navigate, Space to toggle, 'l' to load/unload, 'd' for details, 'r' to refresh, Esc to exit
        </Text>
        {actionMessage && (
          <Box marginTop={1}>
            <Text color={theme.status.success}>{actionMessage}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Total: {plugins.length} plugins | Enabled: {plugins.filter((p) => p.enabled).length} | 
            Loaded: {plugins.filter((p) => p.loaded).length}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
