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
  createSkillManager,
  type InstalledSkill,
} from '@damie-code/damie-code-core';
import { validateSkillName, sanitizeInput } from '../../utils/validation.js';

/**
 * Helper function to capture console output safely without mutating global console
 */
function captureConsoleOutput<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; output: string }> {
  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    const originalLog = console.log;

    const captureLog = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };

    console.log = captureLog;

    fn()
      .then((result) => {
        console.log = originalLog;
        resolve({ result, output: logs.join('\n') });
      })
      .catch((error: unknown) => {
        console.log = originalLog;
        reject(error);
      });
  });
}

export const skillsCommand: SlashCommand = {
  name: 'skills',
  description: 'Manage skills',
  kind: CommandKind.BUILT_IN,
  action: async (_context: CommandContext, args: string) => {
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

    try {
      switch (subcommand) {
        case 'list': {
          const { output } = await captureConsoleOutput(async () => {
            const skills = await skillManager.listSkills();

            console.log('\n=== Installed Skills ===\n');

            if (skills.length === 0) {
              console.log('No skills installed.');
              console.log('Use /skills install <name> to install a skill.');
            } else {
              skills.forEach((skill: InstalledSkill, idx: number) => {
                const status = skill.enabled ? '✓' : '✗';
                console.log(
                  `  ${idx + 1}. ${status} ${skill.name} - ${skill.manifest.description}`,
                );
              });
              console.log(`\nTotal: ${skills.length} skills`);
              console.log('\nUse /skills enable <name> to enable a skill');
              console.log('Use /skills disable <name> to disable a skill');
            }
            console.log('');
          });

          return {
            type: 'message',
            messageType: 'info',
            content: output,
          } satisfies MessageActionReturn;
        }

        case 'enable': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Skill name required.\nUsage: /skills enable <name>',
            } satisfies MessageActionReturn;
          }

          const skillName = sanitizeInput(argsArray[1]);
          const validation = validateSkillName(skillName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /skills enable <name>`,
            } satisfies MessageActionReturn;
          }

          try {
            const { output } = await captureConsoleOutput(async () => {
              await skillManager.enableSkill(skillName);
              console.log(`\n✅ Enabled skill: ${skillName}\n`);
            });

            return {
              type: 'message',
              messageType: 'info',
              content: output,
            } satisfies MessageActionReturn;
          } catch (error) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to enable skill: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies MessageActionReturn;
          }
        }

        case 'disable': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Skill name required.\nUsage: /skills disable <name>',
            } satisfies MessageActionReturn;
          }

          const skillName = sanitizeInput(argsArray[1]);
          const validation = validateSkillName(skillName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /skills disable <name>`,
            } satisfies MessageActionReturn;
          }

          try {
            const { output } = await captureConsoleOutput(async () => {
              await skillManager.disableSkill(skillName);
              console.log(`\n❌ Disabled skill: ${skillName}\n`);
            });

            return {
              type: 'message',
              messageType: 'info',
              content: output,
            } satisfies MessageActionReturn;
          } catch (error) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to disable skill: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies MessageActionReturn;
          }
        }

        case 'install': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Skill name required.\nUsage: /skills install <name>',
            } satisfies MessageActionReturn;
          }

          const skillName = sanitizeInput(argsArray[1]);
          const validation = validateSkillName(skillName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /skills install <name>`,
            } satisfies MessageActionReturn;
          }

          try {
            const { output } = await captureConsoleOutput(async () => {
              console.log(`\n📦 Installing skill: ${skillName}...`);
              const skill = await skillManager.installSkill(skillName);
              console.log(`✅ Successfully installed: ${skill.name}`);
              console.log(`Location: ${skill.path}`);
              console.log('');
            });

            return {
              type: 'message',
              messageType: 'info',
              content: output,
            } satisfies MessageActionReturn;
          } catch (error) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to install skill: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies MessageActionReturn;
          }
        }

        case 'create': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Skill name required.\nUsage: /skills create <name>',
            } satisfies MessageActionReturn;
          }

          const skillName = sanitizeInput(argsArray[1]);
          const validation = validateSkillName(skillName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /skills create <name>`,
            } satisfies MessageActionReturn;
          }

          try {
            const { output } = await captureConsoleOutput(async () => {
              console.log(`\n🔧 Creating skill: ${skillName}...`);
              const skillPath = await skillManager.createSkill(skillName);
              console.log(`✅ Successfully created skill: ${skillName}`);
              console.log(`Location: ${skillPath}`);
              console.log('');
            });

            return {
              type: 'message',
              messageType: 'info',
              content: output,
            } satisfies MessageActionReturn;
          } catch (error) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to create skill: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies MessageActionReturn;
          }
        }

        default:
          return {
            type: 'message',
            messageType: 'error',
            content: `Error: Unknown subcommand "${subcommand}".\nRun "/skills" for usage.`,
          } satisfies MessageActionReturn;
      }
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Skills command error: ${error instanceof Error ? error.message : String(error)}`,
      } satisfies MessageActionReturn;
    }
  },
};
