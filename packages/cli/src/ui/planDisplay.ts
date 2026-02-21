/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  TaskDecomposition,
  Subtask,
  DependencyGraph,
  EffortEstimate,
} from '@damie-code/damie-code-core';
import {
  SubtaskStatus,
  SubtaskPriority,
  EffortLevel,
} from '@damie-code/damie-code-core';

/**
 * Format effort estimate for display
 */
export function formatEffort(effort: EffortEstimate): string {
  const hours = Math.floor(effort.minutes / 60);
  const mins = effort.minutes % 60;

  let timeStr = '';
  if (hours > 0) {
    timeStr = `${hours}h ${mins}m`;
  } else {
    timeStr = `${mins}m`;
  }

  const confidence = Math.round(effort.confidence * 100);
  return `${timeStr} (${confidence}% conf)`;
}

/**
 * Format effort level with emoji
 */
export function formatEffortLevel(level: EffortLevel): string {
  const levels: Record<EffortLevel, string> = {
    [EffortLevel.TRIVIAL]: '🟢 Trivial',
    [EffortLevel.SMALL]: '🟡 Small',
    [EffortLevel.MEDIUM]: '🟠 Medium',
    [EffortLevel.LARGE]: '🔴 Large',
    [EffortLevel.COMPLEX]: '⚫ Complex',
  };
  return levels[level] ?? level;
}

/**
 * Format priority
 */
export function formatPriority(priority: SubtaskPriority): string {
  const priorities: Record<SubtaskPriority, string> = {
    [SubtaskPriority.CRITICAL]: '🔥 Critical',
    [SubtaskPriority.HIGH]: '⬆️ High',
    [SubtaskPriority.MEDIUM]: '➡️ Medium',
    [SubtaskPriority.LOW]: '⬇️ Low',
  };
  return priorities[priority] ?? priority;
}

/**
 * Format status
 */
export function formatStatus(status: SubtaskStatus): string {
  const statuses: Record<SubtaskStatus, string> = {
    [SubtaskStatus.PENDING]: '⏳ Pending',
    [SubtaskStatus.IN_PROGRESS]: '🔄 In Progress',
    [SubtaskStatus.COMPLETED]: '✅ Completed',
    [SubtaskStatus.FAILED]: '❌ Failed',
    [SubtaskStatus.SKIPPED]: '⏭️ Skipped',
    [SubtaskStatus.BLOCKED]: '🚫 Blocked',
  };
  return statuses[status] ?? status;
}

/**
 * Display a single subtask
 */
export function displaySubtask(subtask: Subtask, index: number): string {
  const lines: string[] = [];

  lines.push(`\n  ${index + 1}. ${subtask.title}`);
  lines.push(`     ${formatPriority(subtask.priority)} | ${formatStatus(subtask.status)}`);
  lines.push(`     Effort: ${formatEffort(subtask.effort)}`);

  if (subtask.description) {
    lines.push(`     ${subtask.description.substring(0, 80)}${subtask.description.length > 80 ? '...' : ''}`);
  }

  if (subtask.dependencies.length > 0) {
    lines.push(`     Dependencies: ${subtask.dependencies.length} subtask(s)`);
  }

  if (subtask.affectedFiles.length > 0) {
    lines.push(`     Files: ${subtask.affectedFiles.slice(0, 3).join(', ')}${subtask.affectedFiles.length > 3 ? '...' : ''}`);
  }

  if (subtask.acceptanceCriteria.length > 0) {
    lines.push(`     Criteria: ${subtask.acceptanceCriteria.length} item(s)`);
  }

  return lines.join('\n');
}

/**
 * Display dependency graph as text
 */
export function displayDependencyGraph(
  graph: DependencyGraph,
  subtasks: Subtask[],
): string {
  const lines: string[] = [];
  const subtaskMap = new Map(subtasks.map((s) => [s.id, s]));

  lines.push('\n📊 Dependency Graph:');
  lines.push('  (Tasks grouped by execution level)\n');

  if (graph.hasCycles) {
    lines.push('  ⚠️ WARNING: Circular dependencies detected!');
    for (const cycle of graph.cycles) {
      const cycleNames = cycle.map((id) => subtaskMap.get(id)?.title ?? id);
      lines.push(`     ${cycleNames.join(' → ')}`);
    }
    lines.push('');
  }

  for (let level = 0; level < graph.levels.length; level++) {
    const levelSubtasks = graph.levels[level];
    lines.push(`  Level ${level} (${level === 0 ? 'start first' : 'after level ' + (level - 1)}):`);

    for (const id of levelSubtasks) {
      const subtask = subtaskMap.get(id);
      if (subtask) {
        const deps = subtask.dependencies.length;
        const depStr = deps > 0 ? ` ← depends on ${deps}` : '';
        lines.push(`    • ${subtask.title}${depStr}`);
      }
    }
    lines.push('');
  }

  // Show critical path if available
  const criticalEdges = graph.edges.filter((e) => e.isCritical);
  if (criticalEdges.length > 0) {
    lines.push('  🔴 Critical Path:');
    const criticalNodes = new Set<string>();
    for (const edge of criticalEdges) {
      criticalNodes.add(edge.from);
      criticalNodes.add(edge.to);
    }
    const criticalNames = Array.from(criticalNodes)
      .map((id) => subtaskMap.get(id)?.title ?? id)
      .join(' → ');
    lines.push(`     ${criticalNames}`);
  }

  return lines.join('\n');
}

