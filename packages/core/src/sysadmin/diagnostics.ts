/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  type DiagnosticResult,
  type DiagnosticReport,
  DiagnosticStatus,
} from './types.js';
import { SystemMonitor } from './systemMonitor.js';

/**
 * Diagnostics - Run diagnostic checks on the system and Damie installation
 *
 * Provides:
 * - Configuration validation
 * - API connectivity checks
 * - Skill installation verification
 * - Dependency checks
 * - System requirements verification
 */
export class Diagnostics {
  private monitor: SystemMonitor;

  constructor() {
    this.monitor = new SystemMonitor();
  }

  /**
   * Run all diagnostic checks
   */
  async runAllChecks(): Promise<DiagnosticReport> {
    const startTime = Date.now();
    const results: DiagnosticResult[] = [];

    // Run all checks
    results.push(await this.checkNodeVersion());
    results.push(await this.checkConfigFile());
    results.push(await this.checkSkillsDirectory());
    results.push(await this.checkPluginsDirectory());
    results.push(await this.checkDiskSpace());
    results.push(await this.checkMemory());
    results.push(await this.checkNetworkConnectivity());
    results.push(await this.checkGitInstalled());
    results.push(await this.checkWorkingDirectory());

    const duration = Date.now() - startTime;

    return {
      timestamp: new Date(),
      duration,
      results,
      summary: this.summarizeResults(results),
    };
  }

  /**
   * Summarize diagnostic results
   */
  private summarizeResults(results: DiagnosticResult[]): DiagnosticReport['summary'] {
    return {
      total: results.length,
      passed: results.filter((r) => r.status === DiagnosticStatus.PASS).length,
      warnings: results.filter((r) => r.status === DiagnosticStatus.WARN).length,
      failed: results.filter((r) => r.status === DiagnosticStatus.FAIL).length,
      skipped: results.filter((r) => r.status === DiagnosticStatus.SKIP).length,
    };
  }

  /**
   * Check Node.js version
   */
  async checkNodeVersion(): Promise<DiagnosticResult> {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    const requiredVersion = 20;

    if (majorVersion >= requiredVersion) {
      return {
        name: 'Node.js Version',
        status: DiagnosticStatus.PASS,
        message: `Node.js ${nodeVersion} meets requirements (>= v${requiredVersion})`,
        details: { version: nodeVersion, required: `v${requiredVersion}+` },
      };
    } else {
      return {
        name: 'Node.js Version',
        status: DiagnosticStatus.FAIL,
        message: `Node.js ${nodeVersion} is below required version v${requiredVersion}`,
        details: { version: nodeVersion, required: `v${requiredVersion}+` },
        recommendation: `Upgrade Node.js to version ${requiredVersion} or higher`,
      };
    }
  }

