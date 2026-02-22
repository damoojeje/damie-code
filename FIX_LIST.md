# Damie Code - Comprehensive Fix List

**Review Date:** February 22, 2026
**Version Reviewed:** 1.0.3
**Reviewer:** AI Code Analysis Agent

---

## Executive Summary

This review identified **47 issues** across the Damie Code application, categorized by severity:

| Category | Count | P0 (Blocking) | P1 (High) | P2 (Medium) | P3 (Low) |
|----------|-------|---------------|-----------|-------------|----------|
| Critical | 8 | 3 | 5 | 0 | 0 |
| High | 15 | 0 | 8 | 7 | 0 |
| Medium | 18 | 0 | 0 | 12 | 6 |
| Low | 6 | 0 | 0 | 0 | 6 |
| **Total** | **47** | **3** | **13** | **19** | **12** |

---

## Issue Legend

| Priority | Description |
|----------|-------------|
| P0 | Blocking - Must fix before release |
| P1 | High - Should fix in next release |
| P2 | Medium - Important but not urgent |
| P3 | Low - Nice to have / cosmetic |

---

## CRITICAL ISSUES

### FIX-001: Model Selector Returns Empty for Damie Providers

**Category:** Critical
**Priority:** P0 (Blocking)

**Description:**
The `getAvailableModelsForAuthType()` function in `availableModels.ts` returns an empty array for all Damie Code providers (DeepSeek, Anthropic, OpenRouter, Ollama), making the `/model` command UI unusable for these providers.

**Expected Behavior:**
Users should see a list of available models for each provider when using the `/model` command, allowing them to switch between models.

**Current Behavior:**
```typescript
// packages/cli/src/ui/models/availableModels.ts:43-52
export function getAvailableModelsForAuthType(authType: AuthType): AvailableModel[] {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
      return AVAILABLE_MODELS_QWEN;
    case AuthType.USE_OPENAI: {
      const openAIModel = getOpenAIAvailableModelFromEnv();
      return openAIModel ? [openAIModel] : [];
    }
    default:
      return [];  // ❌ Returns empty for DeepSeek, Anthropic, OpenRouter, Ollama!
  }
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/models/availableModels.ts`

**Impact:**
- Users cannot switch models via UI for 4 out of 6 providers
- Model selection dialog appears empty
- Users are stuck with hardcoded default models

---

### FIX-002: Config File Not Loaded for Damie Providers

**Category:** Critical
**Priority:** P0 (Blocking)

**Description:**
The `createContentGeneratorConfig()` function only reads API keys and models from environment variables, completely ignoring the `~/.damie/config.yaml` file for Damie Code providers.

**Expected Behavior:**
Configuration should be loaded in this order:
1. Damie config file (`~/.damie/config.yaml`)
2. Environment variables (as fallback)
3. Hardcoded defaults (last resort)

**Current Behavior:**
```typescript
// packages/core/src/core/contentGenerator.ts:83-86
const deepseekApiKey = process.env['DEEPSEEK_API_KEY'] || undefined;
const anthropicApiKey = process.env['ANTHROPIC_API_KEY'] || undefined;
const openrouterApiKey = process.env['OPENROUTER_API_KEY'] || undefined;
// ❌ No loading from DamieConfig file!
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`
- `/E:/damie-coder-cli/packages/core/src/config/damieConfigLoader.ts`

**Impact:**
- Users cannot configure providers via config file
- API keys saved in config are ignored
- Custom models in config are ignored
- Timeout/retry settings in config are ignored

---

### FIX-003: Hardcoded Model Names with No Configuration

**Category:** Critical
**Priority:** P0 (Blocking)

**Description:**
Model names are hardcoded in `contentGenerator.ts` with no way for users to change them via configuration.

**Expected Behavior:**
Models should be configurable via:
1. Config file per-provider settings
2. Environment variable overrides
3. Sensible defaults as last resort

**Current Behavior:**
```typescript
// packages/core/src/core/contentGenerator.ts:143-163
if (authType === AuthType.USE_DEEPSEEK) {
  newContentGeneratorConfig.model = generationConfig?.model || 'deepseek-chat';  // ❌ Hardcoded
}

if (authType === AuthType.USE_ANTHROPIC) {
  newContentGeneratorConfig.model = generationConfig?.model || 'claude-3-5-sonnet-20241022';  // ❌ Hardcoded
}

if (authType === AuthType.USE_OPENROUTER) {
  newContentGeneratorConfig.model = generationConfig?.model || 'anthropic/claude-3-5-sonnet';  // ❌ Hardcoded
}

if (authType === AuthType.USE_OLLAMA) {
  newContentGeneratorConfig.baseUrl = generationConfig?.baseUrl || 'http://localhost:11434/v1';
  newContentGeneratorConfig.model = generationConfig?.model || 'codellama';  // ❌ Hardcoded
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`

