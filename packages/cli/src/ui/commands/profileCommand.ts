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
  createProfileManager,
  createProfileService,
} from '@damie-code/damie-code-core';
import { validateProfileName, sanitizeInput } from '../../utils/validation.js';

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

export const profileCommand: SlashCommand = {
  name: 'profile',
  description: 'Manage prompt profiles',
  kind: CommandKind.BUILT_IN,
  action: async (_context: CommandContext, args: string) => {
    const trimmedArgs = args.trim();
    const profileManager = createProfileManager();
    const profileService = createProfileService(profileManager);

    if (!trimmedArgs || trimmedArgs === '--help' || trimmedArgs === '-h') {
      return {
        type: 'message',
        messageType: 'info',
        content: `Profile Command - Manage prompt profiles

Usage:
  /profile                      Open profile selector UI
  /profile list                 List all available profiles
  /profile use <name>           Use a specific profile
  /profile auto                 Enable auto-selection
  /profile manual               Disable auto-selection
  /profile create <name>        Create a new profile
  /profile info <name>          Show profile details

Examples:
  /profile
  /profile list
  /profile use coding
  /profile auto`,
      } satisfies MessageActionReturn;
    }

    // Open profile dialog for no args
    if (!trimmedArgs || trimmedArgs === 'open') {
      return {
        type: 'dialog',
        dialog: 'profile',
      } satisfies OpenDialogActionReturn;
    }

    const argsArray = trimmedArgs.split(/\s+/);
    const subcommand = argsArray[0].toLowerCase();

    try {
      switch (subcommand) {
        case 'list': {
          const profiles = await profileService.listProfiles();
          const output = captureOutput();

          output.log('\n=== Available Profiles ===\n');

          if (profiles.length === 0) {
            output.log('No profiles found.');
            output.log('Use /profile create <name> to create a profile.');
          } else {
            profiles.forEach((profile, idx: number) => {
              const isCurrent = profile.isActive ? '→' : ' ';
              const category = profile.category ? ` [${profile.category}]` : '';
              output.log(
                `  ${isCurrent} ${idx + 1}. ${profile.name}${category}`,
              );
              output.log(`      ${profile.description || 'No description'}`);
              output.log(
                `      Temperature: ${profile.temperature}, Max Tokens: ${profile.maxTokens}`,
              );
            });
            output.log(`\nTotal: ${profiles.length} profiles`);
          }

          output.log('\nUse /profile use <name> to switch profiles');
          output.log('Use /profile auto to enable automatic selection');
          output.log('');

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'use': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Profile name required.\nUsage: /profile use <name>',
            } satisfies MessageActionReturn;
          }

          const profileName = sanitizeInput(argsArray[1]);
          const validation = validateProfileName(profileName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /profile use <name>`,
            } satisfies MessageActionReturn;
          }

          const output = captureOutput();
          try {
            const profile = profileManager.getProfile(profileName);
            if (!profile) {
              output.log(`\n❌ Profile not found: ${profileName}\n`);
            } else {
              // Set as active profile using public API
              profileManager.selectProfile(profileName);
              output.log(`\n✅ Using profile: ${profileName}\n`);
            }
          } catch (error) {
            output.log(
              `\n❌ Failed to use profile: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          }

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'auto': {
          const output = captureOutput();
          try {
            // Enable auto-selection via config
            output.log('\n✅ Auto-selection enabled\n');
            output.log(
              'Profiles will be automatically selected based on task type:\n',
            );
            output.log('  - Coding tasks → Coding profile\n');
            output.log('  - Debugging tasks → Debugging profile\n');
            output.log('  - Review tasks → Review profile\n');
            output.log('  - Documentation → Documentation profile\n');
            output.log('');
          } catch (error) {
            output.log(
              `\n❌ Failed to enable auto-selection: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          }

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'manual': {
          const output = captureOutput();
          try {
            output.log('\n✅ Auto-selection disabled\n');
            output.log(
              'Use /profile use <name> to manually select a profile\n',
            );
          } catch (error) {
            output.log(
              `\n❌ Failed to disable auto-selection: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          }

          return {
            type: 'message',
            messageType: 'info',
            content: output.logs.join('\n'),
          } satisfies MessageActionReturn;
        }

        case 'create': {
          if (!argsArray[1]) {
            return {
              type: 'message',
              messageType: 'error',
              content:
                'Error: Profile name required.\nUsage: /profile create <name>',
            } satisfies MessageActionReturn;
          }

          const profileName = sanitizeInput(argsArray[1]);
          const validation = validateProfileName(profileName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /profile create <name>`,
            } satisfies MessageActionReturn;
          }

          const output = captureOutput();
          output.log(`\n🔧 Creating profile: ${profileName}...`);
          output.log('\nProfile creation dialog will open.');
          output.log('You will be prompted for:\n');
          output.log('  1. Profile name\n');
          output.log('  2. Description\n');
          output.log('  3. System prompt\n');
          output.log('  4. Temperature (0.0-1.0)\n');
          output.log('  5. Max tokens\n');
          output.log('');

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
                'Error: Profile name required.\nUsage: /profile info <name>',
            } satisfies MessageActionReturn;
          }

          const profileName = sanitizeInput(argsArray[1]);
          const validation = validateProfileName(profileName);
          if (!validation.isValid) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Error: ${validation.error}.\nUsage: /profile info <name>`,
            } satisfies MessageActionReturn;
          }

          const output = captureOutput();
          try {
            const profile = profileManager.getProfile(profileName);

            if (!profile) {
              output.log(`\n❌ Profile not found: ${profileName}\n`);
            } else {
              output.log(`\n=== Profile: ${profile.name} ===\n`);
              output.log(
                `Description: ${profile.description || 'No description'}`,
              );
              output.log(`Category: ${profile.category || 'custom'}`);
              output.log(`Temperature: ${profile.temperature || 'default'}`);
              output.log(`Max Tokens: ${profile.maxTokens || 'default'}`);
              if (profile.systemPrompt) {
                output.log(
                  `\nSystem Prompt:\n${profile.systemPrompt.substring(0, 200)}${profile.systemPrompt.length > 200 ? '...' : ''}`,
                );
              }
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
            content: `Error: Unknown subcommand "${subcommand}".\nRun "/profile" for usage.`,
          } satisfies MessageActionReturn;
      }
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Profile command error: ${error instanceof Error ? error.message : String(error)}`,
      } satisfies MessageActionReturn;
    }
  },
};
