/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: MIT
 */

// Export types
export type {
  SkillManifest,
  SkillTrigger,
  SkillCommand,
  InstalledSkill,
  SkillSearchResult,
  SkillInstallOptions,
  SkillManagerConfig,
  SkillContext,
  SkillExecutionResult,
  BundledSkillName,
  SkillListItem,
  InstallResult as SkillInstallResult,
  CreateResult as SkillCreateResult,
  UpdateResult as SkillUpdateResult,
  SkillExecutionUIResult,
} from './types.js';

export { SkillStatus, SkillType, BUNDLED_SKILLS } from './types.js';

// Export skill manager
export { SkillManager, createSkillManager } from './skillManager.js';

// Export skill service
export type { SkillService } from './skillService.js';
export { createSkillService } from './skillService.js';
