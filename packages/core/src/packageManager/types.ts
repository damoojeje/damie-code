/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Package manager type
 */
export enum PackageManagerType {
  NPM = 'npm',
  YARN = 'yarn',
  PNPM = 'pnpm',
  BUN = 'bun',
  PIP = 'pip',
  POETRY = 'poetry',
  CARGO = 'cargo',
  GO = 'go',
  UNKNOWN = 'unknown',
}

/**
 * Package dependency
 */
export interface PkgDependency {
  name: string;
  version: string;
  type: PkgDependencyType;
  resolved?: string;
  integrity?: string;
  dev?: boolean;
  peer?: boolean;
  optional?: boolean;
}

/**
 * Package dependency type
 */
export enum PkgDependencyType {
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
  PEER = 'peer',
  OPTIONAL = 'optional',
}

/**
 * Package info from registry
 */
export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  versions?: string[];
  latestVersion?: string;
}

/**
 * Vulnerability info
 */
export interface Vulnerability {
  id: string;
  package: string;
  severity: VulnerabilitySeverity;
  title: string;
  description?: string;
  fixedIn?: string;
  url?: string;
}

/**
 * Vulnerability severity
 */
export enum VulnerabilitySeverity {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Package install result
 */
export interface PkgInstallResult {
  success: boolean;
  installed: string[];
  failed: string[];
  duration: number;
  output?: string;
  error?: string;
}

/**
 * Update result
 */
export interface UpdateResult {
  success: boolean;
  updated: Array<{
    name: string;
    from: string;
    to: string;
  }>;
  failed: string[];
  duration: number;
}

/**
 * Audit result
 */
export interface AuditResult {
  success: boolean;
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
}

/**
 * Package manager configuration
 */
export interface PackageManagerConfig {
  workingDirectory?: string;
  preferredManager?: PackageManagerType;
  autoDetect?: boolean;
}
