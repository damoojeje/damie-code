# Skills Review & Integration Plan

**Date:** February 22, 2026
**Reviewed:** 7 skill repositories in `mydev/skills/`

---

## 📦 Skills Inventory

### 1. **agent-skills** (vercel-labs/agent-skills)
**Purpose:** AI coding agent skills collection  
**Format:** Agent Skills format (agentskills.io)

**Available Skills:**
- `react-best-practices` - 40+ React/Next.js optimization rules
- `web-design-guidelines` - 100+ accessibility/performance/UX rules
- `react-native-guidelines` - 16 React Native rules
- `composition-patterns` - React composition patterns
- `vercel-deploy-claimable` - Deploy to Vercel from CLI

**Usage:**
```bash
npx add-skill vercel-labs/agent-skills
```

**Triggers:**
- "Deploy my app"
- "Review this React component"
- "Check accessibility"
- "Optimize this Next.js page"

---

### 2. **get-shit-done-skills** (glittercowboy/get-shit-done)
**Purpose:** AI conversion of GSD methodology for Claude Code  
**Format:** SKILL.md files  
**Status:** Untested/experimental

**Features:**
- Heavy workflow automation
- Multi-step processes
- Project management flows

**Note:** Author notes it's "quite heavy" and may become obsolete as agents improve.

---

### 3. **ui-ux-pro-max-skill** (nextlevelbuilder/ui-ux-pro-max-skill)
**Purpose:** Professional UI/UX design system generator  
**Format:** CLI + Skill files  
**Version:** 2.0 (major update)

**Key Features:**
- **Design System Generator** - AI-powered reasoning engine
- **100 reasoning rules** for design decisions
- **67 UI styles** library
- Multi-platform support (web, mobile, desktop)
- Color palette generation (96 palettes)
- Landing page patterns (24 patterns)

**Usage:**
```bash
npm install -g uipro-cli
# Or install as Claude Code skill
```

**Example Output:**
```
TARGET: Serenity Spa - RECOMMENDED DESIGN SYSTEM
PATTERN: Hero-Centric + Social Proof
STYLE: Soft UI Evolution
COLORS: #E8B4B8 (Soft Pink), #A8D5BA (Sage Green)...
TYPOGRAPHY: Cormorant Garamond / Montserrat
```

**Best For:**
- Building landing pages
- Design system creation
- Multi-platform UI consistency
- Professional design reviews

---

### 4. **ralph-tui** (subsy/ralph-tui)
**Purpose:** AI Agent Loop Orchestrator  
**Format:** Bun CLI + TUI  
**Version:** Production ready

**What It Does:**
Runs AI coding agents in an autonomous loop to complete tasks one-by-one from a PRD (Product Requirements Document).

**Workflow:**
```
1. SELECT TASK → 2. BUILD PROMPT → 3. EXECUTE AGENT
       ▲                                        │
       │                                        ▼
       5. NEXT TASK ←── 4. DETECT COMPLETION
```

**Supported Agents:**
- Claude Code
- OpenCode
- Factory Droid
- Gemini CLI (your project!)
- Codex
- Kiro CLI

**Task Trackers:**
- `prd.json` (simple format)
- Beads (git-backed with dependencies)

**CLI Commands:**
```bash
bun install -g ralph-tui
ralph-tui setup              # Setup project
ralph-tui create-prd --chat  # Create PRD with AI
ralph-tui run --prd ./prd.json  # Run autonomous loop
```

**Features:**
- Real-time TUI monitoring
- Session persistence (pause/resume)
- Subagent tracing
- Remote instance monitoring
- Git-backed task tracking (Beads)

**Integration with Damie Code:**
This is **HIGHLY RELEVANT** - Ralph TUI can orchestrate Damie Code to work autonomously through tasks!

---

### 5. **skills** (skills.sh)
**Purpose:** Skills marketplace and CLI  
**Format:** Node.js CLI + skills registry

**What It Is:**
A platform for discovering, installing, and managing AI agent skills.

**CLI Features:**
- Skill discovery
- Skill installation
- Skill management
- Registry integration

**Usage:**
```bash
# Install skills
npx add-skill <skill-name>

# List available skills
npx skills list
```

---

### 6. **superpowers** (obra/superpowers)
**Purpose:** Complete software development workflow for coding agents  
**Format:** Claude Code plugin  
**Author:** Jesse (obra)

**Workflow:**
1. **Brainstorm** - Interactive design refinement
2. **Write Plan** - Create implementation plan (TDD, YAGNI, DRY)
3. **Execute Plan** - Subagent-driven development process

**Key Features:**
- Design-first approach
- Chunked specifications
- True red/green TDD
- Subagent-driven execution
- Automatic skill triggering

**Installation:**
```bash
# Claude Code
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace

# Codex
# Follow instructions in docs/README.codex.md

# OpenCode
# Follow instructions in docs/README.opencode.md
```

