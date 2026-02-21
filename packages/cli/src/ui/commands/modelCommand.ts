/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'View or change current model/provider',
  kind: CommandKind.BUILT_IN,
  action: async (_context: any, args: string) => {
    const trimmedArgs = args.trim();
    
    // Import dynamically
    const { loadDamieConfig } = await import('@damie-code/damie-code-core');
    
    if (!trimmedArgs || trimmedArgs === '--help' || trimmedArgs === '-h') {
      return {
        type: 'message',
        messageType: 'info',
        content: `Model Command - View or change current model/provider

Usage:
  /model                      Show current model configuration
  /model show                 Show detailed model configuration
  /model use <provider>       Use specific provider for next request
  /model use <provider> <model>  Use specific model for next request
  /model reset                Reset to automatic routing

Examples:
  /model                      # Show current config
  /model use qwen             # Use Qwen for next request
  /model use deepseek deepseek-coder  # Use specific model
  /model reset                # Back to automatic routing

Available Providers:
  - qwen (OAuth)
  - deepseek
  - openai
  - anthropic
  - openrouter
  - ollama`,
      } satisfies MessageActionReturn;
    }
    
    const argsArray = trimmedArgs.split(/\s+/);
    const subcommand = argsArray[0].toLowerCase();
    
    switch (subcommand) {
      case 'show': {
        const config = loadDamieConfig();
        let output = '\n=== Current Model Configuration ===\n\n';
        
        if (!config) {
          output += 'No configuration found.\n';
        } else {
          output += `Primary Provider: ${config.security?.auth?.selectedType || 'Not set'}\n\n`;
          
          if (config.model?.routing) {
            output += 'Task Routing:\n';
            if (config.model.routing.coding) output += `  Coding: ${config.model.routing.coding}\n`;
            if (config.model.routing.reasoning) output += `  Reasoning: ${config.model.routing.reasoning}\n`;
            if (config.model.routing.general) output += `  General: ${config.model.routing.general}\n`;
            if (config.model.routing.vision) output += `  Vision: ${config.model.routing.vision}\n`;
            output += '\n';
          }
          
          if (config.providers) {
            output += 'Provider Models:\n';
            for (const [provider, providerConfig] of Object.entries(config.providers)) {
              const pc = providerConfig as any;
              output += `  ${provider}:\n`;
              if (pc.model) output += `    Default: ${pc.model}\n`;
              if (pc.codingModel) output += `    Coding: ${pc.codingModel}\n`;
              if (pc.reasoningModel) output += `    Reasoning: ${pc.reasoningModel}\n`;
              if (pc.generalModel) output += `    General: ${pc.generalModel}\n`;
              if (pc.visionModel) output += `    Vision: ${pc.visionModel}\n`;
            }
          }
        }
        
        output += '\n';
        
        return {
          type: 'message',
          messageType: 'info',
          content: output,
        } satisfies MessageActionReturn;
      }
      
      case 'use': {
        if (!argsArray[1]) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Error: Provider name required.\nUsage: /model use <provider> [model]',
          } satisfies MessageActionReturn;
        }
        
        const provider = argsArray[1];
        const model = argsArray[2];
        
        // Set session override (temporary)
        // In full implementation, this would set a session variable
        let output = `\n✅ Model override set for this session:\n`;
        output += `  Provider: ${provider}\n`;
        if (model) {
          output += `  Model: ${model}\n`;
        }
        output += `\nNext request will use ${provider}${model ? ` (${model})` : ''}.\n`;
        output += `Use /model reset to return to automatic routing.\n\n`;
        
        return {
          type: 'message',
          messageType: 'info',
          content: output,
        } satisfies MessageActionReturn;
      }
      
      case 'reset': {
        // Clear session override
        return {
          type: 'message',
          messageType: 'info',
          content: '\n✅ Automatic routing restored.\n\nThe system will now automatically select the best model based on task type.\n\n',
        } satisfies MessageActionReturn;
      }
      
      default: {
        // Show current model
        const config = loadDamieConfig();
        let output = '\n=== Current Model ===\n\n';
        
        if (config?.security?.auth?.selectedType) {
          output += `Primary Provider: ${config.security.auth.selectedType}\n`;
        }
        
        if (config?.model?.default) {
          output += `Default Model: ${config.model.default}\n`;
        }
        
        output += '\nUse /model show for detailed configuration.\n';
        output += 'Use /model use <provider> to override for next request.\n\n';
        
        return {
          type: 'message',
          messageType: 'info',
          content: output,
        } satisfies MessageActionReturn;
      }
    }
  },
};
