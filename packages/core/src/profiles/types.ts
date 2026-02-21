/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Profile category enum
 */
export enum ProfileCategory {
  CODING = 'coding',
  DEBUGGING = 'debugging',
  REVIEW = 'review',
  DOCUMENTATION = 'documentation',
  REFACTORING = 'refactoring',
  TESTING = 'testing',
  ARCHITECTURE = 'architecture',
  CUSTOM = 'custom',
}

/**
 * Profile definition interface
 */
export interface PromptProfile {
  name: string;
  category: ProfileCategory;
  description: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  extends?: string;
  variables?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Profile match result
 */
export interface ProfileMatch {
  profile: PromptProfile;
  score: number;
  reason: string;
}

/**
 * Profile manager configuration
 */
export interface ProfileManagerConfig {
  profilesPath: string;
  autoSelectProfile?: boolean;
  defaultProfile?: string;
}

/**
 * Default profile names
 */
export const DEFAULT_PROFILES = [
  'coding',
  'debugging',
  'review',
  'documentation',
  'refactoring',
] as const;

export type DefaultProfileName = (typeof DEFAULT_PROFILES)[number];

/**
 * Profile list item for UI display
 */
export interface ProfileListItem {
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  isCustom: boolean;
  isAuto: boolean;
  systemPrompt?: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Profile creation result
 */
export interface CreateProfileResult {
  success: boolean;
  profile?: PromptProfile;
  error?: string;
}

/**
 * Profile update result
 */
export interface UpdateProfileResult {
  success: boolean;
  profile?: PromptProfile;
  error?: string;
  changed?: boolean;
}
