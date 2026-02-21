/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  FileCategory,
  Language,
  EXTENSION_LANGUAGE_MAP,
  EXTENSION_CATEGORY_MAP,
  BINARY_FILE_EXTENSIONS,
} from './types.js';

/**
 * File type detection result
 */
export interface FileTypeResult {
  /** Detected language */
  language: Language;
  /** File category */
  category: FileCategory;
  /** Is binary file */
  isBinary: boolean;
  /** Is test file */
  isTest: boolean;
  /** Is config file */
  isConfig: boolean;
  /** Is build artifact */
  isBuildArtifact: boolean;
  /** Is documentation */
  isDocumentation: boolean;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Detection method used */
  detectionMethod: 'extension' | 'content' | 'pattern' | 'default';
}

/**
 * Shebang to language mapping
 */
const SHEBANG_LANGUAGE_MAP: Record<string, Language> = {
  python: Language.PYTHON,
  python3: Language.PYTHON,
  node: Language.JAVASCRIPT,
  nodejs: Language.JAVASCRIPT,
  bash: Language.SHELL,
  sh: Language.SHELL,
  zsh: Language.SHELL,
  ruby: Language.RUBY,
  perl: Language.OTHER,
  php: Language.PHP,
};

/**
 * Config file patterns
 */
const CONFIG_FILE_PATTERNS = [
  /^package\.json$/,
  /^tsconfig.*\.json$/,
  /^jsconfig.*\.json$/,
  /^\..*rc$/,
  /^\..*rc\.(js|json|yaml|yml|ts)$/,
  /^.*config\.(js|ts|json|yaml|yml|toml)$/,
  /^\.env.*$/,
  /^Makefile$/,
  /^Dockerfile.*$/,
  /^docker-compose.*\.ya?ml$/,
  /^\.gitlab-ci\.ya?ml$/,
  /^\.github\/.*\.ya?ml$/,
  /^jest\.config.*$/,
  /^vitest\.config.*$/,
  /^webpack\.config.*$/,
  /^vite\.config.*$/,
  /^rollup\.config.*$/,
  /^babel\.config.*$/,
  /^prettier.*$/,
  /^eslint.*$/,
  /^\.editorconfig$/,
  /^\.gitignore$/,
  /^\.gitattributes$/,
  /^\.npmrc$/,
  /^\.nvmrc$/,
  /^pyproject\.toml$/,
  /^setup\.py$/,
  /^setup\.cfg$/,
  /^requirements.*\.txt$/,
  /^Pipfile$/,
  /^Cargo\.toml$/,
  /^go\.mod$/,
  /^go\.sum$/,
  /^pom\.xml$/,
  /^build\.gradle.*$/,
];

/**
 * Test file patterns
 */
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.[jt]sx?$/,
  /\.test\.py$/,
  /_test\.py$/,
  /^test_.*\.py$/,
  /_test\.go$/,
  /_test\.rs$/,
  /Test\.java$/,
  /Tests?\.cs$/,
  /\.feature$/,
];

/**
 * Build artifact patterns
 */
const BUILD_ARTIFACT_PATTERNS = [
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^out\//,
  /^target\//,
  /^\.next\//,
  /^\.nuxt\//,
  /^__pycache__\//,
  /^\.pytest_cache\//,
  /^coverage\//,
  /^\.nyc_output\//,
  /^\.cache\//,
  /^vendor\//,
  /^bin\//,
  /^obj\//,
];

/**
 * File Type Detector
 *
 * Detects file types, languages, and categories using multiple methods.
 */
