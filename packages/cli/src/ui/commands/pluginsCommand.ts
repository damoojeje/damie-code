/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  MessageActionReturn,
  OpenDialogActionReturn,
  CommandContext,
} from './types.js';
import { CommandKind } from './types.js';
import {
  createPluginManager,
  type LoadedPlugin,
} from '@damie-code/damie-code-core';
import { validatePluginName, sanitizeInput } from '../../utils/validation.js';

/**
 * Helper function to capture console output safely
 */
function captureOutput(): {
  logs: string[];
  log: (...args: unknown[]) => void;
} {
  const logs: string[] = [];
  return {
    logs,
    log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
  };
}

export const pluginsCommand: SlashCommand = {
  name: 'plugins',
  description: 'Manage plugins',
  kind: CommandKind.BUILT_IN,
  action: async (_context: CommandContext, args: string) => {
    const trimmedArgs = args.trim();
    const pluginManager = createPluginManager();

    if (!trimmedArgs || trimmedArgs === '--help' || trimmedArgs === '-h') {
      return {
        type: 'message',
        messageType: 'info',
        content: `Plugins Command - Manage Damie Code plugins

Usage:
  /plugins                      Open plugins manager UI
  /plugins list                 List all discovered plugins
  /plugins install <name>       Install a new plugin
  /plugins enable <name>        Enable a plugin
  /plugins disable <name>       Disable a plugin
  /plugins load <name>          Load a plugin into memory
  /plugins unload <name>        Unload a plugin
  /plugins info <name>          Show plugin details

Examples:
  /plugins
  /plugins list
  /plugins enable my-plugin
  /plugins install github:user/plugin`,
      } satisfies MessageActionReturn;
    }

    // Open plugins dialog for no args
    if (!trimmedArgs || trimmedArgs === 'open') {
      return {
        type: 'dialog',
        dialog: 'plugins',
      } satisfies OpenDialogActionReturn;
    }

    const argsArray = trimmedArgs.split(/\s+/);
    const subcommand = argsArray[0].toLowerCase();

    try {
      switch (subcommand) {
        case 'list': {
          const plugins = await pluginManager.listPlugins();
          const output = captureOutput();

          output.log('\n=== Discovered Plugins ===\n');

          if (plugins.length === 0) {
            output.log('No plugins discovered.');
            output.log('Place plugins in ~/.damie/plugins/');
          } else {
            plugins.forEach((plugin: LoadedPlugin, idx: number) => {
              const status = plugin.enabledAt ? '✓' : '✗';
              const loaded = plugin.loadedAt ? '[Loaded]' : '[Not Loaded]';
              output.log(`  ${idx + 1}. ${status} ${plugin.name} ${loaded}`);
              output.log(`      ${plugin.manifest.description}`);
              output.log(`      Version: ${plugin.manifest.version}`);
            });
            output.log(`\nTotal: ${plugins.length} plugins`);
          }
          output.log('');

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'install': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Plugin name required.\nUsage: /plugins install <name>',
            } satisfies MessageActionReturn;
          }

          const pluginName = sanitizeInput(argsArray[1]);
          const validation = validatePluginName(pluginName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /plugins install <name>`,
            } satisfies MessageActionReturn;
          }

          const output = captureOutput();
          output.log(`\n📦 Installing plugin: ${pluginName}...`);

          try {
            // Note: installPlugin expects a path, for now we'll create a placeholder
            const plugin = await pluginManager.installPlugin(pluginName);
            output.log(`✅ Successfully installed: ${plugin.name}`);
            output.log(`Location: ${plugin.path}`);
            output.log('');
          } catch (error) {
            output.log(
              `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
            );
            output.log('');
          }

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'enable': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Plugin name required.\nUsage: /plugins enable <name>',
            } satisfies MessageActionReturn;
          }

          const pluginName = sanitizeInput(argsArray[1]);
          const validation = validatePluginName(pluginName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /plugins enable <name>`,
            } satisfies MessageActionReturn;
          }

          const output = captureOutput();
          try {
            await pluginManager.enablePlugin(pluginName);
            output.log(`\n✅ Enabled plugin: ${pluginName}\n`);
          } catch (error) {
            output.log(
              `\n❌ Failed to enable: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          }

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'disable': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Plugin name required.\nUsage: /plugins disable <name>',
            } satisfies MessageActionReturn;
          }

          const pluginName = sanitizeInput(argsArray[1]);
          const validation = validatePluginName(pluginName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /plugins disable <name>`,
            } satisfies MessageActionReturn;
          }

          const output = captureOutput();
          try {
            await pluginManager.disablePlugin(pluginName);
            output.log(`\n❌ Disabled plugin: ${pluginName}\n`);
          } catch (error) {
            output.log(
              `\n❌ Failed to disable: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          }

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'load': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Plugin name required.\nUsage: /plugins load <name>',
            } satisfies MessageActionReturn;
          }

          const pluginName = sanitizeInput(argsArray[1]);
          const validation = validatePluginName(pluginName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /plugins load <name>`,
            } satisfies MessageActionReturn;
          }

          const output = captureOutput();
          try {
            await pluginManager.loadPlugin(pluginName);
            output.log(`\n✅ Loaded plugin: ${pluginName}\n`);
          } catch (error) {
            output.log(
              `\n❌ Failed to load: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          }

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'unload': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Plugin name required.\nUsage: /plugins unload <name>',
            } satisfies MessageActionReturn;
          }

          const pluginName = sanitizeInput(argsArray[1]);
          const validation = validatePluginName(pluginName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /plugins unload <name>`,
            } satisfies MessageActionReturn;
          }

          const output = captureOutput();
          try {
            await pluginManager.unloadPlugin(pluginName);
            output.log(`\n✅ Unloaded plugin: ${pluginName}\n`);
          } catch (error) {
            output.log(
              `\n❌ Failed to unload: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          }

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'info': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Plugin name required.\nUsage: /plugins info <name>',
            } satisfies MessageActionReturn;
          }

          const pluginName = sanitizeInput(argsArray[1]);
          const validation = validatePluginName(pluginName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /plugins info <name>`,
            } satisfies MessageActionReturn;
          }

          const output = captureOutput();
          try {
            const plugins = await pluginManager.listPlugins();
            const plugin = plugins.find((p) => p.name === pluginName);

            if (!plugin) {
              output.log(`\n❌ Plugin not found: ${pluginName}\n`);
            } else {
              output.log(`\n=== Plugin: ${plugin.name} ===\n`);
              output.log(`Description: ${plugin.manifest.description}`);
              output.log(`Version: ${plugin.manifest.version}`);
              output.log(`Author: ${plugin.manifest.author || 'Unknown'}`);
              output.log(
                `Status: ${plugin.enabledAt ? 'Enabled' : 'Disabled'} | ${plugin.loadedAt ? 'Loaded' : 'Not Loaded'}`,
              );
              output.log('');
            }
          } catch (error) {
            output.log(
              `\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          }

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        default:
          return {
            type: 'message',
            messageType: 'error',
            content: `Error: Unknown subcommand "${subcommand}".\nRun "/plugins" for usage.`,
          } satisfies MessageActionReturn;
      }
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Plugins command error: ${error instanceof Error ? error.message : String(error)}`,
      } satisfies MessageActionReturn;
    }
  },
};