/**
 * Display full plan
 */
export function displayPlan(decomposition: TaskDecomposition): string {
  const lines: string[] = [];

  // Header
  lines.push('\n' + '='.repeat(60));
  lines.push(`📋 PLAN: ${decomposition.title}`);
  lines.push('='.repeat(60));

  // Summary
  lines.push(`\n📝 Original Task: ${decomposition.originalTask}`);
  lines.push(`📊 Status: ${decomposition.status}`);
  lines.push(`🔢 Version: ${decomposition.version}`);
  lines.push(`📅 Created: ${decomposition.createdAt.toLocaleString()}`);

  // Total effort
  lines.push('\n⏱️ Total Effort:');
  lines.push(`   ${formatEffortLevel(decomposition.totalEffort.level)}`);
  lines.push(`   ${formatEffort(decomposition.totalEffort)}`);

  // Success criteria
  if (decomposition.successCriteria.length > 0) {
    lines.push('\n✅ Success Criteria:');
    for (const criterion of decomposition.successCriteria) {
      lines.push(`   • ${criterion}`);
    }
  }

  // Subtasks
  lines.push(`\n📋 Subtasks (${decomposition.subtasks.length}):`);
  for (let i = 0; i < decomposition.subtasks.length; i++) {
    lines.push(displaySubtask(decomposition.subtasks[i], i));
  }

  // Assumptions
  if (decomposition.assumptions.length > 0) {
    lines.push('\n💭 Assumptions:');
    for (const assumption of decomposition.assumptions) {
      lines.push(`   • ${assumption}`);
    }
  }

  // Risks
  if (decomposition.risks.length > 0) {
    lines.push('\n⚠️ Risks:');
    for (const risk of decomposition.risks) {
      const severity = '⚡'.repeat(risk.severity);
      lines.push(`   ${severity} ${risk.description}`);
      lines.push(`      Mitigation: ${risk.mitigation}`);
    }
  }

  // Validation
  if (decomposition.validation) {
    const v = decomposition.validation;
    lines.push('\n🔍 Validation:');
    lines.push(`   Valid: ${v.isValid ? '✅ Yes' : '❌ No'}`);
    lines.push(`   Completeness: ${Math.round(v.completenessScore * 100)}%`);

    if (v.errors.length > 0) {
      lines.push('   Errors:');
      for (const error of v.errors) {
        lines.push(`     ❌ ${error.message}`);
      }
    }

    if (v.warnings.length > 0) {
      lines.push('   Warnings:');
      for (const warning of v.warnings) {
        lines.push(`     ⚠️ ${warning.message}`);
      }
    }
  }

  lines.push('\n' + '='.repeat(60));

  return lines.join('\n');
}

/**
 * Display compact plan summary
 */
export function displayPlanSummary(decomposition: TaskDecomposition): string {
  const lines: string[] = [];

  lines.push(`\n📋 ${decomposition.title}`);
  lines.push(`   ${decomposition.subtasks.length} subtasks | ${formatEffort(decomposition.totalEffort)}`);

  const pending = decomposition.subtasks.filter(
    (s) => s.status === SubtaskStatus.PENDING,
  ).length;
  const completed = decomposition.subtasks.filter(
    (s) => s.status === SubtaskStatus.COMPLETED,
  ).length;
  const failed = decomposition.subtasks.filter(
    (s) => s.status === SubtaskStatus.FAILED,
  ).length;

  lines.push(`   Status: ${completed} done, ${pending} pending, ${failed} failed`);

  return lines.join('\n');
}

/**
 * Display approval prompt
 */
export function displayApprovalPrompt(): string {
  return '\n🔐 Do you want to execute this plan? (y/n/s to save): ';
}