**Impact:**
- Users cannot customize models per provider
- No support for new models without code changes
- Cannot use provider-specific models (e.g., deepseek-coder vs deepseek-chat)

---

### FIX-004: Setup Wizard Does Not Save Model Selection

**Category:** Critical
**Priority:** P1 (High)

**Description:**
The setup wizard validates API keys and receives recommended models from validation, but does not persist the model selection to the config file.

**Expected Behavior:**
Setup wizard should:
1. Validate API key
2. Get recommended/default model
3. Allow user to customize model
4. Save both API key AND model to config file

**Current Behavior:**
```typescript
// packages/cli/src/setup/configWriter.ts
// Model from validation is received but NOT saved to config
configs.push({ provider, apiKey, model });  // model is captured

// But in generateConfigYaml, model is only saved conditionally
if (model) {
  lines.push(`  model: "${model}"`);
} else if (provider === AuthType.USE_OLLAMA) {
  lines.push('  model: "llama3.1"  # Default model');  // ❌ Falls back to comment
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/setup/configWriter.ts`
- `/E:/damie-coder-cli/packages/cli/src/setup/setupWizard.ts`

**Impact:**
- Model selection lost after setup
- Users must manually edit config file to set models
- Validation result (recommended model) is wasted

---

### FIX-005: Two Separate Config Systems Create Confusion

**Category:** Critical
**Priority:** P1 (High)

**Description:**
The application has two separate configuration systems that are not properly integrated:
1. **DamieConfig** (`~/.damie/config.yaml`) - Modern, file-based
2. **Settings** (`~/.qwen/settings.json`) - Legacy, used by UI components

**Expected Behavior:**
Single unified configuration system with:
- One source of truth
- Clear migration path from legacy
- All components reading from same config

**Current Behavior:**
```typescript
// DamieConfig - packages/core/src/config/damieConfig.ts
export interface DamieConfig {
  security: SecurityConfig;
  providers?: ProvidersConfig;
  model?: DamieModelConfig;
  ui?: UIConfig;
}

// Settings - packages/cli/src/config/settings.ts
// Uses ~/.qwen/settings.json (legacy path)
// Different schema, different location
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/config/damieConfig.ts`
- `/E:/damie-coder-cli/packages/core/src/config/damieConfigLoader.ts`
- `/E:/damie-coder-cli/packages/cli/src/config/settings.ts`
- `/E:/damie-coder-cli/packages/cli/src/config/settingsSchema.ts`

**Impact:**
- Configuration conflicts possible
- User confusion about which file to edit
- Settings changes may not apply to all components
- Maintenance burden of two systems

---

### FIX-006: No /setup Command Accessibility After First Run

**Category:** Critical
**Priority:** P1 (High)

**Description:**
User reports indicate inability to re-run setup or switch providers after initial setup. The `/setup` command exists but may not be properly accessible.

**Expected Behavior:**
- `/setup` command should always be accessible
- Clear UI flow for switching providers
- Option to re-run full setup wizard anytime

**Current Behavior:**
```typescript
// packages/cli/src/services/BuiltinCommandLoader.ts:89
// setupCommand is registered but firstRunDetector may block access
export function isFirstRun(): boolean {
  const configPath = getDamieConfigPath();
  return !fs.existsSync(configPath);  // ❌ Only checks file existence
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/services/BuiltinCommandLoader.ts`
- `/E:/damie-coder-cli/packages/cli/src/setup/firstRunDetector.ts`
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/setupCommand.ts`

**Impact:**
- Users cannot easily switch providers
- Must manually delete config file to re-run setup
- Poor user experience for multi-provider workflows

---

### FIX-007: No Multi-Provider UI for Configuration

**Category:** Critical
**Priority:** P1 (High)

**Description:**
While the config schema supports multiple providers, there is no UI to:
- View all configured providers
- Add/remove providers
- Set primary provider
- Configure per-provider models

**Expected Behavior:**
Provider management UI should show:
- List of all configured providers with status
- Add new provider button
- Remove provider option
- Set as primary action
- Per-provider model configuration

**Current Behavior:**
```typescript
// packages/cli/src/ui/commands/providerCommand.ts
// Command exists but only shows basic info
// No interactive UI for managing multiple providers
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/providerCommand.ts`
- `/E:/damie-coder-cli/packages/cli/src/commands/providerCommand.ts`

**Impact:**
- Users cannot manage multiple providers easily
- Must manually edit YAML config file
- Intelligent routing configuration is difficult

---

### FIX-008: Model Routing Not Integrated with Content Generator

**Category:** Critical
**Priority:** P1 (High)

**Description:**
The Model Router exists but is not integrated with the actual content generation flow. Routing decisions are made but not applied to API calls.

**Expected Behavior:**
```
User Request → Task Analyzer → Model Router → Content Generator (with selected model)
```

**Current Behavior:**
```
User Request → Content Generator (uses primary provider only)
                    ↓
            Model Router (unused or logging only)
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/router/modelRouter.ts`
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`
- `/E:/damie-coder-cli/packages/core/src/core/client.ts`

