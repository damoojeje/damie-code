/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yaml from 'yaml';
import {
  type PromptProfile,
  type ProfileMatch,
  type ProfileManagerConfig,
  ProfileCategory,
  DEFAULT_PROFILES,
} from './types.js';

/**
 * Default system prompts for built-in profiles
 */
const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  coding: `You are an expert software developer. Focus on writing clean, efficient, and well-documented code.
Follow best practices for the language and framework being used.
Consider edge cases and error handling.
Write code that is easy to maintain and extend.`,

  debugging: `You are an expert debugger. Analyze the problem systematically.
1. Understand the expected behavior
2. Identify the actual behavior
3. Locate the source of the discrepancy
4. Propose and verify fixes
Use logging, breakpoints, and step-through debugging strategies when helpful.`,

  review: `You are a code reviewer focused on quality and best practices.
Check for:
- Code correctness and logic errors
- Security vulnerabilities
- Performance issues
- Code style and consistency
- Test coverage
- Documentation
Provide constructive feedback with specific suggestions.`,

  documentation: `You are a technical writer creating clear documentation.
Write documentation that is:
- Clear and concise
- Well-structured with headings
- Includes code examples
- Covers edge cases
- Appropriate for the target audience
Use proper markdown formatting.`,

  refactoring: `You are a refactoring expert improving code quality.
Focus on:
- Simplifying complex logic
- Reducing code duplication
- Improving naming and readability
- Extracting reusable components
- Following design patterns
Preserve existing functionality while improving structure.`,
};

/**
 * ProfileManager - Manages prompt profiles for different task types
 *
 * Provides:
 * - Built-in profiles for common tasks
 * - Custom profile creation
 * - Profile inheritance
 * - Auto-selection based on task
 */
export class ProfileManager {
  private config: ProfileManagerConfig;
  private profiles: Map<string, PromptProfile> = new Map();
  constructor(config?: Partial<ProfileManagerConfig>) {
    const defaultProfilesPath = path.join(os.homedir(), '.damie', 'profiles');

    this.config = {
      profilesPath: config?.profilesPath ?? defaultProfilesPath,
      autoSelectProfile: config?.autoSelectProfile ?? true,
      defaultProfile: config?.defaultProfile ?? 'coding',
    };

    this.ensureProfilesDirectory();
    this.loadDefaultProfiles();
    this.loadCustomProfiles();
  }

  /**
   * Ensure profiles directory exists
   */
  private ensureProfilesDirectory(): void {
    if (!fs.existsSync(this.config.profilesPath)) {
      fs.mkdirSync(this.config.profilesPath, { recursive: true });
    }
  }

  /**
   * Load built-in default profiles
   */
  private loadDefaultProfiles(): void {
    for (const name of DEFAULT_PROFILES) {
      const profile: PromptProfile = {
        name,
        category: name as ProfileCategory,
        description: `Default ${name} profile`,
        systemPrompt: DEFAULT_SYSTEM_PROMPTS[name] || '',
        temperature: this.getDefaultTemperature(name),
        maxTokens: 4096,
      };

      this.profiles.set(name, profile);
    }
  }

  /**
   * Get default temperature for profile type
   */
  private getDefaultTemperature(name: string): number {
    switch (name) {
      case 'coding':
        return 0.3;
      case 'debugging':
        return 0.2;
      case 'review':
        return 0.3;
      case 'documentation':
        return 0.5;
      case 'refactoring':
        return 0.3;
      default:
        return 0.7;
    }
  }

