/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  MessageActionReturn,
  CommandContext,
} from './types.js';
import { CommandKind } from './types.js';

export const configureCommand: SlashCommand = {
  name: 'configure',
  description: 'Re-run configuration wizard to change API provider or settings',
  kind: CommandKind.BUILT_IN,
  action: async (_context: CommandContext) => {
    try {
      // Import dynamically to avoid circular dependencies
      const { runSetupWizard } = await import('../setup/setupWizard.js');

      console.log('\n🔧 Starting configuration wizard...\n');

      const result = await runSetupWizard();

      if (result.success) {
        return {
          type: 'message',
          messageType: 'info',
          content:
            '✅ Configuration complete! Your settings have been updated.\n\nNote: Some changes may require restarting Damie Code to take effect.',
        } satisfies MessageActionReturn;
      } else {
        return {
          type: 'message',
          messageType: 'error',
          content: `❌ Configuration failed: ${result.error || 'Unknown error'}`,
        } satisfies MessageActionReturn;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        type: 'message',
        messageType: 'error',
        content: `Configuration error: ${message}`,
      } satisfies MessageActionReturn;
    }
  },
};