**Impact:**
- Intelligent routing is non-functional
- All tasks use primary provider regardless of type
- Cost optimization not working
- Task-specific model selection not working

---

## HIGH PRIORITY ISSUES

### FIX-009: Missing Model Lists for Damie Providers

**Category:** High
**Priority:** P1

**Description:**
No model definitions exist for DeepSeek, Anthropic, OpenRouter, and Ollama in the `availableModels.ts` file.

**Expected Behavior:**
Each provider should have a comprehensive model list:
```typescript
export const AVAILABLE_MODELS_DEEPSEEK: AvailableModel[] = [
  { id: 'deepseek-chat', label: 'DeepSeek Chat', description: 'Best for general tasks' },
  { id: 'deepseek-coder', label: 'DeepSeek Coder', description: 'Optimized for code' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: 'Complex reasoning' },
];
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/models/availableModels.ts`

**Impact:**
- Cannot display model options in UI
- Users unaware of available models
- Cannot switch between specialized models

---

### FIX-010: Adapter Factory Not Used in Content Generator

**Category:** High
**Priority:** P1

**Description:**
The adapter system (`adapterFactory.ts`) exists but `contentGenerator.ts` uses its own direct implementation instead of the adapters.

**Expected Behavior:**
```typescript
// Should use adapter factory
const adapter = getAdapterFromConfig(provider);
const response = await adapter.generateContent(request);
```

**Current Behavior:**
```typescript
// Direct implementation in contentGenerator.ts
// Adapters are defined but not used
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`
- `/E:/damie-coder-cli/packages/core/src/adapters/adapterFactory.ts`

**Impact:**
- Duplicate code paths
- Adapter features (retry, streaming) not used
- Harder to add new providers

---

### FIX-011: No API Key Validation in Config Loading

**Category:** High
**Priority:** P1

**Description:**
When loading config from file, there is no validation that API keys are present and valid before attempting API calls.

**Expected Behavior:**
Config loading should validate:
- Required API keys present
- API key format is valid
- Optional: Test connectivity

**Current Behavior:**
```typescript
// packages/core/src/config/damieConfigLoader.ts
// No validation of API keys
export function loadDamieConfig(): DamieConfig | null {
  // Just parses YAML, no validation
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/config/damieConfigLoader.ts`
- `/E:/damie-coder-cli/packages/cli/src/setup/apiValidator.ts`

**Impact:**
- Errors occur at API call time, not config load time
- Poor error messages for users
- Debugging difficult

---

### FIX-012: Skills Command Stub Implementations

**Category:** High
**Priority:** P1

**Description:**
The skills command has stub implementations that don't actually enable/disable/install skills.

**Expected Behavior:**
```bash
/skills enable dependency-updater  # Should actually enable
/skills install skill-name         # Should actually install
```

**Current Behavior:**
```typescript
// packages/cli/src/ui/commands/skillsCommand.ts:82-87
case 'enable':
  console.log(`\n✅ Enabled skill: ${argsArray[1]}\n`);  // ❌ Just prints message
  break;

case 'install':
  console.log('Note: Full installation requires skills.sh integration.');  // ❌ Not implemented
  break;
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/skillsCommand.ts`
- `/E:/damie-coder-cli/packages/cli/src/services/skillService.ts`

**Impact:**
- Skills system non-functional
- Cannot manage skills via CLI
- Feature advertised but not working

---

### FIX-013: Plugins Command Opens Empty Dialog

**Category:** High
**Priority:** P1

**Description:**
The plugins command only opens a dialog without any actual plugin management functionality.

**Expected Behavior:**
```bash
/plugins list       # List installed plugins
/plugins install    # Install new plugin
/plugins enable     # Enable plugin
/plugins disable    # Disable plugin
```

**Current Behavior:**
```typescript
// packages/cli/src/ui/commands/pluginsCommand.ts
export const pluginsCommand: SlashCommand = {
  action: async () => {
    return {
      type: 'dialog',
      dialog: 'plugins',  // ❌ Opens dialog with no implementation
    };
  },
};
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/pluginsCommand.ts`
- `/E:/damie-coder-cli/packages/cli/src/services/pluginService.ts`

**Impact:**
- Plugin system non-functional
- Cannot manage plugins via CLI
- Feature advertised but not working

---

### FIX-014: Profile Command Opens Empty Dialog

**Category:** High
**Priority:** P1

**Description:**
The profile command only opens a dialog without any actual profile management functionality.

