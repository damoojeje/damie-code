/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import {
  type SystemInfo,
  type CpuUsage,
  type MemoryUsage,
  type DiskUsage,
  type NetworkInterface,
  type RuntimeInfo,
  type EnvVariable,
  type SystemMonitorConfig,
} from './types.js';

/**
 * SystemMonitor - Provides system information and monitoring
 *
 * Provides:
 * - CPU, memory, disk usage
 * - Network interfaces
 * - Running processes
 * - Environment variables
 * - Installed runtimes detection
 */
export class SystemMonitor {
  private config: SystemMonitorConfig;

  constructor(config?: SystemMonitorConfig) {
    this.config = {
      checkInterval: config?.checkInterval ?? 5000,
      diskPaths: config?.diskPaths ?? ['/'],
    };
  }

  /**
   * Get comprehensive system information
   */
  getSystemInfo(): SystemInfo {
    const cpus = os.cpus();

    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      release: os.release(),
      uptime: os.uptime(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model ?? 'Unknown',
      loadAverage: os.loadavg(),
    };
  }

  /**
   * Get CPU usage
   */
  getCpuUsage(): CpuUsage {
    const cpus = os.cpus();
    let user = 0;
    let system = 0;
    let idle = 0;

    for (const cpu of cpus) {
      user += cpu.times.user;
      system += cpu.times.sys;
      idle += cpu.times.idle;
    }

    const total = user + system + idle;

    return {
      user: (user / total) * 100,
      system: (system / total) * 100,
      idle: (idle / total) * 100,
      total: ((user + system) / total) * 100,
    };
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): MemoryUsage {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const heapUsage = process.memoryUsage();

    return {
      total,
      used,
      free,
      usedPercent: (used / total) * 100,
      heapTotal: heapUsage.heapTotal,
      heapUsed: heapUsage.heapUsed,
      external: heapUsage.external,
    };
  }

  /**
   * Get disk usage for specified paths
   */
  getDiskUsage(): DiskUsage[] {
    const results: DiskUsage[] = [];

    // For Windows, check common drives
    if (os.platform() === 'win32') {
      const drives = ['C:', 'D:', 'E:'];
      for (const drive of drives) {
        try {
          const stats = fs.statfsSync(drive + '\\');
          results.push({
            path: drive,
            total: stats.blocks * stats.bsize,
            free: stats.bfree * stats.bsize,
            used: (stats.blocks - stats.bfree) * stats.bsize,
            usedPercent:
              ((stats.blocks - stats.bfree) / stats.blocks) * 100,
          });
        } catch {
          // Drive doesn't exist or not accessible
        }
      }
    } else {
      // For Unix-like systems
      for (const diskPath of this.config.diskPaths || ['/']) {
        try {
          const stats = fs.statfsSync(diskPath);
          results.push({
            path: diskPath,
            total: stats.blocks * stats.bsize,
            free: stats.bfree * stats.bsize,
            used: (stats.blocks - stats.bfree) * stats.bsize,
            usedPercent:
              ((stats.blocks - stats.bfree) / stats.blocks) * 100,
          });
        } catch {
          // Path doesn't exist
        }
      }
    }

    return results;
  }

