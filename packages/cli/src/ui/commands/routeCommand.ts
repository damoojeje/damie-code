/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const routeCommand: SlashCommand = {
  name: 'route',
  description: 'View and configure model routing rules',
  kind: CommandKind.BUILT_IN,
  action: async (_context: any, args: string) => {
    const trimmedArgs = args.trim();
    
    // Import dynamically
    const { listRoutingConfig, showTaskTypes, showRouteDecision } = await import('../../commands/routeCommand.js');
    
    if (!trimmedArgs || trimmedArgs === '--help' || trimmedArgs === '-h') {
      return {
        type: 'message',
        messageType: 'info',
        content: `Route Command - View and configure model routing

Usage:
  /route                    Show routing help
  /route config             Show current routing configuration
  /route types              Show task type examples
  /route <task>             Show routing decision for a task
  /route <task> --provider <name>  Test with provider override
  /route <task> --model <name>     Test with model override

Examples:
  /route config
  /route Write a sorting function
  /route Debug this error --provider anthropic`,
      } satisfies MessageActionReturn;
    }
    
    if (trimmedArgs === 'config') {
      // Capture console output
      const originalLog = console.log;
      let output = '';
      console.log = (...args: any[]) => {
        output += args.join(' ') + '\n';
      };
      
      try {
        listRoutingConfig();
      } finally {
        console.log = originalLog;
      }
      
      return {
        type: 'message',
        messageType: 'info',
        content: output,
      } satisfies MessageActionReturn;
    }
    
    if (trimmedArgs === 'types') {
      const originalLog = console.log;
      let output = '';
      console.log = (...args: any[]) => {
        output += args.join(' ') + '\n';
      };
      
      try {
        showTaskTypes();
      } finally {
        console.log = originalLog;
      }
      
      return {
        type: 'message',
        messageType: 'info',
        content: output,
      } satisfies MessageActionReturn;
    }
    
    // Treat as task description
    const originalLog = console.log;
    let output = '';
    console.log = (...args: any[]) => {
      output += args.join(' ') + '\n';
    };
    
    try {
      // Parse args for --provider and --model flags
      const argsArray = trimmedArgs.split(' ');
      showRouteDecision(argsArray.join(' '));
    } catch (error) {
      console.log = originalLog;
      return {
        type: 'message',
        messageType: 'error',
        content: `Routing failed: ${error instanceof Error ? error.message : String(error)}`,
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
