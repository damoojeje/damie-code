/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import {
  TaskPlanner,
  SubtaskType,
  type TaskDecomposition,
  type SubtaskTemplate,
} from '@damie-code/damie-code-core';
import {
  displayPlan,
  displayDependencyGraph,
  displayApprovalPrompt,
} from '../ui/planDisplay.js';

/**
 * Plan command options
 */
export interface PlanCommandOptions {
  /** Auto-approve without prompting */
  autoApprove?: boolean;
  /** Save plan to file */
  save?: string;
  /** Show dependency graph */
  showGraph?: boolean;
  /** Maximum subtasks */
  maxSubtasks?: number;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Generate a simple plan from task description
 * In a real implementation, this would use an LLM
 */
function generateSimplePlan(task: string): SubtaskTemplate[] {
  // Simple heuristic-based plan generation
  const templates: SubtaskTemplate[] = [];
  const taskLower = task.toLowerCase();

  // Detect common patterns
  if (taskLower.includes('add') || taskLower.includes('create') || taskLower.includes('implement')) {
    templates.push({
      title: 'Analyze requirements',
      description: 'Understand what needs to be built',
      type: SubtaskType.RESEARCH,
      acceptanceCriteria: ['Requirements documented'],
    });

    templates.push({
      title: 'Design solution',
      description: 'Plan the implementation approach',
      type: SubtaskType.RESEARCH,
      dependencies: ['Analyze requirements'],
      acceptanceCriteria: ['Design documented'],
    });

    templates.push({
      title: 'Implement core functionality',
      description: 'Write the main code',
      type: SubtaskType.CODE,
      dependencies: ['Design solution'],
      acceptanceCriteria: ['Code compiles', 'Core features work'],
    });

    templates.push({
      title: 'Write tests',
      description: 'Add unit tests for the implementation',
      type: SubtaskType.TEST,
      dependencies: ['Implement core functionality'],
      acceptanceCriteria: ['Tests pass'],
    });

    templates.push({
      title: 'Update documentation',
      description: 'Document the new functionality',
      type: SubtaskType.DOCUMENTATION,
      dependencies: ['Implement core functionality'],
      acceptanceCriteria: ['README updated'],
    });
  } else if (taskLower.includes('fix') || taskLower.includes('bug')) {
    templates.push({
      title: 'Reproduce the issue',
      description: 'Understand and reproduce the bug',
      type: SubtaskType.RESEARCH,
      acceptanceCriteria: ['Issue reproduced'],
    });

    templates.push({
      title: 'Identify root cause',
      description: 'Find the source of the bug',
      type: SubtaskType.RESEARCH,
      dependencies: ['Reproduce the issue'],
      acceptanceCriteria: ['Root cause identified'],
    });

    templates.push({
      title: 'Implement fix',
      description: 'Fix the bug',
      type: SubtaskType.CODE,
      dependencies: ['Identify root cause'],
      acceptanceCriteria: ['Bug fixed', 'Code compiles'],
    });

    templates.push({
      title: 'Add regression test',
      description: 'Add test to prevent regression',
      type: SubtaskType.TEST,
      dependencies: ['Implement fix'],
      acceptanceCriteria: ['Test added and passes'],
    });
  } else if (taskLower.includes('refactor') || taskLower.includes('improve')) {
    templates.push({
      title: 'Analyze current implementation',
      description: 'Understand existing code',
      type: SubtaskType.RESEARCH,
      acceptanceCriteria: ['Code analyzed'],
    });

    templates.push({
      title: 'Plan refactoring approach',
      description: 'Design the refactoring strategy',
      type: SubtaskType.RESEARCH,
      dependencies: ['Analyze current implementation'],
      acceptanceCriteria: ['Approach documented'],
    });

    templates.push({
      title: 'Refactor code',
      description: 'Apply the refactoring',
      type: SubtaskType.CODE,
      dependencies: ['Plan refactoring approach'],
      acceptanceCriteria: ['Code refactored', 'Tests still pass'],
    });

    templates.push({
      title: 'Verify no regressions',
      description: 'Ensure functionality is preserved',
      type: SubtaskType.TEST,
      dependencies: ['Refactor code'],
      acceptanceCriteria: ['All tests pass'],
    });
  } else {
    // Generic plan
    templates.push({
      title: 'Understand task',
      description: `Analyze: ${task}`,
      type: SubtaskType.RESEARCH,
      acceptanceCriteria: ['Task understood'],
    });

    templates.push({
      title: 'Execute task',
      description: 'Perform the requested work',
      type: SubtaskType.CODE,
      dependencies: ['Understand task'],
      acceptanceCriteria: ['Work completed'],
    });

    templates.push({
      title: 'Verify results',
      description: 'Check that the task was completed correctly',
      type: SubtaskType.TEST,
      dependencies: ['Execute task'],
      acceptanceCriteria: ['Results verified'],
    });
  }

  return templates;
}

/**
 * Prompt user for approval
 */
async function promptApproval(): Promise<'yes' | 'no' | 'save'> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(displayApprovalPrompt(), (answer) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();
      if (normalized === 'y' || normalized === 'yes') {
        resolve('yes');
      } else if (normalized === 's' || normalized === 'save') {
        resolve('save');
      } else {
        resolve('no');
      }
    });
  });
}