**Commands:**
```
/superpowers:brainstorm - Interactive design refinement
/superpowers:write-plan - Create implementation plan
/superpowers:execute-plan - Execute plan in batches
```

---

### 7. **agents** (wshobson/agents)
**Purpose:** Claude Code Plugins marketplace  
**Format:** 72 focused plugins  
**Scale:** Production enterprise system

**Massive Scale:**
- **72 Focused Plugins** - Single-purpose, minimal token usage
- **108 Specialized Agents** - Domain experts
- **129 Agent Skills** - Modular knowledge packages
- **15 Workflow Orchestrators** - Multi-agent coordination
- **72 Development Tools** - Utilities and automation

**Plugin Categories:**
- Architecture & Design (6 plugins)
- Backend Development (4 plugins)
- Frontend Development (6 plugins)
- Full-Stack (3 plugins)
- Mobile Development (2 plugins)
- DevOps & Infrastructure (8 plugins)
- Security & Quality (6 plugins)
- Data & AI (5 plugins)
- Documentation (4 plugins)
- Business Operations (3 plugins)
- ...and more

**Usage:**
```bash
# Add marketplace
/plugin marketplace add wshobson/agents

# Install plugins
/plugin install python-development
/plugin install javascript-typescript
/plugin install backend-development
/plugin install kubernetes-operations
/plugin install full-stack-orchestration
```

**Key Innovation:**
- **Progressive Disclosure** - Skills load only when activated
- **Minimal Token Usage** - ~300 tokens per plugin vs loading everything
- **Composable** - Mix and match plugins

---

## 🎯 Integration Opportunities

### Immediate Wins (High Priority)

#### 1. **Ralph TUI + Damie Code** ⭐⭐⭐
**Why:** Ralph can orchestrate Damie Code to work autonomously through tasks

**Integration:**
```bash
# Create PRD for Damie Code feature
ralph-tui create-prd --chat

# Ralph runs Damie Code in loop
ralph-tui run --agent "damie" --prd ./prd.json
```

**Benefits:**
- Autonomous task completion
- Git-backed task tracking
- Real-time monitoring
- Session persistence

**Action:** Test Ralph TUI with Damie Code as the agent

---

#### 2. **UI/UX Pro Max for Damie Code UI** ⭐⭐⭐
**Why:** Improve Damie Code's TUI with professional design

**Integration:**
```bash
# Install CLI
npm install -g uipro-cli

# Use during Damie Code development
uipro review ./packages/cli/src/ui
uipro generate --style "modern-terminal" --framework "ink"
```

**Benefits:**
- Professional TUI design
- Accessibility compliance
- Performance optimization
- Consistent styling

**Action:** Use UI/UX Pro Max to review and improve Damie Code UI components

---

#### 3. **Agent Skills for Code Quality** ⭐⭐
**Why:** Improve code quality automatically

**Integration:**
```bash
npx add-skill vercel-labs/agent-skills
```

**Skills to Use:**
- `react-best-practices` - For React/Ink components
- `web-design-guidelines` - For UI review
- `vercel-deploy-claimable` - Deploy Damie Code demos

**Action:** Install and test with Damie Code codebase

---

#### 4. **Superpowers for Feature Development** ⭐⭐
**Why:** Structured feature development workflow

**Integration:**
```bash
/plugin install superpowers@superpowers-marketplace

# Use for new features
/superpowers:brainstorm "Add model routing UI"
/superpowers:write-plan
/superpowers:execute-plan
```

**Benefits:**
- Design-first approach
- Clear implementation plans
- Subagent-driven execution
- TDD workflow

**Action:** Test with next Damie Code feature

---

#### 5. **Agents Marketplace for Specialized Tasks** ⭐
**Why:** Access 108 specialized agents when needed

**Integration:**
```bash
/plugin marketplace add wshobson/agents

# Install as needed
/plugin install javascript-typescript
/plugin install backend-development
```

**Best For:**
- Complex architecture decisions
- Security reviews
- Performance optimization
- Multi-language projects

**Action:** Install selectively based on project needs

---

## 📋 Recommended Integration Plan

### Phase 1: Test & Validate (1-2 days)

1. **Ralph TUI Integration**
   ```bash
   bun install -g ralph-tui
   ralph-tui setup
   # Create simple PRD for Damie Code bug fix
   ralph-tui run --agent "damie" --prd ./test-prd.json
   ```

2. **UI/UX Pro Max Review**
   ```bash
   npm install -g uipro-cli
   uipro review ./packages/cli/src/ui
   # Apply recommendations
   ```

3. **Agent Skills Installation**
   ```bash
   npx add-skill vercel-labs/agent-skills
   # Test with code review tasks
   ```

### Phase 2: Workflow Integration (1 week)

