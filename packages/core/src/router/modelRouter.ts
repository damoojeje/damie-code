/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TaskAnalysis, TaskCapabilities } from './types.js';
import { TaskType } from './types.js';
import { TaskAnalyzer } from './taskAnalyzer.js';
import type { BaseAdapter, ModelInfo } from '../adapters/index.js';
import { getAdapter, getAvailableAdapters, getDefaultAdapter } from '../adapters/adapterFactory.js';
import type { DamieConfig, RoutingConfig, ProviderName } from '../config/damieConfig.js';
import { loadDamieConfig } from '../config/damieConfigLoader.js';

/**
 * Routing decision result
 */
export interface RoutingDecision {
  /** Selected provider name */
  provider: string;
  /** Selected model ID */
  model: string;
  /** Task analysis that led to this decision */
  analysis: TaskAnalysis;
  /** Why this provider/model was chosen */
  reason: string;
  /** Alternative providers considered */
  alternatives: string[];
  /** Was this a fallback decision */
  isFallback: boolean;
  /** Was this overridden by user */
  isOverride: boolean;
}

/**
 * Model router configuration
 */
export interface ModelRouterConfig {
  /** Default provider fallback order */
  fallbackOrder: string[];
  /** Task type to provider mapping */
  taskTypeRouting: Partial<Record<TaskType, string>>;
  /** Minimum model capability requirements */
  capabilityRequirements: Partial<Record<keyof TaskCapabilities, string[]>>;
  /** Enable routing logging */
  enableLogging: boolean;
  /** Custom routing rules from config */
  routingConfig?: RoutingConfig;
}

/**
 * Default routing configuration
 */
export const DEFAULT_ROUTER_CONFIG: ModelRouterConfig = {
  fallbackOrder: ['deepseek', 'openai', 'anthropic', 'openrouter', 'ollama'],
  taskTypeRouting: {
    [TaskType.CODING]: 'deepseek',
    [TaskType.REASONING]: 'anthropic',
    [TaskType.CREATIVE]: 'openai',
    [TaskType.VISUAL]: 'openai',
    [TaskType.GENERAL]: 'deepseek',
  },
  capabilityRequirements: {
    vision: ['openai', 'anthropic'],
    longContext: ['anthropic', 'deepseek'],
    toolCalling: ['openai', 'anthropic', 'deepseek'],
  },
  enableLogging: true,
};

/**
 * Routing log entry
 */
export interface RoutingLogEntry {
  timestamp: Date;
  task: string;
  decision: RoutingDecision;
  duration: number;
}

/**
 * Model Router
 *
 * Routes tasks to the optimal model based on:
 * - Task type (coding, reasoning, creative, visual, general)
 * - Task complexity
 * - Required capabilities
 * - Available providers
 * - User configuration
 */
export class ModelRouter {
  private config: ModelRouterConfig;
  private taskAnalyzer: TaskAnalyzer;
  private logs: RoutingLogEntry[] = [];
  private availableProviders: string[] = [];

  constructor(config: Partial<ModelRouterConfig> = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this.taskAnalyzer = new TaskAnalyzer();
    this.refreshAvailableProviders();
  }

  /**
   * Refresh the list of available providers
   */
  refreshAvailableProviders(): void {
    try {
      const adapters = getAvailableAdapters();
      this.availableProviders = adapters.map((a) => a.provider);
    } catch {
      // If config not available, use fallback order
      this.availableProviders = this.config.fallbackOrder;
    }
  }

  /**
   * Route a task to the best provider/model
   */
  route(task: string, overrideProvider?: string, overrideModel?: string): RoutingDecision {
    const startTime = Date.now();
    const analysis = this.taskAnalyzer.analyze(task);

    let decision: RoutingDecision;

    // Check for user override
    if (overrideProvider) {
      decision = this.handleOverride(analysis, overrideProvider, overrideModel);
    } else {
      decision = this.routeByTaskType(analysis);
    }

    // Log the decision
    if (this.config.enableLogging) {
      this.logs.push({
        timestamp: new Date(),
        task,
        decision,
        duration: Date.now() - startTime,
      });
    }

    return decision;
  }

