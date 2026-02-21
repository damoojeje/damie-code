/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PackageManager, createPackageManager } from './packageManager.js';
import { PackageManagerType, PkgDependencyType } from './types.js';

describe('PackageManager', () => {
  let manager: PackageManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-manager-test-'));
    manager = new PackageManager({
      workingDirectory: tempDir,
      autoDetect: false,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('detectPackageManager', () => {
    it('should detect npm from package-lock.json', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');

      const detected = manager.detectPackageManager();
      expect(detected).toBe(PackageManagerType.NPM);
    });

    it('should detect yarn from yarn.lock', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');

      const detected = manager.detectPackageManager();
      expect(detected).toBe(PackageManagerType.YARN);
    });

    it('should detect pnpm from pnpm-lock.yaml', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');

      const detected = manager.detectPackageManager();
      expect(detected).toBe(PackageManagerType.PNPM);
    });

    it('should detect bun from bun.lockb', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'bun.lockb'), '');

      const detected = manager.detectPackageManager();
      expect(detected).toBe(PackageManagerType.BUN);
    });

    it('should detect pip from requirements.txt', () => {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'flask==2.0.0');

      const detected = manager.detectPackageManager();
      expect(detected).toBe(PackageManagerType.PIP);
    });

    it('should detect poetry from poetry.lock', () => {
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '');
      fs.writeFileSync(path.join(tempDir, 'poetry.lock'), '');

      const detected = manager.detectPackageManager();
      expect(detected).toBe(PackageManagerType.POETRY);
    });

    it('should detect cargo from Cargo.toml', () => {
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '');

      const detected = manager.detectPackageManager();
      expect(detected).toBe(PackageManagerType.CARGO);
    });

    it('should detect go from go.mod', () => {
      fs.writeFileSync(path.join(tempDir, 'go.mod'), '');

      const detected = manager.detectPackageManager();
      expect(detected).toBe(PackageManagerType.GO);
    });

    it('should detect from packageManager field', () => {
      const pkgJson = {
        name: 'test',
        packageManager: 'pnpm@8.0.0',
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(pkgJson)
      );

      const detected = manager.detectPackageManager();
      expect(detected).toBe(PackageManagerType.PNPM);
    });
  });

  describe('getPackageManager', () => {
    it('should return detected manager', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');

      manager.detectPackageManager();
      expect(manager.getPackageManager()).toBe(PackageManagerType.YARN);
    });
  });

  describe('isManagerAvailable', () => {
    it('should return true for npm', () => {
      // npm should be available since we're running Node
      expect(manager.isManagerAvailable(PackageManagerType.NPM)).toBe(true);
    });

    it('should return false for non-existent manager', () => {
      expect(
        manager.isManagerAvailable('nonexistent' as PackageManagerType)
      ).toBe(false);
    });
  });

  describe('getDependencies', () => {
    it('should parse package.json dependencies', () => {
      const pkgJson = {
        name: 'test',
        dependencies: {
          express: '^4.18.0',
          lodash: '~4.17.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
        peerDependencies: {
          react: '^18.0.0',
        },
        optionalDependencies: {
          fsevents: '^2.3.0',
        },
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(pkgJson)
      );

      const deps = manager.getDependencies();

      expect(deps.length).toBe(5);

      const express = deps.find((d) => d.name === 'express');
      expect(express?.type).toBe(PkgDependencyType.PRODUCTION);
      expect(express?.version).toBe('^4.18.0');

      const typescript = deps.find((d) => d.name === 'typescript');
      expect(typescript?.type).toBe(PkgDependencyType.DEVELOPMENT);
      expect(typescript?.dev).toBe(true);

      const react = deps.find((d) => d.name === 'react');
      expect(react?.type).toBe(PkgDependencyType.PEER);
      expect(react?.peer).toBe(true);

      const fsevents = deps.find((d) => d.name === 'fsevents');
      expect(fsevents?.type).toBe(PkgDependencyType.OPTIONAL);
      expect(fsevents?.optional).toBe(true);
    });

    it('should parse requirements.txt', () => {
      const requirements = `
flask==2.0.0
requests>=2.25.0
# comment
numpy
      `;
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), requirements);

      const deps = manager.getDependencies();

      expect(deps.length).toBe(3);
      expect(deps.find((d) => d.name === 'flask')?.version).toBe('2.0.0');
      expect(deps.find((d) => d.name === 'requests')?.version).toBe('2.25.0');
      expect(deps.find((d) => d.name === 'numpy')?.version).toBe('*');
    });

    it('should return empty array for missing files', () => {
      const deps = manager.getDependencies();
      expect(deps).toHaveLength(0);
    });
  });

  describe('areDependenciesInstalled', () => {
    it('should return true if node_modules exists', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.mkdirSync(path.join(tempDir, 'node_modules'));

      manager.detectPackageManager();
      expect(manager.areDependenciesInstalled()).toBe(true);
    });

    it('should return false if node_modules missing', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      manager.detectPackageManager();
      expect(manager.areDependenciesInstalled()).toBe(false);
    });
  });

  describe('installPackages', () => {
    it('should return error for unknown manager', async () => {
      const result = await manager.installPackages(['lodash']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });
  });

  describe('uninstallPackages', () => {
    it('should return error for unknown manager', async () => {
      const result = await manager.uninstallPackages(['lodash']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });
  });

  describe('updatePackages', () => {
    it('should return failure for unknown manager', async () => {
      const result = await manager.updatePackages();

      expect(result.success).toBe(false);
    });
  });

  describe('audit', () => {
    it('should return empty audit for unknown manager', async () => {
      const result = await manager.audit();

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toHaveLength(0);
    });
  });

  describe('install', () => {
    it('should return error for unknown manager', async () => {
      const result = await manager.install();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });
  });

  describe('getOutdatedPackages', () => {
    it('should return empty for unknown manager', async () => {
      const outdated = await manager.getOutdatedPackages();

      expect(outdated).toHaveLength(0);
    });
  });
});

describe('PackageManager with npm', () => {
  let manager: PackageManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-test-'));

    // Create a minimal package.json
    const pkgJson = {
      name: 'test-project',
      version: '1.0.0',
    };
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify(pkgJson)
    );
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');

    manager = new PackageManager({
      workingDirectory: tempDir,
      autoDetect: true,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should detect npm', () => {
    expect(manager.getPackageManager()).toBe(PackageManagerType.NPM);
  });
});

describe('createPackageManager', () => {
  it('should create manager with factory function', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-factory-'));
    const manager = createPackageManager({
      workingDirectory: tempDir,
      autoDetect: false,
    });

    expect(manager).toBeInstanceOf(PackageManager);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
