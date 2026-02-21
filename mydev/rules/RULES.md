# RULES.md - Damie Code Development Rules

**Version**: 1.0.0
**Last Updated**: 2026-02-08

---

## 1. Project Structure Rules

### 1.1 Root Directory
The project root should ONLY contain:
- `package.json`, `package-lock.json` - Node.js config
- `tsconfig.json` - TypeScript config
- `eslint.config.js`, `.prettierrc.json` - Linting
- `vitest.config.ts` - Testing
- `Dockerfile`, `Makefile` - Build configs
- `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md` - Standard docs
- Standard dotfiles (`.gitignore`, `.editorconfig`, etc.)

### 1.2 Forbidden in Root
**NEVER place in project root:**
- Test scripts or temporary files
- LLM context files (llm.md, context.md)
- Development tracking files
- PRD or planning documents
- Experimental code

### 1.3 Development Artifacts Location
**ALL development artifacts go in `mydev/`:**
```
mydev/
├── CLAUDE.md          # Context file
├── TODO.md            # Task tracking
├── PROGRESS.md        # Progress tracking
├── FILE_MAP.md        # File structure map
├── prd/               # Product requirements
├── prompts/           # Development prompts
├── rules/             # This file and other rules
├── tracking/          # Detailed tracking
├── architecture/      # Architecture documents
└── research/          # Research notes
```

### 1.4 Source Code Location
All source code must be in `packages/`:
```
packages/
├── cli/               # CLI package
├── core/              # Core functionality
├── test-utils/        # Test utilities
└── vscode-ide-companion/  # VS Code extension
```

---

## 2. Ralph Loop Methodology

### 2.1 Every Component Must Follow Ralph Loop
```
PLAN → EXECUTE → VERIFY
```

### 2.2 PLAN Phase Requirements
Before writing ANY code:
- [ ] Define clear requirements
- [ ] Design component architecture
- [ ] Identify dependencies
- [ ] Create implementation plan
- [ ] Define success criteria
- [ ] Document in `mydev/prd/`

### 2.3 EXECUTE Phase Requirements
During implementation:
- [ ] Follow TypeScript best practices
- [ ] Write code in small, testable chunks
- [ ] Add inline documentation
- [ ] Update FILE_MAP.md with new files
- [ ] Commit frequently with clear messages

### 2.4 VERIFY Phase Requirements
After implementation:
- [ ] Write unit tests
- [ ] Run all tests (`npm run test`)
- [ ] Type check (`npm run typecheck`)
- [ ] Lint (`npm run lint`)
- [ ] Update documentation
- [ ] Update PROGRESS.md

---

## 3. TypeScript Coding Standards

### 3.1 General
- Use TypeScript strict mode
- Prefer `const` over `let`, never use `var`
- Use explicit types (avoid `any`)
- Use meaningful variable/function names
- Keep functions small (< 50 lines ideally)

### 3.2 Naming Conventions
```typescript
// Files: camelCase.ts or kebab-case.ts
modelRouter.ts
content-generator.ts

// Classes: PascalCase
class ModelRouter {}
class DeepSeekAdapter {}

// Interfaces: PascalCase with 'I' prefix (optional) or descriptive
interface ModelConfig {}
interface IContentGenerator {}

// Functions: camelCase
function analyzeTask() {}
function createAdapter() {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 30000;

// Enums: PascalCase
enum ModelProvider {
  QWEN = 'qwen',
  DEEPSEEK = 'deepseek',
}
```

### 3.3 File Structure
Each TypeScript file should follow:
```typescript
/**
 * @license
 * Copyright 2025-2026 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Imports (organized)
import { external } from 'external-package';
import { internal } from '../internal/module.js';
import type { TypeOnly } from './types.js';

// Constants
const CONFIG = {};

// Types/Interfaces
interface Options {}

// Main exports
export class MainClass {}
export function mainFunction() {}

// Helper functions (private, not exported)
function helperFunction() {}
```

### 3.4 Async/Await
- Always use `async/await` over `.then()` chains
- Always handle errors with try/catch
- Use `Promise.all()` for parallel operations

