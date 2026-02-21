/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, OpenDialogActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const profileCommand: SlashCommand = {
  name: 'profile',
  description: 'Manage prompt profiles',
  kind: CommandKind.BUILT_IN,
  action: async () => {
    return {
      type: 'dialog',
      dialog: 'profile',
    } satisfies OpenDialogActionReturn;
  },
};
