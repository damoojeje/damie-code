/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, OpenDialogActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const pluginsCommand: SlashCommand = {
  name: 'plugins',
  description: 'Manage plugins',
  kind: CommandKind.BUILT_IN,
  action: async () => {
    return {
      type: 'dialog',
      dialog: 'plugins',
    } satisfies OpenDialogActionReturn;
  },
};