**Expected Behavior:**
```bash
/profile list       # List available profiles
/profile use <name> # Use specific profile
/profile create     # Create new profile
```

**Current Behavior:**
```typescript
// packages/cli/src/ui/commands/profileCommand.ts
export const profileCommand: SlashCommand = {
  action: async () => {
    return {
      type: 'dialog',
      dialog: 'profile',  // ❌ Opens dialog with no implementation
    };
  },
};
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/profileCommand.ts`
- `/E:/damie-coder-cli/packages/cli/src/services/profileService.ts`

**Impact:**
- Profile system partially non-functional
- Cannot manage profiles via CLI UI
- Auto-selection works but manual control doesn't

---

### FIX-015: No Error Handling for Missing Provider Config

**Category:** High
**Priority:** P1

**Description:**
When a provider is selected but not configured, error messages are unclear or missing.

**Expected Behavior:**
```
Error: DeepSeek provider selected but not configured.
Please run /setup or add to ~/.damie/config.yaml:

providers:
  deepseek:
    apiKey: "your-api-key"
```

**Current Behavior:**
```typescript
// packages/core/src/core/contentGenerator.ts:254-258
if (!config.apiKey && config.authType !== AuthType.USE_OLLAMA) {
  throw new Error(
    `API key is required for ${config.authType}. Set the appropriate environment variable or configure in config file.`,
  );
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`

**Impact:**
- Confusing error messages
- Users don't know how to fix
- Poor onboarding experience

---

### FIX-016: Ollama Provider Has No API Key Validation

**Category:** High
**Priority:** P1

**Description:**
Ollama doesn't require API keys, but there's no validation that Ollama is actually running before attempting to use it.

**Expected Behavior:**
Before using Ollama, check:
- Ollama service is running
- Required models are installed
- Connection is available

**Current Behavior:**
```typescript
// packages/core/src/adapters/ollamaAdapter.ts:230-236
// Validation exists but not called before use
async isAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${this.getBaseUrl()}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/adapters/ollamaAdapter.ts`
- `/E:/damie-coder-cli/packages/cli/src/setup/apiValidator.ts`

**Impact:**
- Errors occur at request time
- Users must know to start Ollama manually
- No helpful guidance in errors

---

### FIX-017: No Provider Health Check

**Category:** High
**Priority:** P1

**Description:**
No mechanism to check if configured providers are healthy and accessible before making requests.

**Expected Behavior:**
```bash
damie doctor  # Should check all configured providers
# Output:
# ✓ DeepSeek - Connected
# ✗ Anthropic - API key invalid
# ⚠ Ollama - Not running
```

**Current Behavior:**
```typescript
// packages/cli/src/commands/configCommands.ts
// Basic config show, no health checks
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/commands/configCommands.ts`
- `/E:/damie-coder-cli/packages/cli/src/setup/apiValidator.ts`

**Impact:**
- Users discover issues at request time
- No proactive health monitoring
- Debugging difficult

---

### FIX-018: Timeout Configuration Not Applied

**Category:** High
**Priority:** P1

**Description:**
Timeout configuration in config file is not applied to API requests.

**Expected Behavior:**
```yaml
providers:
  deepseek:
    timeout: 60000  # Should apply 60s timeout
```

**Current Behavior:**
```typescript
// packages/core/src/core/contentGenerator.ts
// Timeout is read but not applied to requests
newContentGeneratorConfig.timeout = providerConfig?.timeout;  // Read but unused
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`
- `/E:/damie-coder-cli/packages/core/src/adapters/baseAdapter.ts`

**Impact:**
- Requests can hang indefinitely
- No control over timeout behavior
- Poor user experience with slow providers

---

### FIX-019: Retry Configuration Not Applied

**Category:** High
**Priority:** P1

**Description:**
Max retries configuration in config file is not applied to API requests.

**Expected Behavior:**
```yaml
providers:
  deepseek:
    maxRetries: 3  # Should retry up to 3 times
```

**Current Behavior:**
```typescript
// packages/core/src/core/contentGenerator.ts
// maxRetries is read but not applied
newContentGeneratorConfig.maxRetries = providerConfig?.maxRetries;  # Read but unused
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`
- `/E:/damie-coder-cli/packages/core/src/adapters/retry.ts`

**Impact:**
- Transient failures cause immediate errors
- No automatic recovery
- Poor reliability

---

### FIX-020: Base URL Override Not Working

**Category:** High
**Priority:** P1

**Description:**
Custom base URL configuration (for proxies/self-hosted) is not properly applied.

**Expected Behavior:**
```yaml
providers:
  ollama:
    baseUrl: "http://custom-server:11434"  # Should use custom URL
```

**Current Behavior:**
```typescript
// packages/core/src/core/contentGenerator.ts:166-167
if (authType === AuthType.USE_OLLAMA) {
  newContentGeneratorConfig.baseUrl = generationConfig?.baseUrl || 'http://localhost:11434/v1';
  // ❌ Ignores config file baseUrl
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`

