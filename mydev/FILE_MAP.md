# FILE_MAP.md - Damie Code Project Structure

**Last Updated**: 2026-02-08
**Purpose**: Track all files and folders in the project

---

## Directory Tree

```
E:/dami/qwen_fork/
│
├── .claude/                         # Claude Code settings
│   └── settings.local.json
│
├── .github/                         # GitHub workflows
│   └── (CI/CD configs)
│
├── .vscode/                         # VS Code settings
│   ├── extensions.json
│   ├── launch.json
│   ├── settings.json
│   └── tasks.json
│
├── docs/                            # User documentation
│   ├── cli/                         # CLI docs
│   │   ├── authentication.md
│   │   ├── commands.md
│   │   ├── configuration.md
│   │   ├── keyboard-shortcuts.md
│   │   └── ...
│   ├── core/                        # Core docs
│   ├── development/                 # Dev docs
│   ├── extensions/                  # Extension docs
│   ├── features/                    # Feature docs
│   ├── ide-integration/             # IDE docs
│   ├── support/                     # Support docs
│   └── tools/                       # Tools docs
│       ├── file-system.md
│       ├── shell.md
│       ├── memory.md
│       ├── mcp-server.md
│       ├── web-fetch.md
│       └── ...
│
├── hello/                           # Example/starter content
│   ├── QWEN.md
│   └── qwen-extension.json
│
├── integration-tests/               # E2E tests
│   ├── *.test.ts                    # Test files
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── mydev/                           # DEVELOPMENT ARTIFACTS
│   ├── CLAUDE.md                    # Project context (READ FIRST)
│   ├── TODO.md                      # Current tasks
│   ├── PROGRESS.md                  # Progress tracking
│   ├── FILE_MAP.md                  # This file
│   ├── prd/                         # Product Requirements
│   │   ├── PRD-damie-code-v1.md     # Main PRD (45 stories)
│   │   └── TASKS-damie-code-v1.json # Granular tasks (350)
│   ├── prompts/                     # Development prompts
│   ├── rules/                       # Development rules
│   │   └── RULES.md
│   ├── tracking/                    # Detailed tracking
│   │   ├── ralph-state.json         # Ralph Loop state (runtime)
│   │   └── sessions/                # Archived session logs
│   ├── architecture/                # Architecture docs
│   └── research/                    # Research notes
│
├── packages/                        # MAIN SOURCE CODE
│   │
│   ├── cli/                         # CLI Package
│   │   ├── package.json
│   │   ├── index.ts
│   │   └── src/
│   │       ├── commands/            # CLI commands
│   │       │   ├── extensions/      # Extension commands
│   │       │   └── mcp/             # MCP commands
│   │       ├── config/              # CLI config
│   │       │   ├── auth.ts
│   │       │   ├── config.ts
│   │       │   ├── extension.ts
│   │       │   ├── keyBindings.ts
│   │       │   └── settings.ts
│   │       ├── services/            # CLI services
│   │       └── ui/                  # UI components
│   │
│   ├── core/                        # Core Package
│   │   ├── package.json
│   │   └── src/
│   │       ├── code_assist/         # OAuth & setup
│   │       │   ├── oauth2.ts
│   │       │   ├── server.ts
│   │       │   └── setup.ts
│   │       ├── config/              # Configuration
│   │       │   ├── config.ts
│   │       │   ├── constants.ts
│   │       │   ├── models.ts
│   │       │   └── storage.ts
│   │       ├── core/                # Core logic
│   │       │   ├── baseLlmClient.ts
│   │       │   ├── client.ts
│   │       │   ├── contentGenerator.ts
│   │       │   ├── coreToolScheduler.ts
│   │       │   └── openaiContentGenerator/
│   │       ├── fallback/            # Fallback handling
│   │       ├── ide/                 # IDE integration
│   │       ├── mcp/                 # Model Context Protocol
│   │       ├── output/              # Output handling
│   │       ├── prompts/             # Prompt templates
│   │       ├── qwen/                # QWEN-SPECIFIC
│   │       │   ├── qwenContentGenerator.ts
│   │       │   ├── qwenOAuth2.ts
│   │       │   └── sharedTokenManager.ts
│   │       ├── services/            # Services
│   │       ├── subagents/           # Subagent system
│   │       └── telemetry/           # Telemetry
│   │
│   ├── test-utils/                  # Test Utilities
│   │   └── (test helpers)
│   │
│   └── vscode-ide-companion/        # VS Code Extension
│       └── (extension code)
│
├── scripts/                         # Build scripts
│   ├── build.js
│   ├── start.js
│   └── ...
│
├── stage/                           # OLD PYTHON CODE (reference)
│   ├── src/                         # 16 Python components
│   │   ├── adapter/
│   │   ├── router/
│   │   ├── tools/
│   │   ├── scanner/
│   │   ├── context/
│   │   ├── planner/
│   │   ├── supervisor/
│   │   ├── verifier/
│   │   ├── prompts/
│   │   ├── diff_engine/
│   │   ├── memory/
│   │   ├── sysadmin/
│   │   ├── skills/
│   │   ├── plugins/
│   │   └── core/
│   └── (other old files)
│
├── package.json                     # Root package.json
├── package-lock.json
├── tsconfig.json                    # TypeScript config
├── eslint.config.js                 # ESLint config
├── vitest.config.ts                 # Test config
├── Dockerfile                       # Container config
├── Makefile                         # Make commands
├── README.md                        # Project README
├── CHANGELOG.md                     # Version history
├── CONTRIBUTING.md                  # Contribution guide
├── LICENSE                          # License
└── SECURITY.md                      # Security policy
```