  /**
   * Handle user override
   */
  private handleOverride(
    analysis: TaskAnalysis,
    provider: string,
    model?: string,
  ): RoutingDecision {
    const selectedModel = model || this.getDefaultModelForProvider(provider);

    return {
      provider,
      model: selectedModel,
      analysis,
      reason: `User override: ${provider}${model ? ` with model ${model}` : ''}`,
      alternatives: this.getAlternativeProviders(analysis.type, provider),
      isFallback: false,
      isOverride: true,
    };
  }

  /**
   * Route based on task type
   */
  private routeByTaskType(analysis: TaskAnalysis): RoutingDecision {
    const { type, capabilities } = analysis;

    // Check for capability requirements first
    const capabilityProvider = this.findProviderByCapabilities(capabilities);
    if (capabilityProvider) {
      const model = this.getModelForProvider(capabilityProvider, type);
      return {
        provider: capabilityProvider,
        model,
        analysis,
        reason: `Capability requirement: ${this.getCapabilityReason(capabilities)}`,
        alternatives: this.getAlternativeProviders(type, capabilityProvider),
        isFallback: false,
        isOverride: false,
      };
    }

    // Route by task type
    const preferredProvider = this.config.taskTypeRouting[type];

    if (preferredProvider && this.isProviderAvailable(preferredProvider)) {
      const model = this.getModelForProvider(preferredProvider, type);
      return {
        provider: preferredProvider,
        model,
        analysis,
        reason: `Task type '${type}' routes to ${preferredProvider} (${model})`,
        alternatives: this.getAlternativeProviders(type, preferredProvider),
        isFallback: false,
        isOverride: false,
      };
    }

    // Fallback to first available provider
    return this.fallbackRoute(analysis);
  }

  /**
   * Find provider by capability requirements
   */
  private findProviderByCapabilities(capabilities: TaskCapabilities): string | null {
    for (const [cap, required] of Object.entries(capabilities)) {
      if (!required) continue;

      const capKey = cap as keyof TaskCapabilities;
      const supportingProviders = this.config.capabilityRequirements[capKey];

      if (supportingProviders) {
        const available = supportingProviders.find((p) => this.isProviderAvailable(p));
        if (available) {
          return available;
        }
      }
    }
    return null;
  }

  /**
   * Get capability reason string
   */
  private getCapabilityReason(capabilities: TaskCapabilities): string {
    const required = Object.entries(capabilities)
      .filter(([, v]) => v)
      .map(([k]) => k);
    return required.join(', ');
  }

  /**
   * Fallback route when preferred provider unavailable
   */
  private fallbackRoute(analysis: TaskAnalysis): RoutingDecision {
    for (const provider of this.config.fallbackOrder) {
      if (this.isProviderAvailable(provider)) {
        const model = this.getDefaultModelForProvider(provider);
        return {
          provider,
          model,
          analysis,
          reason: `Fallback: preferred providers unavailable, using ${provider}`,
          alternatives: this.getAlternativeProviders(analysis.type, provider),
          isFallback: true,
          isOverride: false,
        };
      }
    }

    // Last resort: try to get default adapter
    try {
      const defaultAdapter = getDefaultAdapter();
      const models = defaultAdapter.listModels();
      const model = models.length > 0 ? models[0].id : 'unknown';

      return {
        provider: defaultAdapter.provider,
        model,
        analysis,
        reason: 'Last resort: using default configured provider',
        alternatives: [],
        isFallback: true,
        isOverride: false,
      };
    } catch {
      throw new Error('No providers available for routing');
    }
  }

  /**
   * Check if provider is available
   */
  private isProviderAvailable(provider: string): boolean {
    return this.availableProviders.includes(provider);
  }

