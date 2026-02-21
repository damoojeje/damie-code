# PRD: Damie Code - AI-Powered CLI Coding Assistant

**Version:** 1.0.0
**Date:** 2026-02-08
**Status:** Approved

---

## Overview

Damie Code is a TypeScript-based AI-powered CLI coding assistant forked from qwen-code-cli. It provides an open-source alternative to Claude Code and Cursor, designed for personal use with the ability to be downloaded, installed, and customized by developers.

The primary goal is to achieve insanely accurate software development across all phases (planning, coding, testing, debugging, deployment) through:
- Multi-API support with intelligent task-based routing
- 16 enhanced components following the Ralph Loop methodology (PLAN → EXECUTE → VERIFY)
- Full skills.sh ecosystem integration with pre-bundled skills
- Extensible architecture for custom skills and plugins

---

## Goals

- Provide a free, open-source alternative to commercial AI coding assistants
- Support multiple LLM APIs with equal weight and task-based routing
- Achieve high accuracy across all software development phases
- Enable full customization through config files and CLI options
- Include pre-bundled skills with extensibility via skills.sh
- Implement all 16 components as mandatory features for v1.0
- Support Windows, macOS, and Linux from day one
- Follow Ralph Loop methodology for all AI-assisted tasks

---

## Quality Gates

These commands must pass for every user story:
- `npm run typecheck` - TypeScript type checking
- `npm run lint` - ESLint code linting
- `npm run test` - Vitest unit tests

For integration stories, also include:
- `npm run test:integration` - Integration tests
- Manual CLI testing on target platforms

---

## User Stories

### Phase 0: Foundation & Setup

#### US-001: Rename CLI from qwen to damie
**Description:** As a user, I want to invoke the CLI using `damie`, `damie code`, or `damie-code` so that the tool has its own identity.

**Acceptance Criteria:**
- [ ] `package.json` bin field updated to `damie`
- [ ] Aliases `damie-code` and `damie code` work
- [ ] All internal references to "qwen" renamed to "damie"
- [ ] Help text shows "Damie Code" branding
- [ ] Version command shows "Damie Code v1.0.0"

#### US-002: First-run interactive setup wizard
**Description:** As a new user, I want an interactive setup wizard on first run so that I can configure my API provider easily.

