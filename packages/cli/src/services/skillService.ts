/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: MIT
 */

import { createSkillManager, createSkillService } from '@damie-code/damie-code-core';
import type { SkillService, SkillListItem } from '@damie-code/damie-code-core';

let skillServiceInstance: SkillService | null = null;

/**
 * Get or create the SkillService singleton
 */
export function getSkillService(): SkillService {
  if (!skillServiceInstance) {
    const skillManager = createSkillManager();
    skillServiceInstance = createSkillService(skillManager);
  }
  return skillServiceInstance;
}

export type { SkillService, SkillListItem };
