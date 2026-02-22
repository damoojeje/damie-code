# PRD: Damie Code Complete Fix Implementation

**PRD ID:** DAMIE-FIX-2026-001
**Date:** February 22, 2026
**Version:** 2.0.0 (Complete Fix Release)
**Status:** Ready for Implementation

---

## Executive Summary

This PRD defines the complete fix implementation for all 47 identified issues in Damie Code v1.0.3. The implementation will use:

1. **Ralph Loop Methodology** - PLAN → EXECUTE → VERIFY for each phase
2. **Skills from mydev/skills/** - Leveraging specialized skills for quality
3. **Systematic Phase Execution** - 5 phases, each tested before proceeding
4. **Zero-Tolerance Policy** - No issue left unfixed before v2.0.0 launch

---

## Implementation Methodology

### Ralph Loop Integration

Each phase follows the Ralph Loop:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │  1. PLAN     │────▶│  2. EXECUTE  │────▶│  3. VERIFY   │   │
│   │  (Design)    │     │  (Code)      │     │  (Test)      │   │
│   └──────────────┘     └──────────────┘     └──────────────┘   │
│          ▲                                         │            │
│          │                                         ▼            │
│   ┌──────────────┐                         ┌──────────────┐    │
│   │  NEXT PHASE  │◀────────────────────────│  APPROVE?    │    │
│   └──────────────┘                         └──────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Skills Utilization

| Skill | Usage |
|-------|-------|
| **ralph-tui** | Autonomous task execution, progress tracking |
| **ui-ux-pro-max** | UI/UX review for all UI changes |
| **agent-skills** | Code quality, React best practices |
| **superpowers** | Design brainstorming, implementation planning |
| **agents** | Specialized agents for complex tasks |

---

## Phase 1: Blocking Fixes (P0)

**Duration:** 1-2 days
**Issues:** FIX-001, FIX-002, FIX-003
**Goal:** Make app usable for all providers

### Task 1.1: FIX-001 - Model Selector Returns Empty

**Description:** Add model lists for DeepSeek, Anthropic, OpenRouter, Ollama

**Implementation Plan:**
```typescript
// File: packages/cli/src/ui/models/availableModels.ts

// Add model definitions for each provider
export const AVAILABLE_MODELS_DEEPSEEK: AvailableModel[] = [
  { id: 'deepseek-chat', label: 'DeepSeek Chat', description: 'Best for general tasks' },
  { id: 'deepseek-coder', label: 'DeepSeek Coder', description: 'Optimized for code' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: 'Complex reasoning' },
];

export const AVAILABLE_MODELS_ANTHROPIC: AvailableModel[] = [
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', description: 'Best overall' },
  { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', description: 'Most powerful' },
  { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', description: 'Fast & efficient' },
];

export const AVAILABLE_MODELS_OPENROUTER: AvailableModel[] = [
  { id: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Via OpenRouter' },
  { id: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Via OpenRouter' },
  { id: 'meta-llama/llama-3-70b-instruct', label: 'Llama 3 70B', description: 'Open source' },
];

export const AVAILABLE_MODELS_OLLAMA: AvailableModel[] = [
  { id: 'codellama', label: 'Code Llama', description: 'Coding focused' },
  { id: 'llama3.1', label: 'Llama 3.1', description: 'General purpose' },
  { id: 'mistral', label: 'Mistral', description: 'Fast & efficient' },
];

// Update getAvailableModelsForAuthType to return appropriate lists
export function getAvailableModelsForAuthType(authType: AuthType): AvailableModel[] {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
      return AVAILABLE_MODELS_QWEN;
    case AuthType.USE_OPENAI: {
      const openAIModel = getOpenAIAvailableModelFromEnv();
      return openAIModel ? [openAIModel] : [];
    }
    case AuthType.USE_DEEPSEEK:
      return AVAILABLE_MODELS_DEEPSEEK;
    case AuthType.USE_ANTHROPIC:
      return AVAILABLE_MODELS_ANTHROPIC;
    case AuthType.USE_OPENROUTER:
      return AVAILABLE_MODELS_OPENROUTER;
    case AuthType.USE_OLLAMA:
      return AVAILABLE_MODELS_OLLAMA;
    default:
      return [];
  }
}
```

**Testing:**
```bash
# Start Damie Code
damie

# Use /model command
/model

# Verify:
# - Model list shows for current provider
# - Can select different models
# - Selection persists
```

**Skills Applied:**
- `agent-skills/react-best-practices` - For UI component updates
- `ui-ux-pro-max` - For model selector UI review

---

### Task 1.2: FIX-002 - Config File Not Loaded

**Description:** Load API keys and settings from `~/.damie/config.yaml`

**Implementation Plan:**
```typescript
// File: packages/core/src/core/contentGenerator.ts

import { loadDamieConfig } from '../config/damieConfigLoader.js';

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
  generationConfig?: Partial<ContentGeneratorConfig>,
): ContentGeneratorConfig {
  // Load Damie config file FIRST
  const damieConfig = loadDamieConfig();
  
  // ... existing Google/Qwen logic ...
  
  // Damie Code providers - load from config file FIRST, then env
  if (authType === AuthType.USE_DEEPSEEK) {
    const providerConfig = damieConfig?.providers?.deepseek;
    newContentGeneratorConfig.apiKey = 
      providerConfig?.apiKey || 
      process.env['DEEPSEEK_API_KEY'] || 
      undefined;
    newContentGeneratorConfig.baseUrl = 
      providerConfig?.baseUrl || 
      'https://api.deepseek.com';
    newContentGeneratorConfig.model = 
      generationConfig?.model || 
      providerConfig?.model || 
      'deepseek-chat';
    newContentGeneratorConfig.timeout = providerConfig?.timeout;
    newContentGeneratorConfig.maxRetries = providerConfig?.maxRetries;
    return newContentGeneratorConfig;
  }
  
  // Similar for Anthropic, OpenRouter, Ollama...
}
```

**Testing:**
```bash
# Create config with API key
cat > ~/.damie/config.yaml <<EOF
security:
  auth:
    selectedType: "deepseek"
providers:
  deepseek:
    apiKey: "sk-test-key"
    model: "deepseek-coder"
    timeout: 60000
EOF

# Start Damie Code
damie

# Verify config loaded
# - No "API key required" error
# - Model is deepseek-coder (from config)
# - Timeout is 60000ms (from config)
```

**Skills Applied:**
- `superpowers` - For implementation planning
- `agent-skills` - For code quality review

---

### Task 1.3: FIX-003 - Hardcoded Model Names

**Description:** Make models fully configurable via config file

**Implementation Plan:**
```typescript
// File: packages/core/src/core/contentGenerator.ts

// Update to use config file models as primary source
if (authType === AuthType.USE_DEEPSEEK) {
  const providerConfig = damieConfig?.providers?.deepseek;
  
  // Priority: config file > generationConfig > provider default > hardcoded default
  newContentGeneratorConfig.model = 
    providerConfig?.model ||           // 1. Config file
    generationConfig?.model ||         // 2. Runtime config
    PROVIDER_DEFAULT_MODELS.deepseek || // 3. Provider default
    'deepseek-chat';                   // 4. Hardcoded fallback
  
  // ... rest of config
}
```

**Testing:**
```bash
# Test 1: Config file model
cat > ~/.damie/config.yaml <<EOF
providers:
  deepseek:
    model: "deepseek-coder"
EOF

damie
# Verify: Uses deepseek-coder

# Test 2: Environment override
export DEEPSEEK_MODEL="deepseek-reasoner"
damie
# Verify: Uses deepseek-reasoner

# Test 3: Default fallback
# No config, no env
damie
# Verify: Uses deepseek-chat (default)
```

**Skills Applied:**
- `agent-skills/composition-patterns` - For clean configuration patterns

---

### Phase 1 Verification Checklist

- [ ] FIX-001: `/model` shows models for all 6 providers
- [ ] FIX-002: Config file API keys are loaded and used
- [ ] FIX-003: Models are configurable via config file
- [ ] All tests pass
- [ ] UI/UX Pro Max review completed
- [ ] No regressions in existing functionality

---

## Phase 2: Critical UI Fixes (P1)

**Duration:** 2-3 days
**Issues:** FIX-004, FIX-006, FIX-012, FIX-013, FIX-014
**Goal:** Make all advertised features accessible

### Task 2.1: FIX-004 - Setup Wizard Saves Model Selection

**Description:** Persist model selection from setup wizard to config file

**Implementation Plan:**
```typescript
// File: packages/cli/src/setup/configWriter.ts

export async function writeConfig(
  configs: Array<{ provider: AuthType; apiKey?: string; model?: string }>,
  primaryProvider: AuthType,
): Promise<string> {
  const configPath = getDamieConfigPath();
  
  const lines = [
    '# Damie Code Configuration',
    '# Generated by setup wizard\n',
    'security:',
    '  auth:',
    `    selectedType: "${primaryProvider}"`,
    '\n# Provider configurations',
    'providers:',
  ];
  
  for (const { provider, apiKey, model } of configs) {
    const providerKey = getProviderKey(provider);
    
    lines.push(`  ${providerKey}:`);
    
    if (apiKey) {
      lines.push(`    apiKey: "${apiKey}"`);
    }
    
    // ALWAYS save model (not conditional)
    if (model) {
      lines.push(`    model: "${model}"`);
    } else {
      // Save default model for provider
      const defaultModel = getDefaultModelForProvider(provider);
      lines.push(`    model: "${defaultModel}"  # Default model`);
    }
    
    lines.push('');
  }
  
  fs.writeFileSync(configPath, lines.join('\n'));
  return configPath;
}
```

**Testing:**
```bash
# Delete existing config
rm ~/.damie/config.yaml

# Run setup wizard
damie
# Follow prompts, select DeepSeek, enter API key

# Check config file
cat ~/.damie/config.yaml
# Verify: model field is present with value

# Restart damie
damie
# Verify: Uses saved model
```

---

### Task 2.2: FIX-006 - Make /setup Always Accessible

**Description:** Allow users to re-run setup wizard anytime

**Implementation Plan:**
```typescript
// File: packages/cli/src/ui/commands/setupCommand.ts

export const setupCommand: SlashCommand = {
  name: 'setup',
  description: 'Re-run setup wizard to configure providers',
  action: async (context) => {
    const config = context.config;
    
    // Always allow setup, even if config exists
    const { runSetupWizard } = await import('../../setup/setupWizard.js');
    
    try {
      const result = await runSetupWizard();
      
      if (result.success) {
        // Reload config with new settings
        await config.refreshAuth(result.authType);
        return { type: 'success', message: 'Setup completed successfully!' };
      } else {
        return { type: 'error', message: result.error };
      }
    } catch (error) {
      return { 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Setup failed' 
      };
    }
  },
};
```

**Testing:**
```bash
# With existing config
damie
/setup
# Verify: Setup wizard runs
# Verify: Can change providers
# Verify: New config saved

# Without config
damie
/setup
# Verify: Setup wizard runs
```

---

### Task 2.3: FIX-012, FIX-013, FIX-014 - Fix Skills/Plugins/Profiles Commands

**Description:** Implement actual functionality for Skills, Plugins, Profiles commands

**Implementation Plan:**

#### Skills Command (FIX-012)
```typescript
// File: packages/cli/src/ui/commands/skillsCommand.ts

import { SkillManager } from '@damie-code/damie-code-core';

export const skillsCommand: SlashCommand = {
  name: 'skills',
  description: 'Manage skills',
  action: async (context, args) => {
    const skillManager = SkillManager.getInstance();
    
    switch (args[0]) {
      case 'list':
        const skills = await skillManager.listSkills();
        return { 
          type: 'list', 
          items: skills.map(s => `${s.enabled ? '✓' : '✗'} ${s.name}`)
        };
      
      case 'enable':
        await skillManager.enableSkill(args[1]);
        return { type: 'success', message: `Enabled skill: ${args[1]}` };
      
      case 'disable':
        await skillManager.disableSkill(args[1]);
        return { type: 'success', message: `Disabled skill: ${args[1]}` };
      
      case 'install':
        const result = await skillManager.installSkill(args[1]);
        return { 
          type: result.success ? 'success' : 'error',
          message: result.message 
        };
      
      default:
        return { type: 'help', message: getSkillsHelp() };
    }
  },
};
```

#### Plugins Command (FIX-013)
```typescript
// File: packages/cli/src/ui/commands/pluginsCommand.ts

import { PluginManager } from '@damie-code/damie-code-core';

export const pluginsCommand: SlashCommand = {
  name: 'plugins',
  description: 'Manage plugins',
  action: async (context, args) => {
    const pluginManager = PluginManager.getInstance();
    
    switch (args[0]) {
      case 'list':
        const plugins = await pluginManager.listPlugins();
        return { 
          type: 'list',
          items: plugins.map(p => `${p.enabled ? '✓' : '✗'} ${p.name} (${p.status})`)
        };
      
      case 'install':
        const result = await pluginManager.installPlugin(args[1]);
        return { type: result.success ? 'success' : 'error', message: result.message };
      
      case 'enable':
        await pluginManager.enablePlugin(args[1]);
        return { type: 'success', message: `Enabled plugin: ${args[1]}` };
      
      case 'disable':
        await pluginManager.disablePlugin(args[1]);
        return { type: 'success', message: `Disabled plugin: ${args[1]}` };
      
      default:
        return { type: 'help', message: getPluginsHelp() };
    }
  },
};
```

#### Profile Command (FIX-014)
```typescript
// File: packages/cli/src/ui/commands/profileCommand.ts

import { ProfileManager } from '@damie-code/damie-code-core';

export const profileCommand: SlashCommand = {
  name: 'profile',
  description: 'Manage profiles',
  action: async (context, args) => {
    const profileManager = ProfileManager.getInstance();
    
    switch (args[0]) {
      case 'list':
        const profiles = await profileManager.listProfiles();
        const current = profileManager.getCurrentProfile();
        return { 
          type: 'list',
          items: profiles.map(p => `${p.name === current ? '→' : ' '} ${p.name} - ${p.description}`)
        };
      
      case 'use':
        await profileManager.setProfile(args[1]);
        return { type: 'success', message: `Using profile: ${args[1]}` };
      
      case 'create':
        // Open profile creation dialog
        return { type: 'dialog', dialog: 'profile-create' };
      
      default:
        return { type: 'help', message: getProfileHelp() };
    }
  },
};
```

**Testing:**
```bash
# Skills
damie
/skills list
/skills enable dependency-updater
/skills disable dependency-updater

# Plugins
/plugins list
/plugins install plugin-name
/plugins enable plugin-name

# Profiles
/profile list
/profile use coding
/profile create
```

---

### Phase 2 Verification Checklist

- [ ] FIX-004: Setup wizard saves model to config file
- [ ] FIX-006: `/setup` command always accessible
- [ ] FIX-012: `/skills` command fully functional
- [ ] FIX-013: `/plugins` command fully functional
- [ ] FIX-014: `/profile` command fully functional
- [ ] All commands tested end-to-end
- [ ] No regressions

---

## Phase 3: Configuration Fixes (P1)

**Duration:** 2-3 days
**Issues:** FIX-005, FIX-007, FIX-018, FIX-019, FIX-020
**Goal:** Unified, working configuration system

### Task 3.1: FIX-005 - Unify Config Systems

**Description:** Migrate to single DamieConfig system

**Implementation Plan:**
```typescript
// File: packages/cli/src/config/settings.ts

// Add migration function
export async function migrateLegacySettings(): Promise<void> {
  const legacySettingsPath = getLegacySettingsPath(); // ~/.qwen/settings.json
  const damieConfigPath = getDamieConfigPath(); // ~/.damie/config.yaml
  
  if (!fs.existsSync(legacySettingsPath)) {
    return; // Nothing to migrate
  }
  
  if (fs.existsSync(damieConfigPath)) {
    return; // Already using new config
  }
  
  // Migrate settings
  const legacySettings = JSON.parse(fs.readFileSync(legacySettingsPath, 'utf8'));
  const damieConfig = convertLegacyToDamie(legacySettings);
  
  // Write new config
  fs.writeFileSync(damieConfigPath, generateConfigYaml(damieConfig));
  
  // Backup legacy
  fs.renameSync(legacySettingsPath, legacySettingsPath + '.backup');
  
  console.log('✓ Settings migrated to new format');
}
```

**Testing:**
```bash
# With legacy settings
damie
# Should auto-migrate on first run
# Verify: ~/.damie/config.yaml created
# Verify: ~/.qwen/settings.json backed up
```

---

### Task 3.2: FIX-018, FIX-019, FIX-020 - Apply Timeout/Retry/BaseUrl Config

**Description:** Apply configuration to API requests

**Implementation Plan:**
```typescript
// File: packages/core/src/adapters/baseAdapter.ts

export abstract class AbstractAdapter implements BaseAdapter {
  protected config: AdapterConfig;
  
  async request(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    const timeout = this.config.timeout || 30000;
    const maxRetries = this.config.maxRetries || 3;
    const baseUrl = this.config.baseUrl || this.getDefaultBaseUrl();
    
    const url = `${baseUrl}${endpoint}`;
    
    // Apply retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
            ...options.headers,
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on client errors
        if (lastError.message.includes('400')) {
          throw lastError;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Request failed');
  }
}
```

**Testing:**
```bash
# Test timeout
cat > ~/.damie/config.yaml <<EOF
providers:
  deepseek:
    timeout: 5000  # 5 seconds
EOF

damie
# Make slow request
# Verify: Times out after 5 seconds with clear error

# Test retry
# Simulate transient failure
# Verify: Retries up to maxRetries times

# Test base URL
cat > ~/.damie/config.yaml <<EOF
providers:
  ollama:
    baseUrl: "http://custom-server:11434"
EOF

damie
# Verify: Connects to custom server
```

---

### Phase 3 Verification Checklist

- [ ] FIX-005: Legacy settings migrated
- [ ] FIX-018: Timeout configuration applied
- [ ] FIX-019: Retry configuration applied
- [ ] FIX-020: Base URL configuration applied
- [ ] Single config system working
- [ ] No regressions

---

## Phase 4: Model Routing Fixes (P1/P2)

**Duration:** 1-2 days
**Issues:** FIX-008, FIX-021, FIX-024
**Goal:** Working intelligent model routing

### Task 4.1: FIX-008 - Integrate Model Router with Content Generator

**Description:** Apply routing decisions to actual API calls

**Implementation Plan:**
```typescript
// File: packages/core/src/core/client.ts

import { ModelRouter, TaskType } from '../router/modelRouter.js';

export class GeminiClient {
  private modelRouter: ModelRouter;
  
  async sendMessageStream(request: SendMessageStreamRequest): Promise<AsyncGenerator<Chunk>> {
    // Analyze task type
    const taskType = await this.analyzeTaskType(request);
    
    // Get routed model
    const router = new ModelRouter(this.config);
    const routingDecision = router.getOptimalModel(taskType, request.context);
    
    // Apply routed model to request
    const modifiedRequest = {
      ...request,
      model: routingDecision.model,
      provider: routingDecision.provider,
    };
    
    // Execute with routed model
    return this.executeWithModel(modifiedRequest);
  }
  
  private async analyzeTaskType(request: SendMessageStreamRequest): Promise<TaskType> {
    const text = request.message.toLowerCase();
    
    if (text.includes('code') || text.includes('function') || text.includes('bug')) {
      return TaskType.CODING;
    }
    if (text.includes('explain') || text.includes('why') || text.includes('analyze')) {
      return TaskType.REASONING;
    }
    if (text.includes('image') || text.includes('diagram') || text.includes('screenshot')) {
      return TaskType.VISION;
    }
    return TaskType.GENERAL;
  }
}
```

**Testing:**
```bash
damie

# Test coding task
> "Write a sorting function"
# Verify: Uses DeepSeek (coding provider)

# Test reasoning task
> "Explain why this code is slow"
# Verify: Uses Anthropic (reasoning provider)

# Test general task
> "What's the weather like?"
# Verify: Uses Qwen (general provider)
```

---

### Phase 4 Verification Checklist

- [ ] FIX-008: Model router integrated with content generator
- [ ] FIX-021: Routing UI for configuration
- [ ] FIX-024: Per-task model configuration working
- [ ] Routing decisions logged
- [ ] Can override routing manually

---

## Phase 5: Polish & Documentation (P2/P3)

**Duration:** 2-3 days
**Issues:** FIX-015, FIX-016, FIX-017, FIX-022, FIX-023
**Goal:** Production-ready polish

### Task 5.1: FIX-015, FIX-016, FIX-017 - Error Handling & Health Checks

**Description:** Improve error messages and add health checks

**Implementation Plan:**
```typescript
// File: packages/cli/src/commands/doctorCommand.ts

export async function runDoctorCommand(): Promise<void> {
  console.log('Damie Code Diagnostic Tool\n');
  
  // Check config
  const config = loadDamieConfig();
  if (!config) {
    console.log('✗ Config file not found');
  } else {
    console.log('✓ Config file found');
  }
  
  // Check each configured provider
  const providers = getConfiguredProviders(config);
  for (const provider of providers) {
    console.log(`\nChecking ${provider}...`);
    
    const result = await checkProviderHealth(provider, config);
    
    if (result.status === 'ok') {
      console.log(`✓ ${provider} - Connected (${result.latency}ms)`);
    } else if (result.status === 'warning') {
      console.log(`⚠ ${provider} - ${result.message}`);
    } else {
      console.log(`✗ ${provider} - ${result.message}`);
      console.log(`  Fix: ${result.suggestion}`);
    }
  }
}

async function checkProviderHealth(
  provider: ProviderName,
  config: DamieConfig,
): Promise<HealthCheckResult> {
  switch (provider) {
    case 'deepseek':
      return await checkDeepSeekHealth(config);
    case 'anthropic':
      return await checkAnthropicHealth(config);
    case 'ollama':
      return await checkOllamaHealth(config);
    // ... etc
  }
}
```

**Testing:**
```bash
damie doctor

# Expected output:
# ✓ Config file found
# ✓ DeepSeek - Connected (245ms)
# ⚠ Anthropic - Rate limit approaching
# ✗ Ollama - Not running
#   Fix: Start Ollama with: ollama serve
```

---

### Phase 5 Verification Checklist

- [ ] FIX-015: Clear error messages for missing config
- [ ] FIX-016: Ollama availability check
- [ ] FIX-017: Provider health checks in `damie doctor`
- [ ] FIX-022: Documentation updated
- [ ] FIX-023: Skills.sh integration documented
- [ ] All docs complete

---

## Final Verification & Release

### Pre-Release Checklist

- [ ] All 47 issues fixed and tested
- [ ] All phases completed
- [ ] No regressions in existing functionality
- [ ] UI/UX Pro Max review completed
- [ ] Agent Skills code quality review passed
- [ ] Documentation complete
- [ ] Version bumped to 2.0.0
- [ ] CHANGELOG.md updated
- [ ] Git commit with all changes
- [ ] Git tag v2.0.0
- [ ] Ready for npm publish

### Release Commands

```bash
# Bump version
npm version 2.0.0

# Commit changes
git add .
git commit -m "release: v2.0.0 - Complete fix release

Fixed all 47 identified issues:
- Phase 1: Blocking fixes (3 issues)
- Phase 2: Critical UI fixes (5 issues)
- Phase 3: Configuration fixes (5 issues)
- Phase 4: Model routing fixes (3 issues)
- Phase 5: Polish & documentation (5 issues)

All features tested and verified."

git tag v2.0.0
git push origin main --tags

# Build and publish
npm run build:packages
npm run bundle
cd dist
npm publish --access public --otp=XXX
```

---

## Success Criteria

✅ **Release is successful when:**

1. All 47 issues from FIX_LIST.md are marked complete
2. App launches without errors for all 6 providers
3. Model switching works for all providers
4. Config file is loaded and applied
5. All commands (/setup, /model, /skills, /plugins, /profile) work
6. Model routing is functional
7. Error messages are clear and helpful
8. Documentation is complete
9. Zero regressions from v1.0.3
10. User can complete full workflow without manual config editing

---

**PRD Approved:** Ready for Implementation
**Implementation Method:** Ralph Loop with Skills Integration
**Quality Standard:** Zero-Tolerance for Unfixed Issues
