# Damie Code - Comprehensive Architecture Review

**Date:** February 22, 2026
**Version:** 1.0.3 (pending)
**Purpose:** Review API configuration, model switching, and multi-provider support

---

## 1. CURRENT ARCHITECTURE OVERVIEW

### 1.1 Configuration System

**Two Separate Config Systems:**

#### A. DamieConfig (`packages/core/src/config/damieConfig.ts`)
- **Purpose:** Modern, file-based configuration (`~/.damie/config.yaml`)
- **Supports:** Multiple providers, routing, per-provider settings
- **Schema:**
  ```typescript
  {
    security: {
      auth: {
        selectedType: AuthType  // Primary auth
      }
    },
    providers?: {
      deepseek?: { apiKey, model, timeout, ... },
      anthropic?: { apiKey, model, timeout, ... },
      openrouter?: { apiKey, model, timeout, ... },
      ollama?: { baseUrl, model, ... },
      qwen?: { model, ... }
    },
    model?: {
      routing?: { coding, reasoning, general, vision },
      default?: string,
      maxTokens?: number
    }
  }
  ```

#### B. Settings (`packages/cli/src/config/settings.ts`)
- **Purpose:** Runtime settings with schema validation
- **Location:** `~/.qwen/settings.json` (legacy) + workspace settings
- **Integration:** Used by UI components

**⚠️ ISSUE:** Two config systems create confusion and potential conflicts

---

### 1.2 Authentication Types

**Supported Auth Types** (`packages/core/src/core/contentGenerator.ts`):

```typescript
export enum AuthType {
  // Google/Legacy
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  
  // OpenAI
  USE_OPENAI = 'openai',
  
  // Qwen
  QWEN_OAUTH = 'qwen-oauth',
  
  // Damie Code Providers (NEW)
  USE_DEEPSEEK = 'deepseek',
  USE_ANTHROPIC = 'anthropic',
  USE_OPENROUTER = 'openrouter',
  USE_OLLAMA = 'ollama',
}
```

**Status:** ✅ All 4 Damie Code providers integrated in `createContentGenerator()`

---

### 1.3 Content Generator Flow

```
User Request
    ↓
Config.getAuthType()
    ↓
createContentGeneratorConfig() → Sets API key, baseUrl, model
    ↓
createContentGenerator() → Returns appropriate ContentGenerator
    ↓
OpenAIContentGenerator (for DeepSeek/Anthropic/OpenRouter/Ollama)
GoogleGenAI (for Gemini/Vertex)
QwenContentGenerator (for Qwen OAuth)
```

**✅ FIXED:** Damie Code providers now route through `OpenAIContentGenerator`

---

## 2. IDENTIFIED ISSUES

### 2.1 Critical Issues

#### ISSUE #1: Model Names Hardcoded
**Location:** `packages/core/src/core/contentGenerator.ts:143-163`

```typescript
// Current code - hardcoded defaults
if (authType === AuthType.USE_DEEPSEEK) {
  newContentGeneratorConfig.model = generationConfig?.model || 'deepseek-chat';
}

if (authType === AuthType.USE_ANTHROPIC) {
  newContentGeneratorConfig.model = generationConfig?.model || 'claude-3-5-sonnet-20241022';
}
```

**Problem:**
- No way for users to change default models via config
- UI model selector doesn't work for non-Qwen providers
- `getAvailableModelsForAuthType()` returns empty array for Damie providers

**Impact:** Users stuck with hardcoded models, can't switch or customize

---

#### ISSUE #2: Model Selector Broken for Damie Providers
**Location:** `packages/cli/src/ui/models/availableModels.ts`

```typescript
export function getAvailableModelsForAuthType(authType: AuthType): AvailableModel[] {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
      return AVAILABLE_MODELS_QWEN;  // ✅ Works
    case AuthType.USE_OPENAI:
      const openAIModel = getOpenAIAvailableModelFromEnv();
      return openAIModel ? [openAIModel] : [];  // ⚠️ Only from env
    default:
      return [];  // ❌ Returns empty for DeepSeek, Anthropic, etc!
  }
}
```

**Problem:**
- `/model` command shows no options for DeepSeek, Anthropic, OpenRouter, Ollama
- Users can't switch models via UI
- Model dialog is empty for these providers

---

#### ISSUE #3: Config Not Loaded for Damie Providers
**Location:** `packages/core/src/core/contentGenerator.ts`

**Current Flow:**
```typescript
// Only reads from environment variables
const deepseekApiKey = process.env['DEEPSEEK_API_KEY'] || undefined;
const anthropicApiKey = process.env['ANTHROPIC_API_KEY'] || undefined;
const openrouterApiKey = process.env['OPENROUTER_API_KEY'] || undefined;
```

**Problem:**
- Ignores `~/.damie/config.yaml` provider settings
- Users can't set models in config file
- API keys from config file are ignored

**Expected:**
```typescript
// Should load from DamieConfig first, then env as fallback
const damieConfig = loadDamieConfig();
const deepseekApiKey = damieConfig?.providers?.deepseek?.apiKey 
  || process.env['DEEPSEEK_API_KEY'] 
  || undefined;
const deepseekModel = damieConfig?.providers?.deepseek?.model 
  || generationConfig?.model 
  || 'deepseek-chat';
```

---