1. **Add Ralph TUI to Damie Code workflow**
   - Create PRDs for features
   - Run autonomous development loops
   - Track progress in git

2. **Use UI/UX Pro Max for all UI changes**
   - Design system generation
   - Accessibility audits
   - Performance reviews

3. **Integrate Superpowers for major features**
   - Brainstorming sessions
   - Implementation planning
   - Subagent execution

### Phase 3: Advanced Orchestration (2-4 weeks)

1. **Multi-Agent Workflows**
   - Use Agents marketplace for specialized tasks
   - Coordinate multiple Damie Code instances
   - Parallel development streams

2. **Custom Skill Development**
   - Create Damie Code-specific skills
   - Add to skills.sh registry
   - Share with community

---

## 🔧 How to Use Each Skill

### Ralph TUI (Autonomous Development)
```bash
# 1. Install
bun install -g ralph-tui

# 2. Setup project
cd E:\damie-coder-cli
ralph-tui setup

# 3. Create PRD
ralph-tui create-prd --chat
# Answer questions about your feature
# PRD saved to ./prd.json

# 4. Run autonomous loop
ralph-tui run --prd ./prd.json
# Ralph will:
# - Select tasks from PRD
# - Prompt Damie Code
# - Execute changes
# - Detect completion
# - Move to next task

# 5. Monitor progress
# Real-time TUI shows:
# - Current task
# - Agent output
# - Subagent calls
# - Completion status
```

### UI/UX Pro Max (Design System)
```bash
# 1. Install
npm install -g uipro-cli

# 2. Generate design system
uipro generate --target "Damie Code TUI" --style "modern-terminal"

# 3. Review existing UI
uipro review ./packages/cli/src/ui/components

# 4. Get recommendations
uipro suggest --issue "Improve accessibility"

# 5. Apply changes
# Review generated design system
# Implement recommendations
```

### Agent Skills (Code Quality)
```bash
# 1. Install
npx add-skill vercel-labs/agent-skills

# 2. Use naturally
# Skills trigger automatically when you:
# - "Deploy this"
# - "Review this component"
# - "Check performance"
# - "Optimize this"

# 3. Specific triggers:
# "Deploy my app to Vercel" → vercel-deploy-claimable
# "Review this React code" → react-best-practices
# "Check accessibility" → web-design-guidelines
```

### Superpowers (Structured Development)
```bash
# 1. Install (Claude Code)
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace

# 2. Use workflow
/superpowers:brainstorm "Add model routing UI"
# Interactive design refinement

/superpowers:write-plan
# Creates implementation plan with TDD

/superpowers:execute-plan
# Subagents execute tasks autonomously
```

### Agents Marketplace (Specialized Tasks)
```bash
# 1. Add marketplace
/plugin marketplace add wshobson/agents

# 2. Browse plugins
/plugin

# 3. Install as needed
/plugin install javascript-typescript
/plugin install security-scanning
/plugin install code-review-ai

# 4. Use specialized agents
# Agents load automatically when relevant
```

---

## 💡 Strategic Recommendations

### 1. **Adopt Ralph TUI as Primary Workflow** ⭐⭐⭐
**Why:** Autonomous task completion is a force multiplier

**Action:**
- Create PRDs for all features
- Run Ralph with Damie Code as agent
- Track progress in git with Beads

### 2. **Make UI/UX Pro Max Mandatory for UI Changes** ⭐⭐
**Why:** Professional design quality, accessibility compliance

**Action:**
- Run `uipro review` before any UI PR
- Generate design systems for new features
- Maintain consistent styling

### 3. **Use Superpowers for Major Features** ⭐⭐
**Why:** Structured approach prevents scope creep

**Action:**
- Brainstorm with `/superpowers:brainstorm`
- Write detailed plans
- Execute with subagents

### 4. **Install Agent Skills Selectively** ⭐
**Why:** Code quality improvements, deployment automation

**Action:**
- Install `vercel-labs/agent-skills`
- Use for code reviews
- Deploy demos to Vercel

### 5. **Access Agents Marketplace for Complex Tasks** ⭐
**Why:** 108 specialized agents for niche requirements

**Action:**
- Add marketplace
- Install plugins per-project
- Use progressive disclosure

---

## 🎯 Next Steps

1. **Today:**
   - Install Ralph TUI: `bun install -g ralph-tui`
   - Create test PRD for Damie Code
   - Run first autonomous loop

2. **This Week:**
   - Install UI/UX Pro Max
   - Review Damie Code UI
   - Apply design improvements

3. **Next Week:**
   - Install Agent Skills
   - Test Superpowers workflow
   - Integrate into development process

---

**Summary:** You have access to **world-class AI development tools**. The key is integration into your workflow, not just installation. Start with Ralph TUI for autonomous development, then layer in the others based on need.