**Impact:**
- Cannot use custom Ollama servers
- Cannot use API proxies
- Self-hosted deployments broken

---

### FIX-021: No Model Routing UI Configuration

**Category:** High
**Priority:** P1

**Description:**
Model routing configuration exists in schema but has no UI for configuration.

**Expected Behavior:**
```yaml
model:
  routing:
    coding: "deepseek"      # Coding tasks → DeepSeek
    reasoning: "anthropic"  # Reasoning tasks → Anthropic
    general: "deepseek"     # General tasks → DeepSeek
    vision: "openai"        # Vision tasks → OpenAI
```

**Current Behavior:**
```typescript
// packages/cli/src/ui/commands/routeCommand.ts
// Command shows routing but doesn't allow configuration
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/routeCommand.ts`
- `/E:/damie-coder-cli/packages/core/src/router/modelRouter.ts`

**Impact:**
- Cannot configure routing via UI
- Must manually edit YAML
- Feature advertised but not accessible

---

### FIX-022: Incomplete Documentation for Configuration

**Category:** High
**Priority:** P1

**Description:**
README and docs don't fully document all configuration options, especially for multi-provider setup.

**Expected Behavior:**
Documentation should cover:
- All config file options
- Environment variable overrides
- Multi-provider configuration examples
- Model routing configuration
- Per-provider model settings

**Current Behavior:**
```markdown
# README.md - Configuration section
# Missing:
# - Per-provider model configuration
# - Model routing configuration
# - Timeout/retry settings
# - Base URL overrides
```

**Files Involved:**
- `/E:/damie-coder-cli/README.md`
- `/E:/damie-coder-cli/docs/configuration.md` (if exists)

**Impact:**
- Users don't know available options
- Configuration by trial and error
- Support burden increases

---

### FIX-023: Skills.sh Integration Not Implemented

**Category:** High
**Priority:** P1

**Description:**
README mentions skills.sh integration for community skills, but this integration is not implemented.

**Expected Behavior:**
```bash
damie skills install skill-name  # Should install from skills.sh registry
```

**Current Behavior:**
```typescript
// packages/cli/src/ui/commands/skillsCommand.ts:103-106
case 'install':
  console.log('Note: Full installation requires skills.sh integration.');
  // ❌ Not implemented
  break;
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/skillsCommand.ts`
- `/E:/damie-coder-cli/packages/core/src/skills/skillService.ts`

**Impact:**
- Cannot install community skills
- Limited to bundled skills only
- Feature advertised but not working

---

## MEDIUM PRIORITY ISSUES

### FIX-024: No Per-Task Model Configuration Support

**Category:** Medium
**Priority:** P2

**Description:**
Config schema supports per-task models (codingModel, reasoningModel, etc.) but this is not fully utilized.

**Expected Behavior:**
```yaml
providers:
  deepseek:
    model: "deepseek-chat"       # Default
    codingModel: "deepseek-coder"    # For coding tasks
    reasoningModel: "deepseek-reasoner"  # For reasoning
```

**Current Behavior:**
```typescript
// packages/core/src/router/modelRouter.ts:234-248
// Code exists but depends on config being loaded properly
if (taskType === TaskType.CODING && providerConfig.codingModel) {
  return providerConfig.codingModel;
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/config/damieConfig.ts`
- `/E:/damie-coder-cli/packages/core/src/router/modelRouter.ts`

**Impact:**
- Cannot optimize models per task type
- Cost optimization limited
- Performance optimization limited

---

### FIX-025: No Provider Priority/Fallback Configuration

**Category:** Medium
**Priority:** P2

**Description:**
Config schema supports provider priority but no UI or clear documentation for configuration.

**Expected Behavior:**
```yaml
providers:
  deepseek:
    priority: 10  # Lower = higher priority
  openai:
    priority: 20
  anthropic:
    priority: 30
```

**Current Behavior:**
```typescript
// packages/core/src/config/damieConfig.ts:68-71
/** Priority for fallback ordering (lower = higher priority, default: 100) */
priority?: number;
// Schema exists but not documented or configurable via UI
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/config/damieConfig.ts`
- `/E:/damie-coder-cli/packages/core/src/router/modelRouter.ts`

**Impact:**
- Cannot customize fallback order
- Must use hardcoded fallback order
- Less control over costs

---

### FIX-026: No Cost Estimation or Tracking

**Category:** Medium
**Priority:** P2

**Description:**
No cost estimation before requests or tracking after requests.

**Expected Behavior:**
- Show estimated cost before expensive operations
- Track session costs
- Show cost in `/stats` command

