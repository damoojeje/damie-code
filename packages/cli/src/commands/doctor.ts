/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { runDoctorCommand } from './doctorCommand.js';

export const doctorCommand: CommandModule = {
  command: 'doctor',
  describe: 'Run diagnostic checks',
  handler: async () => {
    await runDoctorCommand();
  },
};
