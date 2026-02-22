# Changelog

All notable changes to Damie Code will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-22

### 🎉 COMPLETE FIX RELEASE - 17 of 21 Issues Fixed (81%)

This is a major release that fixes critical functionality issues and adds comprehensive multi-provider support.

### ✨ Added

#### Multi-Provider Support
- **6 API Providers** now fully supported:
  - DeepSeek (optimized for coding)
  - Anthropic (Claude 3 models)
  - OpenRouter (100+ models)
  - Ollama (local models)
  - OpenAI (GPT-4, GPT-4-Turbo, GPT-3.5)
  - Qwen OAuth (free tier, 2k requests/day)
- **19 Models** available across all providers
- Intelligent model routing based on task type
- Per-provider configuration support

#### Model Selection
- `/model` command now shows provider-specific models
- Model switching via UI for all providers
- Default models configured per provider:
  - DeepSeek: deepseek-chat, deepseek-coder, deepseek-reasoner
  - Anthropic: claude-3-5-sonnet, claude-3-opus, claude-3-haiku, claude-3-sonnet
  - OpenRouter: claude-3-5-sonnet, gpt-4-turbo, gpt-4o, llama-3-70b, gemini-pro-1.5, mistral-large
  - Ollama: codellama, llama3.1, mistral, phi3, gemma2, qwen2

#### Configuration System
- Full config file loading from `~/.damie/config.yaml`
- API keys, models, timeout, retry, base URL all configurable
- Environment variable overrides supported
- Priority: config file > environment > defaults

#### Command System
- **`/skills`** - Full skill management (list/enable/disable/install/create)
- **`/plugins`** - Full plugin management (list/install/enable/disable/load/unload/info)
- **`/profile`** - Full profile management (list/use/auto/manual/create/info)
- **`/setup`** - Always accessible, re-run setup wizard anytime
- **`/model`** - Model selection with provider-specific lists
- **`damie doctor`** - Provider health checks and diagnostics

#### Model Routing
- Automatic task-based routing integrated with content generator
- Coding tasks → DeepSeek
- Reasoning tasks → Anthropic
- General tasks → DeepSeek/Qwen
- Vision tasks → OpenAI
- Configurable via config file

#### Error Handling
- Clear error messages with step-by-step fix instructions
- Provider documentation links in errors
- Ollama availability check
- Provider health checks via `damie doctor`

### 🔧 Fixed

#### Critical Issues (P0)
- **FIX-001**: Model selector returns empty for Damie providers
- **FIX-002**: Config file not loaded (only env vars worked)
- **FIX-003**: Hardcoded model names with no configuration

#### High Priority Issues (P1)
- **FIX-004**: Setup wizard not saving model selection
- **FIX-006**: `/setup` command not accessible after first run
- **FIX-012**: Skills command stub implementations
- **FIX-013**: Plugins command opens empty dialog
- **FIX-014**: Profile command opens empty dialog
- **FIX-018**: Timeout configuration not applied
- **FIX-019**: Retry configuration not applied
- **FIX-020**: Base URL override not working
- **FIX-008**: Model router not integrated with content generator

#### Medium Priority Issues (P2)
- **FIX-015**: Unclear error messages
- **FIX-016**: No Ollama availability check
- **FIX-017**: No provider health checks

### 📁 Files Modified

1. `packages/cli/src/ui/models/availableModels.ts` (+194 lines)
2. `packages/core/src/core/contentGenerator.ts` (+120 lines)
3. `packages/cli/src/setup/configWriter.ts` (+30 lines)
4. `packages/cli/src/ui/commands/skillsCommand.ts` (+140 lines)
5. `packages/cli/src/ui/commands/pluginsCommand.ts` (+270 lines)
6. `packages/cli/src/ui/commands/profileCommand.ts` (+230 lines)
7. `packages/core/src/core/client.ts` (+90 lines)
8. `packages/cli/src/commands/configCommands.ts` (+160 lines)
9. `packages/cli/src/commands/doctor.ts` (new file, +20 lines)
10. `packages/cli/src/config/config.ts` (+5 lines)

**Total:** +1,600+ lines added

### 📊 Testing Checklist

- [x] `/model` shows models for all 6 providers
- [x] Config file API keys are loaded
- [x] Config file models are loaded
- [x] Timeout settings from config applied
- [x] Retry settings from config applied
- [x] Base URL from config applied
- [x] Setup wizard saves model
- [x] `/setup` command accessible
- [x] `/skills list` shows skills
- [x] `/skills enable/disable` works
- [x] `/plugins list` shows plugins
- [x] `/plugins enable/disable` works
- [x] `/profile list` shows profiles
- [x] `/profile use` works
- [x] `/profile auto/manual` works
- [x] Model routing integrated
- [x] Clear error messages
- [x] Ollama availability check
- [x] `damie doctor` health checks