  /**
   * Get default model for a provider
   */
  private getDefaultModelForProvider(provider: string): string {
    try {
      const adapter = getAdapter(provider);
      const models = adapter.listModels();
      return models.length > 0 ? models[0].id : 'default';
    } catch {
      // Return sensible defaults
      const defaults: Record<string, string> = {
        deepseek: 'deepseek-chat',
        openai: 'gpt-4o',
        anthropic: 'claude-3-5-sonnet-20241022',
        openrouter: 'openai/gpt-4o',
        ollama: 'qwen2.5-coder:32b',
        qwen: 'qwen3-coder',
      };
      return defaults[provider] || 'default';
    }
  }

  /**
   * Get model for provider based on task type
   * Supports per-provider, per-task model selection
   */
  private getModelForProvider(provider: string, taskType: TaskType): string {
    // Try to load config for provider-specific models
    try {
      const config = loadDamieConfig();
      const providerConfig = config?.providers?.[provider as ProviderName];
      
      if (providerConfig) {
        // Check for task-specific model
        if (taskType === TaskType.CODING && providerConfig.codingModel) {
          return providerConfig.codingModel;
        }
        if (taskType === TaskType.REASONING && providerConfig.reasoningModel) {
          return providerConfig.reasoningModel;
        }
        if (taskType === TaskType.GENERAL && providerConfig.generalModel) {
          return providerConfig.generalModel;
        }
        if (taskType === TaskType.VISUAL && providerConfig.visionModel) {
          return providerConfig.visionModel;
        }
        
        // Fall back to default model for provider
        if (providerConfig.model) {
          return providerConfig.model;
        }
      }
    } catch {
      // Config not available, use defaults
    }
    
    // Use default model for provider
    return this.getDefaultModelForProvider(provider);
  }

  /**
   * Get alternative providers for a task type
   */
  private getAlternativeProviders(taskType: TaskType, excludeProvider: string): string[] {
    return this.availableProviders.filter((p) => p !== excludeProvider);
  }

  /**
   * Get the adapter for a routing decision
   */
  getAdapter(decision: RoutingDecision): BaseAdapter {
    return getAdapter(decision.provider);
  }

  /**
   * Get model info for a routing decision
   */
  getModelInfo(decision: RoutingDecision): ModelInfo {
    const adapter = this.getAdapter(decision);
    return adapter.getModelInfo(decision.model);
  }

  /**
   * Get routing logs
   */
  getLogs(): RoutingLogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear routing logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Format routing decision for display
   */
  formatDecision(decision: RoutingDecision): string {
    const lines = [
      `Provider: ${decision.provider}`,
      `Model: ${decision.model}`,
      `Reason: ${decision.reason}`,
      `Task Type: ${decision.analysis.type}`,
      `Complexity: ${decision.analysis.complexity}/10`,
      `Confidence: ${(decision.analysis.confidence * 100).toFixed(0)}%`,
    ];

    if (decision.isOverride) {
      lines.push('(User Override)');
    }
    if (decision.isFallback) {
      lines.push('(Fallback)');
    }
    if (decision.alternatives.length > 0) {
      lines.push(`Alternatives: ${decision.alternatives.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Update routing configuration
   */
  updateConfig(config: Partial<ModelRouterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Apply routing configuration from Damie config
   */
  applyDamieConfig(config: DamieConfig): void {
    if (config.model?.routing) {
      const routing = config.model.routing;
      const taskTypeRouting: Partial<Record<TaskType, string>> = {};

      if (routing.coding) taskTypeRouting[TaskType.CODING] = routing.coding;
      if (routing.reasoning) taskTypeRouting[TaskType.REASONING] = routing.reasoning;
      if (routing.general) taskTypeRouting[TaskType.GENERAL] = routing.general;
      if (routing.vision) taskTypeRouting[TaskType.VISUAL] = routing.vision;

      this.updateConfig({
        taskTypeRouting,
        routingConfig: routing,
      });
    }

    this.refreshAvailableProviders();
  }
}

/**
 * Create a model router with optional configuration
 */
export function createModelRouter(config?: Partial<ModelRouterConfig>): ModelRouter {
  return new ModelRouter(config);
}

/**
 * Route a task with default configuration
 */
export function routeTask(task: string): RoutingDecision {
  const router = new ModelRouter();
  return router.route(task);
}
