/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ModelRouter,
  createModelRouter,
  routeTask,
  DEFAULT_ROUTER_CONFIG,
} from './modelRouter.js';
import { TaskType } from './types.js';

// Mock the adapter factory
vi.mock('../adapters/adapterFactory.js', () => ({
  getAvailableAdapters: vi.fn(() => [
    { provider: 'deepseek', listModels: () => [{ id: 'deepseek-chat' }] },
    { provider: 'openai', listModels: () => [{ id: 'gpt-4o' }] },
    { provider: 'anthropic', listModels: () => [{ id: 'claude-3-5-sonnet-20241022' }] },
  ]),
  getAdapter: vi.fn((provider: string) => ({
    provider,
    listModels: () => {
      const models: Record<string, Array<{ id: string }>> = {
        deepseek: [{ id: 'deepseek-chat' }, { id: 'deepseek-coder' }],
        openai: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
        anthropic: [{ id: 'claude-3-5-sonnet-20241022' }],
        openrouter: [{ id: 'openai/gpt-4o' }],
        ollama: [{ id: 'qwen2.5-coder:32b' }],
      };
      return models[provider] || [{ id: 'default' }];
    },
    getModelInfo: (model: string) => ({ id: model, provider }),
  })),
  getDefaultAdapter: vi.fn(() => ({
    provider: 'deepseek',
    listModels: () => [{ id: 'deepseek-chat' }],
  })),
}));

