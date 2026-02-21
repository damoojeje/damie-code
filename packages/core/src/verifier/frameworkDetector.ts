/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Supported test frameworks
 */
export enum TestFramework {
  VITEST = 'vitest',
  JEST = 'jest',
  MOCHA = 'mocha',
  PYTEST = 'pytest',
  NPM_TEST = 'npm_test',
  UNKNOWN = 'unknown',
}

/**
 * Test framework detection result
 */
export interface FrameworkDetection {
  /** Detected framework */
  framework: TestFramework;
  /** Command to run tests */
  command: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Config file found (if any) */
  configFile?: string;
  /** Additional detection notes */
  notes?: string[];
}

/**
 * Framework Detector
 *
 * Auto-detects test frameworks in a project by analyzing
 * package.json, config files, and file patterns.
 */
export class FrameworkDetector {
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
  }

  /**
   * Detect the test framework used in the project
   */
  async detect(): Promise<FrameworkDetection> {
    const detections: FrameworkDetection[] = [];

    // Check for Vitest
    const vitestDetection = await this.detectVitest();
    if (vitestDetection) detections.push(vitestDetection);

    // Check for Jest
    const jestDetection = await this.detectJest();
    if (jestDetection) detections.push(jestDetection);

    // Check for Mocha
    const mochaDetection = await this.detectMocha();
    if (mochaDetection) detections.push(mochaDetection);

    // Check for Pytest
    const pytestDetection = await this.detectPytest();
    if (pytestDetection) detections.push(pytestDetection);

    // Check for npm test script
    const npmTestDetection = await this.detectNpmTest();
    if (npmTestDetection) detections.push(npmTestDetection);

    // Sort by confidence and return best match
    detections.sort((a, b) => b.confidence - a.confidence);

    if (detections.length > 0) {
      return detections[0];
    }

    return {
      framework: TestFramework.UNKNOWN,
      command: '',
      confidence: 0,
      notes: ['No test framework detected'],
    };
  }

  /**
   * Detect all test frameworks in the project
   */
  async detectAll(): Promise<FrameworkDetection[]> {
    const detections: FrameworkDetection[] = [];

    const vitestDetection = await this.detectVitest();
    if (vitestDetection) detections.push(vitestDetection);

    const jestDetection = await this.detectJest();
    if (jestDetection) detections.push(jestDetection);

    const mochaDetection = await this.detectMocha();
    if (mochaDetection) detections.push(mochaDetection);

    const pytestDetection = await this.detectPytest();
    if (pytestDetection) detections.push(pytestDetection);

    const npmTestDetection = await this.detectNpmTest();
    if (npmTestDetection) detections.push(npmTestDetection);

    return detections.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect Vitest
   */
  private async detectVitest(): Promise<FrameworkDetection | null> {
    const notes: string[] = [];
    let confidence = 0;
    let configFile: string | undefined;

    // Check for vitest config files
    const vitestConfigs = [
      'vitest.config.ts',
      'vitest.config.js',
      'vitest.config.mjs',
      'vite.config.ts',
      'vite.config.js',
    ];

    for (const config of vitestConfigs) {
      const configPath = path.join(this.workingDir, config);
      if (fs.existsSync(configPath)) {
        if (config.startsWith('vitest')) {
          confidence += 0.5;
          configFile = config;
          notes.push(`Found ${config}`);
        } else {
          // Vite config might include vitest
          const content = fs.readFileSync(configPath, 'utf-8');
          if (content.includes('vitest') || content.includes('test:')) {
            confidence += 0.3;
            configFile = config;
            notes.push(`Found vitest config in ${config}`);
          }
        }
      }
    }

    // Check package.json for vitest dependency
    const pkgPath = path.join(this.workingDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        if (deps.vitest) {
          confidence += 0.4;
          notes.push('vitest in dependencies');
        }

        if (pkg.scripts?.test?.includes('vitest')) {
          confidence += 0.2;
          notes.push('vitest in test script');
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (confidence > 0) {
      return {
        framework: TestFramework.VITEST,
        command: 'npx vitest run',
        confidence: Math.min(confidence, 1),
        configFile,
        notes,
      };
    }

    return null;
  }

  /**
   * Detect Jest
   */
  private async detectJest(): Promise<FrameworkDetection | null> {
    const notes: string[] = [];
    let confidence = 0;
    let configFile: string | undefined;

    // Check for jest config files
    const jestConfigs = [
      'jest.config.ts',
      'jest.config.js',
      'jest.config.mjs',
      'jest.config.json',
    ];

    for (const config of jestConfigs) {
      const configPath = path.join(this.workingDir, config);
      if (fs.existsSync(configPath)) {
        confidence += 0.5;
        configFile = config;
        notes.push(`Found ${config}`);
        break;
      }
    }

    // Check package.json
    const pkgPath = path.join(this.workingDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        if (deps.jest) {
          confidence += 0.4;
          notes.push('jest in dependencies');
        }

        if (pkg.jest) {
          confidence += 0.3;
          notes.push('jest config in package.json');
        }

        if (pkg.scripts?.test?.includes('jest')) {
          confidence += 0.2;
          notes.push('jest in test script');
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (confidence > 0) {
      return {
        framework: TestFramework.JEST,
        command: 'npx jest',
        confidence: Math.min(confidence, 1),
        configFile,
        notes,
      };
    }

    return null;
  }

  /**
   * Detect Mocha
   */
  private async detectMocha(): Promise<FrameworkDetection | null> {
    const notes: string[] = [];
    let confidence = 0;
    let configFile: string | undefined;

    // Check for mocha config files
    const mochaConfigs = ['.mocharc.js', '.mocharc.json', '.mocharc.yaml', '.mocharc.yml'];

    for (const config of mochaConfigs) {
      const configPath = path.join(this.workingDir, config);
      if (fs.existsSync(configPath)) {
        confidence += 0.5;
        configFile = config;
        notes.push(`Found ${config}`);
        break;
      }
    }

    // Check package.json
    const pkgPath = path.join(this.workingDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        if (deps.mocha) {
          confidence += 0.4;
          notes.push('mocha in dependencies');
        }

        if (pkg.mocha) {
          confidence += 0.3;
          notes.push('mocha config in package.json');
        }

        if (pkg.scripts?.test?.includes('mocha')) {
          confidence += 0.2;
          notes.push('mocha in test script');
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (confidence > 0) {
      return {
        framework: TestFramework.MOCHA,
        command: 'npx mocha',
        confidence: Math.min(confidence, 1),
        configFile,
        notes,
      };
    }

    return null;
  }

  /**
   * Detect Pytest
   */
  private async detectPytest(): Promise<FrameworkDetection | null> {
    const notes: string[] = [];
    let confidence = 0;
    let configFile: string | undefined;

    // Check for pytest config files
    const pytestConfigs = ['pytest.ini', 'pyproject.toml', 'setup.cfg', 'conftest.py'];

    for (const config of pytestConfigs) {
      const configPath = path.join(this.workingDir, config);
      if (fs.existsSync(configPath)) {
        if (config === 'pytest.ini' || config === 'conftest.py') {
          confidence += 0.5;
          configFile = config;
          notes.push(`Found ${config}`);
        } else {
          // Check if pyproject.toml or setup.cfg contains pytest config
          const content = fs.readFileSync(configPath, 'utf-8');
          if (content.includes('[tool.pytest') || content.includes('[pytest]')) {
            confidence += 0.4;
            configFile = config;
            notes.push(`Found pytest config in ${config}`);
          }
        }
      }
    }

    // Check for requirements.txt with pytest
    const reqPath = path.join(this.workingDir, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      const content = fs.readFileSync(reqPath, 'utf-8');
      if (content.includes('pytest')) {
        confidence += 0.3;
        notes.push('pytest in requirements.txt');
      }
    }

    // Check for test_*.py or *_test.py files
    const hasTestFiles = await this.hasFilesMatching(/^test_.*\.py$|_test\.py$/);
    if (hasTestFiles) {
      confidence += 0.2;
      notes.push('Found pytest-style test files');
    }

    if (confidence > 0) {
      return {
        framework: TestFramework.PYTEST,
        command: 'pytest',
        confidence: Math.min(confidence, 1),
        configFile,
        notes,
      };
    }

    return null;
  }

  /**
   * Detect npm test script
   */
  private async detectNpmTest(): Promise<FrameworkDetection | null> {
    const pkgPath = path.join(this.workingDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return null;
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        return {
          framework: TestFramework.NPM_TEST,
          command: 'npm test',
          confidence: 0.1, // Low confidence as fallback
          notes: [`npm test: ${pkg.scripts.test}`],
        };
      }
    } catch {
      // Ignore JSON parse errors
    }

    return null;
  }

  /**
   * Check if directory has files matching pattern
   */
  private async hasFilesMatching(pattern: RegExp): Promise<boolean> {
    try {
      const entries = fs.readdirSync(this.workingDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && pattern.test(entry.name)) {
          return true;
        }
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subEntries = fs.readdirSync(path.join(this.workingDir, entry.name));
          for (const subEntry of subEntries) {
            if (pattern.test(subEntry)) {
              return true;
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }
    return false;
  }

  /**
   * Get command to run tests for specific files
   */
  getTestCommand(framework: TestFramework, files?: string[]): string {
    const fileArgs = files?.join(' ') ?? '';

    switch (framework) {
      case TestFramework.VITEST:
        return files ? `npx vitest run ${fileArgs}` : 'npx vitest run';

      case TestFramework.JEST:
        return files ? `npx jest ${fileArgs}` : 'npx jest';

      case TestFramework.MOCHA:
        return files ? `npx mocha ${fileArgs}` : 'npx mocha';

      case TestFramework.PYTEST:
        return files ? `pytest ${fileArgs}` : 'pytest';

      case TestFramework.NPM_TEST:
        return 'npm test';

      default:
        return '';
    }
  }
}

/**
 * Create a framework detector
 */
export function createFrameworkDetector(workingDir?: string): FrameworkDetector {
  return new FrameworkDetector(workingDir);
}