---

## Key Files Quick Reference

### Development (mydev/)
| File | Purpose |
|------|---------|
| `mydev/CLAUDE.md` | Project context - READ FIRST |
| `mydev/TODO.md` | Current tasks |
| `mydev/PROGRESS.md` | Progress tracking |
| `mydev/FILE_MAP.md` | This file |
| `mydev/rules/RULES.md` | Development rules |

### Source Code (packages/)
| File | Purpose |
|------|---------|
| `packages/core/src/core/baseLlmClient.ts` | Base LLM client |
| `packages/core/src/qwen/qwenContentGenerator.ts` | Qwen API integration |
| `packages/core/src/core/coreToolScheduler.ts` | Tool execution |
| `packages/cli/src/config/config.ts` | CLI configuration |

### Configuration
| File | Purpose |
|------|---------|
| `package.json` | Node.js project config |
| `tsconfig.json` | TypeScript config |
| `.env` (create) | Environment variables |

---

## Files Created by Development

| Date | File | Purpose |
|------|------|---------|
| 2026-02-08 | mydev/CLAUDE.md | Context |
| 2026-02-08 | mydev/TODO.md | Tasks |
| 2026-02-08 | mydev/PROGRESS.md | Progress |
| 2026-02-08 | mydev/FILE_MAP.md | This file |
| 2026-02-08 | mydev/rules/RULES.md | Development rules |
| 2026-02-08 | mydev/prd/PRD-damie-code-v1.md | PRD (45 stories) |
| 2026-02-08 | mydev/prd/TASKS-damie-code-v1.json | Tasks (350 tasks) |
| 2026-02-08 | ~/.claude/skills/ralph-loop/ | Ralph Loop skill |

---

## Folders to Create (Planned)

| Path | Purpose | When |
|------|---------|------|
| `packages/core/src/damie/` | Damie-specific code | Implementation |
| `packages/core/src/adapters/` | Multi-API adapters | Implementation |
| `packages/core/src/router/` | Model router | Implementation |

---

## Update Instructions

When creating new files:
1. Add entry to this FILE_MAP.md
2. Update the directory tree above
3. Add to "Files Created" table with date