**Acceptance Criteria:**
- [ ] Detect first run (no config file exists)
- [ ] Prompt user to select API provider (DeepSeek, OpenAI, Anthropic, Qwen, OpenRouter, Ollama)
- [ ] Prompt for API key (masked input)
- [ ] For Ollama, prompt for base URL (default: http://localhost:11434)
- [ ] Display config file path after setup
- [ ] Create config file with user selections
- [ ] Validate API key by making test request
- [ ] Show success message with next steps

#### US-003: YAML configuration system
**Description:** As a user, I want to configure Damie via a YAML file so that I can customize settings without CLI flags.

**Acceptance Criteria:**
- [ ] Config file location: `~/.damie/config.yaml`
- [ ] Support environment variable override: `DAMIE_CONFIG`
- [ ] Config schema includes: api_provider, api_key, model, routing, tools, sandbox settings
- [ ] CLI flags override config file values
- [ ] `damie config show` displays current config
- [ ] `damie config set <key> <value>` updates config
- [ ] `damie config path` shows config file location
- [ ] Config file is created with comments explaining each option

#### US-004: Multi-API provider configuration
**Description:** As a user, I want to configure multiple API providers so that I can switch between them or use routing.

**Acceptance Criteria:**
- [ ] Config supports multiple providers section
- [ ] Each provider has: name, api_key, base_url, model, enabled flag
- [ ] `damie provider list` shows configured providers
- [ ] `damie provider add <name>` adds new provider interactively
- [ ] `damie provider remove <name>` removes provider
- [ ] `damie provider set-default <name>` sets default provider
- [ ] Provider credentials stored securely (not in plain text in config)

---

### Phase 1: Multi-API Adapter System

#### US-005: Base adapter interface
**Description:** As a developer, I want a common adapter interface so that all API providers implement the same contract.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/adapters/baseAdapter.ts`
- [ ] Interface includes: `generateContent()`, `streamContent()`, `countTokens()`, `getModelInfo()`
- [ ] Support for function/tool calling in interface
- [ ] Error handling with custom error types
- [ ] Retry logic with exponential backoff
- [ ] Request timeout configuration
- [ ] Response streaming support

#### US-006: DeepSeek adapter implementation
**Description:** As a user, I want to use DeepSeek API so that I can leverage DeepSeek models for coding tasks.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/adapters/deepseekAdapter.ts`
- [ ] Implement all base adapter methods
- [ ] Support DeepSeek-Coder and DeepSeek-Reasoner models
- [ ] Handle DeepSeek-specific API format
- [ ] Support streaming responses
- [ ] Support function calling format
- [ ] Include rate limiting handling
- [ ] Add adapter tests with mocked responses

#### US-007: OpenAI adapter implementation
**Description:** As a user, I want to use OpenAI API so that I can leverage GPT models.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/adapters/openaiAdapter.ts`
- [ ] Implement all base adapter methods
- [ ] Support GPT-4, GPT-4-Turbo, GPT-3.5-Turbo models
- [ ] Handle OpenAI chat completions format
- [ ] Support streaming with SSE
- [ ] Support function calling / tools
- [ ] Handle API errors gracefully
- [ ] Add adapter tests

#### US-008: Anthropic adapter implementation
**Description:** As a user, I want to use Anthropic API so that I can leverage Claude models.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/adapters/anthropicAdapter.ts`
- [ ] Implement all base adapter methods
- [ ] Support Claude 3 Opus, Sonnet, Haiku models
- [ ] Handle Anthropic messages format
- [ ] Support streaming responses
- [ ] Support tool use format
- [ ] Handle rate limits and errors
- [ ] Add adapter tests

#### US-009: OpenRouter adapter implementation
**Description:** As a user, I want to use OpenRouter so that I can access multiple models through one API.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/adapters/openrouterAdapter.ts`
- [ ] Implement all base adapter methods
- [ ] Support model selection from OpenRouter catalog
- [ ] Handle OpenRouter-specific headers (HTTP-Referer, X-Title)
- [ ] Support streaming responses
- [ ] Dynamic model listing from OpenRouter API
- [ ] Add adapter tests

#### US-010: Ollama adapter implementation
**Description:** As a user, I want to use Ollama so that I can run models locally without API costs.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/adapters/ollamaAdapter.ts`
- [ ] Implement all base adapter methods
- [ ] Support configurable base URL
- [ ] Auto-detect available models via Ollama API
- [ ] Support streaming responses
- [ ] Handle Ollama-specific format
- [ ] Graceful error when Ollama not running
- [ ] Add adapter tests

#### US-011: Adapter factory and registry
**Description:** As a developer, I want an adapter factory so that adapters can be instantiated dynamically based on config.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/adapters/adapterFactory.ts`
- [ ] Factory creates adapter based on provider name
- [ ] Registry pattern for adapter registration
- [ ] Support for custom/third-party adapters
- [ ] Lazy initialization of adapters
- [ ] Singleton pattern per provider
- [ ] Add factory tests

---

### Phase 2: Model Router

#### US-012: Task analyzer
**Description:** As a user, I want my tasks analyzed so that they can be routed to the best model.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/router/taskAnalyzer.ts`
- [ ] Classify tasks by type: coding, reasoning, creative, visual, general
- [ ] Estimate task complexity (1-10 scale)
- [ ] Extract required capabilities from task description
- [ ] Estimate token requirements
- [ ] Calculate confidence score for classification
- [ ] Add analyzer tests with various task types

#### US-013: Model router implementation
**Description:** As a user, I want automatic model routing so that each task uses the optimal model.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/router/modelRouter.ts`
- [ ] Route based on task type (coding → DeepSeek, reasoning → Claude, etc.)
- [ ] Consider available/enabled providers only
- [ ] Support user override via CLI flag `--model`
- [ ] Log routing decisions for transparency
- [ ] Fallback to default provider if routing fails
- [ ] `damie route <task>` shows routing decision without executing
- [ ] Add router tests

#### US-014: Routing configuration
**Description:** As a user, I want to customize routing rules so that I can control which models handle which tasks.

**Acceptance Criteria:**
- [ ] Config section for routing rules
- [ ] Support task type → provider mapping
- [ ] Support keyword-based routing rules
- [ ] Support cost/performance preferences
- [ ] `damie config routing show` displays rules
- [ ] `damie config routing set <type> <provider>` updates rules
- [ ] Validation of routing config on load

---

### Phase 3: Supervisor Loop (Ralph Loop)

#### US-015: Supervisor state machine
**Description:** As a developer, I want a state machine so that tasks follow the Ralph Loop methodology.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/supervisor/stateMachine.ts`
- [ ] States: IDLE, PLAN, EXECUTE, VERIFY, ITERATE, COMPLETE, FAILED, PAUSED
- [ ] Define valid state transitions
- [ ] State transition events/callbacks
- [ ] State persistence for recovery
- [ ] Timeout handling per state
- [ ] Add state machine tests

#### US-016: Supervisor loop implementation
**Description:** As a user, I want tasks to follow PLAN→EXECUTE→VERIFY so that results are validated.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/supervisor/supervisorLoop.ts`
- [ ] PLAN phase: Generate implementation plan
- [ ] EXECUTE phase: Execute plan steps
- [ ] VERIFY phase: Validate results against criteria
- [ ] ITERATE: Loop back to EXECUTE if verification fails
- [ ] Max iteration limit (configurable, default: 3)
- [ ] Progress reporting during execution
- [ ] Pause/resume capability
- [ ] Add supervisor tests

#### US-017: Decision engine
**Description:** As a developer, I want a decision engine so that the supervisor knows when to continue, retry, or abort.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/supervisor/decisionEngine.ts`
- [ ] Evaluate success/failure of each phase
- [ ] Determine if retry is appropriate
- [ ] Handle partial successes
- [ ] Configurable decision thresholds
- [ ] Decision logging for debugging
- [ ] Add decision engine tests

---

### Phase 4: Planner

#### US-018: Task decomposition
**Description:** As a user, I want complex tasks broken into subtasks so that they can be executed incrementally.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/planner/taskPlanner.ts`
- [ ] Analyze task and generate subtask list
- [ ] Each subtask has: id, title, description, dependencies
- [ ] Estimate effort per subtask
- [ ] Generate dependency graph
- [ ] Validate plan completeness
- [ ] Add planner tests

#### US-019: Plan execution order
**Description:** As a developer, I want subtasks ordered by dependencies so that they execute correctly.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/planner/dependencyResolver.ts`
- [ ] Topological sort of subtasks
- [ ] Detect circular dependencies
- [ ] Support parallel execution where possible
- [ ] Handle failed subtask dependencies
- [ ] Add resolver tests

#### US-020: Plan display and approval
**Description:** As a user, I want to see and approve plans before execution so that I maintain control.

**Acceptance Criteria:**
- [ ] `damie plan <task>` shows plan without executing
- [ ] Display subtasks with estimated effort
- [ ] Show dependency graph (text-based)
- [ ] Prompt for approval before execution
- [ ] `--auto-approve` flag skips approval
- [ ] Save plan to file with `--save <path>`

---

### Phase 5: Verifier

#### US-021: Result verification
**Description:** As a user, I want results verified so that I know the task was completed correctly.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/verifier/resultVerifier.ts`
- [ ] Verify against acceptance criteria
- [ ] Run automated tests if applicable
- [ ] Check for syntax errors in generated code
- [ ] Verify file changes are correct
- [ ] Generate verification report
- [ ] Add verifier tests

#### US-022: Test runner integration
**Description:** As a user, I want tests run automatically so that code changes are validated.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/verifier/testRunner.ts`
- [ ] Detect test framework (Jest, Vitest, Mocha, etc.)
- [ ] Run relevant tests for changed files
- [ ] Parse test results
- [ ] Report pass/fail summary
- [ ] Support test timeout configuration
- [ ] Add test runner tests

---

### Phase 6: Context Manager

#### US-023: Context window management
**Description:** As a user, I want efficient context management so that large codebases work within token limits.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/context/contextManager.ts`
- [ ] Track current context size
- [ ] Prioritize relevant context
- [ ] Compress/summarize old context
- [ ] Support context window limits per model
- [ ] Context persistence across sessions
- [ ] Add context manager tests

#### US-024: Relevance scoring
**Description:** As a developer, I want context scored by relevance so that important context is retained.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/context/relevanceScorer.ts`
- [ ] Score based on recency
- [ ] Score based on file proximity
- [ ] Score based on semantic similarity
- [ ] Configurable scoring weights
- [ ] Add scorer tests

---

### Phase 7: File Scanner

#### US-025: Project structure analysis
**Description:** As a user, I want my project scanned so that the AI understands the codebase structure.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/scanner/fileScanner.ts`
- [ ] Scan directory recursively
- [ ] Respect .gitignore patterns
- [ ] Respect .damieignore patterns
- [ ] Generate file tree representation
- [ ] Detect project type (Node.js, Python, etc.)
- [ ] Cache scan results for performance
- [ ] Add scanner tests

#### US-026: File type detection
**Description:** As a developer, I want files categorized by type so that relevant files are prioritized.

**Acceptance Criteria:**
- [ ] Detect language by extension and content
- [ ] Identify config files
- [ ] Identify test files
- [ ] Identify documentation
- [ ] Identify build artifacts (to exclude)
- [ ] Add detection tests

---

### Phase 8: Diff Engine

#### US-027: Diff generation
**Description:** As a user, I want diffs generated for code changes so that I can review modifications.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/diff/diffEngine.ts`
- [ ] Generate unified diff format
- [ ] Support multi-file diffs
- [ ] Syntax highlighting in diff output
- [ ] Line number display
- [ ] Add diff tests

#### US-028: Patch application
**Description:** As a user, I want patches applied safely so that code changes are reversible.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/diff/patchApplier.ts`
- [ ] Apply patches atomically
- [ ] Detect conflicts before applying
- [ ] Create backup before patching
- [ ] Rollback on failure
- [ ] `damie patch <file>` applies patch file
- [ ] Add patch tests

---

### Phase 9: Memory System

#### US-029: Conversation memory
**Description:** As a user, I want conversation history preserved so that context carries across sessions.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/memory/memoryStore.ts`
- [ ] Store conversation history
- [ ] Per-project memory isolation
- [ ] Memory size limits (configurable)
- [ ] Memory compression for old conversations
- [ ] `damie memory show` displays history
- [ ] `damie memory clear` clears history
- [ ] Add memory tests

#### US-030: Task memory
**Description:** As a user, I want task results remembered so that similar tasks are faster.

**Acceptance Criteria:**
- [ ] Store task inputs and outputs
- [ ] Retrieve similar past tasks
- [ ] Use past results to inform new tasks
- [ ] Memory expiration policy
- [ ] Add task memory tests

---

### Phase 10: Enhanced Tools

#### US-031: File operations tool
**Description:** As a user, I want file operations so that the AI can read/write files.

**Acceptance Criteria:**
- [ ] Extend existing file tools in qwen-code-cli
- [ ] Read file with line range support
- [ ] Write file with backup
- [ ] Create directory
- [ ] Delete with confirmation
- [ ] Move/rename files
- [ ] Search file contents
- [ ] Add tool tests

#### US-032: Shell command tool
**Description:** As a user, I want shell commands executed so that the AI can run build/test commands.

**Acceptance Criteria:**
- [ ] Extend existing shell tools
- [ ] Command timeout configuration
- [ ] Output capture and streaming
- [ ] Error handling and exit codes
- [ ] Blocked command list (configurable)
- [ ] Working directory support
- [ ] Add tool tests

#### US-033: Git operations tool
**Description:** As a user, I want git operations so that the AI can manage version control.

**Acceptance Criteria:**
- [ ] Git status, add, commit, push, pull
- [ ] Branch operations
- [ ] Diff viewing
- [ ] Stash operations
- [ ] Block destructive operations (force push, reset --hard) unless confirmed
- [ ] Add tool tests

#### US-034: Sandbox configuration
**Description:** As a user, I want configurable sandboxing so that I can control tool permissions.

**Acceptance Criteria:**
- [ ] Config section for sandbox settings
- [ ] Enable/disable sandbox globally
- [ ] Per-tool permission settings
- [ ] Allowed paths configuration
- [ ] Blocked commands configuration
- [ ] `damie sandbox status` shows current settings
- [ ] Add sandbox tests

---

### Phase 11: Skills Integration

#### US-035: Pre-bundled skills installation
**Description:** As a user, I want skills pre-installed so that common capabilities are available immediately.

**Acceptance Criteria:**
- [ ] Bundle all 11 skills:
  - dependency-updater
  - expo-tailwind-setup
  - find-skills
  - frontend-design
  - get-shit-done-skills
  - rag-implementation
  - ralph-tui-prd
  - ui-ux-pro-max
  - vercel-react-best-practices
  - web-artifacts-builder
  - web-design-guidelines
- [ ] Skills installed to `~/.damie/skills/`
- [ ] Skills available on first run
- [ ] `damie skills list` shows all installed skills

#### US-036: Skills.sh integration
**Description:** As a user, I want to install skills from skills.sh so that I can extend capabilities.

**Acceptance Criteria:**
- [ ] `damie skills add <skill-name>` installs from skills.sh
- [ ] `damie skills add vercel-labs/agent-skills` works
- [ ] `npx skills add` compatibility
- [ ] Skill validation before installation
- [ ] Skill dependency resolution
- [ ] `damie skills remove <skill-name>` uninstalls
- [ ] `damie skills update` updates all skills
- [ ] Add skills integration tests

#### US-037: Custom Damie skills
**Description:** As a user, I want to create custom skills so that I can extend Damie for my needs.

**Acceptance Criteria:**
- [ ] `damie skills create <name>` scaffolds new skill
- [ ] Skill template with examples
- [ ] Local skill development mode
- [ ] Skill documentation generation
- [ ] `damie skills link <path>` links local skill
- [ ] Add custom skill tests

---

### Phase 12: Prompt Profiles

#### US-038: Profile system
**Description:** As a user, I want prompt profiles so that the AI adapts to different task types.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/prompts/profileManager.ts`
- [ ] Default profiles: coding, debugging, review, documentation, refactoring
- [ ] Profile includes: system prompt, temperature, max tokens
- [ ] Auto-select profile based on task
- [ ] `--profile <name>` overrides auto-selection
- [ ] `damie profiles list` shows available profiles
- [ ] Add profile tests

#### US-039: Custom profiles
**Description:** As a user, I want custom profiles so that I can create specialized prompts.

**Acceptance Criteria:**
- [ ] Custom profiles in `~/.damie/profiles/`
- [ ] YAML format for profile definition
- [ ] `damie profiles create <name>` creates profile
- [ ] `damie profiles edit <name>` opens in editor
- [ ] Profile inheritance (extend base profile)
- [ ] Add custom profile tests

---

### Phase 13: Plugin Support

#### US-040: Plugin system
**Description:** As a developer, I want a plugin system so that Damie can be extended with custom functionality.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/plugins/pluginManager.ts`
- [ ] Plugin interface definition
- [ ] Plugin discovery from `~/.damie/plugins/`
- [ ] Plugin lifecycle: load, enable, disable, unload
- [ ] Plugin configuration in main config
- [ ] `damie plugins list` shows plugins
- [ ] `damie plugins enable/disable <name>` controls plugins
- [ ] Add plugin tests

---

### Phase 14: Sysadmin Tools

#### US-041: System monitoring
**Description:** As a user, I want system information so that the AI can diagnose environment issues.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/sysadmin/systemMonitor.ts`
- [ ] CPU, memory, disk usage
- [ ] Running processes
- [ ] Network connectivity
- [ ] Environment variables
- [ ] Installed runtimes (Node, Python, etc.)
- [ ] Add sysadmin tool tests

#### US-042: Diagnostic commands
**Description:** As a user, I want diagnostic commands so that I can troubleshoot issues.

**Acceptance Criteria:**
- [ ] `damie doctor` runs diagnostic checks
- [ ] Check API connectivity
- [ ] Check config validity
- [ ] Check skill installations
- [ ] Check dependencies
- [ ] Output actionable recommendations
- [ ] Add diagnostic tests

---

### Phase 15: Package Manager Integration

#### US-043: Dependency management
**Description:** As a user, I want dependency management so that the AI can install packages.

**Acceptance Criteria:**
- [ ] Create `packages/core/src/packageManager/packageManager.ts`
- [ ] Detect package manager (npm, yarn, pnpm, bun)
- [ ] Install/uninstall packages
- [ ] Update packages
- [ ] Check for vulnerabilities
- [ ] Parse package.json/requirements.txt
- [ ] Add package manager tests

---

### Phase 16: Documentation & Release

#### US-044: User documentation
**Description:** As a user, I want documentation so that I can learn how to use Damie.

**Acceptance Criteria:**
- [ ] Update README.md with Damie branding
- [ ] Installation guide for all platforms
- [ ] Configuration reference
- [ ] Command reference
- [ ] Skills guide
- [ ] Troubleshooting guide
- [ ] Examples and tutorials

#### US-045: Release packaging
**Description:** As a maintainer, I want release packaging so that users can install Damie easily.

**Acceptance Criteria:**
- [ ] npm package: `damie-code`
- [ ] Global install: `npm install -g damie-code`
- [ ] Binary releases for Windows, macOS, Linux
- [ ] Version management
- [ ] Changelog generation
- [ ] GitHub releases automation

---

## Functional Requirements

- **FR-001:** The system must support CLI invocation via `damie`, `damie code`, or `damie-code`
- **FR-002:** The system must support API providers: DeepSeek, Qwen OAuth, OpenAI, Anthropic, OpenRouter, Ollama
- **FR-003:** The system must route tasks to appropriate models based on task type
- **FR-004:** The system must follow Ralph Loop (PLAN→EXECUTE→VERIFY) for all tasks
- **FR-005:** The system must support states: IDLE, PLAN, EXECUTE, VERIFY, ITERATE, COMPLETE, FAILED, PAUSED
- **FR-006:** The system must bundle 11 default skills from skills.sh ecosystem
- **FR-007:** The system must support installing additional skills via `damie skills add`
- **FR-008:** The system must store configuration in YAML format at `~/.damie/config.yaml`
- **FR-009:** The system must provide interactive setup wizard on first run
- **FR-010:** The system must support Windows, macOS, and Linux
- **FR-011:** The system must implement all 16 components as mandatory features
- **FR-012:** The system must support configurable sandboxing for tool execution
- **FR-013:** The system must preserve conversation memory across sessions
- **FR-014:** The system must generate and apply code diffs safely with rollback capability
- **FR-015:** The system must decompose complex tasks into subtasks with dependencies

---

## Non-Goals (Out of Scope for v1.0)

- Web-based dashboard or UI (CLI only)
- Multi-user or team collaboration features
- Cloud-hosted version
- Mobile applications
- IDE plugins beyond VS Code companion (inherited from qwen-code-cli)
- Real-time collaboration
- Custom model training or fine-tuning
- Billing or usage tracking for APIs
- Enterprise SSO or authentication

---

## Technical Considerations

### Dependencies
- Node.js 20+ (inherited from qwen-code-cli)
- TypeScript 5.x
- Existing qwen-code-cli architecture and components

### Integration Points
- Extend `packages/core/src/qwen/` with new adapters
- Extend `packages/core/src/core/coreToolScheduler.ts` with new tools
- Leverage existing MCP support for tool execution
- Use existing extension system for skills

### Performance Requirements
- CLI startup time < 2 seconds
- Response streaming for long outputs
- Context management for codebases up to 100k files
- Memory usage < 500MB for typical sessions

### Security Requirements
- API keys stored securely (not plain text)
- Sandboxed command execution by default
- No telemetry without explicit opt-in
- Blocked dangerous commands by default

---

## Success Metrics

- All 16 components implemented and tested
- All 45 user stories completed with passing quality gates
- CLI works on Windows, macOS, and Linux
- All 6 API adapters functional
- 11 pre-bundled skills working
- Documentation complete and accurate
- npm package published and installable globally
- 80%+ code coverage for new code
- Zero critical security vulnerabilities

---

## Open Questions

1. Should we support Azure OpenAI as a separate adapter or via OpenAI adapter with custom base URL?
2. Should memory persistence use SQLite, JSON files, or another storage mechanism?
3. Should we include a `damie upgrade` command for self-updating?
4. Should skill execution have its own sandbox separate from tool sandbox?
5. What should the default routing rules be for each task type?
