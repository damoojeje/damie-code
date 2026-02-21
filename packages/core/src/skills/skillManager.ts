/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  type SkillManifest,
  type InstalledSkill,
  type SkillSearchResult,
  type SkillInstallOptions,
  type SkillManagerConfig,
  type SkillContext,
  type SkillExecutionResult,
  SkillStatus,
  SkillType,
  BUNDLED_SKILLS,
} from './types.js';

/**
 * Default skills.sh registry URL
 */
const DEFAULT_REGISTRY_URL = 'https://skills.sh/api/v1';

/**
 * SkillManager - Manages skill installation, updates, and execution
 *
 * Provides:
 * - Pre-bundled skills installation
 * - Skills.sh integration for installing new skills
 * - Custom skill creation and linking
 * - Skill lifecycle management
 */
export class SkillManager {
  private config: SkillManagerConfig;
  private skills: Map<string, InstalledSkill> = new Map();
  constructor(config?: Partial<SkillManagerConfig>) {
    const defaultSkillsPath = path.join(os.homedir(), '.damie', 'skills');

    this.config = {
      skillsPath: config?.skillsPath ?? defaultSkillsPath,
      registryUrl: config?.registryUrl ?? DEFAULT_REGISTRY_URL,
      autoUpdate: config?.autoUpdate ?? false,
      autoUpdateInterval: config?.autoUpdateInterval ?? 86400000, // 24 hours
    };

    this.ensureSkillsDirectory();
    this.loadInstalledSkills();
  }

  /**
   * Ensure skills directory exists
   */
  private ensureSkillsDirectory(): void {
    if (!fs.existsSync(this.config.skillsPath)) {
      fs.mkdirSync(this.config.skillsPath, { recursive: true });
    }
  }

