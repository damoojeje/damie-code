/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: MIT
 */

// Export types
export type {
  PromptProfile,
  ProfileMatch,
  ProfileManagerConfig,
  DefaultProfileName,
  ProfileListItem,
  CreateProfileResult,
  UpdateProfileResult,
} from './types.js';

export { ProfileCategory, DEFAULT_PROFILES } from './types.js';

// Export profile manager
export { ProfileManager, createProfileManager } from './profileManager.js';

// Export profile service
export type { ProfileService } from './profileService.js';
export { createProfileService } from './profileService.js';
