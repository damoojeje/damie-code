/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const providerCommand: SlashCommand = {
  name: 'provider',
  description: 'Manage API provider configurations',
  kind: CommandKind.BUILT_IN,
  action: async (_context: any, args: string) => {
    const trimmedArgs = args.trim();
    
    // Import dynamically
    const { 
      listProviders, 
      show_provider, 
      set_provider_config, 
      set_provider_enabled 
    } = await import('../../commands/providerCommand.js');
    
    if (!trimmedArgs || trimmedArgs === '--help' || trimmedArgs === '-h') {
      return {
        type: 'message',
        messageType: 'info',
        content: `Provider Command - Manage API provider configurations

Usage:
  /provider                       Show help
  /provider list                  List all providers and their status
  /provider show <provider>       Show detailed provider configuration
  /provider set <provider> <key> <value>  Set provider configuration
  /provider enable <provider>     Enable provider
  /provider disable <provider>    Disable provider

Examples:
  /provider list
  /provider show deepseek
  /provider set deepseek model deepseek-coder
  /provider set anthropic timeout 60000
  /provider enable openrouter
  /provider disable ollama

Configuration Keys:
  - apiKey: API key for the provider
  - baseUrl: Base URL override
  - model: Default model to use
  - timeout: Request timeout in milliseconds
  - maxRetries: Maximum retry attempts`,
      } satisfies MessageActionReturn;
    }
    
    const argsArray = trimmedArgs.split(/\s+/);
    const subcommand = argsArray[0].toLowerCase();
    
    // Capture console output
    const originalLog = console.log;
    let output = '';
    const captureLog = (...logArgs: any[]) => {
      output += logArgs.join(' ') + '\n';
    };
    
    try {
      switch (subcommand) {
        case 'list':
          console.log = captureLog;
          listProviders();
          break;
          
        case 'show':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Provider name required.\nUsage: /provider show <provider>',
            } satisfies MessageActionReturn;
          }
          console.log = captureLog;
          show_provider(argsArray[1]);
          break;
          
        case 'set':
          if (argsArray.length < 4) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Usage: /provider set <provider> <key> <value>',
            } satisfies MessageActionReturn;
          }
          console.log = captureLog;
          set_provider_config(argsArray[1], argsArray[2], argsArray[3]);
          break;
          
        case 'enable':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Provider name required.\nUsage: /provider enable <provider>',
            } satisfies MessageActionReturn;
          }
          console.log = captureLog;
          set_provider_enabled(argsArray[1], true);
          break;
          
        case 'disable':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Provider name required.\nUsage: /provider disable <provider>',
            } satisfies MessageActionReturn;
          }
          console.log = captureLog;
          set_provider_enabled(argsArray[1], false);
          break;
          
        default:
          return {
            type: 'message',
            messageType: 'error',
            content: `Error: Unknown subcommand "${subcommand}".\nRun "/provider" for usage.`,
          } satisfies MessageActionReturn;
      }
    } catch (error) {
      console.log = originalLog;
      return {
        type: 'message',
        messageType: 'error',
        content: `Provider command error: ${error instanceof Error ? error.message : String(error)}`,
      } satisfies MessageActionReturn;
    }
    
    console.log = originalLog;
    
    return {
      type: 'message',
      messageType: 'info',
      content: output,
    } satisfies MessageActionReturn;
  },
};
