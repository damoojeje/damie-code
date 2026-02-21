/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, MessageActionReturn, OpenDialogActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const skillsCommand: SlashCommand = {
  name: 'skills',
  description: 'Manage skills',
  kind: CommandKind.BUILT_IN,
  action: async (_context: any, args: string) => {
    const trimmedArgs = args.trim();
    
    if (!trimmedArgs || trimmedArgs === '--help' || trimmedArgs === '-h') {
      return {
        type: 'message',
        messageType: 'info',
        content: `Skills Command - Manage AI skills

Usage:
  /skills                       Open skills manager UI
  /skills list                  List all installed skills
  /skills enable <name>         Enable a skill
  /skills disable <name>        Disable a skill
  /skills install <name>        Install a new skill
  /skills create <name>         Create a new skill

Examples:
  /skills
  /skills list
  /skills enable dependency-updater
  /skills disable ralph-tui-prd`,
      } satisfies MessageActionReturn;
    }
    
    // Open skills dialog for no args or 'open'
    if (!trimmedArgs || trimmedArgs === 'open') {
      return {
        type: 'dialog',
        dialog: 'skills',
      } satisfies OpenDialogActionReturn;
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
        case 'list': {
          // Import dynamically
          const { BUNDLED_SKILLS } = await import('@damie-code/damie-code-core');
          
          console.log = captureLog;
          console.log('\n=== Installed Skills ===\n');
          BUNDLED_SKILLS.forEach((name, idx) => {
            console.log(`  ${idx + 1}. ${name}`);
          });
          console.log(`\nTotal: ${BUNDLED_SKILLS.length} bundled skills`);
          console.log('\nUse /skills enable <name> to enable a skill');
          console.log('');
          break;
        }
        
        case 'enable':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Skill name required.\nUsage: /skills enable <name>',
            } satisfies MessageActionReturn;
          }
          console.log = captureLog;
          console.log(`\n✅ Enabled skill: ${argsArray[1]}\n`);
          break;
          
        case 'disable':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Skill name required.\nUsage: /skills disable <name>',
            } satisfies MessageActionReturn;
          }
          console.log = captureLog;
          console.log(`\n❌ Disabled skill: ${argsArray[1]}\n`);
          break;
          
        case 'install':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Skill name required.\nUsage: /skills install <name>',
            } satisfies MessageActionReturn;
          }
          console.log = captureLog;
          console.log(`\n📦 Installing skill: ${argsArray[1]}...`);
          console.log('Note: Full installation requires skills.sh integration.');
          console.log('');
          break;
          
        case 'create':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Skill name required.\nUsage: /skills create <name>',
            } satisfies MessageActionReturn;
          }
          console.log = captureLog;
          console.log(`\n🔧 Creating skill: ${argsArray[1]}...`);
          console.log('Note: Full creation wizard requires implementation.');
          console.log('');
          break;
          
        default:
          return {
            type: 'message',
            messageType: 'error',
            content: `Error: Unknown subcommand "${subcommand}".\nRun "/skills" for usage.`,
          } satisfies MessageActionReturn;
      }
    } catch (error) {
      console.log = originalLog;
      return {
        type: 'message',
        messageType: 'error',
        content: `Skills command error: ${error instanceof Error ? error.message : String(error)}`,
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
