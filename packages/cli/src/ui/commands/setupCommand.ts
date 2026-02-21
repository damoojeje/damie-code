/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const setupCommand: SlashCommand = {
  name: 'setup',
  description: 'Re-run the setup wizard to change API provider',
  kind: CommandKind.BUILT_IN,
  action: async (context: any) => {
    try {
      // Import dynamically to avoid circular dependencies
      const { runSetupWizard } = await import('../../setup/setupWizard.js');
      
      console.log('\nStarting setup wizard...\n');
      
      const result = await runSetupWizard();
      
      if (result.success) {
        // Reload config if available
        if (context.config?.reload) {
          context.config.reload();
        }
        
        return {
          type: 'message',
          messageType: 'info',
          content: 'Setup complete. Configuration updated. Please restart the application for changes to take effect.',
        } satisfies MessageActionReturn;
      } else {
        return {
          type: 'message',
          messageType: 'error',
          content: `Setup failed: ${result.error || 'Unknown error'}`,
        } satisfies MessageActionReturn;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        type: 'message',
        messageType: 'error',
        content: `Setup wizard error: ${message}`,
      } satisfies MessageActionReturn;
    }
  },
};