  /**
   * Get network interfaces
   */
  getNetworkInterfaces(): NetworkInterface[] {
    const interfaces = os.networkInterfaces();
    const results: NetworkInterface[] = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (addrs) {
        for (const addr of addrs) {
          results.push({
            name,
            address: addr.address,
            family: addr.family,
            internal: addr.internal,
            mac: addr.mac,
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if a runtime is available
   */
  checkRuntime(command: string, versionFlag = '--version'): RuntimeInfo {
    try {
      const output = execSync(`${command} ${versionFlag}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      }).trim();

      // Extract version from output
      const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : output.split('\n')[0];

      // Try to find path
      let runtimePath = '';
      try {
        const whereCmd = os.platform() === 'win32' ? 'where' : 'which';
        runtimePath = execSync(`${whereCmd} ${command}`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000,
        }).trim().split('\n')[0];
      } catch {
        // Couldn't find path
      }

      return {
        name: command,
        version,
        path: runtimePath,
        available: true,
      };
    } catch {
      return {
        name: command,
        version: '',
        path: '',
        available: false,
      };
    }
  }

  /**
   * Get all installed runtimes
   */
  getInstalledRuntimes(): RuntimeInfo[] {
    const runtimes = [
      { cmd: 'node', flag: '--version' },
      { cmd: 'npm', flag: '--version' },
      { cmd: 'pnpm', flag: '--version' },
      { cmd: 'yarn', flag: '--version' },
      { cmd: 'bun', flag: '--version' },
      { cmd: 'python', flag: '--version' },
      { cmd: 'python3', flag: '--version' },
      { cmd: 'pip', flag: '--version' },
      { cmd: 'go', flag: 'version' },
      { cmd: 'rust', flag: '--version' },
      { cmd: 'cargo', flag: '--version' },
      { cmd: 'java', flag: '-version' },
      { cmd: 'ruby', flag: '--version' },
      { cmd: 'php', flag: '--version' },
      { cmd: 'dotnet', flag: '--version' },
      { cmd: 'git', flag: '--version' },
      { cmd: 'docker', flag: '--version' },
    ];

    return runtimes.map((r) => this.checkRuntime(r.cmd, r.flag));
  }

  /**
   * Get environment variables
   */
  getEnvironmentVariables(filter?: string): EnvVariable[] {
    const env = process.env;
    const results: EnvVariable[] = [];

    for (const [name, value] of Object.entries(env)) {
      if (value !== undefined) {
        if (!filter || name.toLowerCase().includes(filter.toLowerCase())) {
          results.push({
            name,
            value,
          });
        }
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get specific environment variable
   */
  getEnvVariable(name: string): string | undefined {
    return process.env[name];
  }

  /**
   * Check network connectivity
   */
  async checkNetworkConnectivity(host = 'google.com'): Promise<boolean> {
    try {
      const pingCmd =
        os.platform() === 'win32' ? `ping -n 1 ${host}` : `ping -c 1 ${host}`;

      execSync(pingCmd, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current working directory info
   */
  getWorkingDirectoryInfo(): {
    path: string;
    exists: boolean;
    writable: boolean;
    isGitRepo: boolean;
  } {
    const cwd = process.cwd();
    let exists = false;
    let writable = false;
    let isGitRepo = false;

    try {
      exists = fs.existsSync(cwd);
      if (exists) {
        fs.accessSync(cwd, fs.constants.W_OK);
        writable = true;
      }
    } catch {
      // Not writable
    }

    try {
      isGitRepo = fs.existsSync(path.join(cwd, '.git'));
    } catch {
      // Not a git repo
    }

    return {
      path: cwd,
      exists,
      writable,
      isGitRepo,
    };
  }

  /**
   * Get home directory info
   */
  getHomeDirectoryInfo(): {
    path: string;
    damieConfigPath: string;
    damieConfigExists: boolean;
  } {
    const homedir = os.homedir();
    const damieConfigPath = path.join(homedir, '.damie', 'config.yaml');

    return {
      path: homedir,
      damieConfigPath,
      damieConfigExists: fs.existsSync(damieConfigPath),
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Format uptime to human readable
   */
  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Get summary report
   */
  getSummary(): Record<string, string> {
    const sysInfo = this.getSystemInfo();
    const memUsage = this.getMemoryUsage();
    const cpuUsage = this.getCpuUsage();

    return {
      Platform: `${sysInfo.platform} ${sysInfo.arch}`,
      Hostname: sysInfo.hostname,
      Uptime: this.formatUptime(sysInfo.uptime),
      'CPU Cores': `${sysInfo.cpuCount}`,
      'CPU Model': sysInfo.cpuModel,
      'CPU Usage': `${cpuUsage.total.toFixed(1)}%`,
      'Memory Total': this.formatBytes(memUsage.total),
      'Memory Used': `${this.formatBytes(memUsage.used)} (${memUsage.usedPercent.toFixed(1)}%)`,
      'Memory Free': this.formatBytes(memUsage.free),
      'Node.js': process.version,
    };
  }
}

/**
 * Factory function to create SystemMonitor
 */
export function createSystemMonitor(
  config?: SystemMonitorConfig
): SystemMonitor {
  return new SystemMonitor(config);
}