**Current Behavior:**
```typescript
// packages/core/src/adapters/types.ts
// ModelInfo includes cost fields but they're not used
inputCostPer1M?: number;
outputCostPer1M?: number;
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/adapters/types.ts`
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/statsCommand.ts`

**Impact:**
- Users unaware of costs
- No budget control
- Surprise bills possible

---

### FIX-027: No Token Count Display

**Category:** Medium
**Priority:** P2

**Description:**
Token usage is tracked but not displayed to users in a meaningful way.

**Expected Behavior:**
```
Response complete
Tokens: 1,234 input / 567 output
Cost: $0.0023
```

**Current Behavior:**
```typescript
// Token usage returned but not displayed
// packages/core/src/adapters/types.ts
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/adapters/types.ts`
- `/E:/damie-coder-cli/packages/cli/src/ui/components/ChatDisplay.tsx` (if exists)

**Impact:**
- Users unaware of token usage
- Cannot optimize for cost
- Debugging token limit issues difficult

---

### FIX-028: No Session Persistence for Model Overrides

**Category:** Medium
**Priority:** P2

**Description:**
Model overrides via `/model use` are not persisted across sessions.

**Expected Behavior:**
```bash
/model use deepseek deepseek-coder
# Next session should remember this preference
```

**Current Behavior:**
```typescript
// packages/cli/src/ui/commands/modelCommand.ts:88-101
// Sets session override but doesn't persist
let output = `\n✅ Model override set for this session:\n`;
// "this session" indicates temporary
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/modelCommand.ts`

**Impact:**
- Must re-set override each session
- Preferences not remembered
- Annoying for users

---

### FIX-029: No Provider-Specific Error Messages

**Category:** Medium
**Priority:** P2

**Description:**
Error messages don't include provider-specific troubleshooting guidance.

**Expected Behavior:**
```
DeepSeek API Error: Rate limit exceeded
Suggestions:
- Wait 60 seconds before retrying
- Consider upgrading your plan
- Use fallback provider: /model use anthropic
```

**Current Behavior:**
```typescript
// Generic error messages
throw new Error('API request failed');
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`
- `/E:/damie-coder-cli/packages/core/src/adapters/errors.ts`

**Impact:**
- Users don't know how to fix errors
- Support burden increases
- Frustration with unclear errors

---

### FIX-030: No Automatic Fallback on Errors

**Category:** Medium
**Priority:** P2

**Description:**
When a request fails, there's no automatic fallback to secondary providers.

**Expected Behavior:**
```
DeepSeek API failed (rate limit)
Falling back to Anthropic...
Request successful with Anthropic
```

**Current Behavior:**
```typescript
// Request fails, error thrown to user
// No automatic fallback
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/contentGenerator.ts`
- `/E:/damie-coder-cli/packages/core/src/router/modelRouter.ts`

**Impact:**
- Requests fail unnecessarily
- Poor reliability
- Users must manually retry

---

### FIX-031: No Provider Connectivity Test Command

**Category:** Medium
**Priority:** P2

**Description:**
No command to test connectivity to all configured providers.

**Expected Behavior:**
```bash
damie provider test all
# Testing DeepSeek... ✓ Connected (45ms)
# Testing Anthropic... ✓ Connected (67ms)
# Testing Ollama... ✗ Not running
```

**Current Behavior:**
```typescript
// No test command exists
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/commands/providerCommand.ts`

**Impact:**
- Must make actual request to test
- Debugging connectivity difficult
- No proactive health check

---

### FIX-032: No Model Comparison Feature

**Category:** Medium
**Priority:** P2

**Description:**
No way to compare models side-by-side for the same task.

**Expected Behavior:**
```bash
/model compare "Explain this code" --providers deepseek,anthropic,openai
```

**Current Behavior:**
```typescript
// No comparison feature exists
```

**Files Involved:**
- N/A (feature doesn't exist)

**Impact:**
- Cannot evaluate model quality
- Must test manually
- Decision making difficult

---

### FIX-033: Incomplete Adapter Test Coverage

**Category:** Medium
**Priority:** P2

**Description:**
Some adapters have incomplete or missing test coverage.

**Expected Behavior:**
All adapters should have:
- Unit tests for request/response parsing
- Integration tests with mock servers
- Error handling tests

**Current Behavior:**
```typescript
// Some adapters have tests, others don't
// packages/core/src/adapters/deepseekAdapter.test.ts - exists
// packages/core/src/adapters/ollamaAdapter.test.ts - missing or incomplete
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/adapters/*.test.ts`

**Impact:**
- Regression risk
- Harder to maintain adapters
- Bugs may go undetected

---

### FIX-034: No Streaming Support Verification

**Category:** Medium
**Priority:** P2

**Description:**
Streaming support exists but no verification that it works correctly for all providers.

**Expected Behavior:**
All providers should support streaming with:
- Proper chunk parsing
- Tool call accumulation
- Error handling

**Current Behavior:**
```typescript
// Streaming implemented but not verified for all providers
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/adapters/streaming.ts`
- `/E:/damie-coder-cli/packages/core/src/adapters/*.ts`

**Impact:**
- Streaming may be broken for some providers
- Users experience inconsistent behavior
- Hard to debug streaming issues

---

### FIX-035: No Rate Limit Handling

**Category:** Medium
**Priority:** P2

**Description:**
Rate limit errors are not handled with automatic retry-after delays.

**Expected Behavior:**
```
Rate limit exceeded. Waiting 60 seconds before retry...
Retry 1/3...
```

**Current Behavior:**
```typescript
// packages/core/src/adapters/errors.ts
export class RateLimitError extends AdapterError {
  retryAfter?: number;  // Defined but not used for automatic retry
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/adapters/errors.ts`
- `/E:/damie-coder-cli/packages/core/src/adapters/retry.ts`

**Impact:**
- Requests fail immediately on rate limit
- Users must manually retry
- Poor experience with rate-limited providers

---

### FIX-036: No Request/Response Logging

**Category:** Medium
**Priority:** P2

**Description:**
No built-in request/response logging for debugging.

**Expected Behavior:**
```bash
damie --debug-requests
# Would log all API requests and responses
```

**Current Behavior:**
```typescript
// packages/core/src/core/loggingContentGenerator.ts
// Exists but may not be fully integrated
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/core/loggingContentGenerator.ts`

**Impact:**
- Hard to debug API issues
- Cannot audit requests
- Support difficult

---

### FIX-037: No Model Capability Detection

**Category:** Medium
**Priority:** P2

**Description:**
Model capabilities (vision, tools, streaming) are defined but not used for routing.

**Expected Behavior:**
```typescript
// Router should check capabilities
if (taskRequiresVision && !modelInfo.supportsVision) {
  // Select different model
}
```

**Current Behavior:**
```typescript
// packages/core/src/adapters/types.ts
export interface ModelInfo {
  supportsVision?: boolean;  // Defined but not used in routing
  supportsTools?: boolean;
  supportsStreaming?: boolean;
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/adapters/types.ts`
- `/E:/damie-coder-cli/packages/core/src/router/modelRouter.ts`

**Impact:**
- May select incompatible models
- Errors when using unsupported features
- Poor task-model matching

---

### FIX-038: No Context Window Awareness

**Category:** Medium
**Priority:** P2

**Description:**
Model context windows are defined but not used to prevent overflow.

**Expected Behavior:**
```
Warning: Context (150K tokens) exceeds model limit (128K).
Truncating oldest messages...
```

**Current Behavior:**
```typescript
// packages/core/src/adapters/types.ts
export interface ModelInfo {
  contextWindow: number;  // Defined but not enforced
}
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/adapters/types.ts`
- `/E:/damie-coder-cli/packages/core/src/context/contextManager.ts`

**Impact:**
- API errors from context overflow
- Poor handling of long conversations
- Wasted tokens on failed requests

---

### FIX-039: Incomplete Qwen OAuth Integration

**Category:** Medium
**Priority:** P2

**Description:**
Qwen OAuth integration exists but may have incomplete error handling or token refresh.

**Expected Behavior:**
- Automatic token refresh
- Clear OAuth errors
- Session persistence

**Current Behavior:**
```typescript
// packages/core/src/qwen/qwenOAuth2.ts
// OAuth implementation exists but may need verification
```

**Files Involved:**
- `/E:/damie-coder-cli/packages/core/src/qwen/qwenOAuth2.ts`
- `/E:/damie-coder-cli/packages/core/src/qwen/qwenContentGenerator.ts`

**Impact:**
- OAuth sessions may expire unexpectedly
- Token refresh may fail
- Poor user experience

---

### FIX-040: No Multi-Language Documentation

**Category:** Medium
**Priority:** P2

**Description:**
Documentation is only in English, limiting international users.

**Expected Behavior:**
Documentation available in multiple languages.

**Current Behavior:**
All documentation in English only.

**Files Involved:**
- `/E:/damie-coder-cli/README.md`
- `/E:/damie-coder-cli/docs/`

**Impact:**
- Limited international adoption
- Non-English users struggle
- Smaller community

---

## LOW PRIORITY ISSUES

### FIX-041: No Dark Mode for TUI

**Category:** Low
**Priority:** P3

**Description:**
TUI may not have proper dark mode support or theme customization.

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/`

---

### FIX-042: No Keyboard Shortcuts Documentation

**Category:** Low
**Priority:** P3

**Description:**
Keyboard shortcuts not documented or configurable.

**Files Involved:**
- `/E:/damie-coder-cli/docs/`

---

### FIX-043: No ASCII Art Banner Customization

**Category:** Low
**Priority:** P3

**Description:**
Startup banner cannot be customized or disabled.

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/core/initializer.ts`

---

### FIX-044: No Easter Eggs or Fun Features

**Category:** Low
**Priority:** P3

**Description:**
No fun features like `/corgi` command (mentioned in BuiltinCommandLoader).

**Files Involved:**
- `/E:/damie-coder-cli/packages/cli/src/ui/commands/corgiCommand.ts`

---

### FIX-045: No Contribution Guidelines in Docs

**Category:** Low
**Priority:** P3

**Description:**
CONTRIBUTING.md exists but not linked prominently in docs.

**Files Involved:**
- `/E:/damie-coder-cli/CONTRIBUTING.md`
- `/E:/damie-coder-cli/docs/`

---

### FIX-046: No Changelog Automation

**Category:** Low
**Priority:** P3

**Description:**
CHANGELOG.md is manually maintained, not automated from commits.

**Files Involved:**
- `/E:/damie-coder-cli/CHANGELOG.md`

---

### FIX-047: No Performance Benchmarks

**Category:** Low
**Priority:** P3

**Description:**
No performance benchmarks or optimization tracking.

**Files Involved:**
- N/A (feature doesn't exist)

---

## Summary by Category

### API Configuration (DeepSeek, Anthropic, OpenRouter, Ollama, Qwen)
- FIX-002: Config File Not Loaded
- FIX-003: Hardcoded Model Names
- FIX-011: No API Key Validation
- FIX-015: No Error Handling for Missing Config
- FIX-016: Ollama No Validation
- FIX-017: No Provider Health Check
- FIX-018: Timeout Not Applied
- FIX-019: Retry Not Applied
- FIX-020: Base URL Not Working

### Model Switching and Selection
- FIX-001: Model Selector Empty
- FIX-003: Hardcoded Model Names
- FIX-004: Setup Doesn't Save Model
- FIX-009: Missing Model Lists
- FIX-028: No Session Persistence

### Multi-Provider Support
- FIX-005: Two Config Systems
- FIX-007: No Multi-Provider UI
- FIX-025: No Priority Configuration
- FIX-030: No Automatic Fallback

### Settings UI Accessibility
- FIX-001: Model Selector Empty
- FIX-006: /setup Not Accessible
- FIX-007: No Provider Management UI
- FIX-021: No Routing UI

### Skills System Integration
- FIX-012: Skills Command Stubs
- FIX-023: skills.sh Not Implemented

### Plugin System Integration
- FIX-013: Plugins Empty Dialog

### Profile System Integration
- FIX-014: Profile Empty Dialog

### Model Routing
- FIX-008: Routing Not Integrated
- FIX-021: No Routing UI
- FIX-024: No Per-Task Models
- FIX-037: No Capability Detection
- FIX-038: No Context Window Awareness

### Error Handling
- FIX-015: Unclear Error Messages
- FIX-029: No Provider-Specific Errors
- FIX-035: No Rate Limit Handling
- FIX-036: No Request/Response Logging

### Documentation Completeness
- FIX-022: Incomplete Config Docs
- FIX-040: No Multi-Language Docs
- FIX-042: No Keyboard Shortcuts Docs

---

## Recommended Fix Order

### Phase 1: Critical Blocking Issues (P0)
1. FIX-001: Model Selector Returns Empty
2. FIX-002: Config File Not Loaded
3. FIX-003: Hardcoded Model Names

### Phase 2: High Priority User-Facing (P1)
4. FIX-004: Setup Wizard Model Saving
5. FIX-005: Two Config Systems
6. FIX-006: /setup Accessibility
7. FIX-007: Multi-Provider UI
8. FIX-008: Routing Integration
9. FIX-009: Model Lists
10. FIX-012: Skills Implementation
11. FIX-013: Plugins Implementation
12. FIX-014: Profile Implementation

### Phase 3: Important Infrastructure (P1/P2)
13. FIX-010: Adapter Factory Integration
14. FIX-011: API Key Validation
15. FIX-015: Error Handling
16. FIX-017: Provider Health Check
17. FIX-018: Timeout Configuration
18. FIX-019: Retry Configuration
19. FIX-020: Base URL Override
20. FIX-022: Documentation

### Phase 4: Enhancements (P2)
21. FIX-024: Per-Task Models
22. FIX-025: Provider Priority
23. FIX-026: Cost Tracking
24. FIX-027: Token Display
25. FIX-028: Session Persistence
26. FIX-030: Automatic Fallback
27. FIX-031: Connectivity Test
28. FIX-035: Rate Limit Handling

### Phase 5: Polish (P3)
29. FIX-041: Dark Mode
30. FIX-042: Keyboard Docs
31. FIX-043: Banner Customization
32. FIX-044: Easter Eggs
33. FIX-046: Changelog Automation
34. FIX-047: Performance Benchmarks

---

**End of Fix List**