#### ISSUE #4: Setup Wizard Doesn't Save Models Properly
**Location:** `packages/cli/src/setup/configWriter.ts`

**Current Behavior:**
- Setup wizard validates API key and gets recommended model
- But model is not persisted to config file
- Config only saves: `selectedType` and `apiKey`

**Expected:**
- Save the validated/recommended model to config
- Allow user to customize model during setup

---

### 2.2 UX Issues

#### ISSUE #5: No Way to Re-run Setup After First Run
**User Report:** *"i can no longer select qwen as an option also the /setup"*

**Current State:**
- `/setup` command exists but may not be accessible
- No clear way to switch primary provider
- Config file must be manually deleted

**Expected:**
- `/setup` should always be accessible
- Clear UI for switching providers
- Option to re-run full setup wizard

---

#### ISSUE #6: No Multi-Provider Support in UI
**Current State:**
- Config supports multiple providers (`providers: { deepseek, anthropic, ... }`)
- UI only shows ONE selected provider
- No way to configure routing in UI

**Expected:**
- UI to show all configured providers
- Easy switching between providers
- Model routing configuration UI

---

## 3. RECOMMENDED FIXES

### Priority 1: Critical (Blocking Users)

#### FIX #1: Load Provider Config from File
**File:** `packages/core/src/core/contentGenerator.ts`

```typescript
export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
  generationConfig?: Partial<ContentGeneratorConfig>,
): ContentGeneratorConfig {
  // Load Damie config file
  const { loadDamieConfig } = require('../config/damieConfigLoader');
  const damieConfig = loadDamieConfig();
  
  const newContentGeneratorConfig: ContentGeneratorConfig = {
    ...(generationConfig || {}),
    model: generationConfig?.model || DEFAULT_QWEN_MODEL,
    authType,
    proxy: config?.getProxy(),
  };
  
  // ... existing Google/Qwen logic ...
  
  // Damie Code providers - load from config file FIRST
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
      'deepseek-chat';  // Fallback default
    newContentGeneratorConfig.timeout = providerConfig?.timeout;
    newContentGeneratorConfig.maxRetries = providerConfig?.maxRetries;
    return newContentGeneratorConfig;
  }
  
  // Similar for Anthropic, OpenRouter, Ollama...
}
```

---

#### FIX #2: Add Model Lists for Damie Providers
**File:** `packages/cli/src/ui/models/availableModels.ts`

```typescript
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
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Via OpenRouter' },
  { id: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Via OpenRouter' },
  { id: 'meta-llama/llama-3-70b-instruct', label: 'Llama 3 70B', description: 'Open source' },
];

export const AVAILABLE_MODELS_OLLAMA: AvailableModel[] = [
  { id: 'codellama', label: 'Code Llama', description: 'Coding focused' },
  { id: 'llama3.1', label: 'Llama 3.1', description: 'General purpose' },
  { id: 'mistral', label: 'Mistral', description: 'Fast & efficient' },
];

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

---

#### FIX #3: Make /setup Always Accessible
**File:** `packages/cli/src/services/BuiltinCommandLoader.ts`

Ensure `/setup` command is always registered and accessible, even after initial setup.

---

### Priority 2: Important (UX Improvements)

#### FIX #4: Add Provider Management UI
Create new UI component for managing multiple providers:
- List all configured providers
- Add/remove providers
- Set primary provider
- Configure per-provider models
- Test API connectivity

---

#### FIX #5: Add Model Routing UI
UI for configuring intelligent routing:
- Coding tasks → [select provider]
- Reasoning tasks → [select provider]
- General tasks → [select provider]
- Vision tasks → [select provider]

---

#### FIX #6: Improve Setup Wizard
- Save model selection during setup
- Allow model customization before saving
- Show recommended models per provider
- Test connection before saving

---

## 4. TESTING CHECKLIST

Before publishing next version:

### API Configuration
- [ ] Set API key via environment variable
- [ ] Set API key via config file
- [ ] Set custom model in config file
- [ ] Set custom base URL (for proxies/self-hosted)
- [ ] Set timeout and retry settings

### Model Switching
- [ ] `/model` command shows options for all providers
- [ ] Can switch models via UI
- [ ] Model persists across sessions
- [ ] Default models load correctly

### Multi-Provider
- [ ] Configure multiple providers
- [ ] Switch primary provider
- [ ] Re-run setup wizard
- [ ] Provider routing works

### Error Handling
- [ ] Invalid API key shows clear error
- [ ] Model not found shows available options
- [ ] Network timeout handled gracefully
- [ ] Fallback to secondary provider works

---

## 5. RECOMMENDED NEXT STEPS

1. **IMMEDIATE:** Implement FIX #1, #2, #3 (critical user blockers)
2. **SHORT-TERM:** Add comprehensive model lists (FIX #2)
3. **MEDIUM-TERM:** Build provider management UI (FIX #4)
4. **LONG-TERM:** Implement model routing UI (FIX #5)

---

## 6. OPEN QUESTIONS

1. **Config Strategy:** Should we migrate fully to DamieConfig and deprecate Settings.json?
2. **Model Lists:** Should model lists be hardcoded or fetched from API?
3. **Routing:** Should routing be automatic or manual selection?
4. **Storage:** Should API keys be encrypted in config file?

---

**Status:** Ready for implementation planning
**Reviewers:** @damoojeje