  /**
   * Check config file exists and is valid
   */
  async checkConfigFile(): Promise<DiagnosticResult> {
    const configPath = path.join(os.homedir(), '.damie', 'config.yaml');

    if (!fs.existsSync(configPath)) {
      return {
        name: 'Configuration File',
        status: DiagnosticStatus.WARN,
        message: 'Configuration file not found',
        details: { path: configPath },
        recommendation: 'Run "damie setup" to create configuration',
      };
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      if (content.trim().length === 0) {
        return {
          name: 'Configuration File',
          status: DiagnosticStatus.WARN,
          message: 'Configuration file is empty',
          details: { path: configPath },
          recommendation: 'Run "damie setup" to configure',
        };
      }

      return {
        name: 'Configuration File',
        status: DiagnosticStatus.PASS,
        message: 'Configuration file found and readable',
        details: { path: configPath },
      };
    } catch (error) {
      return {
        name: 'Configuration File',
        status: DiagnosticStatus.FAIL,
        message: 'Cannot read configuration file',
        details: {
          path: configPath,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        recommendation: 'Check file permissions or recreate config',
      };
    }
  }

  /**
   * Check skills directory
   */
  async checkSkillsDirectory(): Promise<DiagnosticResult> {
    const skillsPath = path.join(os.homedir(), '.damie', 'skills');

    if (!fs.existsSync(skillsPath)) {
      return {
        name: 'Skills Directory',
        status: DiagnosticStatus.WARN,
        message: 'Skills directory not found',
        details: { path: skillsPath },
        recommendation: 'Run "damie skills install-bundled" to install default skills',
      };
    }

    try {
      const skills = fs.readdirSync(skillsPath);
      const skillCount = skills.filter((s) =>
        fs.statSync(path.join(skillsPath, s)).isDirectory()
      ).length;

      if (skillCount === 0) {
        return {
          name: 'Skills Directory',
          status: DiagnosticStatus.WARN,
          message: 'No skills installed',
          details: { path: skillsPath, count: 0 },
          recommendation: 'Run "damie skills install-bundled" to install default skills',
        };
      }

      return {
        name: 'Skills Directory',
        status: DiagnosticStatus.PASS,
        message: `${skillCount} skill(s) installed`,
        details: { path: skillsPath, count: skillCount },
      };
    } catch (error) {
      return {
        name: 'Skills Directory',
        status: DiagnosticStatus.FAIL,
        message: 'Cannot read skills directory',
        details: {
          path: skillsPath,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Check plugins directory
   */
  async checkPluginsDirectory(): Promise<DiagnosticResult> {
    const pluginsPath = path.join(os.homedir(), '.damie', 'plugins');

    if (!fs.existsSync(pluginsPath)) {
      return {
        name: 'Plugins Directory',
        status: DiagnosticStatus.PASS,
        message: 'Plugins directory not created (optional)',
        details: { path: pluginsPath },
      };
    }

    try {
      const plugins = fs.readdirSync(pluginsPath);
      const pluginCount = plugins.filter((p) =>
        fs.statSync(path.join(pluginsPath, p)).isDirectory()
      ).length;

      return {
        name: 'Plugins Directory',
        status: DiagnosticStatus.PASS,
        message: `${pluginCount} plugin(s) installed`,
        details: { path: pluginsPath, count: pluginCount },
      };
    } catch (error) {
      return {
        name: 'Plugins Directory',
        status: DiagnosticStatus.WARN,
        message: 'Cannot read plugins directory',
        details: {
          path: pluginsPath,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Check disk space
   */
  async checkDiskSpace(): Promise<DiagnosticResult> {
    try {
      const diskUsage = this.monitor.getDiskUsage();

      if (diskUsage.length === 0) {
        return {
          name: 'Disk Space',
          status: DiagnosticStatus.SKIP,
          message: 'Unable to check disk space',
        };
      }

      const mainDisk = diskUsage[0];
      const freeGB = mainDisk.free / (1024 * 1024 * 1024);
      const minFreeGB = 1;

      if (freeGB < minFreeGB) {
        return {
          name: 'Disk Space',
          status: DiagnosticStatus.FAIL,
          message: `Low disk space: ${freeGB.toFixed(2)} GB free`,
          details: {
            path: mainDisk.path,
            free: this.monitor.formatBytes(mainDisk.free),
            total: this.monitor.formatBytes(mainDisk.total),
            usedPercent: `${mainDisk.usedPercent.toFixed(1)}%`,
          },
          recommendation: 'Free up disk space to ensure smooth operation',
        };
      } else if (freeGB < 5) {
        return {
          name: 'Disk Space',
          status: DiagnosticStatus.WARN,
          message: `Disk space is getting low: ${freeGB.toFixed(2)} GB free`,
          details: {
            path: mainDisk.path,
            free: this.monitor.formatBytes(mainDisk.free),
            total: this.monitor.formatBytes(mainDisk.total),
          },
          recommendation: 'Consider freeing up some disk space',
        };
      }

      return {
        name: 'Disk Space',
        status: DiagnosticStatus.PASS,
        message: `${freeGB.toFixed(2)} GB free disk space`,
        details: {
          path: mainDisk.path,
          free: this.monitor.formatBytes(mainDisk.free),
          total: this.monitor.formatBytes(mainDisk.total),
        },
      };
    } catch {
      return {
        name: 'Disk Space',
        status: DiagnosticStatus.SKIP,
        message: 'Unable to check disk space',
      };
    }
  }

  /**
   * Check available memory
   */
  async checkMemory(): Promise<DiagnosticResult> {
    const memUsage = this.monitor.getMemoryUsage();
    const freeGB = memUsage.free / (1024 * 1024 * 1024);
    const totalGB = memUsage.total / (1024 * 1024 * 1024);
    const minFreeGB = 0.5;

    if (freeGB < minFreeGB) {
      return {
        name: 'Memory',
        status: DiagnosticStatus.WARN,
        message: `Low memory: ${freeGB.toFixed(2)} GB free of ${totalGB.toFixed(2)} GB`,
        details: {
          free: this.monitor.formatBytes(memUsage.free),
          total: this.monitor.formatBytes(memUsage.total),
          usedPercent: `${memUsage.usedPercent.toFixed(1)}%`,
        },
        recommendation: 'Close some applications to free up memory',
      };
    }

    return {
      name: 'Memory',
      status: DiagnosticStatus.PASS,
      message: `${freeGB.toFixed(2)} GB free of ${totalGB.toFixed(2)} GB`,
      details: {
        free: this.monitor.formatBytes(memUsage.free),
        total: this.monitor.formatBytes(memUsage.total),
        usedPercent: `${memUsage.usedPercent.toFixed(1)}%`,
      },
    };
  }

  /**
   * Check network connectivity
   */
  async checkNetworkConnectivity(): Promise<DiagnosticResult> {
    const isConnected = await this.monitor.checkNetworkConnectivity();

    if (isConnected) {
      return {
        name: 'Network Connectivity',
        status: DiagnosticStatus.PASS,
        message: 'Internet connection available',
      };
    } else {
      return {
        name: 'Network Connectivity',
        status: DiagnosticStatus.WARN,
        message: 'No internet connection detected',
        recommendation: 'Check your network connection for API access',
      };
    }
  }

  /**
   * Check Git is installed
   */
  async checkGitInstalled(): Promise<DiagnosticResult> {
    const gitInfo = this.monitor.checkRuntime('git', '--version');

    if (gitInfo.available) {
      return {
        name: 'Git',
        status: DiagnosticStatus.PASS,
        message: `Git ${gitInfo.version} installed`,
        details: { version: gitInfo.version, path: gitInfo.path },
      };
    } else {
      return {
        name: 'Git',
        status: DiagnosticStatus.WARN,
        message: 'Git not found in PATH',
        recommendation: 'Install Git for version control features',
      };
    }
  }

  /**
   * Check working directory
   */
  async checkWorkingDirectory(): Promise<DiagnosticResult> {
    const cwdInfo = this.monitor.getWorkingDirectoryInfo();

    if (!cwdInfo.exists) {
      return {
        name: 'Working Directory',
        status: DiagnosticStatus.FAIL,
        message: 'Working directory does not exist',
        details: { path: cwdInfo.path },
      };
    }

    if (!cwdInfo.writable) {
      return {
        name: 'Working Directory',
        status: DiagnosticStatus.WARN,
        message: 'Working directory is not writable',
        details: { path: cwdInfo.path },
        recommendation: 'Check directory permissions',
      };
    }

    return {
      name: 'Working Directory',
      status: DiagnosticStatus.PASS,
      message: cwdInfo.isGitRepo
        ? 'Working directory is a Git repository'
        : 'Working directory is accessible',
      details: {
        path: cwdInfo.path,
        isGitRepo: cwdInfo.isGitRepo,
      },
    };
  }

  /**
   * Format diagnostic report for display
   */
  formatReport(report: DiagnosticReport): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                    DAMIE CODE DIAGNOSTICS                      ');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    for (const result of report.results) {
      const icon = this.getStatusIcon(result.status);
      lines.push(`${icon} ${result.name}: ${result.message}`);

      if (result.recommendation) {
        lines.push(`   └─ Recommendation: ${result.recommendation}`);
      }
    }

    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(
      `Summary: ${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failed} failed`
    );
    lines.push(`Duration: ${report.duration}ms`);
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: DiagnosticStatus): string {
    switch (status) {
      case DiagnosticStatus.PASS:
        return '✓';
      case DiagnosticStatus.WARN:
        return '⚠';
      case DiagnosticStatus.FAIL:
        return '✗';
      case DiagnosticStatus.SKIP:
        return '○';
      default:
        return '?';
    }
  }
}

/**
 * Factory function to create Diagnostics
 */
export function createDiagnostics(): Diagnostics {
  return new Diagnostics();
}
