/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SkillManager,
  InstalledSkill,
  SkillManifest,
  SkillInstallOptions,
  SkillContext,
  SkillExecutionResult,
} from '@damie-code/damie-code-core';
import { SkillStatus, SkillType, BUNDLED_SKILLS } from '@damie-code/damie-code-core';

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

/**
 * SkillService - Service layer for skill management
 * 
 * Provides a clean interface between SkillManager backend and UI components.
 * Handles:
 * - Listing skills with UI-friendly formatting
 * - Installing skills from registry
 * - Enabling/disabling skills
 * - Executing skills
 * - Creating custom skills
 * - Updating/removing skills
 */
export class SkillService {
  constructor(private skillManager: SkillManager) {}

  /**
   * List all skills (installed + bundled)
   */
  async listSkills(): Promise<SkillListItem[]> {
    try {
      const installedSkills = this.skillManager.listSkills();
      
      return installedSkills.map((skill) => this.toSkillListItem(skill));
    } catch (error) {
      console.error('Failed to list skills:', error);
      return [];
    }
  }

  /**
   * Get skill details by name
   */
  async getSkill(name: string): Promise<SkillListItem | null> {
    try {
      const skill = this.skillManager.getSkill(name);
      if (!skill) {
        return null;
      }
      return this.toSkillListItem(skill);
    } catch (error) {
      console.error(`Failed to get skill ${name}:`, error);
      return null;
    }
  }

  /**
   * Install new skill from registry
   */
  async installSkill(
    name: string,
    options?: SkillInstallOptions,
  ): Promise<InstallResult> {
    try {
      // Check if already installed
      if (this.skillManager.isInstalled(name)) {
        return {
          success: false,
          error: `Skill "${name}" is already installed`,
        };
      }

      // Install the skill
      const skill = await this.skillManager.installSkill(name, options);

      return {
        success: true,
        skill,
        warnings: [],
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
   * Enable a skill
   */
  async enableSkill(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.skillManager.isInstalled(name)) {
        return {
          success: false,
          error: `Skill "${name}" is not installed`,
        };
      }

      this.skillManager.enableSkill(name);
      
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
   * Disable a skill
   */
  async disableSkill(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.skillManager.isInstalled(name)) {
        return {
          success: false,
          error: `Skill "${name}" is not installed`,
        };
      }

      this.skillManager.disableSkill(name);
      
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
   * Execute a skill
   */
  async executeSkill(
    name: string,
    context: SkillContext,
  ): Promise<SkillExecutionUIResult> {
    try {
      const skill = this.skillManager.getSkill(name);
      if (!skill) {
        return {
          success: false,
          error: `Skill "${name}" not found`,
          duration: 0,
        };
      }

      if (!skill.enabled) {
        return {
          success: false,
          error: `Skill "${name}" is disabled`,
          duration: 0,
        };
      }

      const startTime = Date.now();
      const result = await this.executeSkillInternal(skill, context);
      const duration = Date.now() - startTime;

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        duration: 0,
      };
    }
  }

  /**
   * Create a new custom skill
   */
  async createSkill(
    name: string,
    description: string,
    template?: 'basic' | 'advanced',
  ): Promise<CreateResult> {
    try {
      // Validate name
      if (!name || name.trim().length === 0) {
        return {
          success: false,
          error: 'Skill name is required',
        };
      }

      if (!/^[a-z0-9\-_]+$/.test(name)) {
        return {
          success: false,
          error: 'Skill name must contain only lowercase letters, numbers, hyphens, and underscores',
        };
      }

      const skillPath = await this.skillManager.createCustomSkill(name, description);

      return {
        success: true,
        skillPath,
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
   * Delete a skill
   */
  async deleteSkill(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const removed = await this.skillManager.removeSkill(name);
      
      if (!removed) {
        return {
          success: false,
          error: `Failed to remove skill "${name}"`,
        };
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
   * Update a skill from registry
   */
  async updateSkill(name: string): Promise<UpdateResult> {
    try {
      const skill = this.skillManager.getSkill(name);
      if (!skill) {
        return {
          success: false,
          error: `Skill "${name}" not found`,
        };
      }

      // Check for updates (in production, would call skills.sh API)
      // For now, assume no updates for bundled skills
      if (skill.type === SkillType.BUNDLED) {
        return {
          success: true,
          skill,
          changed: false,
        };
      }

      // Simulate update check
      return {
        success: true,
        skill,
        changed: false,
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
   * Search for skills in registry
   */
  async searchSkills(query: string): Promise<SkillListItem[]> {
    try {
      const searchResults = await this.skillManager.searchSkills(query);
      
      // Convert search results to list items
      return searchResults.map((result) => ({
        name: result.name,
        description: result.description,
        version: result.version,
        enabled: false,
        type: SkillType.INSTALLED,
        status: SkillStatus.INSTALLED,
        installedAt: new Date(),
        keywords: [],
      }));
    } catch (error) {
      console.error('Failed to search skills:', error);
      return [];
    }
  }

  /**
   * Convert InstalledSkill to SkillListItem
   */
  private toSkillListItem(skill: InstalledSkill): SkillListItem {
    return {
      name: skill.name,
      description: skill.manifest.description,
      version: skill.manifest.version,
      enabled: skill.enabled,
      type: skill.type,
      status: skill.status,
      installedAt: skill.installedAt,
      keywords: skill.manifest.keywords || [],
    };
  }

  /**
   * Execute skill internally (placeholder for actual execution logic)
   */
  private async executeSkillInternal(
    skill: InstalledSkill,
    context: SkillContext,
  ): Promise<SkillExecutionResult> {
    // In production, this would:
    // 1. Load skill handler
    // 2. Execute with context
    // 3. Return result
    
    // For now, return placeholder result
    return {
      success: true,
      output: `Executed skill: ${skill.name}`,
    };
  }
}

/**
 * Factory function to create SkillService instance
 */
export function createSkillService(skillManager: SkillManager): SkillService {
  return new SkillService(skillManager);
}
