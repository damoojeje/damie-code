/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * System information
 */
export interface SystemInfo {
  platform: string;
  arch: string;
  hostname: string;
  release: string;
  uptime: number;
  totalMemory: number;
  freeMemory: number;
  cpuCount: number;
  cpuModel: string;
  loadAverage: number[];
}

/**
 * CPU usage information
 */
export interface CpuUsage {
  user: number;
  system: number;
  idle: number;
  total: number;
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  total: number;
  used: number;
  free: number;
  usedPercent: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

/**
 * Disk usage information
 */
export interface DiskUsage {
  path: string;
  total: number;
  used: number;
  free: number;
  usedPercent: number;
}

/**
 * Network interface information
 */
export interface NetworkInterface {
  name: string;
  address: string;
  family: string;
  internal: boolean;
  mac: string;
}

/**
 * Process information
 */
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  uptime: number;
}

/**
 * Runtime information
 */
export interface RuntimeInfo {
  name: string;
  version: string;
  path: string;
  available: boolean;
}

/**
 * Diagnostic check result
 */
export interface DiagnosticResult {
  name: string;
  status: DiagnosticStatus;
  message: string;
  details?: Record<string, unknown>;
  recommendation?: string;
}

/**
 * Diagnostic status
 */
export enum DiagnosticStatus {
  PASS = 'pass',
  WARN = 'warn',
  FAIL = 'fail',
  SKIP = 'skip',
}

/**
 * Diagnostic report
 */
export interface DiagnosticReport {
  timestamp: Date;
  duration: number;
  results: DiagnosticResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Environment variable info
 */
export interface EnvVariable {
  name: string;
  value: string;
  source?: string;
}

/**
 * System monitor configuration
 */
export interface SystemMonitorConfig {
  checkInterval?: number;
  diskPaths?: string[];
}
