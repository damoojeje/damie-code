/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillService, createSkillService } from './skillService.js';
import type { SkillManager, InstalledSkill, SkillManifest } from '@damie-code/damie-code-core';
import { SkillStatus, SkillType } from '@damie-code/damie-code-core';

// Mock SkillManager
const mockSkillManager = {
  listSkills: vi.fn(),
  getSkill: vi.fn(),
  isInstalled: vi.fn(),
  installSkill: vi.fn(),
  enableSkill: vi.fn(),
  disableSkill: vi.fn(),
  removeSkill: vi.fn(),
  searchSkills: vi.fn(),
  createCustomSkill: vi.fn(),
} as unknown as SkillManager;

describe('SkillService', () => {
  let service: SkillService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createSkillService(mockSkillManager);
  });

  describe('listSkills', () => {
    it('should return empty array when no skills installed', async () => {
      vi.mocked(mockSkillManager.listSkills).mockReturnValue([]);

      const result = await service.listSkills();

      expect(result).toEqual([]);
      expect(mockSkillManager.listSkills).toHaveBeenCalled();
    });

    it('should return list of skills with UI-friendly formatting', async () => {
      const mockSkills: InstalledSkill[] = [
        {
          name: 'test-skill',
          manifest: {
            name: 'test-skill',
            version: '1.0.0',
            description: 'Test skill',
            keywords: ['test'],
          } as SkillManifest,
          type: SkillType.BUNDLED,
          status: SkillStatus.INSTALLED,
          path: '/path/to/skill',
          installedAt: new Date(),
          enabled: true,
        },
      ];

      vi.mocked(mockSkillManager.listSkills).mockReturnValue(mockSkills);

      const result = await service.listSkills();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'test-skill',
        description: 'Test skill',
        version: '1.0.0',
        enabled: true,
        type: SkillType.BUNDLED,
        status: SkillStatus.INSTALLED,
        installedAt: expect.any(Date),
        keywords: ['test'],
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(mockSkillManager.listSkills).mockImplementation(() => {
        throw new Error('Failed to list skills');
      });

      const result = await service.listSkills();

      expect(result).toEqual([]);
    });
  });

  describe('getSkill', () => {
    it('should return skill details by name', async () => {
      const mockSkill: InstalledSkill = {
        name: 'test-skill',
        manifest: {
          name: 'test-skill',
          version: '1.0.0',
          description: 'Test skill',
        } as SkillManifest,
        type: SkillType.BUNDLED,
        status: SkillStatus.INSTALLED,
        path: '/path/to/skill',
        installedAt: new Date(),
        enabled: true,
      };

      vi.mocked(mockSkillManager.getSkill).mockReturnValue(mockSkill);

      const result = await service.getSkill('test-skill');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-skill');
    });

    it('should return null if skill not found', async () => {
      vi.mocked(mockSkillManager.getSkill).mockReturnValue(undefined);

      const result = await service.getSkill('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(mockSkillManager.getSkill).mockImplementation(() => {
        throw new Error('Failed to get skill');
      });

      const result = await service.getSkill('test');

      expect(result).toBeNull();
    });
  });

  describe('installSkill', () => {
    it('should install skill successfully', async () => {
      const mockSkill: InstalledSkill = {
        name: 'new-skill',
        manifest: {
          name: 'new-skill',
          version: '1.0.0',
          description: 'New skill',
        } as SkillManifest,
        type: SkillType.INSTALLED,
        status: SkillStatus.INSTALLED,
        path: '/path/to/skill',
        installedAt: new Date(),
        enabled: true,
      };

      vi.mocked(mockSkillManager.isInstalled).mockReturnValue(false);
      vi.mocked(mockSkillManager.installSkill).mockResolvedValue(mockSkill);

      const result = await service.installSkill('new-skill');

      expect(result.success).toBe(true);
      expect(result.skill).toEqual(mockSkill);
    });

    it('should fail if skill already installed', async () => {
      vi.mocked(mockSkillManager.isInstalled).mockReturnValue(true);

      const result = await service.installSkill('existing-skill');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already installed');
    });

    it('should handle installation errors', async () => {
      vi.mocked(mockSkillManager.isInstalled).mockReturnValue(false);
      vi.mocked(mockSkillManager.installSkill).mockRejectedValue(new Error('Installation failed'));

      const result = await service.installSkill('new-skill');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Installation failed');
    });
  });

  describe('enableSkill', () => {
    it('should enable skill successfully', async () => {
      vi.mocked(mockSkillManager.isInstalled).mockReturnValue(true);
      vi.mocked(mockSkillManager.enableSkill).mockImplementation(() => {});

      const result = await service.enableSkill('test-skill');

      expect(result.success).toBe(true);
      expect(mockSkillManager.enableSkill).toHaveBeenCalledWith('test-skill');
    });

    it('should fail if skill not installed', async () => {
      vi.mocked(mockSkillManager.isInstalled).mockReturnValue(false);

      const result = await service.enableSkill('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
    });
  });

  describe('disableSkill', () => {
    it('should disable skill successfully', async () => {
      vi.mocked(mockSkillManager.isInstalled).mockReturnValue(true);
      vi.mocked(mockSkillManager.disableSkill).mockImplementation(() => {});

      const result = await service.disableSkill('test-skill');

      expect(result.success).toBe(true);
      expect(mockSkillManager.disableSkill).toHaveBeenCalledWith('test-skill');
    });

    it('should fail if skill not installed', async () => {
      vi.mocked(mockSkillManager.isInstalled).mockReturnValue(false);

      const result = await service.disableSkill('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
    });
  });

  describe('deleteSkill', () => {
    it('should delete skill successfully', async () => {
      vi.mocked(mockSkillManager.removeSkill).mockResolvedValue(true);

      const result = await service.deleteSkill('test-skill');

      expect(result.success).toBe(true);
      expect(mockSkillManager.removeSkill).toHaveBeenCalledWith('test-skill');
    });

    it('should fail if deletion fails', async () => {
      vi.mocked(mockSkillManager.removeSkill).mockResolvedValue(false);

      const result = await service.deleteSkill('test-skill');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to remove');
    });
  });

  describe('searchSkills', () => {
    it('should return search results', async () => {
      const mockResults = [
        {
          name: 'test-skill',
          description: 'Test skill',
          version: '1.0.0',
          url: 'https://skills.sh/test-skill',
        },
      ];

      vi.mocked(mockSkillManager.searchSkills).mockResolvedValue(mockResults as any);

      const result = await service.searchSkills('test');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-skill');
    });

    it('should handle search errors gracefully', async () => {
      vi.mocked(mockSkillManager.searchSkills).mockRejectedValue(new Error('Search failed'));

      const result = await service.searchSkills('test');

      expect(result).toEqual([]);
    });
  });

  describe('createSkill', () => {
    it('should create skill with valid name', async () => {
      vi.mocked(mockSkillManager.createCustomSkill).mockResolvedValue('/path/to/skill');

      const result = await service.createSkill('my-skill', 'Test skill');

      expect(result.success).toBe(true);
      expect(result.skillPath).toBe('/path/to/skill');
    });

    it('should fail with empty name', async () => {
      const result = await service.createSkill('', 'Test skill');

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should fail with invalid name format', async () => {
      const result = await service.createSkill('Invalid Name', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('lowercase letters');
    });
  });

  describe('updateSkill', () => {
    it('should return success for bundled skills with no changes', async () => {
      const mockSkill: InstalledSkill = {
        name: 'bundled-skill',
        manifest: {
          name: 'bundled-skill',
          version: '1.0.0',
          description: 'Bundled',
        } as SkillManifest,
        type: SkillType.BUNDLED,
        status: SkillStatus.INSTALLED,
        path: '/path',
        installedAt: new Date(),
        enabled: true,
      };

      vi.mocked(mockSkillManager.getSkill).mockReturnValue(mockSkill);

      const result = await service.updateSkill('bundled-skill');

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
    });

    it('should fail if skill not found', async () => {
      vi.mocked(mockSkillManager.getSkill).mockReturnValue(undefined);

      const result = await service.updateSkill('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});

describe('createSkillService', () => {
  it('should create SkillService instance', () => {
    const service = createSkillService(mockSkillManager);

    expect(service).toBeInstanceOf(SkillService);
  });

  it('should create same instance type with same manager', () => {
    const service1 = createSkillService(mockSkillManager);
    const service2 = createSkillService(mockSkillManager);

    expect(service1).toEqual(service2);
  });
});
