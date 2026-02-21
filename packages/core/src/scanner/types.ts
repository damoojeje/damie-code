/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * File type category
 */
export enum FileCategory {
  SOURCE = 'source',
  TEST = 'test',
  CONFIG = 'config',
  DOCUMENTATION = 'documentation',
  ASSET = 'asset',
  BUILD = 'build',
  DATA = 'data',
  OTHER = 'other',
}

/**
 * Programming language
 */
export enum Language {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  RUST = 'rust',
  GO = 'go',
  JAVA = 'java',
  CSHARP = 'csharp',
  CPP = 'cpp',
  C = 'c',
  RUBY = 'ruby',
  PHP = 'php',
  SWIFT = 'swift',
  KOTLIN = 'kotlin',
  HTML = 'html',
  CSS = 'css',
  SCSS = 'scss',
  JSON = 'json',
  YAML = 'yaml',
  MARKDOWN = 'markdown',
  SQL = 'sql',
  SHELL = 'shell',
  OTHER = 'other',
}

/**
 * File information
 */
export interface FileInfo {
  /** Absolute file path */
  path: string;
  /** Relative path from project root */
  relativePath: string;
  /** File name */
  name: string;
  /** File extension (without dot) */
  extension: string;
  /** File size in bytes */
  size: number;
  /** Last modified date */
  modifiedAt: Date;
  /** File category */
  category: FileCategory;
  /** Detected language */
  language: Language;
  /** Line count (for text files) */
  lineCount?: number;
  /** Is binary file */
  isBinary: boolean;
  /** Is hidden file */
  isHidden: boolean;
}

/**
 * Directory information
 */
export interface DirectoryInfo {
  /** Absolute path */
  path: string;
  /** Relative path from project root */
  relativePath: string;
  /** Directory name */
  name: string;
  /** Number of files (direct children) */
  fileCount: number;
  /** Number of subdirectories (direct children) */
  directoryCount: number;
  /** Total files (recursive) */
  totalFiles: number;
  /** Total size in bytes (recursive) */
  totalSize: number;
  /** Is hidden directory */
  isHidden: boolean;
}

/**
 * Project structure summary
 */
export interface ProjectStructure {
  /** Project root path */
  rootPath: string;
  /** Project name (from package.json or directory name) */
  name: string;
  /** Detected project type */
  projectType: ProjectType;
  /** Primary language */
  primaryLanguage: Language;
  /** All detected languages */
  languages: Language[];
  /** Total file count */
  totalFiles: number;
  /** Total directory count */
  totalDirectories: number;
  /** Total size in bytes */
  totalSize: number;
  /** Files by category */
  filesByCategory: Record<FileCategory, number>;
  /** Files by language */
  filesByLanguage: Record<Language, number>;
  /** Key directories */
  keyDirectories: DirectoryInfo[];
  /** Entry points */
  entryPoints: string[];
  /** Config files */
  configFiles: string[];
  /** Scan timestamp */
  scannedAt: Date;
  /** Scan duration in ms */
  scanDuration: number;
}

/**
 * Project type
 */
export enum ProjectType {
  NODEJS = 'nodejs',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  RUST = 'rust',
  GO = 'go',
  JAVA = 'java',
  DOTNET = 'dotnet',
  FRONTEND = 'frontend',
  MONOREPO = 'monorepo',
  UNKNOWN = 'unknown',
}

/**
 * Scanner configuration
 */
export interface ScannerConfig {
  /** Maximum depth to scan */
  maxDepth: number;
  /** Maximum files to scan */
  maxFiles: number;
  /** Patterns to exclude */
  excludePatterns: string[];
  /** Follow symlinks */
  followSymlinks: boolean;
  /** Count lines in files */
  countLines: boolean;
  /** Include hidden files */
  includeHidden: boolean;
  /** File size limit for content reading (bytes) */
  maxFileSize: number;
}

/**
 * Default scanner configuration
 */
export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  maxDepth: 20,
  maxFiles: 50000,
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    'target',
    '.next',
    '.nuxt',
    '__pycache__',
    '.pytest_cache',
    'venv',
    '.venv',
    'coverage',
    '.nyc_output',
    '.idea',
    '.vscode',
  ],
  followSymlinks: false,
  countLines: true,
  includeHidden: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

/**
 * File extension to language mapping
 */
export const EXTENSION_LANGUAGE_MAP: Record<string, Language> = {
  ts: Language.TYPESCRIPT,
  tsx: Language.TYPESCRIPT,
  mts: Language.TYPESCRIPT,
  cts: Language.TYPESCRIPT,
  js: Language.JAVASCRIPT,
  jsx: Language.JAVASCRIPT,
  mjs: Language.JAVASCRIPT,
  cjs: Language.JAVASCRIPT,
  py: Language.PYTHON,
  pyw: Language.PYTHON,
  pyx: Language.PYTHON,
  rs: Language.RUST,
  go: Language.GO,
  java: Language.JAVA,
  cs: Language.CSHARP,
  cpp: Language.CPP,
  cc: Language.CPP,
  cxx: Language.CPP,
  c: Language.C,
  h: Language.C,
  hpp: Language.CPP,
  rb: Language.RUBY,
  php: Language.PHP,
  swift: Language.SWIFT,
  kt: Language.KOTLIN,
  kts: Language.KOTLIN,
  html: Language.HTML,
  htm: Language.HTML,
  css: Language.CSS,
  scss: Language.SCSS,
  sass: Language.SCSS,
  less: Language.CSS,
  json: Language.JSON,
  yaml: Language.YAML,
  yml: Language.YAML,
  md: Language.MARKDOWN,
  markdown: Language.MARKDOWN,
  sql: Language.SQL,
  sh: Language.SHELL,
  bash: Language.SHELL,
  zsh: Language.SHELL,
  fish: Language.SHELL,
  ps1: Language.SHELL,
};

/**
 * File extension to category mapping
 */
export const EXTENSION_CATEGORY_MAP: Record<string, FileCategory> = {
  // Config
  json: FileCategory.CONFIG,
  yaml: FileCategory.CONFIG,
  yml: FileCategory.CONFIG,
  toml: FileCategory.CONFIG,
  ini: FileCategory.CONFIG,
  env: FileCategory.CONFIG,
  // Documentation
  md: FileCategory.DOCUMENTATION,
  markdown: FileCategory.DOCUMENTATION,
  rst: FileCategory.DOCUMENTATION,
  txt: FileCategory.DOCUMENTATION,
  // Assets
  png: FileCategory.ASSET,
  jpg: FileCategory.ASSET,
  jpeg: FileCategory.ASSET,
  gif: FileCategory.ASSET,
  svg: FileCategory.ASSET,
  ico: FileCategory.ASSET,
  webp: FileCategory.ASSET,
  mp3: FileCategory.ASSET,
  mp4: FileCategory.ASSET,
  wav: FileCategory.ASSET,
  pdf: FileCategory.ASSET,
  // Data
  csv: FileCategory.DATA,
  sql: FileCategory.DATA,
  db: FileCategory.DATA,
  sqlite: FileCategory.DATA,
};

/**
 * Binary file extensions
 */
export const BINARY_FILE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg',
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'avi', 'mov',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
  'exe', 'dll', 'so', 'dylib', 'bin',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'db', 'sqlite', 'sqlite3',
]);
