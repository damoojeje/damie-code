/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  FileInfo,
  DirectoryInfo,
  ProjectStructure,
  ScannerConfig,
} from './types.js';
import {
  FileCategory,
  Language,
  ProjectType,
  DEFAULT_SCANNER_CONFIG,
  EXTENSION_LANGUAGE_MAP,
  EXTENSION_CATEGORY_MAP,
  BINARY_FILE_EXTENSIONS,
} from './types.js';

/**
 * Scan progress callback
 */
export type ScanProgressCallback = (progress: ScanProgress) => void;

/**
 * Scan progress information
 */
export interface ScanProgress {
  /** Files scanned so far */
  filesScanned: number;
  /** Directories scanned so far */
  directoriesScanned: number;
  /** Current path being scanned */
  currentPath: string;
  /** Percentage complete (0-100) */
  percentComplete: number;
}

/**
 * File Scanner
 *
 * Scans project directories to analyze structure, detect languages,
 * and build project summaries.
 */
export class FileScanner {
  private config: ScannerConfig;
  private excludePatterns: Set<string>;

  constructor(config: Partial<ScannerConfig> = {}) {
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...config };
    this.excludePatterns = new Set(this.config.excludePatterns);
  }

  /**
   * Scan a project directory
   */
  async scan(
    rootPath: string,
    onProgress?: ScanProgressCallback,
  ): Promise<ProjectStructure> {
    const startTime = Date.now();
    const absoluteRoot = path.resolve(rootPath);

    if (!fs.existsSync(absoluteRoot)) {
      throw new Error(`Path does not exist: ${absoluteRoot}`);
    }

    const stats = fs.statSync(absoluteRoot);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${absoluteRoot}`);
    }

    // Initialize counters
    const filesByCategory: Record<FileCategory, number> = {} as Record<FileCategory, number>;
    const filesByLanguage: Record<Language, number> = {} as Record<Language, number>;

    for (const category of Object.values(FileCategory)) {
      filesByCategory[category] = 0;
    }
    for (const lang of Object.values(Language)) {
      filesByLanguage[lang] = 0;
    }

    // Scan recursively
    const { files, directories, totalSize } = await this.scanDirectory(
      absoluteRoot,
      absoluteRoot,
      0,
      onProgress,
    );

    // Process files
    for (const file of files) {
      filesByCategory[file.category]++;
      filesByLanguage[file.language]++;
    }

    // Determine primary language
    let primaryLanguage = Language.OTHER;
    let maxCount = 0;
    for (const [lang, count] of Object.entries(filesByLanguage)) {
      if (count > maxCount && lang !== Language.OTHER) {
        maxCount = count;
        primaryLanguage = lang as Language;
      }
    }

    // Get detected languages (with > 0 files)
    const languages = Object.entries(filesByLanguage)
      .filter(([lang, count]) => count > 0 && lang !== Language.OTHER)
      .map(([lang]) => lang as Language);

    // Detect project type
    const projectType = this.detectProjectType(absoluteRoot, files);

    // Find entry points
    const entryPoints = this.findEntryPoints(files, projectType);

    // Find config files
    const configFiles = files
      .filter((f) => f.category === FileCategory.CONFIG)
      .map((f) => f.relativePath);

    // Find key directories
    const keyDirectories = directories
      .filter((d) => this.isKeyDirectory(d.name))
      .slice(0, 20);

    // Get project name
    const projectName = this.getProjectName(absoluteRoot);

    return {
      rootPath: absoluteRoot,
      name: projectName,
      projectType,
      primaryLanguage,
      languages,
      totalFiles: files.length,
      totalDirectories: directories.length,
      totalSize,
      filesByCategory,
      filesByLanguage,
      keyDirectories,
      entryPoints,
      configFiles,
      scannedAt: new Date(),
      scanDuration: Date.now() - startTime,
    };
  }

  /**
   * Scan a directory recursively
   */
  private async scanDirectory(
    dirPath: string,
    rootPath: string,
    depth: number,
    onProgress?: ScanProgressCallback,
  ): Promise<{
    files: FileInfo[];
    directories: DirectoryInfo[];
    totalSize: number;
  }> {
    if (depth > this.config.maxDepth) {
      return { files: [], directories: [], totalSize: 0 };
    }

    const files: FileInfo[] = [];
    const directories: DirectoryInfo[] = [];
    let totalSize = 0;
    let localFileCount = 0;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        // Check exclusions
        if (this.shouldExclude(entry.name, relativePath)) {
          continue;
        }

        // Check hidden files
        if (entry.name.startsWith('.') && !this.config.includeHidden) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recurse into subdirectory
          const subResult = await this.scanDirectory(
            fullPath,
            rootPath,
            depth + 1,
            onProgress,
          );

          files.push(...subResult.files);
          directories.push(...subResult.directories);

          const dirInfo: DirectoryInfo = {
            path: fullPath,
            relativePath,
            name: entry.name,
            fileCount: subResult.files.filter(
              (f) => path.dirname(f.relativePath) === relativePath,
            ).length,
            directoryCount: subResult.directories.filter(
              (d) => path.dirname(d.relativePath) === relativePath,
            ).length,
            totalFiles: subResult.files.length,
            totalSize: subResult.totalSize,
            isHidden: entry.name.startsWith('.'),
          };

          directories.push(dirInfo);
          totalSize += subResult.totalSize;
        } else if (entry.isFile()) {
          if (files.length >= this.config.maxFiles) {
            continue;
          }

          const fileInfo = await this.getFileInfo(fullPath, relativePath);
          if (fileInfo) {
            files.push(fileInfo);
            totalSize += fileInfo.size;
            localFileCount++;

            if (onProgress && localFileCount % 100 === 0) {
              onProgress({
                filesScanned: files.length,
                directoriesScanned: directories.length,
                currentPath: relativePath,
                percentComplete: Math.min(
                  100,
                  (files.length / this.config.maxFiles) * 100,
                ),
              });
            }
          }
        }
      }
    } catch {
      // Ignore permission errors
    }

    return { files, directories, totalSize };
  }

  /**
   * Get file information
   */
  private async getFileInfo(
    filePath: string,
    relativePath: string,
  ): Promise<FileInfo | null> {
    try {
      const stats = fs.statSync(filePath);
      const name = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase().slice(1);

      const language = this.getLanguage(ext, name);
      const category = this.getCategory(ext, name, relativePath);
      const isBinary = BINARY_FILE_EXTENSIONS.has(ext);

      let lineCount: number | undefined;
      if (
        this.config.countLines &&
        !isBinary &&
        stats.size <= this.config.maxFileSize
      ) {
        lineCount = await this.countLines(filePath);
      }

      return {
        path: filePath,
        relativePath,
        name,
        extension: ext,
        size: stats.size,
        modifiedAt: stats.mtime,
        category,
        language,
        lineCount,
        isBinary,
        isHidden: name.startsWith('.'),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get language from extension
   */
  private getLanguage(ext: string, name: string): Language {
    // Special case for config files
    if (name === 'Makefile' || name === 'Dockerfile') {
      return Language.SHELL;
    }

    return EXTENSION_LANGUAGE_MAP[ext] ?? Language.OTHER;
  }

  /**
   * Get category from extension and path
   */
  private getCategory(ext: string, name: string, relativePath: string): FileCategory {
    // Test files
    if (
      name.includes('.test.') ||
      name.includes('.spec.') ||
      name.includes('_test.') ||
      name.startsWith('test_') ||
      relativePath.includes('__tests__') ||
      relativePath.includes('/tests/') ||
      relativePath.includes('/test/')
    ) {
      return FileCategory.TEST;
    }

    // Build outputs
    if (
      relativePath.startsWith('dist/') ||
      relativePath.startsWith('build/') ||
      relativePath.startsWith('out/')
    ) {
      return FileCategory.BUILD;
    }

    // Check extension-based category
    if (ext in EXTENSION_CATEGORY_MAP) {
      return EXTENSION_CATEGORY_MAP[ext];
    }

    // Source files
    const sourceLanguages = [
      Language.TYPESCRIPT,
      Language.JAVASCRIPT,
      Language.PYTHON,
      Language.RUST,
      Language.GO,
      Language.JAVA,
      Language.CSHARP,
      Language.CPP,
      Language.C,
      Language.RUBY,
      Language.PHP,
      Language.SWIFT,
      Language.KOTLIN,
    ];

    const lang = this.getLanguage(ext, name);
    if (sourceLanguages.includes(lang)) {
      return FileCategory.SOURCE;
    }

    return FileCategory.OTHER;
  }

  /**
   * Count lines in a file
   */
  private async countLines(filePath: string): Promise<number> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  /**
   * Check if path should be excluded
   */
  private shouldExclude(name: string, relativePath: string): boolean {
    if (this.excludePatterns.has(name)) {
      return true;
    }

    for (const pattern of this.excludePatterns) {
      if (relativePath.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if directory is a key directory
   */
  private isKeyDirectory(name: string): boolean {
    const keyDirs = new Set([
      'src',
      'lib',
      'app',
      'apps',
      'packages',
      'components',
      'pages',
      'api',
      'services',
      'utils',
      'helpers',
      'models',
      'types',
      'interfaces',
      'hooks',
      'store',
      'redux',
      'tests',
      'test',
      '__tests__',
      'spec',
      'docs',
      'documentation',
      'scripts',
      'bin',
      'config',
      'assets',
      'public',
      'static',
      'resources',
    ]);

    return keyDirs.has(name.toLowerCase());
  }

  /**
   * Detect project type
   */
  private detectProjectType(rootPath: string, files: FileInfo[]): ProjectType {
    const fileNames = new Set(files.map((f) => f.name));
    const hasFile = (name: string) => fileNames.has(name) || fs.existsSync(path.join(rootPath, name));

    // Check for monorepo
    if (
      hasFile('lerna.json') ||
      hasFile('pnpm-workspace.yaml') ||
      hasFile('turbo.json') ||
      fs.existsSync(path.join(rootPath, 'packages'))
    ) {
      return ProjectType.MONOREPO;
    }

    // TypeScript
    if (hasFile('tsconfig.json')) {
      return ProjectType.TYPESCRIPT;
    }

    // Node.js
    if (hasFile('package.json')) {
      return ProjectType.NODEJS;
    }

    // Python
    if (
      hasFile('pyproject.toml') ||
      hasFile('setup.py') ||
      hasFile('requirements.txt') ||
      hasFile('Pipfile')
    ) {
      return ProjectType.PYTHON;
    }

    // Rust
    if (hasFile('Cargo.toml')) {
      return ProjectType.RUST;
    }

    // Go
    if (hasFile('go.mod')) {
      return ProjectType.GO;
    }

    // Java
    if (hasFile('pom.xml') || hasFile('build.gradle') || hasFile('build.gradle.kts')) {
      return ProjectType.JAVA;
    }

    // .NET
    if (files.some((f) => f.extension === 'csproj' || f.extension === 'sln')) {
      return ProjectType.DOTNET;
    }

    // Frontend
    if (
      hasFile('index.html') ||
      hasFile('vite.config.js') ||
      hasFile('vite.config.ts') ||
      hasFile('next.config.js') ||
      hasFile('nuxt.config.js')
    ) {
      return ProjectType.FRONTEND;
    }

    return ProjectType.UNKNOWN;
  }

  /**
   * Find entry points
   */
  private findEntryPoints(files: FileInfo[], projectType: ProjectType): string[] {
    const entryPoints: string[] = [];

    const commonEntryPoints = [
      'src/index.ts',
      'src/index.js',
      'src/main.ts',
      'src/main.js',
      'src/app.ts',
      'src/app.js',
      'index.ts',
      'index.js',
      'main.ts',
      'main.js',
      'app.ts',
      'app.js',
      'main.py',
      'app.py',
      '__main__.py',
      'src/main.rs',
      'main.go',
      'cmd/main.go',
    ];

    for (const entry of commonEntryPoints) {
      // Normalize entry path for cross-platform comparison
      const normalizedEntry = entry.replace(/\//g, path.sep);
      const found = files.find((f) => f.relativePath === normalizedEntry);
      if (found) {
        entryPoints.push(found.relativePath);
      }
    }

    // Project-specific entry points
    switch (projectType) {
      case ProjectType.NODEJS:
      case ProjectType.TYPESCRIPT: {
        // Check package.json main field
        const pkgFiles = files.filter((f) => f.name === 'package.json');
        for (const pkg of pkgFiles.slice(0, 5)) {
          try {
            const content = fs.readFileSync(pkg.path, 'utf-8');
            const json = JSON.parse(content);
            if (json.main) {
              entryPoints.push(json.main);
            }
            if (json.bin) {
              if (typeof json.bin === 'string') {
                entryPoints.push(json.bin);
              } else if (typeof json.bin === 'object') {
                entryPoints.push(...Object.values(json.bin as Record<string, string>));
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
        break;
      }

      default:
        // No additional entry points for other project types
        break;
    }

    return [...new Set(entryPoints)];
  }

  /**
   * Get project name
   */
  private getProjectName(rootPath: string): string {
    // Try package.json
    const pkgPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const content = fs.readFileSync(pkgPath, 'utf-8');
        const json = JSON.parse(content);
        if (json.name) {
          return json.name;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Try pyproject.toml
    const pyprojectPath = path.join(rootPath, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
      try {
        const content = fs.readFileSync(pyprojectPath, 'utf-8');
        const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
        if (nameMatch) {
          return nameMatch[1];
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Use directory name
    return path.basename(rootPath);
  }

  /**
   * Scan single file
   */
  async scanFile(filePath: string, rootPath?: string): Promise<FileInfo | null> {
    const root = rootPath ?? path.dirname(filePath);
    const relativePath = path.relative(root, filePath);
    return this.getFileInfo(filePath, relativePath);
  }

  /**
   * Get summary string
   */
  getSummaryString(structure: ProjectStructure): string {
    const lines: string[] = [];

    lines.push(`Project: ${structure.name}`);
    lines.push(`Type: ${structure.projectType}`);
    lines.push(`Primary Language: ${structure.primaryLanguage}`);
    lines.push(`Files: ${structure.totalFiles}`);
    lines.push(`Directories: ${structure.totalDirectories}`);
    lines.push(`Size: ${this.formatSize(structure.totalSize)}`);
    lines.push(`Scan Time: ${structure.scanDuration}ms`);

    if (structure.languages.length > 1) {
      lines.push(`Languages: ${structure.languages.join(', ')}`);
    }

    if (structure.entryPoints.length > 0) {
      lines.push(`Entry Points: ${structure.entryPoints.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Format size in human readable format
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

/**
 * Create a file scanner
 */
export function createFileScanner(config?: Partial<ScannerConfig>): FileScanner {
  return new FileScanner(config);
}
