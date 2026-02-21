/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { createModelRouter } from '../../../core/src/router/index.js';
import { loadDamieConfig } from '../../../core/src/config/damieConfigLoader.js';

/**
 * Show routing decision for a task without executing
 */
export function showRouteDecision(task: string, overrideProvider?: string, overrideModel?: string): void {
  const router = createModelRouter();

  // Apply config if available
  const config = loadDamieConfig();
  if (config) {
    router.applyDamieConfig(config);
  }

  try {
    const decision = router.route(task, overrideProvider, overrideModel);

    console.log('\n=== Routing Decision ===\n');
    console.log(router.formatDecision(decision));
    console.log('');

    // Show matched keywords
    if (decision.analysis.matchedKeywords.length > 0) {
      console.log(`Matched Keywords: ${decision.analysis.matchedKeywords.join(', ')}`);
    }

    // Show estimated tokens
    console.log(`\nEstimated Tokens:`);
    console.log(`  Input:  ~${decision.analysis.estimatedInputTokens}`);
    console.log(`  Output: ~${decision.analysis.estimatedOutputTokens}`);

    // Show capabilities
    const caps = decision.analysis.capabilities;
    const activeCaps = Object.entries(caps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeCaps.length > 0) {
      console.log(`\nRequired Capabilities: ${activeCaps.join(', ')}`);
    }

    console.log('');
  } catch (error) {
    console.error(`Routing failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

/**
 * List current routing configuration
 */
export function listRoutingConfig(): void {
  const config = loadDamieConfig();

  console.log('\n=== Routing Configuration ===\n');

  if (!config) {
    console.log('No configuration found. Run "damie" to set up.');
    return;
  }

  const routing = config.model?.routing;
  if (!routing) {
    console.log('Using default routing rules:\n');
    console.log('  Coding tasks    → deepseek');
    console.log('  Reasoning tasks → anthropic');
    console.log('  Creative tasks  → openai');
    console.log('  Visual tasks    → openai');
    console.log('  General tasks   → deepseek');
    console.log('\nTo customize, edit ~/.damie/config.yaml');
    return;
  }

  console.log('Custom routing rules:\n');
  if (routing.coding) console.log(`  Coding tasks    → ${routing.coding}`);
  if (routing.reasoning) console.log(`  Reasoning tasks → ${routing.reasoning}`);
  if (routing.general) console.log(`  General tasks   → ${routing.general}`);
  if (routing.vision) console.log(`  Visual tasks    → ${routing.vision}`);

  console.log('\nTo modify, edit ~/.damie/config.yaml under model.routing');
  console.log('');
}

/**
 * Show task type examples
 */
export function showTaskTypes(): void {
  console.log('\n=== Task Types ===\n');

  const examples: Record<string, string[]> = {
    'coding': [
      'Write a function to sort an array',
      'Fix the bug in the login module',
      'Implement a REST API endpoint',
    ],
    'reasoning': [
      'Analyze why this algorithm is slow',
      'Explain the trade-offs between options',
      'Debug step by step why the test fails',
    ],
    'creative': [
      'Write a blog post about AI',
      'Create a story for the landing page',
      'Brainstorm marketing ideas',
    ],
    'visual': [
      'Analyze this screenshot',
      'Create a diagram of the architecture',
      'Describe this UI mockup',
    ],
    'general': [
      'What is machine learning?',
      'Summarize this article',
      'Translate this to Spanish',
    ],
  };

  for (const [type, exampleList] of Object.entries(examples)) {
    console.log(`${type.charAt(0).toUpperCase() + type.slice(1)}:`);
    for (const example of exampleList) {
      console.log(`  - "${example}"`);
    }
    console.log('');
  }
}

/**
 * Handle route subcommand
 */
export function handleRouteCommand(args: string[]): void {
  if (args.length === 0) {
    console.log('Usage: damie route <task>');
    console.log('       damie route --config    Show routing configuration');
    console.log('       damie route --types     Show task type examples');
    console.log('');
    console.log('Options:');
    console.log('  --provider <name>  Override provider selection');
    console.log('  --model <name>     Override model selection');
    console.log('');
    console.log('Example:');
    console.log('  damie route "Write a function to sort an array"');
    console.log('  damie route "Analyze this bug" --provider anthropic');
    return;
  }

  // Check for flags
  if (args[0] === '--config' || args[0] === '-c') {
    listRoutingConfig();
    return;
  }

  if (args[0] === '--types' || args[0] === '-t') {
    showTaskTypes();
    return;
  }

  // Parse options
  let overrideProvider: string | undefined;
  let overrideModel: string | undefined;
  const taskParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' || args[i] === '-p') {
      overrideProvider = args[++i];
    } else if (args[i] === '--model' || args[i] === '-m') {
      overrideModel = args[++i];
    } else {
      taskParts.push(args[i]);
    }
  }

  const task = taskParts.join(' ');
  if (!task) {
    console.error('Error: Task description required');
    return;
  }

  showRouteDecision(task, overrideProvider, overrideModel);
}
