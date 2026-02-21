/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  FileInfo,
  DirectoryInfo,
  ProjectStructure,
  ScannerConfig,
} from './types.js';

export {
  FileCategory,
  Language,
  ProjectType,
  DEFAULT_SCANNER_CONFIG,
  EXTENSION_LANGUAGE_MAP,
  EXTENSION_CATEGORY_MAP,
  BINARY_FILE_EXTENSIONS,
} from './types.js';

// File Scanner
export type {
  ScanProgress,
  ScanProgressCallback,
} from './fileScanner.js';

export {
  FileScanner,
  createFileScanner,
} from './fileScanner.js';

// File Type Detector
export type {
  FileTypeResult,
} from './fileTypeDetector.js';

export {
  FileTypeDetector,
  createFileTypeDetector,
} from './fileTypeDetector.js';
