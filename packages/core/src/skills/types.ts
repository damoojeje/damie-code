/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Skill status enum
 */
export enum SkillStatus {
  INSTALLED = 'installed',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ERROR = 'error',
  UPDATING = 'updating',
}

/**
 * Skill type enum
 */
export enum SkillType {
  BUNDLED = 'bundled',
  INSTALLED = 'installed',
  LOCAL = 'local',
  CUSTOM = 'custom',
}

/**
 * Skill manifest interface
 */
export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  repository?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  main?: string;
  triggers?: SkillTrigger[];
  commands?: SkillCommand[];
}

/**
 * Skill trigger definition
 */
export interface SkillTrigger {
  pattern: string | RegExp;
  description?: string;
  priority?: number;
}

/**
 * Skill command definition
 */
export interface SkillCommand {
  name: string;
  description: string;
  usage?: string;
  examples?: string[];
  handler?: string;
}

/**
 * Installed skill info
 */
export interface InstalledSkill {
  name: string;
  manifest: SkillManifest;
  type: SkillType;
  status: SkillStatus;
  path: string;
  installedAt: Date;
  updatedAt?: Date;
  enabled: boolean;
  error?: string;
}

/**
 * Skill search result from skills.sh
 */
export interface SkillSearchResult {
  name: string;
  description: string;
  version: string;
  author?: string;
  downloads?: number;
  stars?: number;
  url: string;
}

/**
 * Skill installation options
 */
export interface SkillInstallOptions {
  force?: boolean;
  version?: string;
  skipValidation?: boolean;
  source?: 'skills.sh' | 'github' | 'local';
}

/**
 * Skill manager configuration
 */
export interface SkillManagerConfig {
  skillsPath: string;
  registryUrl?: string;
  autoUpdate?: boolean;
  autoUpdateInterval?: number;
}

/**
 * Skill execution context
 */
export interface SkillContext {
  workingDirectory: string;
  projectType?: string;
  args?: Record<string, unknown>;
  env?: Record<string, string>;
}

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

/**
 * Pre-bundled skills list
 */
export const BUNDLED_SKILLS = [
  'dependency-updater',
  'expo-tailwind-setup',
  'find-skills',
  'frontend-design',
  'get-shit-done-skills',
  'rag-implementation',
  'ralph-tui-prd',
  'ui-ux-pro-max',
  'vercel-react-best-practices',
  'web-artifacts-builder',
  'web-design-guidelines',
] as const;

export type BundledSkillName = (typeof BUNDLED_SKILLS)[number];

/**
 * Skill list item for UI display
 */
export interface SkillListItem {
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  type: SkillType;
  status: SkillStatus;
  installedAt: Date;
  keywords: string[];
}

/**
 * Skill installation result
 */
export interface InstallResult {
  success: boolean;
  skill?: InstalledSkill;
  error?: string;
  warnings?: string[];
}

/**
 * Skill creation result
 */
export interface CreateResult {
  success: boolean;
  skillPath?: string;
  error?: string;
}

/**
 * Skill update result
 */
export interface UpdateResult {
  success: boolean;
  skill?: InstalledSkill;
  error?: string;
  changed?: boolean;
}

/**
 * Skill execution result with UI-friendly format
 */
export interface SkillExecutionUIResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}
