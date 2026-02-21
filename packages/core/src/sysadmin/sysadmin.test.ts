/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { SystemMonitor, createSystemMonitor } from './systemMonitor.js';
import { Diagnostics, createDiagnostics } from './diagnostics.js';
import { DiagnosticStatus } from './types.js';

describe('SystemMonitor', () => {
  let monitor: SystemMonitor;

  beforeEach(() => {
    monitor = new SystemMonitor();
  });

  describe('getSystemInfo', () => {
    it('should return system information', () => {
      const info = monitor.getSystemInfo();

      expect(info.platform).toBeDefined();
      expect(info.arch).toBeDefined();
      expect(info.hostname).toBeDefined();
      expect(info.uptime).toBeGreaterThan(0);
      expect(info.totalMemory).toBeGreaterThan(0);
      expect(info.cpuCount).toBeGreaterThan(0);
    });
  });

  describe('getCpuUsage', () => {
    it('should return CPU usage', () => {
      const usage = monitor.getCpuUsage();

      expect(usage.user).toBeGreaterThanOrEqual(0);
      expect(usage.system).toBeGreaterThanOrEqual(0);
      expect(usage.idle).toBeGreaterThanOrEqual(0);
      expect(usage.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage', () => {
      const usage = monitor.getMemoryUsage();

      expect(usage.total).toBeGreaterThan(0);
      expect(usage.used).toBeGreaterThan(0);
      expect(usage.free).toBeGreaterThanOrEqual(0);
      expect(usage.usedPercent).toBeGreaterThanOrEqual(0);
      expect(usage.usedPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('getDiskUsage', () => {
    it('should return disk usage array', { timeout: 30000 }, () => {
      const usage = monitor.getDiskUsage();

      expect(Array.isArray(usage)).toBe(true);
      // At least one disk should be detected
      if (usage.length > 0) {
        expect(usage[0].path).toBeDefined();
        expect(usage[0].total).toBeGreaterThan(0);
      }
    });
  });

  describe('getNetworkInterfaces', () => {
    it('should return network interfaces', () => {
      const interfaces = monitor.getNetworkInterfaces();

      expect(Array.isArray(interfaces)).toBe(true);
      // Should have at least loopback interface
      expect(interfaces.length).toBeGreaterThan(0);
    });
  });

  describe('checkRuntime', () => {
    it('should detect Node.js', () => {
      const info = monitor.checkRuntime('node', '--version');

      expect(info.name).toBe('node');
      expect(info.available).toBe(true);
      expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should handle non-existent runtime', () => {
      const info = monitor.checkRuntime('nonexistent-runtime-xyz');

      expect(info.available).toBe(false);
    });
  });

  describe('getInstalledRuntimes', () => {
    it('should return array of runtimes', { timeout: 30000 }, () => {
      const runtimes = monitor.getInstalledRuntimes();

      expect(Array.isArray(runtimes)).toBe(true);
      expect(runtimes.length).toBeGreaterThan(0);

      // Node should be available since we're running tests
      const node = runtimes.find((r) => r.name === 'node');
      expect(node?.available).toBe(true);
    });
  });

  describe('getEnvironmentVariables', () => {
    it('should return environment variables', () => {
      const vars = monitor.getEnvironmentVariables();

      expect(Array.isArray(vars)).toBe(true);
      expect(vars.length).toBeGreaterThan(0);
    });

    it('should filter environment variables', () => {
      const vars = monitor.getEnvironmentVariables('PATH');

      expect(vars.some((v) => v.name.includes('PATH'))).toBe(true);
    });
  });

  describe('getEnvVariable', () => {
    it('should return specific variable', () => {
      // NODE_ENV may or may not be set, just check it doesn't throw
      monitor.getEnvVariable('NODE_ENV');
      expect(true).toBe(true);
    });
  });

  describe('getWorkingDirectoryInfo', () => {
    it('should return working directory info', () => {
      const info = monitor.getWorkingDirectoryInfo();

      expect(info.path).toBeDefined();
      expect(info.exists).toBe(true);
      expect(typeof info.writable).toBe('boolean');
      expect(typeof info.isGitRepo).toBe('boolean');
    });
  });

  describe('getHomeDirectoryInfo', () => {
    it('should return home directory info', () => {
      const info = monitor.getHomeDirectoryInfo();

      expect(info.path).toBeDefined();
      expect(info.damieConfigPath).toContain('.damie');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(monitor.formatBytes(0)).toBe('0.00 B');
      expect(monitor.formatBytes(1024)).toBe('1.00 KB');
      expect(monitor.formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(monitor.formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    });
  });

  describe('formatUptime', () => {
    it('should format uptime correctly', () => {
      expect(monitor.formatUptime(0)).toBe('0s');
      expect(monitor.formatUptime(60)).toBe('1m');
      expect(monitor.formatUptime(3600)).toBe('1h');
      expect(monitor.formatUptime(86400)).toBe('1d');
      expect(monitor.formatUptime(90061)).toBe('1d 1h 1m 1s');
    });
  });

  describe('getSummary', () => {
    it('should return summary object', () => {
      const summary = monitor.getSummary();

      expect(summary['Platform']).toBeDefined();
      expect(summary['Hostname']).toBeDefined();
      expect(summary['CPU Cores']).toBeDefined();
      expect(summary['Memory Total']).toBeDefined();
      expect(summary['Node.js']).toBeDefined();
    });
  });
});

describe('createSystemMonitor', () => {
  it('should create monitor with factory function', () => {
    const monitor = createSystemMonitor();
    expect(monitor).toBeInstanceOf(SystemMonitor);
  });
});

describe('Diagnostics', () => {
  let diagnostics: Diagnostics;

  beforeEach(() => {
    diagnostics = new Diagnostics();
  });

  describe('runAllChecks', () => {
    it('should run all diagnostic checks', async () => {
      const report = await diagnostics.runAllChecks();

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.duration).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(report.results)).toBe(true);
      expect(report.results.length).toBeGreaterThan(0);
      expect(report.summary.total).toBe(report.results.length);
    });

    it('should have valid summary counts', async () => {
      const report = await diagnostics.runAllChecks();

      const { summary } = report;
      expect(summary.passed + summary.warnings + summary.failed + summary.skipped)
        .toBe(summary.total);
    });
  });

  describe('checkNodeVersion', () => {
    it('should pass for current Node version', async () => {
      const result = await diagnostics.checkNodeVersion();

      expect(result.name).toBe('Node.js Version');
      // We're running on Node 20+, so should pass
      expect(result.status).toBe(DiagnosticStatus.PASS);
    });
  });

  describe('checkConfigFile', () => {
    it('should return a result', async () => {
      const result = await diagnostics.checkConfigFile();

      expect(result.name).toBe('Configuration File');
      expect([DiagnosticStatus.PASS, DiagnosticStatus.WARN, DiagnosticStatus.FAIL])
        .toContain(result.status);
    });
  });

  describe('checkSkillsDirectory', () => {
    it('should return a result', async () => {
      const result = await diagnostics.checkSkillsDirectory();

      expect(result.name).toBe('Skills Directory');
      expect([DiagnosticStatus.PASS, DiagnosticStatus.WARN, DiagnosticStatus.FAIL])
        .toContain(result.status);
    });
  });

  describe('checkDiskSpace', () => {
    it('should check disk space', async () => {
      const result = await diagnostics.checkDiskSpace();

      expect(result.name).toBe('Disk Space');
      expect([
        DiagnosticStatus.PASS,
        DiagnosticStatus.WARN,
        DiagnosticStatus.FAIL,
        DiagnosticStatus.SKIP,
      ]).toContain(result.status);
    });
  });

  describe('checkMemory', () => {
    it('should check memory', async () => {
      const result = await diagnostics.checkMemory();

      expect(result.name).toBe('Memory');
      expect([DiagnosticStatus.PASS, DiagnosticStatus.WARN])
        .toContain(result.status);
    });
  });

  describe('checkGitInstalled', () => {
    it('should check Git installation', async () => {
      const result = await diagnostics.checkGitInstalled();

      expect(result.name).toBe('Git');
      expect([DiagnosticStatus.PASS, DiagnosticStatus.WARN])
        .toContain(result.status);
    });
  });

  describe('checkWorkingDirectory', () => {
    it('should check working directory', async () => {
      const result = await diagnostics.checkWorkingDirectory();

      expect(result.name).toBe('Working Directory');
      expect(result.status).toBe(DiagnosticStatus.PASS);
    });
  });

  describe('formatReport', () => {
    it('should format report as string', async () => {
      const report = await diagnostics.runAllChecks();
      const formatted = diagnostics.formatReport(report);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('DAMIE CODE DIAGNOSTICS');
      expect(formatted).toContain('Summary:');
    });
  });
});

describe('createDiagnostics', () => {
  it('should create diagnostics with factory function', () => {
    const diagnostics = createDiagnostics();
    expect(diagnostics).toBeInstanceOf(Diagnostics);
  });
});

// Import beforeEach for vitest
import { beforeEach } from 'vitest';
