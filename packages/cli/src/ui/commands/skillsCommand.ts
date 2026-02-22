/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, MessageActionReturn, OpenDialogActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { createSkillManager } from '@damie-code/damie-code-core';

export const skillsCommand: SlashCommand = {
  name: 'skills',
  description: 'Manage skills',
  kind: CommandKind.BUILT_IN,
  action: async (_context: any, args: string) => {
    const trimmedArgs = args.trim();
    const skillManager = createSkillManager();

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
          const skills = await skillManager.listSkills();
          
          console.log = captureLog;
          console.log('\n=== Installed Skills ===\n');
          
          if (skills.length === 0) {
            console.log('No skills installed.');
            console.log('Use /skills install <name> to install a skill.');
          } else {
            skills.forEach((skill: any, idx: number) => {
              const status = skill.enabled ? '✓' : '✗';
              console.log(`  ${idx + 1}. ${status} ${skill.name} - ${skill.description}`);
            });
            console.log(`\nTotal: ${skills.length} skills`);
            console.log('\nUse /skills enable <name> to enable a skill');
            console.log('Use /skills disable <name> to disable a skill');
          }
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
          try {
            await skillManager.enableSkill(argsArray[1]);
            console.log = captureLog;
            console.log(`\n✅ Enabled skill: ${argsArray[1]}\n`);
          } catch (error) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to enable skill: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies MessageActionReturn;
          }
          break;

        case 'disable':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Skill name required.\nUsage: /skills disable <name>',
            } satisfies MessageActionReturn;
          }
          try {
            await skillManager.disableSkill(argsArray[1]);
            console.log = captureLog;
            console.log(`\n❌ Disabled skill: ${argsArray[1]}\n`);
          } catch (error) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to disable skill: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies MessageActionReturn;
          }
          break;

        case 'install':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Skill name required.\nUsage: /skills install <name>',
            } satisfies MessageActionReturn;
          }
          try {
            console.log = captureLog;
            console.log(`\n📦 Installing skill: ${argsArray[1]}...`);
            const result = await skillManager.installSkill(argsArray[1]);
            if (result.success) {
              console.log(`✅ Successfully installed: ${argsArray[1]}`);
            } else {
              console.log(`❌ Installation failed: ${result.message}`);
            }
            console.log('');
          } catch (error) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to install skill: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies MessageActionReturn;
          }
          break;

        case 'create':
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Error: Skill name required.\nUsage: /skills create <name>',
            } satisfies MessageActionReturn;
          }
          try {
            console.log = captureLog;
            console.log(`\n🔧 Creating skill: ${argsArray[1]}...`);
            const result = await skillManager.createSkill(argsArray[1]);
            if (result.success) {
              console.log(`✅ Successfully created skill: ${argsArray[1]}`);
              console.log(`Location: ${result.path}`);
            } else {
              console.log(`❌ Creation failed: ${result.message}`);
            }
            console.log('');
          } catch (error) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to create skill: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies MessageActionReturn;
          }
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
