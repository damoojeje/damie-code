/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { runDoctorCommand as runDoctorCommandImpl } from './configCommands.js';

/**
 * Run diagnostic checks
 */
export async function runDoctorCommand(): Promise<void> {
  await runDoctorCommandImpl();
}