  /**
   * Load all installed skills from disk
   */
  private loadInstalledSkills(): void {
    this.skills.clear();

    if (!fs.existsSync(this.config.skillsPath)) {
      return;
    }

    const entries = fs.readdirSync(this.config.skillsPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(this.config.skillsPath, entry.name);
        const manifestPath = path.join(skillPath, 'manifest.json');

        if (fs.existsSync(manifestPath)) {
          try {
            const manifestData = fs.readFileSync(manifestPath, 'utf-8');
            const manifest: SkillManifest = JSON.parse(manifestData);

            const skill: InstalledSkill = {
              name: manifest.name,
              manifest,
              type: this.isBundledSkill(manifest.name)
                ? SkillType.BUNDLED
                : SkillType.INSTALLED,
              status: SkillStatus.INSTALLED,
              path: skillPath,
              installedAt: this.getFileCreationTime(manifestPath),
              enabled: true,
            };

            this.skills.set(manifest.name, skill);
          } catch (error) {
            console.error(`Failed to load skill from ${skillPath}:`, error);
          }
        }
      }
    }
  }

  /**
   * Check if a skill is a bundled skill
   */
  private isBundledSkill(name: string): boolean {
    return BUNDLED_SKILLS.includes(name as (typeof BUNDLED_SKILLS)[number]);
  }

  /**
   * Get file creation time
   */
  private getFileCreationTime(filePath: string): Date {
    try {
      const stats = fs.statSync(filePath);
      return stats.birthtime;
    } catch {
      return new Date();
    }
  }

  /**
   * Install bundled skills
   */
  async installBundledSkills(): Promise<void> {
    for (const skillName of BUNDLED_SKILLS) {
      if (!this.skills.has(skillName)) {
        await this.createBundledSkillPlaceholder(skillName);
      }
    }
  }

  /**
   * Create a placeholder for bundled skills
   */
  private async createBundledSkillPlaceholder(name: string): Promise<void> {
    const skillPath = path.join(this.config.skillsPath, name);

    if (!fs.existsSync(skillPath)) {
      fs.mkdirSync(skillPath, { recursive: true });
    }

    const manifest: SkillManifest = {
      name,
      version: '1.0.0',
      description: `Bundled skill: ${name}`,
      keywords: ['bundled'],
    };

    fs.writeFileSync(
      path.join(skillPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    const skill: InstalledSkill = {
      name,
      manifest,
      type: SkillType.BUNDLED,
      status: SkillStatus.INSTALLED,
      path: skillPath,
      installedAt: new Date(),
      enabled: true,
    };

    this.skills.set(name, skill);
  }

  /**
   * List all installed skills
   */
  listSkills(): InstalledSkill[] {
    return Array.from(this.skills.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Get a specific skill by name
   */
  getSkill(name: string): InstalledSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * Check if a skill is installed
   */
  isInstalled(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Search for skills in the registry
   */
  async searchSkills(query: string): Promise<SkillSearchResult[]> {
    // Simulate search results for now
    // In production, this would call skills.sh API
    const mockResults: SkillSearchResult[] = [];

    for (const bundledName of BUNDLED_SKILLS) {
      if (bundledName.includes(query.toLowerCase())) {
        mockResults.push({
          name: bundledName,
          description: `Bundled skill: ${bundledName}`,
          version: '1.0.0',
          url: `https://skills.sh/skills/${bundledName}`,
        });
      }
    }

    return mockResults;
  }

  /**
   * Install a skill from skills.sh or GitHub
   */
  async installSkill(
    nameOrUrl: string,
    options?: SkillInstallOptions
  ): Promise<InstalledSkill> {
    const skillName = this.parseSkillName(nameOrUrl);

    // Check if already installed
    if (this.skills.has(skillName) && !options?.force) {
      throw new Error(`Skill "${skillName}" is already installed`);
    }

    // For now, create a placeholder
    // In production, this would download from skills.sh
    const skillPath = path.join(this.config.skillsPath, skillName);

    if (!fs.existsSync(skillPath)) {
      fs.mkdirSync(skillPath, { recursive: true });
    }

    const manifest: SkillManifest = {
      name: skillName,
      version: options?.version ?? '1.0.0',
      description: `Installed skill: ${skillName}`,
    };

    fs.writeFileSync(
      path.join(skillPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    const skill: InstalledSkill = {
      name: skillName,
      manifest,
      type: options?.source === 'local' ? SkillType.LOCAL : SkillType.INSTALLED,
      status: SkillStatus.INSTALLED,
      path: skillPath,
      installedAt: new Date(),
      enabled: true,
    };

    this.skills.set(skillName, skill);
    return skill;
  }

  /**
   * Parse skill name from URL or name
   */
  private parseSkillName(nameOrUrl: string): string {
    // Handle GitHub URLs like "vercel-labs/agent-skills"
    if (nameOrUrl.includes('/')) {
      const parts = nameOrUrl.split('/');
      return parts[parts.length - 1];
    }
    return nameOrUrl;
  }

  /**
   * Remove a skill
   */
  async removeSkill(name: string): Promise<boolean> {
    const skill = this.skills.get(name);

    if (!skill) {
      return false;
    }

    // Don't allow removing bundled skills
    if (skill.type === SkillType.BUNDLED) {
      throw new Error('Cannot remove bundled skills');
    }

    try {
      fs.rmSync(skill.path, { recursive: true, force: true });
      this.skills.delete(name);
      return true;
    } catch (error) {
      console.error(`Failed to remove skill ${name}:`, error);
      return false;
    }
  }

  /**
   * Enable a skill
   */
  enableSkill(name: string): boolean {
    const skill = this.skills.get(name);

    if (!skill) {
      return false;
    }

    skill.enabled = true;
    skill.status = SkillStatus.ENABLED;
    return true;
  }

  /**
   * Disable a skill
   */
  disableSkill(name: string): boolean {
    const skill = this.skills.get(name);

    if (!skill) {
      return false;
    }

    skill.enabled = false;
    skill.status = SkillStatus.DISABLED;
    return true;
  }

  /**
   * Update all skills
   */
  async updateAllSkills(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, skill] of this.skills) {
      if (skill.type !== SkillType.LOCAL) {
        try {
          await this.updateSkill(name);
          results.set(name, true);
        } catch {
          results.set(name, false);
        }
      }
    }

    return results;
  }

  /**
   * Update a specific skill
   */
  async updateSkill(name: string): Promise<InstalledSkill> {
    const skill = this.skills.get(name);

    if (!skill) {
      throw new Error(`Skill "${name}" is not installed`);
    }

    skill.status = SkillStatus.UPDATING;
    skill.updatedAt = new Date();
    skill.status = SkillStatus.INSTALLED;

    return skill;
  }

  /**
   * Create a new custom skill
   */
  async createSkill(name: string, _template?: string): Promise<string> {
    const skillPath = path.join(this.config.skillsPath, name);

    if (fs.existsSync(skillPath)) {
      throw new Error(`Skill "${name}" already exists`);
    }

    fs.mkdirSync(skillPath, { recursive: true });

    // Create manifest
    const manifest: SkillManifest = {
      name,
      version: '1.0.0',
      description: `Custom skill: ${name}`,
      author: os.userInfo().username,
      triggers: [
        {
          pattern: name,
          description: `Trigger ${name} skill`,
        },
      ],
      commands: [
        {
          name: 'run',
          description: `Run the ${name} skill`,
          usage: `damie skill ${name} run`,
        },
      ],
    };

    fs.writeFileSync(
      path.join(skillPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create skill file
    const skillContent = `/**
 * Custom Skill: ${name}
 * Created: ${new Date().toISOString()}
 */

export interface SkillContext {
  workingDirectory: string;
  args?: Record<string, unknown>;
}

export interface SkillResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Main skill handler
 */
export async function run(context: SkillContext): Promise<SkillResult> {
  // Implement your skill logic here
  return {
    success: true,
    output: 'Skill executed successfully',
  };
}
`;

    fs.writeFileSync(path.join(skillPath, 'index.ts'), skillContent);

    // Create README
    const readmeContent = `# ${name}

Custom skill for Damie Code.

## Usage

\`\`\`bash
damie skill ${name} run
\`\`\`

## Commands

- \`run\`: Execute the skill

## Development

Edit \`index.ts\` to implement your skill logic.
`;

    fs.writeFileSync(path.join(skillPath, 'README.md'), readmeContent);

    // Register the skill
    const skill: InstalledSkill = {
      name,
      manifest,
      type: SkillType.CUSTOM,
      status: SkillStatus.INSTALLED,
      path: skillPath,
      installedAt: new Date(),
      enabled: true,
    };

    this.skills.set(name, skill);

    return skillPath;
  }

  /**
   * Link a local skill directory
   */
  async linkSkill(sourcePath: string): Promise<InstalledSkill> {
    const manifestPath = path.join(sourcePath, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error('No manifest.json found in skill directory');
    }

    const manifestData = fs.readFileSync(manifestPath, 'utf-8');
    const manifest: SkillManifest = JSON.parse(manifestData);

    const linkPath = path.join(this.config.skillsPath, manifest.name);

    // Create symlink (or copy on Windows)
    if (fs.existsSync(linkPath)) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }

    // On Windows, we'll just store the path reference
    // In production, you might use junction or copy
    const linkInfo = {
      type: 'link',
      source: sourcePath,
    };

    fs.mkdirSync(linkPath, { recursive: true });
    fs.writeFileSync(
      path.join(linkPath, '.link'),
      JSON.stringify(linkInfo, null, 2)
    );
    fs.copyFileSync(manifestPath, path.join(linkPath, 'manifest.json'));

    const skill: InstalledSkill = {
      name: manifest.name,
      manifest,
      type: SkillType.LOCAL,
      status: SkillStatus.INSTALLED,
      path: sourcePath,
      installedAt: new Date(),
      enabled: true,
    };

    this.skills.set(manifest.name, skill);
    return skill;
  }

  /**
   * Execute a skill
   */
  async executeSkill(
    name: string,
    command: string,
    _context: SkillContext
  ): Promise<SkillExecutionResult> {
    const skill = this.skills.get(name);

    if (!skill) {
      return {
        success: false,
        error: `Skill "${name}" is not installed`,
      };
    }

    if (!skill.enabled) {
      return {
        success: false,
        error: `Skill "${name}" is disabled`,
      };
    }

    const startTime = Date.now();

    try {
      // In production, this would dynamically load and execute the skill
      return {
        success: true,
        output: `Executed ${name}:${command}`,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get skills by type
   */
  getSkillsByType(type: SkillType): InstalledSkill[] {
    return Array.from(this.skills.values()).filter((s) => s.type === type);
  }

  /**
   * Get enabled skills
   */
  getEnabledSkills(): InstalledSkill[] {
    return Array.from(this.skills.values()).filter((s) => s.enabled);
  }

  /**
   * Get skill statistics
   */
  getStats(): {
    total: number;
    bundled: number;
    installed: number;
    local: number;
    custom: number;
    enabled: number;
    disabled: number;
  } {
    const skills = Array.from(this.skills.values());
    return {
      total: skills.length,
      bundled: skills.filter((s) => s.type === SkillType.BUNDLED).length,
      installed: skills.filter((s) => s.type === SkillType.INSTALLED).length,
      local: skills.filter((s) => s.type === SkillType.LOCAL).length,
      custom: skills.filter((s) => s.type === SkillType.CUSTOM).length,
      enabled: skills.filter((s) => s.enabled).length,
      disabled: skills.filter((s) => !s.enabled).length,
    };
  }
}

/**
 * Factory function to create SkillManager
 */
export function createSkillManager(
  config?: Partial<SkillManagerConfig>
): SkillManager {
  return new SkillManager(config);
}