export class FileTypeDetector {
  /**
   * Detect file type from path
   */
  detect(filePath: string): FileTypeResult {
    const name = path.basename(filePath);
    const ext = path.extname(name).toLowerCase().slice(1);
    const relativePath = filePath;

    // Start with default result
    const result: FileTypeResult = {
      language: Language.OTHER,
      category: FileCategory.OTHER,
      isBinary: false,
      isTest: false,
      isConfig: false,
      isBuildArtifact: false,
      isDocumentation: false,
      confidence: 0.5,
      detectionMethod: 'default',
    };

    // Check if binary
    result.isBinary = BINARY_FILE_EXTENSIONS.has(ext);

    // Detect by extension
    if (ext && ext in EXTENSION_LANGUAGE_MAP) {
      result.language = EXTENSION_LANGUAGE_MAP[ext];
      result.confidence = 0.9;
      result.detectionMethod = 'extension';
    }

    // Detect category by extension
    if (ext && ext in EXTENSION_CATEGORY_MAP) {
      result.category = EXTENSION_CATEGORY_MAP[ext];
    }

    // Check patterns
    result.isTest = this.matchesPatterns(name, relativePath, TEST_FILE_PATTERNS);
    result.isConfig = this.matchesPatterns(name, relativePath, CONFIG_FILE_PATTERNS);
    result.isBuildArtifact = this.matchesPatterns(name, relativePath, BUILD_ARTIFACT_PATTERNS);

    // Set category based on patterns
    if (result.isTest) {
      result.category = FileCategory.TEST;
      result.confidence = 0.95;
      result.detectionMethod = 'pattern';
    } else if (result.isConfig) {
      result.category = FileCategory.CONFIG;
      result.confidence = 0.95;
      result.detectionMethod = 'pattern';
    } else if (result.isBuildArtifact) {
      result.category = FileCategory.BUILD;
    }

    // Check documentation
    if (['md', 'markdown', 'rst', 'txt', 'adoc'].includes(ext)) {
      result.isDocumentation = true;
      result.category = FileCategory.DOCUMENTATION;
    }

    // Set source category for code files
    if (result.category === FileCategory.OTHER && !result.isBinary) {
      const codeLanguages = [
        Language.TYPESCRIPT, Language.JAVASCRIPT, Language.PYTHON,
        Language.RUST, Language.GO, Language.JAVA, Language.CSHARP,
        Language.CPP, Language.C, Language.RUBY, Language.PHP,
        Language.SWIFT, Language.KOTLIN,
      ];
      if (codeLanguages.includes(result.language)) {
        result.category = FileCategory.SOURCE;
      }
    }

    return result;
  }

  /**
   * Detect file type with content analysis
   */
  detectWithContent(filePath: string): FileTypeResult {
    const result = this.detect(filePath);

    // Try content-based detection if language unknown
    if (result.language === Language.OTHER && !result.isBinary) {
      const contentResult = this.detectFromContent(filePath);
      if (contentResult) {
        result.language = contentResult.language;
        result.confidence = contentResult.confidence;
        result.detectionMethod = 'content';
      }
    }

    return result;
  }

  /**
   * Detect language from file content
   */
  private detectFromContent(filePath: string): { language: Language; confidence: number } | null {
    try {
      // Read first 512 bytes
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(512);
      const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
      fs.closeSync(fd);

      if (bytesRead === 0) {
        return null;
      }

      const content = buffer.toString('utf-8', 0, bytesRead);
      const firstLine = content.split('\n')[0];

      // Check shebang
      if (firstLine.startsWith('#!')) {
        const shebang = firstLine.toLowerCase();
        for (const [key, language] of Object.entries(SHEBANG_LANGUAGE_MAP)) {
          if (shebang.includes(key)) {
            return { language, confidence: 0.95 };
          }
        }
      }

      // Check for XML/HTML
      if (content.trim().startsWith('<?xml') || content.trim().startsWith('<!DOCTYPE')) {
        return { language: Language.HTML, confidence: 0.8 };
      }

      // Check for JSON
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try {
          JSON.parse(content);
          return { language: Language.JSON, confidence: 0.7 };
        } catch {
          // Not valid JSON
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if path matches any pattern
   */
  private matchesPatterns(name: string, relativePath: string, patterns: RegExp[]): boolean {
    for (const pattern of patterns) {
      if (pattern.test(name) || pattern.test(relativePath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if file is a test file
   */
  isTestFile(filePath: string): boolean {
    const name = path.basename(filePath);
    return this.matchesPatterns(name, filePath, TEST_FILE_PATTERNS);
  }

  /**
   * Check if file is a config file
   */
  isConfigFile(filePath: string): boolean {
    const name = path.basename(filePath);
    return this.matchesPatterns(name, filePath, CONFIG_FILE_PATTERNS);
  }

  /**
   * Check if file is in build artifacts
   */
  isBuildArtifact(filePath: string): boolean {
    return this.matchesPatterns(path.basename(filePath), filePath, BUILD_ARTIFACT_PATTERNS);
  }

  /**
   * Check if file is binary
   */
  isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    return BINARY_FILE_EXTENSIONS.has(ext);
  }

  /**
   * Get language for extension
   */
  getLanguageForExtension(ext: string): Language {
    const normalized = ext.toLowerCase().replace(/^\./, '');
    return EXTENSION_LANGUAGE_MAP[normalized] ?? Language.OTHER;
  }

  /**
   * Get all supported extensions
   */
  getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_LANGUAGE_MAP);
  }

  /**
   * Get extensions for language
   */
  getExtensionsForLanguage(language: Language): string[] {
    const extensions: string[] = [];
    for (const [ext, lang] of Object.entries(EXTENSION_LANGUAGE_MAP)) {
      if (lang === language) {
        extensions.push(ext);
      }
    }
    return extensions;
  }
}

/**
 * Create a file type detector
 */
export function createFileTypeDetector(): FileTypeDetector {
  return new FileTypeDetector();
}
