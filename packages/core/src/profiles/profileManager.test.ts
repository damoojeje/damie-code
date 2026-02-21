/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProfileManager, createProfileManager } from './profileManager.js';
import { ProfileCategory, DEFAULT_PROFILES } from './types.js';

describe('ProfileManager', () => {
  let manager: ProfileManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-manager-test-'));
    manager = new ProfileManager({ profilesPath: tempDir });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should create profiles directory', () => {
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it('should load default profiles', () => {
      expect(manager.getProfileCount()).toBeGreaterThanOrEqual(
        DEFAULT_PROFILES.length
      );
    });

    it('should have coding profile by default', () => {
      expect(manager.hasProfile('coding')).toBe(true);
    });
  });

  describe('getAllProfiles', () => {
    it('should return all profiles sorted', () => {
      const profiles = manager.getAllProfiles();
      const names = profiles.map((p) => p.name);

      expect(names).toEqual([...names].sort());
    });

    it('should include all default profiles', () => {
      const profiles = manager.getAllProfiles();
      const names = profiles.map((p) => p.name);

      for (const defaultName of DEFAULT_PROFILES) {
        expect(names).toContain(defaultName);
      }
    });
  });

  describe('getProfile', () => {
    it('should return existing profile', () => {
      const profile = manager.getProfile('debugging');

      expect(profile).toBeDefined();
      expect(profile?.name).toBe('debugging');
    });

    it('should return undefined for non-existent', () => {
      expect(manager.getProfile('nonexistent')).toBeUndefined();
    });
  });

  describe('getDefaultProfile', () => {
    it('should return coding profile by default', () => {
      const profile = manager.getDefaultProfile();

      expect(profile).toBeDefined();
      expect(profile?.name).toBe('coding');
    });
  });

  describe('setDefaultProfile', () => {
    it('should set new default profile', () => {
      const result = manager.setDefaultProfile('debugging');

      expect(result).toBe(true);
      expect(manager.getDefaultProfile()?.name).toBe('debugging');
    });

    it('should return false for non-existent profile', () => {
      expect(manager.setDefaultProfile('nonexistent')).toBe(false);
    });
  });

  describe('selectProfile', () => {
    it('should select debugging for bug fix tasks', () => {
      const match = manager.selectProfile('Fix the bug in login');

      expect(match.profile.name).toBe('debugging');
      expect(match.score).toBeGreaterThan(0);
    });

    it('should select coding for implementation tasks', () => {
      const match = manager.selectProfile('Implement user authentication');

      expect(match.profile.name).toBe('coding');
    });

    it('should select documentation for doc tasks', () => {
      const match = manager.selectProfile('Write README documentation');

      expect(match.profile.name).toBe('documentation');
    });

    it('should select review for code review tasks', () => {
      const match = manager.selectProfile('Review this pull request');

      expect(match.profile.name).toBe('review');
    });

    it('should select refactoring for cleanup tasks', () => {
      const match = manager.selectProfile('Refactor the user service');

      expect(match.profile.name).toBe('refactoring');
    });

    it('should return default for unmatched tasks', () => {
      const match = manager.selectProfile('xyz abc 123');

      expect(match.reason).toContain('default');
    });
  });

  describe('createProfile', () => {
    it('should create new custom profile', () => {
      manager.createProfile({
        name: 'my-profile',
        category: ProfileCategory.CUSTOM,
        description: 'My custom profile',
        systemPrompt: 'Be helpful',
      });

      expect(manager.hasProfile('my-profile')).toBe(true);
    });

    it('should save profile to disk', () => {
      manager.createProfile({
        name: 'saved-profile',
        category: ProfileCategory.CUSTOM,
        description: 'Saved',
        systemPrompt: 'Hello',
      });

      const filePath = path.join(tempDir, 'saved-profile.yaml');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should throw if profile already exists', () => {
      expect(() =>
        manager.createProfile({
          name: 'coding',
          category: ProfileCategory.CODING,
          description: 'Duplicate',
          systemPrompt: 'Test',
        })
      ).toThrow('already exists');
    });
  });

  describe('updateProfile', () => {
    it('should update existing profile', () => {
      manager.createProfile({
        name: 'update-me',
        category: ProfileCategory.CUSTOM,
        description: 'Original',
        systemPrompt: 'Original prompt',
      });

      const result = manager.updateProfile('update-me', {
        description: 'Updated',
      });

      expect(result).toBe(true);
      expect(manager.getProfile('update-me')?.description).toBe('Updated');
    });

    it('should return false for non-existent profile', () => {
      expect(manager.updateProfile('nonexistent', {})).toBe(false);
    });
  });

  describe('deleteProfile', () => {
    it('should delete custom profile', () => {
      manager.createProfile({
        name: 'to-delete',
        category: ProfileCategory.CUSTOM,
        description: 'Delete me',
        systemPrompt: 'Test',
      });

      const result = manager.deleteProfile('to-delete');

      expect(result).toBe(true);
      expect(manager.hasProfile('to-delete')).toBe(false);
    });

    it('should remove file from disk', () => {
      manager.createProfile({
        name: 'file-delete',
        category: ProfileCategory.CUSTOM,
        description: 'Delete file',
        systemPrompt: 'Test',
      });

      manager.deleteProfile('file-delete');

      const filePath = path.join(tempDir, 'file-delete.yaml');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not delete default profiles', () => {
      expect(() => manager.deleteProfile('coding')).toThrow(
        'Cannot delete default'
      );
    });

    it('should return false for non-existent profile', () => {
      expect(manager.deleteProfile('nonexistent')).toBe(false);
    });
  });

  describe('getProfilesByCategory', () => {
    beforeEach(() => {
      manager.createProfile({
        name: 'custom1',
        category: ProfileCategory.CUSTOM,
        description: 'Custom 1',
        systemPrompt: 'Test',
      });
      manager.createProfile({
        name: 'custom2',
        category: ProfileCategory.CUSTOM,
        description: 'Custom 2',
        systemPrompt: 'Test',
      });
    });

    it('should filter by category', () => {
      const custom = manager.getProfilesByCategory(ProfileCategory.CUSTOM);

      expect(custom.length).toBe(2);
      expect(custom.every((p) => p.category === ProfileCategory.CUSTOM)).toBe(
        true
      );
    });

    it('should return coding profiles', () => {
      const coding = manager.getProfilesByCategory(ProfileCategory.CODING);

      expect(coding.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('hasProfile', () => {
    it('should return true for existing profile', () => {
      expect(manager.hasProfile('coding')).toBe(true);
    });

    it('should return false for non-existent profile', () => {
      expect(manager.hasProfile('nonexistent')).toBe(false);
    });
  });

  describe('getExpandedSystemPrompt', () => {
    it('should expand variables in prompt', () => {
      manager.createProfile({
        name: 'var-profile',
        category: ProfileCategory.CUSTOM,
        description: 'With variables',
        systemPrompt: 'Hello {{name}}, you are a {{role}}',
        variables: {
          name: 'Claude',
          role: 'assistant',
        },
      });

      const profile = manager.getProfile('var-profile')!;
      const expanded = manager.getExpandedSystemPrompt(profile);

      expect(expanded).toBe('Hello Claude, you are a assistant');
    });

    it('should merge with provided variables', () => {
      manager.createProfile({
        name: 'merge-vars',
        category: ProfileCategory.CUSTOM,
        description: 'Merge test',
        systemPrompt: 'Hello {{name}}, your task is {{task}}',
        variables: { name: 'User' },
      });

      const profile = manager.getProfile('merge-vars')!;
      const expanded = manager.getExpandedSystemPrompt(profile, {
        task: 'coding',
      });

      expect(expanded).toBe('Hello User, your task is coding');
    });

    it('should override profile variables', () => {
      manager.createProfile({
        name: 'override-vars',
        category: ProfileCategory.CUSTOM,
        description: 'Override test',
        systemPrompt: 'Hello {{name}}',
        variables: { name: 'Default' },
      });

      const profile = manager.getProfile('override-vars')!;
      const expanded = manager.getExpandedSystemPrompt(profile, {
        name: 'Override',
      });

      expect(expanded).toBe('Hello Override');
    });
  });

  describe('exportProfile', () => {
    it('should export profile as YAML', () => {
      const yaml = manager.exportProfile('coding');

      expect(yaml).toBeDefined();
      expect(yaml).toContain('name: coding');
    });

    it('should return undefined for non-existent', () => {
      expect(manager.exportProfile('nonexistent')).toBeUndefined();
    });
  });

  describe('importProfile', () => {
    it('should import profile from YAML', () => {
      const yaml = `
name: imported
category: custom
description: Imported profile
systemPrompt: Hello from import
`;

      const profile = manager.importProfile(yaml);

      expect(profile.name).toBe('imported');
      expect(manager.hasProfile('imported')).toBe(true);
    });

    it('should throw if no name provided', () => {
      const yaml = `
description: No name
systemPrompt: Test
`;

      expect(() => manager.importProfile(yaml)).toThrow('must have a name');
    });
  });

  describe('profile inheritance', () => {
    it('should load custom profile extending base', () => {
      // Create a custom profile file that extends coding
      const customProfile = `
name: my-coding
extends: coding
description: Extended coding profile
temperature: 0.1
`;
      fs.writeFileSync(path.join(tempDir, 'my-coding.yaml'), customProfile);

      // Reload manager
      const newManager = new ProfileManager({ profilesPath: tempDir });
      const profile = newManager.getProfile('my-coding');

      expect(profile).toBeDefined();
      expect(profile?.temperature).toBe(0.1);
      // Should inherit systemPrompt from coding
      expect(profile?.systemPrompt).toContain('expert software developer');
    });
  });
});

describe('createProfileManager', () => {
  it('should create manager with factory function', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-factory-'));
    const manager = createProfileManager({ profilesPath: tempDir });

    expect(manager).toBeInstanceOf(ProfileManager);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