  /**
   * Load custom profiles from disk
   */
  private loadCustomProfiles(): void {
    if (!fs.existsSync(this.config.profilesPath)) {
      return;
    }

    const files = fs.readdirSync(this.config.profilesPath);

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const filePath = path.join(this.config.profilesPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const profile: PromptProfile = yaml.parse(content);

          if (profile.name) {
            // Handle inheritance
            if (profile.extends) {
              this.applyInheritance(profile);
            }
            this.profiles.set(profile.name, profile);
          }
        } catch (error) {
          console.error(`Failed to load profile from ${filePath}:`, error);
        }
      }
    }
  }

  /**
   * Apply inheritance from parent profile
   */
  private applyInheritance(profile: PromptProfile): void {
    if (!profile.extends) return;

    const parent = this.profiles.get(profile.extends);
    if (!parent) {
      console.warn(`Parent profile "${profile.extends}" not found`);
      return;
    }

    // Merge parent values with child (child takes precedence)
    profile.systemPrompt = profile.systemPrompt || parent.systemPrompt;
    profile.temperature = profile.temperature ?? parent.temperature;
    profile.maxTokens = profile.maxTokens ?? parent.maxTokens;
    profile.topP = profile.topP ?? parent.topP;
    profile.topK = profile.topK ?? parent.topK;
    profile.frequencyPenalty =
      profile.frequencyPenalty ?? parent.frequencyPenalty;
    profile.presencePenalty = profile.presencePenalty ?? parent.presencePenalty;
    profile.stopSequences = profile.stopSequences ?? parent.stopSequences;
    profile.variables = { ...parent.variables, ...profile.variables };
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): PromptProfile[] {
    return Array.from(this.profiles.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Get a specific profile
   */
  getProfile(name: string): PromptProfile | undefined {
    return this.profiles.get(name);
  }

  /**
   * Get default profile
   */
  getDefaultProfile(): PromptProfile | undefined {
    return this.profiles.get(this.config.defaultProfile || 'coding');
  }

  /**
   * Set default profile
   */
  setDefaultProfile(name: string): boolean {
    if (!this.profiles.has(name)) {
      return false;
    }
    this.config.defaultProfile = name;
    return true;
  }

  /**
   * Auto-select profile based on task description
   */
  selectProfile(task: string): ProfileMatch {
    const taskLower = task.toLowerCase();

    // Score each profile based on keyword matches
    const matches: ProfileMatch[] = [];

    for (const profile of this.profiles.values()) {
      const score = this.scoreProfileMatch(taskLower, profile);
      if (score > 0) {
        matches.push({
          profile,
          score,
          reason: this.getMatchReason(taskLower, profile),
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Return best match or default
    if (matches.length > 0) {
      return matches[0];
    }

    const defaultProfile = this.getDefaultProfile()!;
    return {
      profile: defaultProfile,
      score: 0,
      reason: 'No specific match, using default profile',
    };
  }

  /**
   * Score how well a profile matches a task
   */
  private scoreProfileMatch(task: string, profile: PromptProfile): number {
    let score = 0;

    // Check category keywords
    const categoryKeywords: Record<ProfileCategory, string[]> = {
      [ProfileCategory.CODING]: [
        'implement',
        'create',
        'build',
        'add',
        'write',
        'code',
        'function',
        'class',
      ],
      [ProfileCategory.DEBUGGING]: [
        'debug',
        'fix',
        'error',
        'bug',
        'issue',
        'broken',
        'crash',
        'fails',
      ],
      [ProfileCategory.REVIEW]: [
        'review',
        'check',
        'audit',
        'examine',
        'analyze',
        'feedback',
      ],
      [ProfileCategory.DOCUMENTATION]: [
        'document',
        'readme',
        'docs',
        'explain',
        'describe',
        'comment',
      ],
      [ProfileCategory.REFACTORING]: [
        'refactor',
        'improve',
        'clean',
        'simplify',
        'optimize',
        'restructure',
      ],
      [ProfileCategory.TESTING]: [
        'test',
        'spec',
        'coverage',
        'unit',
        'integration',
        'e2e',
      ],
      [ProfileCategory.ARCHITECTURE]: [
        'architecture',
        'design',
        'structure',
        'pattern',
        'system',
      ],
      [ProfileCategory.CUSTOM]: [],
    };

    const keywords = categoryKeywords[profile.category] || [];
    for (const keyword of keywords) {
      if (task.includes(keyword)) {
        score += 10;
      }
    }

    // Check profile name match
    if (task.includes(profile.name)) {
      score += 20;
    }

    return score;
  }

  /**
   * Get reason for profile match
   */
  private getMatchReason(task: string, profile: PromptProfile): string {
    if (task.includes(profile.name)) {
      return `Task mentions "${profile.name}"`;
    }

    const categoryWords: Record<ProfileCategory, string> = {
      [ProfileCategory.CODING]: 'coding keywords',
      [ProfileCategory.DEBUGGING]: 'debugging keywords',
      [ProfileCategory.REVIEW]: 'review keywords',
      [ProfileCategory.DOCUMENTATION]: 'documentation keywords',
      [ProfileCategory.REFACTORING]: 'refactoring keywords',
      [ProfileCategory.TESTING]: 'testing keywords',
      [ProfileCategory.ARCHITECTURE]: 'architecture keywords',
      [ProfileCategory.CUSTOM]: 'custom keywords',
    };

    return `Task contains ${categoryWords[profile.category] || 'matching keywords'}`;
  }

  /**
   * Create a new custom profile
   */
  createProfile(profile: PromptProfile): void {
    if (this.profiles.has(profile.name)) {
      throw new Error(`Profile "${profile.name}" already exists`);
    }

    // Ensure category is set
    if (!profile.category) {
      profile.category = ProfileCategory.CUSTOM;
    }

    this.profiles.set(profile.name, profile);
    this.saveProfile(profile);
  }

  /**
   * Update an existing profile
   */
  updateProfile(name: string, updates: Partial<PromptProfile>): boolean {
    const profile = this.profiles.get(name);
    if (!profile) {
      return false;
    }

    const updated = { ...profile, ...updates, name };
    this.profiles.set(name, updated);
    this.saveProfile(updated);
    return true;
  }

  /**
   * Save profile to disk
   */
  private saveProfile(profile: PromptProfile): void {
    const filePath = path.join(this.config.profilesPath, `${profile.name}.yaml`);
    const content = yaml.stringify(profile);
    fs.writeFileSync(filePath, content);
  }

  /**
   * Delete a custom profile
   */
  deleteProfile(name: string): boolean {
    // Don't allow deleting default profiles
    if (DEFAULT_PROFILES.includes(name as (typeof DEFAULT_PROFILES)[number])) {
      throw new Error('Cannot delete default profiles');
    }

    const profile = this.profiles.get(name);
    if (!profile) {
      return false;
    }

    this.profiles.delete(name);

    const filePath = path.join(this.config.profilesPath, `${name}.yaml`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return true;
  }

  /**
   * Get profiles by category
   */
  getProfilesByCategory(category: ProfileCategory): PromptProfile[] {
    return Array.from(this.profiles.values()).filter(
      (p) => p.category === category
    );
  }

  /**
   * Check if profile exists
   */
  hasProfile(name: string): boolean {
    return this.profiles.has(name);
  }

  /**
   * Get profile count
   */
  getProfileCount(): number {
    return this.profiles.size;
  }

  /**
   * Get expanded system prompt with variables
   */
  getExpandedSystemPrompt(
    profile: PromptProfile,
    variables?: Record<string, string>
  ): string {
    let prompt = profile.systemPrompt;

    const allVariables = { ...profile.variables, ...variables };

    for (const [key, value] of Object.entries(allVariables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      prompt = prompt.replace(pattern, value);
    }

    return prompt;
  }

  /**
   * Export profile to YAML string
   */
  exportProfile(name: string): string | undefined {
    const profile = this.profiles.get(name);
    if (!profile) {
      return undefined;
    }
    return yaml.stringify(profile);
  }

  /**
   * Import profile from YAML string
   */
  importProfile(yamlContent: string): PromptProfile {
    const profile: PromptProfile = yaml.parse(yamlContent);

    if (!profile.name) {
      throw new Error('Profile must have a name');
    }

    if (!profile.category) {
      profile.category = ProfileCategory.CUSTOM;
    }

    this.profiles.set(profile.name, profile);
    this.saveProfile(profile);

    return profile;
  }
}

/**
 * Factory function to create ProfileManager
 */
export function createProfileManager(
  config?: Partial<ProfileManagerConfig>
): ProfileManager {
  return new ProfileManager(config);
}