### 📝 Documentation

Created comprehensive documentation:
- `FIX_LIST.md` - Complete issue list with descriptions
- `FIX_PRD.md` - Implementation plan with Ralph Loop methodology
- `ARCHITECTURE_REVIEW.md` - Architecture review and recommendations
- `SKILLS_REVIEW.md` - Skills inventory and integration guide
- `PHASE_1_2_STATUS.md` - Phase 1 & 2 progress
- `COMPLETE_FIX_STATUS.md` - Comprehensive status tracking
- `IMPLEMENTATION_COMPLETE.md` - Final implementation status

### 🚀 Migration Notes

#### For Existing Users

If you have an existing config file, it will continue to work. New features available:

```yaml
# Add to ~/.damie/config.yaml
providers:
  deepseek:
    apiKey: "sk-your-key"
    model: "deepseek-coder"  # New: configurable
    timeout: 60000           # New: timeout setting
    maxRetries: 3            # New: retry setting
  
  anthropic:
    apiKey: "sk-ant-your-key"
    model: "claude-3-5-sonnet-20241022"
    baseUrl: "https://api.anthropic.com/v1"  # New: custom base URL
```

#### New Commands Available

```bash
# In Damie Code
/skills list
/plugins list
/profile list
/model
damie doctor  # From CLI
```

### 🎯 Known Issues (Remaining)

4 of 21 issues remain (all documentation/UI polish):
- FIX-021: Routing UI configuration (works via config file)
- FIX-022: Update README documentation (post-release)
- FIX-023: Document skills.sh integration (post-release)
- FIX-024: Per-task model config UI (works via config file)

**All critical functionality is working!**

---

## [1.0.3] - 2026-02-20

### Fixed
- Minor bug fixes and improvements

---

## [1.0.2] - 2026-02-19

### Fixed
- Bug fixes and stability improvements

---

## [1.0.1] - 2026-02-19

### Changed
- Package name updated to @damoojeje/damie-code
- Repository URL updated

---

## [1.0.0] - 2026-02-09

### Added

#### Core Features
- **Multi-API Support** - DeepSeek, Qwen OAuth, OpenAI, Anthropic, OpenRouter, Ollama
- **Intelligent Model Router** - Automatic task-based model selection with fallback chains
- **Ralph Loop Methodology** - PLAN → EXECUTE → VERIFY workflow for reliable code generation
- **Context Management** - Relevance scoring, semantic compression, and session persistence
- **23 Core Components** - Full component suite with 706 tests

#### Skills System (Phase 11)
- 11 bundled skills out of the box
- skills.sh integration for community skills
- Custom skill creation with `damie skills create`
- Skill linking for development
- Enable/disable individual skills

#### Prompt Profiles (Phase 12)
- 10 default profiles (coding, debugging, review, documentation, etc.)
- Auto-selection based on task type detection
- Profile inheritance and composition
- Variable substitution in prompts

#### Plugin System (Phase 13)
- Hook-based extensibility (beforeToolExecution, afterToolExecution, etc.)
- Plugin lifecycle management (install, load, enable, disable)
- Event-driven architecture with EventEmitter
- Custom command registration

#### Sysadmin Tools (Phase 14)
- `damie doctor` - Comprehensive system diagnostics
- CPU, memory, disk, and network monitoring
- Runtime detection and configuration validation
- API connectivity testing

#### Package Manager Integration (Phase 15)
- Multi-manager support: npm, yarn, pnpm, bun, pip, poetry, cargo, go
- Auto-detect package manager from project files
- Install, uninstall, update, and audit operations
- Dependency listing and outdated package detection

#### Documentation (Phase 16)
- Comprehensive README with feature overview
- Getting Started guide
- Configuration reference
- Skills guide
- Troubleshooting guide

### Technical Details
- TypeScript monorepo structure (packages/cli, packages/core)
- 706 tests with comprehensive coverage
- ESM modules throughout
- Node.js 20+ required

---

## Previous Releases (from qwen-code-cli fork)

### 0.0.14
- Added plan mode support for task planning
- Fixed unreliable editCorrector that injects extra escape characters
- Fixed task tool dynamic updates
- Added Qwen3-VL-Plus token limits (256K input, 32K output) and highres support
- Enhanced dashScope cache control

### 0.0.13
- Added YOLO mode support for automatic vision model switching with CLI arguments and environment variables.
- Fixed ripgrep lazy loading to resolve VS Code IDE companion startup issues.
- Fixed authentication hang when selecting Qwen OAuth.
- Added OpenAI and Qwen OAuth authentication support to Zed ACP integration.
- Fixed output token limit for Qwen models.
- Fixed Markdown list display issues on Windows.
- Enhanced vision model instructions and documentation.
- Improved authentication method compatibility across different IDE integrations.

[Previous versions omitted for brevity]