```typescript
// Good
async function fetchData() {
  try {
    const result = await api.call();
    return result;
  } catch (error) {
    throw new Error(`Failed to fetch: ${error.message}`);
  }
}

// Bad
function fetchData() {
  return api.call().then(result => result).catch(err => { throw err; });
}
```

---

## 4. Testing Rules

### 4.1 Test File Location
- Unit tests: Same directory as source file, named `*.test.ts`
- Integration tests: `integration-tests/` directory

### 4.2 Test Requirements
- Every new function must have tests
- Minimum 80% code coverage for new code
- Use descriptive test names
- Test edge cases and error conditions

### 4.3 Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  describe('methodName', () => {
    it('should do expected behavior', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle edge case', () => {
      // Test edge case
    });

    it('should throw on invalid input', () => {
      // Test error handling
    });
  });
});
```

---

## 5. Git & Version Control

### 5.1 Branch Naming
```
feature/component-name     # New features
fix/issue-description      # Bug fixes
refactor/area-name         # Refactoring
docs/topic                 # Documentation
```

### 5.2 Commit Messages
Follow conventional commits:
```
type(scope): description

feat(adapter): add DeepSeek API support
fix(router): correct model scoring algorithm
docs(readme): update installation instructions
refactor(core): simplify content generator
test(tools): add file operation tests
```

### 5.3 Commit Frequency
- Commit after completing each logical unit of work
- Never commit broken code to main branch
- Include tests in the same commit as the feature

---

## 6. API Adapter Rules

### 6.1 Adapter Interface
All API adapters must implement:
```typescript
interface ContentGenerator {
  generateContent(request: GenerateRequest): Promise<GenerateResponse>;
  streamContent(request: GenerateRequest): AsyncGenerator<StreamChunk>;
  countTokens(text: string): Promise<number>;
  getModelInfo(): ModelInfo;
}
```

### 6.2 Error Handling
- Wrap API errors in custom error classes
- Include retry logic with exponential backoff
- Log errors appropriately
- Never expose API keys in error messages

### 6.3 Configuration
- API keys via environment variables only
- Support `.env` files for local development
- Never hardcode API endpoints

---

## 7. Documentation Rules

### 7.1 Code Documentation
- Add JSDoc comments to all public functions
- Document complex logic inline
- Keep comments up-to-date with code changes

```typescript
/**
 * Routes a task to the most appropriate model.
 * @param task - The task description to analyze
 * @param availableModels - List of available model adapters
 * @returns The selected model adapter and routing reasoning
 */
export function routeTask(task: string, availableModels: ModelAdapter[]): RoutingResult {
  // Implementation
}
```

### 7.2 Markdown Documentation
- Keep docs in `docs/` for user documentation
- Keep dev docs in `mydev/` for development
- Update README.md for major changes

---

## 8. Progress Tracking Rules

### 8.1 Update Frequency
- Update TODO.md when starting/completing tasks
- Update PROGRESS.md at end of each session
- Update FILE_MAP.md when creating files

### 8.2 Session Recovery
Before ending a session:
1. Update TODO.md with current state
2. Update PROGRESS.md with checkpoint
3. Commit all changes
4. Note next steps in TODO.md

---

## 9. Security Rules

### 9.1 Secrets Management
- NEVER commit API keys, tokens, or passwords
- Use environment variables for all secrets
- Add sensitive files to `.gitignore`

### 9.2 Input Validation
- Validate all user inputs
- Sanitize file paths
- Limit command execution scope

### 9.3 Dependency Security
- Keep dependencies updated
- Review security advisories
- Use `npm audit` regularly

---

## 10. Performance Rules

### 10.1 Async Operations
- Use streaming for large responses
- Implement request timeouts
- Cache when appropriate

### 10.2 Memory Management
- Avoid loading entire files into memory
- Use streams for large file operations
- Clean up resources properly

---

## Quick Checklist

Before every commit:
- [ ] Code follows TypeScript standards
- [ ] Tests pass (`npm run test`)
- [ ] Types check (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Documentation updated
- [ ] FILE_MAP.md updated (if new files)
- [ ] PROGRESS.md updated
- [ ] Commit message follows convention
