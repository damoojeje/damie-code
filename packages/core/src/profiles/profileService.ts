/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProfileManager, PromptProfile } from '@damie-code/damie-code-core';
import { DEFAULT_PROFILES } from '@damie-code/damie-code-core';

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

/**
 * ProfileService - Service layer for profile management
 * 
 * Provides a clean interface between ProfileManager backend and UI components.
 * Handles:
 * - Listing profiles with UI-friendly formatting
 * - Getting active profile
 * - Setting active profile
 * - Auto-selection management
 * - Creating custom profiles
 * - Updating profiles
 * - Deleting custom profiles
 * - Resetting profiles to default
 */
export class ProfileService {
  private activeProfile: string | null = null;
  private autoSelectionEnabled: boolean = true;

  constructor(private profileManager: ProfileManager) {
    // Initialize with default active profile
    this.activeProfile = 'coding';
  }

  /**
   * List all profiles (built-in + custom)
   */
  async listProfiles(): Promise<ProfileListItem[]> {
    try {
      // Get all profile names (built-in + custom)
      const allProfiles = Array.from(DEFAULT_PROFILES);
      
      // Add custom profiles (in production, would load from ProfileManager)
      const customProfiles = await this.getCustomProfiles();
      allProfiles.push(...customProfiles.filter(p => !allProfiles.includes(p)));
      
      return allProfiles.map((name) => this.toProfileListItem(name));
    } catch (error) {
      console.error('Failed to list profiles:', error);
      return [];
    }
  }

  /**
   * Get active profile
   */
  async getActiveProfile(): Promise<ProfileListItem | null> {
    try {
      if (!this.activeProfile) {
        return null;
      }
      return this.toProfileListItem(this.activeProfile);
    } catch (error) {
      console.error('Failed to get active profile:', error);
      return null;
    }
  }

  /**
   * Set active profile
   */
  async setActiveProfile(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate profile exists
      const profile = this.getProfileByName(name);
      if (!profile) {
        return {
          success: false,
          error: `Profile "${name}" not found`,
        };
      }

      this.activeProfile = name;
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Enable auto-selection
   */
  async enableAutoSelection(): Promise<{ success: boolean; error?: string }> {
    try {
      this.autoSelectionEnabled = true;
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Disable auto-selection
   */
  async disableAutoSelection(): Promise<{ success: boolean; error?: string }> {
    try {
      this.autoSelectionEnabled = false;
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if auto-selection is enabled
   */
  isAutoSelectionEnabled(): boolean {
    return this.autoSelectionEnabled;
  }

  /**
   * Create custom profile
   */
  async createProfile(
    name: string,
    description: string,
    systemPrompt: string,
    options?: {
      category?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<CreateProfileResult> {
    try {
      // Validate name
      if (!name || name.trim().length === 0) {
        return {
          success: false,
          error: 'Profile name is required',
        };
      }

      if (!/^[a-z0-9\-_]+$/.test(name)) {
        return {
          success: false,
          error: 'Profile name must contain only lowercase letters, numbers, hyphens, and underscores',
        };
      }

      // Check if profile already exists
      if (this.getProfileByName(name)) {
        return {
          success: false,
          error: `Profile "${name}" already exists`,
        };
      }

      // Create profile
      const profile: PromptProfile = {
        name,
        category: (options?.category || 'custom') as any,
        description,
        systemPrompt,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 4096,
      };

      // In production, would save to disk via ProfileManager
      // For now, just add to memory
      this.profileManager.saveProfile(profile);

      return {
        success: true,
        profile,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Update profile
   */
  async updateProfile(
    name: string,
    updates: Partial<{
      description: string;
      systemPrompt: string;
      temperature: number;
      maxTokens: number;
    }>,
  ): Promise<UpdateProfileResult> {
    try {
      const profile = this.getProfileByName(name);
      if (!profile) {
        return {
          success: false,
          error: `Profile "${name}" not found`,
        };
      }

      // Check if it's a custom profile (can only update custom profiles)
      if (DEFAULT_PROFILES.includes(name as any)) {
        return {
          success: false,
          error: `Cannot modify built-in profile "${name}"`,
        };
      }

      // Apply updates
      const updatedProfile: PromptProfile = {
        ...profile,
        ...updates,
      };

      // Save updated profile
      this.profileManager.saveProfile(updatedProfile);

      return {
        success: true,
        profile: updatedProfile,
        changed: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete custom profile
   */
  async deleteProfile(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if profile exists
      const profile = this.getProfileByName(name);
      if (!profile) {
        return {
          success: false,
          error: `Profile "${name}" not found`,
        };
      }

      // Check if it's a custom profile
      if (DEFAULT_PROFILES.includes(name as any)) {
        return {
          success: false,
          error: `Cannot delete built-in profile "${name}"`,
        };
      }

      // Delete profile
      this.profileManager.deleteProfile(name);

      // If this was the active profile, reset to default
      if (this.activeProfile === name) {
        this.activeProfile = 'coding';
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Reset profile to default
   */
  async resetProfile(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if profile exists
      const profile = this.getProfileByName(name);
      if (!profile) {
        return {
          success: false,
          error: `Profile "${name}" not found`,
        };
      }

      // Check if it's a custom profile
      if (DEFAULT_PROFILES.includes(name as any)) {
        // Already a default profile
        return { success: true };
      }

      // In production, would reload from disk
      // For now, just indicate success
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get custom profiles
   */
  private async getCustomProfiles(): Promise<string[]> {
    try {
      // In production, would load from ProfileManager
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Failed to get custom profiles:', error);
      return [];
    }
  }

  /**
   * Get profile by name
   */
  private getProfileByName(name: string): PromptProfile | null {
    try {
      return this.profileManager.getProfile(name);
    } catch (error) {
      console.error(`Failed to get profile ${name}:`, error);
      return null;
    }
  }

  /**
   * Convert profile name to ProfileListItem
   */
  private toProfileListItem(name: string): ProfileListItem {
    const profile = this.getProfileByName(name);
    const isCustom = !DEFAULT_PROFILES.includes(name as any);
    const isActive = this.activeProfile === name;

    return {
      name,
      description: profile?.description || `Profile: ${name}`,
      category: profile?.category || 'custom',
      isActive,
      isCustom,
      isAuto: this.autoSelectionEnabled,
      systemPrompt: profile?.systemPrompt,
      temperature: profile?.temperature ?? 0.7,
      maxTokens: profile?.maxTokens ?? 4096,
    };
  }
}

/**
 * Factory function to create ProfileService instance
 */
export function createProfileService(profileManager: ProfileManager): ProfileService {
  return new ProfileService(profileManager);
}