/**
 * Save plan to file
 */
function savePlan(decomposition: TaskDecomposition, filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data = JSON.stringify(decomposition, null, 2);
  fs.writeFileSync(filePath, data, 'utf-8');
  console.log(`\n✅ Plan saved to: ${filePath}`);
}

/**
 * Handle the plan command
 */
export async function handlePlanCommand(
  task: string,
  options: PlanCommandOptions = {},
): Promise<TaskDecomposition | null> {
  const planner = new TaskPlanner({
    maxSubtasks: options.maxSubtasks ?? 20,
  });

  // Generate plan
  console.log('\n🔄 Generating plan...');
  const templates = generateSimplePlan(task);
  const decomposition = planner.createDecomposition({ task }, templates);

  // Validate plan
  const validation = planner.validate(decomposition);
  decomposition.validation = validation;

  // Display plan
  console.log(displayPlan(decomposition));

  // Show dependency graph if requested
  if (options.showGraph) {
    const graph = planner.getDependencyGraph(decomposition);
    console.log(displayDependencyGraph(graph, decomposition.subtasks));
  }

  // Save if path provided
  if (options.save) {
    savePlan(decomposition, options.save);
    if (!options.autoApprove) {
      return decomposition;
    }
  }

  // Auto-approve or prompt
  if (options.autoApprove) {
    console.log('\n✅ Auto-approved. Ready for execution.');
    return decomposition;
  }

  // Prompt for approval
  const approval = await promptApproval();

  switch (approval) {
    case 'yes':
      console.log('\n✅ Plan approved. Ready for execution.');
      return decomposition;

    case 'save': {
      const defaultPath = `./plans/plan-${Date.now()}.json`;
      savePlan(decomposition, options.save ?? defaultPath);
      return decomposition;
    }

    case 'no':
    default:
      console.log('\n❌ Plan rejected.');
      return null;
  }
}

/**
 * Show plan help
 */
export function showPlanHelp(): void {
  console.log(`
Usage: damie plan <task> [options]

Generate and display an execution plan for a task.

Options:
  --auto-approve     Execute without approval prompt
  --save <path>      Save plan to JSON file
  --show-graph       Display dependency graph
  --max-subtasks <n> Maximum number of subtasks (default: 20)
  --verbose          Show detailed output

Examples:
  damie plan "Add user authentication"
  damie plan "Fix login bug" --show-graph
  damie plan "Refactor API" --save ./plans/api-refactor.json
  damie plan "Add tests" --auto-approve
`);
}
