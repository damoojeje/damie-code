/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Export types
export type {
  PkgDependency,
  PackageInfo,
  Vulnerability,
  PkgInstallResult,
  UpdateResult,
  AuditResult,
  PackageManagerConfig,
} from './types.js';

export {
  PackageManagerType,
  PkgDependencyType,
  VulnerabilitySeverity,
} from './types.js';

// Export package manager
export { PackageManager, createPackageManager } from './packageManager.js';
