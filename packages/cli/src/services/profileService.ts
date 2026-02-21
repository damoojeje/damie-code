/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: MIT
 */

import { createProfileManager, createProfileService } from '@damie-code/damie-code-core';
import type { ProfileService, ProfileListItem } from '@damie-code/damie-code-core';

let profileServiceInstance: ProfileService | null = null;

/**
 * Get or create the ProfileService singleton
 */
export function getProfileService(): ProfileService {
  if (!profileServiceInstance) {
    const profileManager = createProfileManager();
    profileServiceInstance = createProfileService(profileManager);
  }
  return profileServiceInstance;
}

export type { ProfileService, ProfileListItem };
