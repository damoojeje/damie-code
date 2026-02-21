/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Subtask, DependencyGraph, DependencyEdge } from './types.js';
import { DependencyType } from './types.js';

/**
 * Dependency Graph Builder
 *
 * Builds and analyzes dependency graphs from subtasks.
 * Supports cycle detection, level calculation, and critical path analysis.
 */
export class DependencyGraphBuilder {
  /**
   * Build a dependency graph from subtasks
   */
  build(subtasks: Subtask[]): DependencyGraph {
    const nodes = subtasks.map((s) => s.id);
    const edges: DependencyEdge[] = [];
    const adjacencyList = new Map<string, string[]>();
    const reverseAdjacencyList = new Map<string, string[]>();

    // Initialize adjacency lists
    for (const node of nodes) {
      adjacencyList.set(node, []);
      reverseAdjacencyList.set(node, []);
    }

    // Build edges and adjacency lists
    for (const subtask of subtasks) {
      for (const depId of subtask.dependencies) {
        if (nodes.includes(depId)) {
          edges.push({
            from: depId,
            to: subtask.id,
            type: DependencyType.FINISH_TO_START,
            isCritical: false,
          });
          adjacencyList.get(depId)!.push(subtask.id);
          reverseAdjacencyList.get(subtask.id)!.push(depId);
        }
      }
    }

    // Detect cycles
    const cycles = this.detectCycles(nodes, adjacencyList);
    const hasCycles = cycles.length > 0;

    // Calculate levels (for parallel execution)
    const levels = hasCycles ? [] : this.calculateLevels(nodes, reverseAdjacencyList);

    // Mark critical path
    if (!hasCycles && levels.length > 0) {
      this.markCriticalPath(edges, levels, subtasks);
    }

    return {
      nodes,
      edges,
      adjacencyList,
      reverseAdjacencyList,
      levels,
      hasCycles,
      cycles,
    };
  }

  /**
   * Detect cycles using DFS
   */
  private detectCycles(
    nodes: string[],
    adjacencyList: Map<string, string[]>,
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = adjacencyList.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor);
          cycles.push(cycle);
        }
      }

      path.pop();
      recursionStack.delete(node);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Calculate execution levels for parallel processing
   *
   * Level 0: No dependencies
   * Level N: All dependencies are in levels < N
   */
  private calculateLevels(
    nodes: string[],
    reverseAdjacencyList: Map<string, string[]>,
  ): string[][] {
    const levels: string[][] = [];
    const nodeLevel = new Map<string, number>();
    const remaining = new Set(nodes);

    // Find nodes with no dependencies (level 0)
    while (remaining.size > 0) {
      const currentLevel: string[] = [];

      for (const node of remaining) {
        const dependencies = reverseAdjacencyList.get(node) ?? [];
        const allDepsProcessed = dependencies.every(
          (dep) => !remaining.has(dep),
        );

        if (allDepsProcessed) {
          currentLevel.push(node);
        }
      }

      if (currentLevel.length === 0) {
        // No progress - remaining nodes have unresolvable dependencies
        break;
      }

      for (const node of currentLevel) {
        remaining.delete(node);
        nodeLevel.set(node, levels.length);
      }

      levels.push(currentLevel);
    }

    return levels;
  }

  /**
   * Mark edges on the critical path
   */
  private markCriticalPath(
    edges: DependencyEdge[],
    _levels: string[][],
    subtasks: Subtask[],
  ): void {
    // Find the longest path through the graph based on effort

    // Simple heuristic: edges connecting the highest effort tasks
    const nodeEffort = new Map<string, number>();
    for (const subtask of subtasks) {
      nodeEffort.set(subtask.id, subtask.effort?.minutes ?? 30);
    }

    // Mark edges where both nodes have high effort
    const avgEffort =
      subtasks.reduce((sum, s) => sum + (s.effort?.minutes ?? 30), 0) /
      subtasks.length;

    for (const edge of edges) {
      const fromEffort = nodeEffort.get(edge.from) ?? 0;
      const toEffort = nodeEffort.get(edge.to) ?? 0;
      edge.isCritical = fromEffort >= avgEffort && toEffort >= avgEffort;
    }
  }

  /**
   * Get topologically sorted nodes
   */
  topologicalSort(graph: DependencyGraph): string[] {
    if (graph.hasCycles) {
      throw new Error('Cannot topologically sort a graph with cycles');
    }

    return graph.levels.flat();
  }

  /**
   * Get all dependencies (transitive) for a node
   */
  getAllDependencies(graph: DependencyGraph, nodeId: string): string[] {
    const dependencies = new Set<string>();
    const queue = [...(graph.reverseAdjacencyList.get(nodeId) ?? [])];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!dependencies.has(current)) {
        dependencies.add(current);
        const deps = graph.reverseAdjacencyList.get(current) ?? [];
        queue.push(...deps);
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Get all dependents (transitive) for a node
   */
  getAllDependents(graph: DependencyGraph, nodeId: string): string[] {
    const dependents = new Set<string>();
    const queue = [...(graph.adjacencyList.get(nodeId) ?? [])];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!dependents.has(current)) {
        dependents.add(current);
        const deps = graph.adjacencyList.get(current) ?? [];
        queue.push(...deps);
      }
    }

    return Array.from(dependents);
  }

  /**
   * Check if adding a dependency would create a cycle
   */
  wouldCreateCycle(graph: DependencyGraph, from: string, to: string): boolean {
    // If 'to' can reach 'from', adding from->to would create a cycle
    const reachable = this.getAllDependents(graph, to);
    return reachable.includes(from);
  }

  /**
   * Get nodes that can be executed in parallel at current state
   */
  getParallelExecutable(
    graph: DependencyGraph,
    completed: Set<string>,
    inProgress: Set<string>,
  ): string[] {
    const executable: string[] = [];

    for (const node of graph.nodes) {
      if (completed.has(node) || inProgress.has(node)) {
        continue;
      }

      const dependencies = graph.reverseAdjacencyList.get(node) ?? [];
      const allDepsCompleted = dependencies.every((dep) => completed.has(dep));

      if (allDepsCompleted) {
        executable.push(node);
      }
    }

    return executable;
  }
}

/**
 * Create a dependency graph builder
 */
export function createDependencyGraphBuilder(): DependencyGraphBuilder {
  return new DependencyGraphBuilder();
}
