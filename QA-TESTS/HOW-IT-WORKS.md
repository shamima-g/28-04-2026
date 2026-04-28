# How This AI-Driven Development System Works

A complete reference for understanding the instructions, workflow, agents, skills, hooks, and technical machinery that governs Claude Code in this repository.

---

## Table of Contents

1. [What This Repository Is](#1-what-this-repository-is)
2. [The Big Picture — TDD Workflow](#2-the-big-picture--tdd-workflow)
3. [Slash Commands (Skills)](#3-slash-commands-skills)
4. [Phases in Detail](#4-phases-in-detail)
   - [INTAKE](#41-intake)
   - [DESIGN](#42-design)
   - [SCOPE](#43-scope)
   - [STORIES](#44-stories)
   - [REALIGN](#45-realign)
   - [TEST-DESIGN](#46-test-design)
   - [WRITE-TESTS](#47-write-tests)
   - [IMPLEMENT](#48-implement)
   - [QA](#49-qa)
5. [Agents — Who Does What](#5-agents--who-does-what)
6. [Context Management — When to /clear + /continue](#6-context-management--when-to-clear--continue)
7. [Questions I Ask and How I Route the Answers](#7-questions-i-ask-and-how-i-route-the-answers)
8. [Quality Gates](#8-quality-gates)
9. [Policies I Must Never Break](#9-policies-i-must-never-break)
10. [Hooks — Automated Background Tasks](#10-hooks--automated-background-tasks)
11. [Permission System](#11-permission-system)
12. [Orchestrator Architecture](#12-orchestrator-architecture)
13. [State Tracking and Recovery](#13-state-tracking-and-recovery)
14. [Dashboard](#14-dashboard)
15. [Session Logging](#15-session-logging)
16. [Key Files and Directories](#16-key-files-and-directories)
17. [Technical Stack](#17-technical-stack)
18. [Glossary](#18-glossary)

---

## 1. What This Repository Is

This is a **template repository** for building production-ready frontend applications. Users clone it and use Claude Code to generate features, components, and API integrations through a guided, Test-Driven Development (TDD) workflow.

**Tech Stack:**
- Next.js 16 (App Router) + React 19 + TypeScript 5 (strict)
- Tailwind CSS 4 + Shadcn UI components
- Vitest + React Testing Library
- OpenAPI-driven API client

**Repository layout:**
```
project-root/
├── .claude/              ← Claude config: agents, hooks, scripts, commands, policies
├── web/                  ← Next.js frontend application
├── documentation/        ← User-provided feature specs, API docs, wireframes
└── generated-docs/       ← Auto-generated: specs, stories, tests, dashboard
```

---

## 2. The Big Picture — TDD Workflow

The entire development process follows this linear pipeline, run once per feature:

```
INTAKE → DESIGN → SCOPE → STORIES → [REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA] per story
```

| Stage | Frequency | What Happens |
|---|---|---|
| **INTAKE** | Once per feature | Gather requirements → produce Feature Requirements Specification (FRS) |
| **DESIGN** | Once per feature | Generate API spec, design tokens, wireframes, TypeScript types |
| **SCOPE** | Once per feature | Define all epics (no stories yet) |
| **STORIES** | Once per epic | Define stories and acceptance criteria for that epic only |
| **REALIGN** | Once per story | Check if prior implementation changed the plan; adjust if so |
| **TEST-DESIGN** | Once per story | Write human-readable test scenarios for BA review |
| **WRITE-TESTS** | Once per story | Generate failing Vitest tests (TDD red phase) |
| **IMPLEMENT** | Once per story | Write code to make the tests pass |
| **QA** | Once per story | Review code quality, run gates, manual verification, commit |

**Critical principle:** Stories are defined and implemented one epic at a time — not all upfront. Tests are written immediately before each implementation — true TDD.

---

## 3. Slash Commands (Skills)

These are user-invocable commands that trigger specific workflows. Type them in the Claude Code chat.

| Command | What It Does |
|---|---|
| `/start` | Begins the TDD workflow — runs INTAKE, then hands off to `/continue` |
| `/continue` | Resumes wherever the workflow was interrupted; reads state and picks up automatically |
| `/status` | Shows workflow progress (which epic, story, phase) without resuming |
| `/quality-check` | Runs all 5 quality gates manually (useful before committing outside the workflow) |
| `/setup` | Installs npm dependencies and verifies the environment |
| `/dashboard` | Generates the HTML progress dashboard and opens it in the browser |
| `/api-status` | Shows API endpoint provenance, mock status, and handler coverage |
| `/api-mock-refresh` | Refreshes MSW mock handlers when the API spec changes |
| `/api-go-live` | Switches from mock API to the live backend |

### How Skills Work Technically

Skills are markdown files in `.claude/commands/`. When invoked, Claude Code expands them into a full prompt that I (Claude) receive and execute as instructions. They are not shell scripts — they are instruction sets.

---

## 4. Phases in Detail

### 4.1 INTAKE

**Purpose:** Understand what needs to be built.

**Triggered by:** `/start`

**Path options (I ask the user at the start):**

| Option | What Happens |
|---|---|
| **A — Share existing docs** | User copies files into `documentation/`; I scan and extract requirements |
| **B — Import prototype repo** | I run `import-prototype.js` to pull in docs, design tokens, React source from a prototyping tool |
| **C — Guided Q&A** | User describes the project in free text; I ask structured questions |

**Agents invoked (sequentially):**
1. `intake-agent` — Scans `documentation/`, detects operating mode, asks 5-6 checklist questions (via orchestrator), produces `generated-docs/context/intake-manifest.json`
2. `prototype-review-agent` — (v2 prototype imports only) Exports .pen screenshots, extracts enrichments, flags assumptions
3. `intake-brd-review-agent` — Reviews completeness against the FRS template, asks clarifying questions, produces `generated-docs/specs/feature-requirements.md`

**Questions asked during INTAKE** (see Section 7 for full detail):
1. Roles and permissions
2. Styling/branding preferences
3. API spec availability + backend readiness (asked together)
4. Authentication method (BFF / next-auth / custom)
5. Compliance and regulatory requirements
6. Wireframe quality (if wireframes were provided)

**Output:** The **Feature Requirements Specification (FRS)** — the canonical source of truth for everything that follows. All requirements are written as testable statements (R1, R2...) and business rules (BR1, BR2...).

**Ends with:** Mandatory `/clear` + `/continue`.

---

### 4.2 DESIGN

**Purpose:** Generate all technical artifacts from the FRS before any code is written.

**Triggered by:** `/continue` after INTAKE clearing boundary.

**Agents invoked (conditionally, based on `intake-manifest.json`):**

| Agent | Condition | Output |
|---|---|---|
| `design-api-agent` | `manifest.artifacts.apiSpec.generate == true` | `generated-docs/specs/api-spec.yaml` |
| `design-style-agent` | `manifest.artifacts.designTokensCss.generate == true` | `generated-docs/specs/design-tokens.css` + `.md` |
| `design-wireframe-agent` | `manifest.artifacts.wireframes.generate == true` | `generated-docs/specs/wireframes/*.md` |
| `type-generator-agent` | API spec exists (generated or user-provided) | `web/src/types/api-generated.ts` + `web/src/lib/api/endpoints.ts` |

If `generate == false` but `userProvided` is set in the manifest, the orchestrator copies the user's file to `generated-docs/specs/` using a copy script — no agent needed.

`design-api-agent`, `design-style-agent`, and `design-wireframe-agent` (Call A) run **in parallel** to save time. User approves each before Call B runs. `type-generator-agent` runs autonomously after the API spec is approved.

**Ends with:** Mandatory `/clear` + `/continue`.

---

### 4.3 SCOPE

**Purpose:** Define all epics for the feature (no stories yet).

**Agent:** `feature-planner`

**How it works:**
- Call A: Proposes epic breakdown from the FRS → user approves
- Call B: Writes epic files + commits + pushes

**Output:** `generated-docs/stories/_feature-overview.md` + one `_epic-overview.md` per epic.

**Ends with:** Mandatory `/clear` + `/continue`.

---

### 4.4 STORIES

**Purpose:** Define stories and acceptance criteria for the current epic.

**Agent:** `feature-planner`

**Key rule:** Stories are defined **one epic at a time** — not all epics at once. This allows course-correction based on what was learned in previous epics.

**Output:** `generated-docs/stories/epic-N-[name]/story-M-[name].md` for each story in the current epic.

**Transitions directly to REALIGN** (no clearing boundary here).

---

### 4.5 REALIGN

**Purpose:** Check whether previous implementation work revealed impacts on the upcoming story; revise if so.

**Agent:** `feature-planner`

**How it works:**
- Reads `generated-docs/discovered-impacts.md`
- **If no impacts for this story:** Auto-completes immediately — no user approval, no pause. Transitions straight to TEST-DESIGN.
- **If impacts exist:** Proposes story revisions → user approves before proceeding.

This is how implementation learnings flow back into planning without derailing the whole project.

---

### 4.6 TEST-DESIGN

**Purpose:** Produce a human-readable specification-by-example document that a Business Analyst can review — before any executable tests are written.

**Agent:** `test-designer`

**What it contains:**
- Business behaviors identified
- Key decisions surfaced by AI (gaps the BA didn't specify)
- Test scenarios in Setup/Input/Expected table format
- Edge cases and out-of-scope items
- AC → example mapping (acceptance criteria linked to scenarios)

**This is an approval gate:** User reviews the full test-design document before proceeding to WRITE-TESTS. This is the last chance to catch misunderstood requirements before code is generated.

**Output:** `generated-docs/test-design/epic-N-[slug]/story-M-[slug]-test-design.md`

---

### 4.7 WRITE-TESTS

**Purpose:** Generate failing Vitest + React Testing Library tests before implementation (TDD red phase).

**Agent:** `test-generator`

**How it works:**
- Reads the story file and test-design document
- Writes tests that will fail because the components don't exist yet
- This is intentional — failing tests define the acceptance criteria as executable code

**Note on quality gates:** Gate 3 (TypeScript, ESLint) will fail at this point because tests reference components that don't exist. This is expected and documented — the gate reports FAIL but the workflow proceeds immediately to IMPLEMENT.

**Transitions directly to IMPLEMENT** (no user pause).

**Output:** `web/src/__tests__/integration/[feature].test.tsx`

---

### 4.8 IMPLEMENT

**Purpose:** Write code to make the failing tests pass.

**Agent:** `developer`

**How it works (2 calls):**
- **Call A — Implement:** Reads story, reads failing tests, writes components/pages/API calls to make them pass. Does NOT run quality gates.
- **Call B — Pre-flight Test Check:** Runs `npm test`, verifies all tests pass, fixes any failures. Does NOT run lint or build.

**Key rules the developer must follow:**
- Implements exactly ONE story at a time
- Uses App Router (not pages/), Shadcn UI components, the project's API client
- Never calls `fetch()` directly in components
- Uses `@/lib/api/client.ts` for all API calls
- FRS requirements override template code — if the template has something the FRS doesn't want, replace it

**Discovered impacts:** If the developer finds that implementing this story will affect a future story, they append to `generated-docs/discovered-impacts.md`. REALIGN picks this up before that future story runs.

**Transitions directly to QA.**

---

### 4.9 QA

**Purpose:** Code review, automated quality gates, manual browser verification, spec compliance check, and commit.

**Agent:** `code-reviewer`

**How it works (3 calls + checkpoints):**

1. **Call A — Code Review:** Reviews code quality, security, patterns (TypeScript, React, Next.js, RBAC, API client usage, Shadcn UI, accessibility). No gates, no commit.

2. **Call B — Quality Gates + Checklist:**
   - Runs all automated gates (see Section 8)
   - Persists the manual verification checklist to `generated-docs/qa/epic-N/story-M-verification-checklist.md`
   - Returns gate results and checklist

3. **Manual Verification Checkpoint:** User is asked to verify the feature in the browser. If they find issues → QA Fix Cycle begins (developer fixes → re-verify → loop until resolved).

4. **Spec Compliance Check (Gate 6):** `spec-compliance-watchdog` runs to verify that all acceptance criteria and test-design scenarios match the actual implementation. If there's drift:
   - **Option A:** Fix the code to match the specs
   - **Option B:** Update the specs to match the code

5. **Call C — Commit:** After all checks pass, commits and pushes the story. Returns a message with `/clear` + `/continue` instruction.

**Ends with:** Mandatory `/clear` + `/continue` (clearing boundary #4).

---

## 5. Agents — Who Does What

Each agent is a markdown file in `.claude/agents/` with a YAML frontmatter header that defines its name, model, tools, and instructions.

| Agent | Phase | Invoked By | Output |
|---|---|---|---|
| `intake-agent` | INTAKE | orchestrator (`/start`) | `intake-manifest.json` |
| `prototype-review-agent` | INTAKE (v2 only) | orchestrator | Screenshots, enrichments, FRS mapping |
| `intake-brd-review-agent` | INTAKE | orchestrator | `feature-requirements.md` |
| `design-api-agent` | DESIGN | orchestrator | `api-spec.yaml` |
| `design-style-agent` | DESIGN | orchestrator | `design-tokens.css`, `design-tokens.md` |
| `design-wireframe-agent` | DESIGN | orchestrator | `wireframes/*.md` |
| `type-generator-agent` | DESIGN | orchestrator (autonomous) | `api-generated.ts`, `endpoints.ts` |
| `mock-setup-agent` | DESIGN | orchestrator (autonomous) | MSW mock handlers |
| `feature-planner` | SCOPE, STORIES, REALIGN | orchestrator | Epic/story files |
| `test-designer` | TEST-DESIGN | orchestrator | `test-design/*.md` |
| `test-generator` | WRITE-TESTS | orchestrator | `*.test.tsx` files |
| `developer` | IMPLEMENT | orchestrator | Component/page/API code |
| `code-reviewer` | QA | orchestrator | Review findings, commits |
| `spec-compliance-watchdog` | QA (between verification and commit) | orchestrator | Compliance report or spec updates |

### Scoped Calls Pattern

Agents do not ask the user questions directly. Instead:
1. Orchestrator launches agent for **Call A** (analysis only, no writes, no user questions)
2. Agent returns structured data
3. **Orchestrator** displays content + uses `AskUserQuestion` to get approval
4. Orchestrator launches agent for **Call B** (writes files, commits) with user's answers included

This pattern ensures the user can always see what they're approving before they approve it.

### Why Agents Can't Use `AskUserQuestion`

`AskUserQuestion` silently auto-resolves inside Task subagents without waiting for the user. Only the **parent orchestrator** may use it. This is a Claude Code platform constraint.

---

## 6. Context Management — When to /clear + /continue

There are 5 mandatory clearing boundaries where the user must run `/clear` then `/continue`:

| Boundary | When | Why |
|---|---|---|
| **#1** | After INTAKE approves FRS | INTAKE and DESIGN are independent; clearing prevents old context from confusing design agents |
| **#2** | After DESIGN completes all artifacts | DESIGN and SCOPE are independent |
| **#3** | After SCOPE approves epic list | Epic planning and story planning are independent |
| **#4** | After each story's QA passes and is committed | Each story cycle is self-contained |
| **#5** | After the last story in an epic | Epic-to-epic transitions need a fresh context |

**All other phase transitions are automatic** — I proceed directly without asking the user.

### Post-Compaction Safety Net

If Claude Code auto-compacts the conversation mid-workflow, the hook `inject-phase-context.ps1` fires on the next `SessionStart` event (matcher: "compact") and automatically injects the current workflow state and phase-specific instructions back into the context. This prevents instruction loss in long sessions.

---

## 7. Questions I Ask and How I Route the Answers

### Onboarding (at `/start`)

**"How would you like to get started?"**
- "I have existing docs to share" → Option A: User adds files to `documentation/`
- "I have a prototype repo to import" → Option B: Run `import-prototype.js`
- "Let's build requirements together" → Option C: Free-text project description

### Checklist Questions (during INTAKE, asked by orchestrator via `AskUserQuestion`)

**1. Roles and Permissions**
- If docs exist and hint at roles: "I see the spec mentions [roles]. Is that the complete list?"
- Otherwise: "Who uses this application? What distinct roles exist, and what can each see and do?"
- Routing: Captured as `roles` in the manifest → informs RBAC implementation

**2. Styling/Branding**
- If docs exist: "There's [branding info]. Anything to override?"
- Otherwise: "Any specific colors, themes, or design system preferences?"
- Routing: `designTokensCss.generate` / `designTokensMd.generate` set in manifest → triggers `design-style-agent`

**3a. API Spec Availability** (asked together with 3b)
- "Do you have an OpenAPI or Swagger specification?"
- Options: Yes (complete) / Yes (partial) / No / N/A (no backend)
- Routing: Sets `dataSource` and `specCompleteness` in manifest

**3b. Backend Readiness** (asked with 3a)
- "Is your backend API up and running?"
- Options: Yes / No (still in development)
- Routing matrix:

| Spec? | Backend? | `dataSource` | Mock Layer? |
|---|---|---|---|
| Yes, complete | Running | `existing-api` | No |
| Yes, complete | In dev | `api-in-development` | Yes |
| No | Running | `new-api` | No |
| No | In dev | `api-in-development` | Yes |
| N/A | Any | `mock-only` | No |

**4. Authentication Method** ← Policy: NEVER skip or simplify this question
- "Backend For Frontend (BFF)" — backend handles OIDC, sets cookies
  - Follow-up (plain text, not `AskUserQuestion`): login URL, userinfo URL, logout URL
- "Frontend-only (next-auth)" — Next.js handles auth; shows trade-off warning
- "Custom" — follow-up: describe your approach
- Routing: Sets `authMethod` in manifest → implementation follows the exact architecture chosen

**5. Compliance and Regulatory**
- I scan prior answers and docs for compliance keywords first
- If domains detected (payment, personal data, health records): ask domain-specific questions
- If nothing detected: brief confirmation "I haven't spotted anything that would trigger compliance requirements — does that sound right?"
- Routing: `complianceDomains` array in manifest

**6. Wireframe Quality** (only if wireframes were provided)
- "Are these wireframes rough references or detailed enough for implementation?"
- Routing: Affects how strictly the design-wireframe-agent follows them

### Approval Questions (using `AskUserQuestion`)

- After intake manifest: "Does this look right? Anything to add or change?"
- After FRS: "Does this capture everything we need to build?"
- After SCOPE epics: "Does this breakdown look right?"
- After STORIES stories: "Does this story list look right?"
- After TEST-DESIGN: "Does this test design look right before we write the tests?"
- After QA: "Have you verified [story name] in the browser?"

### Two-Step Approval Rule (Mandatory)

Every approval follows this exact pattern:
1. **Display the content** as regular text (user must see what they're approving)
2. **Then** call `AskUserQuestion` (never combine steps, never ask without showing content first)

---

## 8. Quality Gates

Gates are **binary** — pass or fail. No conditional passes, no "expected failures count as passes."

| Gate | Type | What It Checks | Pass Criteria |
|---|---|---|---|
| **Gate 1: Functional** | Manual | User confirms feature works as specified | User says yes |
| **Gate 2: Security** | Automated | `npm audit` | 0 high/critical vulnerabilities; no hardcoded secrets |
| **Gate 3: Code Quality** | Automated | Prettier, TypeScript (`tsc --noEmit`), ESLint, Build | 0 TypeScript errors, 0 ESLint errors, build succeeds |
| **Gate 4: Testing** | Automated | `npm test` | All tests pass; coverage ≥ 80% (if configured) |
| **Gate 5: Performance** | Manual | User confirms acceptable performance | User says yes |
| **Gate 6: Spec Compliance** | LLM (agent) | `spec-compliance-watchdog` checks AC vs implementation vs test-design | All ACs implemented; test-design tables match test assertions |

### What I Report When Gates Fail

- Report actual exit codes and error counts — never rationalize
- Show what failed and why
- Present options (fix code / update specs / continue despite failure)
- Let the user decide — never decide for them

### Special Case: WRITE-TESTS Phase

During WRITE-TESTS, Gate 3 will fail because tests reference components that don't exist yet. This is expected. I report it as:
- Gate 3: FAIL (with explanation that this is expected TDD behavior)
- Workflow proceeds immediately to IMPLEMENT

---

## 9. Policies I Must Never Break

### FRS Requirements Override Template Code

The template ships with pre-built code (NextAuth, layout components, etc.). If the FRS specifies something different, I **replace** the template code — not extend it. The FRS is always right.

Example: Template uses NextAuth with credentials provider. FRS says BFF auth at `localhost:5120`. Correct action: Remove NextAuth, implement BFF redirects.

### No Error Suppression

Never use:
- `// eslint-disable` / `// eslint-disable-next-line`
- `// @ts-expect-error` / `// @ts-ignore` / `// @ts-nocheck`

Fix errors properly.

### Authentication Must Always Be Asked Explicitly

Even if the docs make the answer obvious, I must present all three auth options (BFF / next-auth / custom) explicitly during INTAKE. Authentication affects every layer of the app — no assumptions allowed.

### Never Auto-Approve

If an agent produces work requiring user approval, I stop and ask. I never proceed on behalf of the user.

### Session Log Marker

Every response ends with `[Logs saved]` — this signals to the user that the session logging hook is about to run. It is safe to close the chat window at this point.

### API Spec Detection (Multi-Layer)

Before implementing any API-related feature:
1. Check `documentation/` and `generated-docs/specs/` for OpenAPI specs
2. Verify endpoint paths, methods, and types against the spec before writing API calls
3. If API calls fail, report the error accurately and reference the spec — never guess why it failed
4. Ask the user about backend status — do not dismiss errors

### Shadcn UI via MCP

All UI components must use Shadcn (`<Button />`, `<Card />`, etc.). If a component doesn't exist, install it via the MCP tool `mcp__shadcn__add_component`. Never write hand-crafted "Shadcn-style" components.

### Plain Language for User-Facing Text

Non-technical users read this system's output. All user-facing text must avoid jargon:
- "The app builds correctly" not "TypeScript compilation succeeded with zero diagnostics"
- "All automated checks passed" not "Gate 3 (ESLint + tsc) exited 0"

### Speak in First Person

When relaying agent findings, I speak as if I found them: "I've gone through your docs" — not "The intake-agent has scanned your documentation."

---

## 10. Hooks — Automated Background Tasks

Hooks are shell commands that run automatically in response to Claude Code events. They are defined in `.claude/settings.json`.

| Hook Event | What Runs | Purpose |
|---|---|---|
| `UserPromptSubmit` | `capture-context.ps1 -EventType prompt` | Logs every user prompt |
| `SessionStart` | `capture-context.ps1 -EventType session_start` | Logs session start |
| `SessionStart` (compact) | `inject-phase-context.ps1` | Restores workflow state after auto-compaction |
| `SessionEnd` | `capture-context.ps1 -EventType session_end` | Logs session end |
| `SubagentStart` | `capture-context.ps1 -EventType subagent_start` | Logs when an agent launches |
| `SubagentStart` (named agents) | `inject-agent-context.ps1` | Injects current workflow state into the agent's context |
| `SubagentStop` | `capture-context.ps1 -EventType subagent_stop` | Logs when an agent finishes |
| `PreCompact` | `capture-context.ps1 -EventType pre_compact` | Saves context before compaction |
| `Stop` | `capture-context.ps1 -EventType response` | Logs each response (this is what triggers `[Logs saved]`) |
| `PreToolUse` (Bash) | `bash-permission-checker.js` | Validates Bash commands against permission rules |
| `PreToolUse` (all) | `capture-context.ps1 -EventType pre_tool_use` | Logs all tool use |
| `PostToolUse` (all) | `capture-context.ps1 -EventType post_tool_use` | Logs tool results |
| `PostToolUse` (Write/Edit) | `generate-progress-index.js` | Updates the progress index after every file write |
| `PermissionRequest` | `capture-context.ps1 -EventType permission_request` | Logs permission requests |
| `Notification` | `capture-context.ps1 -EventType notification` | Logs notifications |

The named agent hook (`SubagentStart` matcher: `developer|test-generator|code-reviewer|feature-planner|...`) specifically injects workflow state into agents that need to know the current phase and epic/story context.

---

## 11. Permission System

Defined in `.claude/settings.json` under `permissions`.

### Always Allowed (no user prompt)
- All Shadcn MCP operations (`mcp__shadcn-ui__*`)
- Reading and writing `documentation/**`
- Reading and writing `generated-docs/**`
- Reading and writing `web/**`

### Always Denied (blocked regardless)
- `rm -rf /` or `rm -rf /*` (destructive deletion)
- Reading SSH keys (`*.ssh/*`, `id_rsa`, `*.pem`, `credentials`)
- Shell equivalents of the above (`cat`, `type`, `Get-Content`, `sed` on sensitive file patterns)

### Everything Else
Requires user approval when the tool is called. The `bash-permission-checker.js` hook validates Bash commands before they run.

---

## 12. Orchestrator Architecture

The orchestrator is the "conductor" — it invokes agents, manages user interaction, and tracks phase transitions. There are two orchestrators:

- **`/start` orchestrator** — handles INTAKE through the first context clearing boundary
- **`/continue` orchestrator** — handles all subsequent phases via a dispatcher pattern

### Dispatcher Pattern (Critical for `/continue`)

Claude Code has a bug where tool dispatch (hooks, permissions) stops working after approximately 4 tool calls in a single response. To work around this:

1. **Parent orchestrator** makes only 2-3 tool calls maximum:
   - Run `collect-dashboard-data.js` to get workflow state (1 Bash call)
   - Launch a coordinator subagent (1 Agent call)
2. **Coordinator subagent** handles everything else (file reads, TodoWrite, agent launches, dashboard updates)
3. When user approval is needed, coordinator returns `NEEDS_APPROVAL:` prefix in its response
4. Parent orchestrator displays the content and calls `AskUserQuestion`
5. User response creates a **fresh turn with fresh hooks** — safe to launch another coordinator

This architecture ensures each user interaction starts with fresh hooks, preventing the 4-tool-call limit from blocking execution.

---

## 13. State Tracking and Recovery

### Workflow State File

`generated-docs/context/workflow-state.json` — tracks:
- Current phase (INTAKE, DESIGN, SCOPE, STORIES, REALIGN, etc.)
- Current epic number and story number
- Phase history

### Scripts

| Script | Purpose |
|---|---|
| `transition-phase.js` | Manages phase transitions with validation |
| `validate-phase-output.js` | Confirms expected artifacts exist for a phase |
| `detect-workflow-state.js` | Reads state without modifying it |
| `collect-dashboard-data.js` | Collects full enriched workflow data (used by `/continue`) |
| `generate-dashboard-html.js` | Regenerates the HTML progress dashboard |
| `generate-todo-list.js` | Generates the TodoWrite progress list |

### Script Output Convention

All scripts output JSON. The orchestrator always checks:
- `"status": "ok"` → proceed
- `"status": "error"` → STOP, report to user
- `"status": "warning"` → proceed with caution, inform user

### State Recovery

If `workflow-state.json` is missing or corrupted:
```bash
node .claude/scripts/transition-phase.js --repair
```

Repair infers state from artifacts on disk and returns a confidence level:
- **High** — state is reliable, proceed automatically
- **Medium** — show detected vs assumed, ask user to confirm
- **Low** — require user verification before proceeding

### Agent-to-Agent Communication Files

| File | Written By | Read By |
|---|---|---|
| `intake-manifest.json` | intake-agent | DESIGN orchestrator, feature-planner |
| `workflow-state.json` | transition scripts | all agents |
| `review-findings.json` | code-reviewer | code-reviewer (QA phase) |
| `quality-gate-status.json` | code-reviewer | (final output) |
| `discovered-impacts.md` | developer, test-generator | feature-planner (REALIGN) |

---

## 14. Dashboard

The HTML dashboard (`generated-docs/dashboard.html`) shows a visual overview of workflow progress — epics, stories, phases, and status.

- **Auto-refreshes every 10 seconds** via `<meta http-equiv="refresh">`
- **Updated at milestones:** end of INTAKE, during/after DESIGN, end of SCOPE, end of STORIES, after REALIGN, TEST-DESIGN, WRITE-TESTS, IMPLEMENT, QA
- **Updates are fire-and-forget** — a failure never blocks the workflow
- **User-triggered:** `/dashboard` generates and opens it in the default browser

---

## 15. Session Logging

Every conversation is logged to `.claude/logs/` as markdown files. These logs are:
- **Intentionally tracked in Git** — included in commits for traceability
- **Automatically captured** by hooks at every event (prompt, response, tool use, agent start/stop)
- **Named by date and conversation snippet** (e.g., `2026-04-09_02-21Z-i-am-testing-if-all-the-instructions-739fc0fd.md`)

The `[Logs saved]` marker at the end of every response signals that the `Stop` hook (`capture-context.ps1 -EventType response`) is about to run.

---

## 16. Key Files and Directories

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Primary instruction file — read by Claude at the start of every conversation |
| `.claude/settings.json` | Hooks, permissions, allowed/denied tool patterns |
| `.claude/shared/orchestrator-rules.md` | Mandatory rules for both `/start` and `/continue` orchestrators |
| `.claude/policies/authentication-intake.md` | Authentication question policy — never skip or simplify |
| `.claude/policies/compliance-intake.md` | Compliance keyword triggers and domain-specific questions |
| `.claude/policies/quality-gates.md` | Gate definitions, reporting rules, binary pass/fail policy |
| `.claude/agents/` | One markdown file per specialized agent |
| `.claude/commands/` | One markdown file per slash command |
| `.claude/hooks/phase-context/` | Phase-specific instructions injected via hook on compaction |
| `.claude/templates/feature-requirements.md` | FRS template — used by intake-brd-review-agent |
| `documentation/` | User-provided specs, API docs, wireframes, design files |
| `generated-docs/specs/` | Canonical specs after DESIGN (api-spec.yaml, design-tokens.css, wireframes) |
| `generated-docs/context/` | Agent communication files (manifest, workflow state) |
| `generated-docs/stories/` | Epic and story files |
| `generated-docs/test-design/` | Test-design documents |
| `generated-docs/qa/` | Manual verification checklists |
| `web/src/lib/api/client.ts` | API client — all API calls must go through this |
| `web/src/types/api-generated.ts` | TypeScript types generated from OpenAPI spec |
| `web/src/lib/api/endpoints.ts` | Typed endpoint functions generated from OpenAPI spec |

---

## 17. Technical Stack

### Frontend (in `web/`)

| Technology | Role |
|---|---|
| Next.js 16 (App Router) | Framework — pages in `app/`, server components by default |
| React 19 | UI library |
| TypeScript 5 (strict) | Type safety — `@ts-ignore` is forbidden |
| Tailwind CSS 4 | Styling |
| Shadcn UI | Component library — always used via MCP, never hand-crafted |
| Vitest | Test runner |
| React Testing Library | Testing utilities |
| MSW (Mock Service Worker) | API mocking for development (when backend is not ready) |

### Path Aliases
- `@/` resolves to `web/src/`

### API Client Rules
- Never call `fetch()` directly in components
- Always use `web/src/lib/api/client.ts`: `get`, `post`, `put`, `del`
- If an OpenAPI spec exists, it is the source of truth for all endpoint paths, methods, and types

### Testing Rules
- Focus on **integration tests** — user-observable behavior, not implementation details
- Query priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId` (last resort)
- No `.skip()` — tests either pass or fail, never skip
- No testing third-party library internals (Recharts SVGs, Zod schemas, etc.)

---

## 18. Glossary

| Term | Definition |
|---|---|
| **FRS** | Feature Requirements Specification — the canonical document produced by INTAKE; everything else derives from it |
| **Intake Manifest** | `intake-manifest.json` — produced by `intake-agent`; controls which DESIGN agents run and what artifacts they generate |
| **Scoped Call** | A pattern where an agent is called twice: Call A (analyze only, no writes) → orchestrator asks user → Call B (write + commit) |
| **Orchestrator** | The parent Claude instance running `/start` or `/continue`; manages user interaction and launches subagents |
| **Coordinator** | A general-purpose subagent launched by the orchestrator to handle multi-step work without hitting the 4-tool-call limit |
| **Clearing Boundary** | A point where the user must run `/clear` + `/continue` to reset context before the next independent phase |
| **Discovered Impacts** | Notes appended to `discovered-impacts.md` by developer/test-generator when they find that a future story's plan needs to change |
| **REALIGN** | The phase that processes discovered impacts and revises the upcoming story before tests are written |
| **TDD** | Test-Driven Development — write failing tests first, then write code to make them pass |
| **BFF** | Backend For Frontend — an authentication pattern where the backend handles OIDC and sets HTTP-only cookies |
| **MSW** | Mock Service Worker — intercepts API calls in the browser during development when the backend isn't ready |
| **Gate** | A quality check; all gates are binary (pass/fail); no conditional passes |
| **Epic** | A group of related user stories that together deliver a major piece of functionality |
| **Story** | A single user-facing feature or behavior, small enough to implement and test in one cycle |
| **Acceptance Criteria (AC)** | Testable statements that define when a story is done; written in the story file |
| **Spec Compliance Watchdog** | An agent that checks whether the implementation and tests match every AC and test-design scenario |
| **`[Logs saved]`** | Mandatory marker at the end of every Claude response; signals that session logging is complete |
| **`v2` prototype** | A prototype import format from a specific prototyping tool (.pen files, genesis.md, tokens.css) that includes an extra review step |
| **`generate == true`** | A manifest flag indicating that a DESIGN agent should generate this artifact from scratch |
| **`generate == false`** | A manifest flag indicating that the user has already provided this artifact; it gets copied, not generated |
| **Dispatcher Pattern** | The architecture used by `/continue` to work around Claude Code's ~4-tool-call per response hook limit |
| **`NEEDS_APPROVAL:`** | A prefix returned by coordinator subagents to signal that the parent orchestrator must display content and ask the user |

---

*Generated from project instructions on 2026-04-09.*
