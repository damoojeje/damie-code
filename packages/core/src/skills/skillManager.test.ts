/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SkillManager, createSkillManager } from './skillManager.js';
import { SkillType, BUNDLED_SKILLS } from './types.js';

describe('SkillManager', () => {
  let manager: SkillManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-manager-test-'));
    manager = new SkillManager({ skillsPath: tempDir });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should create skills directory', () => {
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it('should start with no skills', () => {
      expect(manager.listSkills()).toHaveLength(0);
    });
  });

  describe('installBundledSkills', () => {
    it('should install all bundled skills', async () => {
      await manager.installBundledSkills();

      const skills = manager.listSkills();
      expect(skills.length).toBe(BUNDLED_SKILLS.length);
    });

    it('should mark bundled skills as BUNDLED type', async () => {
      await manager.installBundledSkills();

      const skill = manager.getSkill('dependency-updater');
      expect(skill?.type).toBe(SkillType.BUNDLED);
    });

    it('should not reinstall existing bundled skills', async () => {
      await manager.installBundledSkills();
      const firstInstall = manager.getSkill('find-skills')?.installedAt;

      await manager.installBundledSkills();
      const secondInstall = manager.getSkill('find-skills')?.installedAt;

      expect(firstInstall).toEqual(secondInstall);
    });
  });

  describe('listSkills', () => {
    it('should return sorted list', async () => {
      await manager.installBundledSkills();

      const skills = manager.listSkills();
      const names = skills.map((s) => s.name);

      expect(names).toEqual([...names].sort());
    });
  });

  describe('getSkill', () => {
    it('should return installed skill', async () => {
      await manager.installBundledSkills();

      const skill = manager.getSkill('frontend-design');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('frontend-design');
    });

    it('should return undefined for non-existent skill', () => {
      expect(manager.getSkill('nonexistent')).toBeUndefined();
    });
  });

  describe('isInstalled', () => {
    it('should return true for installed skill', async () => {
      await manager.installBundledSkills();

      expect(manager.isInstalled('ui-ux-pro-max')).toBe(true);
    });

    it('should return false for non-installed skill', () => {
      expect(manager.isInstalled('not-installed')).toBe(false);
    });
  });

  describe('searchSkills', () => {
    it('should find matching skills', async () => {
      const results = await manager.searchSkills('design');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name.includes('design'))).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const results = await manager.searchSkills('xyznonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('installSkill', () => {
    it('should install a new skill', async () => {
      const skill = await manager.installSkill('test-skill');

      expect(skill.name).toBe('test-skill');
      expect(skill.type).toBe(SkillType.INSTALLED);
      expect(manager.isInstalled('test-skill')).toBe(true);
    });

    it('should throw if skill already installed', async () => {
      await manager.installSkill('test-skill');

      await expect(manager.installSkill('test-skill')).rejects.toThrow(
        'already installed'
      );
    });

    it('should allow force reinstall', async () => {
      await manager.installSkill('test-skill');

      const skill = await manager.installSkill('test-skill', { force: true });
      expect(skill.name).toBe('test-skill');
    });

    it('should handle GitHub-style names', async () => {
      const skill = await manager.installSkill('vercel-labs/agent-skills');

      expect(skill.name).toBe('agent-skills');
    });
  });

  describe('removeSkill', () => {
    it('should remove installed skill', async () => {
      await manager.installSkill('removable-skill');

      const result = await manager.removeSkill('removable-skill');
      expect(result).toBe(true);
      expect(manager.isInstalled('removable-skill')).toBe(false);
    });

    it('should return false for non-existent skill', async () => {
      const result = await manager.removeSkill('nonexistent');
      expect(result).toBe(false);
    });

    it('should not allow removing bundled skills', async () => {
      await manager.installBundledSkills();

      await expect(
        manager.removeSkill('dependency-updater')
      ).rejects.toThrow('Cannot remove bundled skills');
    });
  });

  describe('enableSkill/disableSkill', () => {
    beforeEach(async () => {
      await manager.installSkill('toggle-skill');
    });

    it('should enable skill', () => {
      manager.disableSkill('toggle-skill');
      const result = manager.enableSkill('toggle-skill');

      expect(result).toBe(true);
      expect(manager.getSkill('toggle-skill')?.enabled).toBe(true);
    });

    it('should disable skill', () => {
      const result = manager.disableSkill('toggle-skill');

      expect(result).toBe(true);
      expect(manager.getSkill('toggle-skill')?.enabled).toBe(false);
    });

    it('should return false for non-existent skill', () => {
      expect(manager.enableSkill('nonexistent')).toBe(false);
      expect(manager.disableSkill('nonexistent')).toBe(false);
    });
  });

  describe('updateSkill', () => {
    it('should update installed skill', async () => {
      await manager.installSkill('update-skill');

      const skill = await manager.updateSkill('update-skill');
      expect(skill.updatedAt).toBeDefined();
    });

    it('should throw for non-existent skill', async () => {
      await expect(manager.updateSkill('nonexistent')).rejects.toThrow(
        'not installed'
      );
    });
  });

  describe('updateAllSkills', () => {
    it('should update all installed skills', async () => {
      await manager.installSkill('skill1');
      await manager.installSkill('skill2');

      const results = await manager.updateAllSkills();

      expect(results.get('skill1')).toBe(true);
      expect(results.get('skill2')).toBe(true);
    });
  });

  describe('createSkill', () => {
    it('should create new custom skill', async () => {
      const skillPath = await manager.createSkill('my-custom-skill');

      expect(fs.existsSync(skillPath)).toBe(true);
      expect(fs.existsSync(path.join(skillPath, 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(skillPath, 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(skillPath, 'README.md'))).toBe(true);
    });

    it('should register created skill', async () => {
      await manager.createSkill('created-skill');

      expect(manager.isInstalled('created-skill')).toBe(true);
      expect(manager.getSkill('created-skill')?.type).toBe(SkillType.CUSTOM);
    });

    it('should throw if skill already exists', async () => {
      await manager.createSkill('existing');

      await expect(manager.createSkill('existing')).rejects.toThrow(
        'already exists'
      );
    });
  });

  describe('linkSkill', () => {
    let sourceDir: string;

    beforeEach(() => {
      sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-skill-'));

      // Create a valid skill in source directory
      const manifest = {
        name: 'linked-skill',
        version: '1.0.0',
        description: 'Test linked skill',
      };
      fs.writeFileSync(
        path.join(sourceDir, 'manifest.json'),
        JSON.stringify(manifest)
      );
    });

    afterEach(() => {
      try {
        fs.rmSync(sourceDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it('should link local skill', async () => {
      const skill = await manager.linkSkill(sourceDir);

      expect(skill.name).toBe('linked-skill');
      expect(skill.type).toBe(SkillType.LOCAL);
      expect(manager.isInstalled('linked-skill')).toBe(true);
    });

    it('should throw if no manifest found', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));

      await expect(manager.linkSkill(emptyDir)).rejects.toThrow(
        'No manifest.json found'
      );

      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe('executeSkill', () => {
    beforeEach(async () => {
      await manager.installSkill('exec-skill');
    });

    it('should execute installed skill', async () => {
      const result = await manager.executeSkill('exec-skill', 'run', {
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeDefined();
    });

    it('should fail for non-existent skill', async () => {
      const result = await manager.executeSkill('nonexistent', 'run', {
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
    });

    it('should fail for disabled skill', async () => {
      manager.disableSkill('exec-skill');

      const result = await manager.executeSkill('exec-skill', 'run', {
        workingDirectory: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });
  });

  describe('getSkillsByType', () => {
    beforeEach(async () => {
      await manager.installBundledSkills();
      await manager.installSkill('installed-skill');
      await manager.createSkill('custom-skill');
    });

    it('should filter by BUNDLED type', () => {
      const bundled = manager.getSkillsByType(SkillType.BUNDLED);
      expect(bundled.length).toBe(BUNDLED_SKILLS.length);
    });

    it('should filter by INSTALLED type', () => {
      const installed = manager.getSkillsByType(SkillType.INSTALLED);
      expect(installed.length).toBe(1);
    });

    it('should filter by CUSTOM type', () => {
      const custom = manager.getSkillsByType(SkillType.CUSTOM);
      expect(custom.length).toBe(1);
    });
  });

  describe('getEnabledSkills', () => {
    beforeEach(async () => {
      await manager.installSkill('enabled1');
      await manager.installSkill('enabled2');
      await manager.installSkill('disabled1');
      manager.disableSkill('disabled1');
    });

    it('should return only enabled skills', () => {
      const enabled = manager.getEnabledSkills();

      expect(enabled.length).toBe(2);
      expect(enabled.every((s) => s.enabled)).toBe(true);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await manager.installBundledSkills();
      await manager.installSkill('installed1');
      await manager.createSkill('custom1');
      manager.disableSkill('custom1');
    });

    it('should return correct statistics', () => {
      const stats = manager.getStats();

      expect(stats.total).toBe(BUNDLED_SKILLS.length + 2);
      expect(stats.bundled).toBe(BUNDLED_SKILLS.length);
      expect(stats.installed).toBe(1);
      expect(stats.custom).toBe(1);
      expect(stats.disabled).toBe(1);
    });
  });
});

describe('createSkillManager', () => {
  it('should create manager with factory function', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-factory-'));
    const manager = createSkillManager({ skillsPath: tempDir });

    expect(manager).toBeInstanceOf(SkillManager);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