describe('ModelRouter', () => {
  let router: ModelRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new ModelRouter();
  });

  describe('constructor', () => {
    it('should create router with default config', () => {
      expect(router).toBeDefined();
    });

    it('should accept custom config', () => {
      const customRouter = new ModelRouter({
        enableLogging: false,
        fallbackOrder: ['ollama', 'deepseek'],
      });
      expect(customRouter).toBeDefined();
    });
  });

  describe('route - task type routing', () => {
    it('should route coding tasks to deepseek', () => {
      const decision = router.route('Write a function to sort an array');
      expect(decision.provider).toBe('deepseek');
      expect(decision.analysis.type).toBe(TaskType.CODING);
      expect(decision.isOverride).toBe(false);
      expect(decision.isFallback).toBe(false);
    });

    it('should route reasoning tasks to anthropic', () => {
      const decision = router.route('Analyze why this algorithm is slow step by step');
      expect(decision.provider).toBe('anthropic');
      expect(decision.analysis.type).toBe(TaskType.REASONING);
    });

    it('should route creative tasks to openai', () => {
      const decision = router.route('Write a creative blog post about AI');
      expect(decision.provider).toBe('openai');
      expect(decision.analysis.type).toBe(TaskType.CREATIVE);
    });

    it('should route general tasks to deepseek', () => {
      const decision = router.route('What is the meaning of this brief definition?');
      expect(decision.provider).toBe('deepseek');
      expect(decision.analysis.type).toBe(TaskType.GENERAL);
    });
  });

  describe('route - user override', () => {
    it('should respect provider override', () => {
      const decision = router.route('Write code', 'openai');
      expect(decision.provider).toBe('openai');
      expect(decision.isOverride).toBe(true);
      expect(decision.reason).toContain('User override');
    });

    it('should respect model override', () => {
      const decision = router.route('Write code', 'openai', 'gpt-4-turbo');
      expect(decision.provider).toBe('openai');
      expect(decision.model).toBe('gpt-4-turbo');
      expect(decision.isOverride).toBe(true);
    });

    it('should include alternatives in override decision', () => {
      const decision = router.route('Write code', 'openai');
      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives).not.toContain('openai');
    });
  });

  describe('route - capability routing', () => {
    it('should route vision tasks to capable provider', () => {
      const decision = router.route('Look at this image screenshot photo and describe it visually');
      // Vision capability should trigger openai or anthropic
      expect(['openai', 'anthropic']).toContain(decision.provider);
      expect(decision.reason).toContain('vision');
    });
  });

  describe('route - fallback', () => {
    it('should fallback when preferred provider unavailable', () => {
      // Create router with custom config where preferred isn't available
      const customRouter = new ModelRouter({
        taskTypeRouting: {
          [TaskType.CODING]: 'unavailable-provider',
        },
        fallbackOrder: ['deepseek', 'openai'],
      });

      const decision = customRouter.route('Write code');
      expect(decision.isFallback).toBe(true);
      expect(['deepseek', 'openai']).toContain(decision.provider);
    });
  });

  describe('route - logging', () => {
    it('should log routing decisions when enabled', () => {
      router.route('First task');
      router.route('Second task');

      const logs = router.getLogs();
      expect(logs.length).toBe(2);
      expect(logs[0].task).toBe('First task');
      expect(logs[1].task).toBe('Second task');
    });

    it('should not log when disabled', () => {
      const noLogRouter = new ModelRouter({ enableLogging: false });
      noLogRouter.route('Task');

      const logs = noLogRouter.getLogs();
      expect(logs.length).toBe(0);
    });

    it('should clear logs', () => {
      router.route('Task');
      expect(router.getLogs().length).toBe(1);

      router.clearLogs();
      expect(router.getLogs().length).toBe(0);
    });

    it('should include timing in logs', () => {
      router.route('Task');
      const logs = router.getLogs();
      expect(logs[0].duration).toBeGreaterThanOrEqual(0);
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('formatDecision', () => {
    it('should format decision for display', () => {
      const decision = router.route('Write code');
      const formatted = router.formatDecision(decision);

      expect(formatted).toContain('Provider:');
      expect(formatted).toContain('Model:');
      expect(formatted).toContain('Reason:');
      expect(formatted).toContain('Task Type:');
      expect(formatted).toContain('Complexity:');
      expect(formatted).toContain('Confidence:');
    });

    it('should include override indicator', () => {
      const decision = router.route('Write code', 'openai');
      const formatted = router.formatDecision(decision);
      expect(formatted).toContain('User Override');
    });

    it('should include fallback indicator', () => {
      const customRouter = new ModelRouter({
        taskTypeRouting: { [TaskType.CODING]: 'unavailable' },
      });
      const decision = customRouter.route('Write code');
      const formatted = customRouter.formatDecision(decision);
      expect(formatted).toContain('Fallback');
    });

    it('should include alternatives', () => {
      const decision = router.route('Write code');
      const formatted = router.formatDecision(decision);
      if (decision.alternatives.length > 0) {
        expect(formatted).toContain('Alternatives:');
      }
    });
  });

  describe('updateConfig', () => {
    it('should update router configuration', () => {
      router.updateConfig({
        taskTypeRouting: {
          [TaskType.CODING]: 'openai',
        },
      });

      const decision = router.route('Write code');
      expect(decision.provider).toBe('openai');
    });

    it('should merge with existing config', () => {
      router.updateConfig({ enableLogging: false });
      router.route('Task');
      expect(router.getLogs().length).toBe(0);
    });
  });

  describe('getAdapter', () => {
    it('should return adapter for decision', () => {
      const decision = router.route('Write code');
      const adapter = router.getAdapter(decision);
      expect(adapter.provider).toBe(decision.provider);
    });
  });

  describe('getModelInfo', () => {
    it('should return model info for decision', () => {
      const decision = router.route('Write code');
      const info = router.getModelInfo(decision);
      expect(info.id).toBe(decision.model);
    });
  });

  describe('createModelRouter', () => {
    it('should create router with factory function', () => {
      const factoryRouter = createModelRouter();
      expect(factoryRouter).toBeInstanceOf(ModelRouter);
    });

    it('should pass config to factory', () => {
      const factoryRouter = createModelRouter({
        enableLogging: false,
      });
      factoryRouter.route('Task');
      expect(factoryRouter.getLogs().length).toBe(0);
    });
  });

  describe('routeTask', () => {
    it('should route task with default router', () => {
      const decision = routeTask('Write a function');
      expect(decision.provider).toBeDefined();
      expect(decision.analysis).toBeDefined();
    });
  });

  describe('DEFAULT_ROUTER_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_ROUTER_CONFIG.fallbackOrder.length).toBeGreaterThan(0);
      expect(DEFAULT_ROUTER_CONFIG.taskTypeRouting[TaskType.CODING]).toBeDefined();
      expect(DEFAULT_ROUTER_CONFIG.enableLogging).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty task', () => {
      const decision = router.route('');
      expect(decision.provider).toBeDefined();
      expect(decision.model).toBeDefined();
    });

    it('should handle very long task', () => {
      const longTask = 'Write code '.repeat(1000);
      const decision = router.route(longTask);
      expect(decision.provider).toBeDefined();
    });

    it('should handle special characters', () => {
      const decision = router.route('Write code with émojis 🎉 and symbols @#$%');
      expect(decision.provider).toBeDefined();
    });
  });
});
