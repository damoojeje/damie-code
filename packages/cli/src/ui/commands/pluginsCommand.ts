/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, MessageActionReturn, OpenDialogActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { createPluginManager } from '@damie-code/damie-code-core';

export const pluginsCommand: SlashCommand = {
  name: 'plugins',
  description: 'Manage plugins',
  kind: CommandKind.BUILT_IN,
  action: async (_context: any, args: string) => {
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

    const captureOutput = (): { logs: string[], log: (...args: any[]) => void } => {
      const logs: string[] = [];
      return {
        logs,
        log: (...args: any[]) => logs.push(args.join(' ')),
      };
    };

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
            plugins.forEach((plugin: any, idx: number) => {
              const status = plugin.enabled ? '✓' : '✗';
              const loaded = plugin.loaded ? '[Loaded]' : '[Not Loaded]';
              output.log(`  ${idx + 1}. ${status} ${plugin.name} ${loaded}`);
              output.log(`      ${plugin.description}`);
              output.log(`      Version: ${plugin.version}, Hooks: ${plugin.hooks?.length || 0}, Commands: ${plugin.commands?.length || 0}`);
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
              content: 'Error: Plugin name required.\nUsage: /plugins install <name>',
            } satisfies MessageActionReturn;
          }
          
          const output = captureOutput();
          output.log(`\n📦 Installing plugin: ${argsArray[1]}...`);
          
          try {
            const result = await pluginManager.installPlugin(argsArray[1]);
            if (result.success) {
              output.log(`✅ Successfully installed: ${argsArray[1]}`);
              if (result.path) {
                output.log(`Location: ${result.path}`);
              }
            } else {
              output.log(`❌ Installation failed: ${result.message}`);
            }
          } catch (error) {
            output.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
          }
          output.log('');
          
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
              content: 'Error: Plugin name required.\nUsage: /plugins enable <name>',
            } satisfies MessageActionReturn;
          }
          
          const output = captureOutput();
          try {
            await pluginManager.enablePlugin(argsArray[1]);
            output.log(`\n✅ Enabled plugin: ${argsArray[1]}\n`);
          } catch (error) {
            output.log(`\n❌ Failed to enable: ${error instanceof Error ? error.message : String(error)}\n`);
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
              content: 'Error: Plugin name required.\nUsage: /plugins disable <name>',
            } satisfies MessageActionReturn;
          }
          
          const output = captureOutput();
          try {
            await pluginManager.disablePlugin(argsArray[1]);
            output.log(`\n❌ Disabled plugin: ${argsArray[1]}\n`);
          } catch (error) {
            output.log(`\n❌ Failed to disable: ${error instanceof Error ? error.message : String(error)}\n`);
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
              content: 'Error: Plugin name required.\nUsage: /plugins load <name>',
            } satisfies MessageActionReturn;
          }
          
          const output = captureOutput();
          try {
            await pluginManager.loadPlugin(argsArray[1]);
            output.log(`\n✅ Loaded plugin: ${argsArray[1]}\n`);
          } catch (error) {
            output.log(`\n❌ Failed to load: ${error instanceof Error ? error.message : String(error)}\n`);
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
              content: 'Error: Plugin name required.\nUsage: /plugins unload <name>',
            } satisfies MessageActionReturn;
          }
          
          const output = captureOutput();
          try {
            await pluginManager.unloadPlugin(argsArray[1]);
            output.log(`\n✅ Unloaded plugin: ${argsArray[1]}\n`);
          } catch (error) {
            output.log(`\n❌ Failed to unload: ${error instanceof Error ? error.message : String(error)}\n`);
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
              content: 'Error: Plugin name required.\nUsage: /plugins info <name>',
            } satisfies MessageActionReturn;
          }
          
          const output = captureOutput();
          try {
            const plugins = await pluginManager.listPlugins();
            const plugin = plugins.find(p => p.name === argsArray[1]);
            
            if (!plugin) {
              output.log(`\n❌ Plugin not found: ${argsArray[1]}\n`);
            } else {
              output.log(`\n=== Plugin: ${plugin.name} ===\n`);
              output.log(`Description: ${plugin.description}`);
              output.log(`Version: ${plugin.version}`);
              output.log(`Author: ${plugin.author || 'Unknown'}`);
              output.log(`Status: ${plugin.enabled ? 'Enabled' : 'Disabled'} | ${plugin.loaded ? 'Loaded' : 'Not Loaded'}`);
              output.log(`Hooks: ${plugin.hooks?.length || 0}`);
              output.log(`Commands: ${plugin.commands?.length || 0}`);
              if (plugin.hooks?.length) {
                output.log('\nHooks:');
                plugin.hooks.forEach((h: any) => output.log(`  - ${h.event} (${h.handler})`));
              }
              if (plugin.commands?.length) {
                output.log('\nCommands:');
                plugin.commands.forEach((c: any) => output.log(`  - /${c.name}: ${c.description}`));
              }
              output.log('');
            }
          } catch (error) {
            output.log(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
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
