# Guide me how to proceed with test in QA-Tests (2026-04-28 07:33Z)

**Project:** 28-04-2026
**Session ID:** 8a9226ab-71f7-4990-87cc-01ab0fdc0ebd
**Started:** 2026-04-28 07:33Z
**Permission Mode:** 

---


_**User: shamima-g (2026-04-28 07:33Z)**_

Guide me how to proceed with test in QA-Tests


_**Agent (model claude-opus-4-7)**_



Bash: List QA-TESTS folder contents

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Read_

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Read_

---

_**Agent (model claude-opus-4-7)**_



Bash: Check if QA-TESTS deps installed and list tier folders

---

_**Agent (model claude-opus-4-7)**_

Here's how to proceed with the `QA-TESTS/` suite. This folder tests the **workflow template itself** (scripts, hooks, schemas, agents) â€” it's separate from the main `web/` project and the per-story QA phase. Note: dependencies aren't installed yet.

## Step 1 â€” Install dependencies

```bash
cd QA-TESTS
npm install
```

This is a self-contained workspace (own `package.json`, own `node_modules`). It won't touch `/web` or the repo root.

## Step 2 â€” Pick which tier to run

| Command | What runs | When to use |
|---|---|---|
| `npm test` | Tier 1 + Tier 2 (Vitest) | Full automated pass â€” start here |
| `npm run test:tier1` | Pure unit tests (scripts, hooks, schemas, doc-lint, artifact-lint) | Fastest; run while iterating on a script/hook |
| `npm run test:tier2` | Log-replay (parses `.claude/logs/*.md` for tool-call order/timing invariants) | When validating session-log invariants |
| `npm run test:watch` | Vitest watch mode | While editing a single test file |
| `npm run test:pester` | PowerShell hook tests (Windows) | Only when changing `.claude/hooks/*.ps1` |

## Step 3 â€” One-time Pester v5 setup (only if running `test:pester`)

Windows ships with Pester v3.4 which won't parse v5 syntax. Install v5 side-by-side:

```powershell
pwsh -Command "Install-Module Pester -Scope CurrentUser -Force -SkipPublisherCheck -MinimumVersion 5.0"
```

## Step 4 â€” Tier 3 (manual / live behavioral)

Tier 3 isn't automated. [tier-3-pointer.md](QA-TESTS/tier-3-pointer.md) points at [TEST-GUIDE.md](QA-TESTS/TEST-GUIDE.md) â€” that's the authoritative live suite, executed by a human driving Claude through real workflows.

## Recommended first run

```bash
cd QA-TESTS && npm install && npm test
```

If you want, I can run the install and the Tier 1 suite now and report the results â€” say the word.

[Logs saved]

---


_**User: shamima-g (2026-04-28 07:34Z)**_

yes proceed


_**User: shamima-g (2026-04-28 07:37Z)**_

open each failing test and diagnose precisely what to change


#### Permission Request - 2026-04-28 07:38Z

**Tool:** `Bash`

---


#### Permission Request - 2026-04-28 07:39Z

**Tool:** `Bash`

---


_**Agent (model claude-opus-4-7)**_



_Tools used: ToolSearch_

---

_**Agent (model claude-opus-4-7)**_



Update Todos
[*] Diagnose agents-frontmatter test failure
[ ] Diagnose commands-frontmatter test failure
[ ] Diagnose cross-doc-references test failure
[ ] Diagnose bash-permission-checker deny-matrix failure
[ ] Diagnose stale-log-canary failure
[ ] Identify the 6th (clipped) failing test

---

_**Agent (model claude-opus-4-7)**_

Re-running with verbose output so I can see the 6th clipped failure, and reading each failing test source in parallel.

---

_**Agent (model claude-opus-4-7)**_



Bash: Get full list of failing tests

---

_**Agent (model claude-opus-4-7)**_

Got all 6 failures identified. Now reading each failing test and its source in parallel.

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Read_

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Read_

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Read_

---

_**Agent (model claude-opus-4-7)**_



Bash: List agent files on disk

---

_**Agent (model claude-opus-4-7)**_



Bash: List command files on disk

---

_**Agent (model claude-opus-4-7)**_



Bash: Check frontmatter of api-* commands

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Read_

---

_**Agent (model claude-opus-4-7)**_



Update Todos
[x] Diagnose agents-frontmatter test failure
[x] Diagnose commands-frontmatter test failure
[x] Diagnose cross-doc-references test failure
[*] Diagnose bash-permission-checker deny-matrix failure
[ ] Diagnose stale-log-canary failure
[x] Confirm there are exactly 6 failures (none clipped/missing)

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Read_

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Read_

---

_**Agent (model claude-opus-4-7)**_



Bash: Compare timestamps between golden logs and source rules

---

_**Agent (model claude-opus-4-7)**_



Bash: Read golden-logs README for context

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Grep_

---

_**Agent (model claude-opus-4-7)**_



_Tools used: Read_

---

_**Agent (model claude-opus-4-7)**_

Now checking the root README.md and `.claude/agents/README.md` to confirm what references are missing.

---

_**Agent (model claude-opus-4-7)**_



Bash: Check which agents are referenced in agents/README

---

_**Agent (model claude-opus-4-7)**_



Bash: Count missing-agent references

---

_**Agent (model claude-opus-4-7)**_



Update Todos
[x] Diagnose agents-frontmatter test failure
[x] Diagnose commands-frontmatter test failure
[x] Diagnose cross-doc-references test failure
[x] Diagnose bash-permission-checker deny-matrix failure
[x] Diagnose stale-log-canary failure
[x] Confirm there are exactly 6 failures (none clipped/missing)

---

_**Agent (model claude-opus-4-7)**_

Diagnosis complete. Here's the precise change required for each failure.

---

## 1 â€” [agents-frontmatter.test.ts:66](QA-TESTS/tier-1-unit/consistency/agents-frontmatter.test.ts#L66)

> Test: `every agent file has a matching entry in README.md`
> Where the README check runs against: `.claude/agents/README.md`

The test does a plain `readme.includes(stem)` check. Two agent files exist but are not referenced anywhere in [.claude/agents/README.md](.claude/agents/README.md):

- [.claude/agents/mock-setup-agent.md](.claude/agents/mock-setup-agent.md)
- [.claude/agents/spec-compliance-watchdog.md](.claude/agents/spec-compliance-watchdog.md)

**Fix:** Add both agents to the table near the top of `.claude/agents/README.md` (under their phases) and add a `**File:** [<name>.md](<name>.md)` entry in the per-agent section. From the existing table, `mock-setup-agent` belongs in DESIGN (between `type-generator-agent` and the SCOPE row); `spec-compliance-watchdog` belongs in QA (alongside `code-reviewer`).

---

## 2 â€” [commands-frontmatter.test.ts:29](QA-TESTS/tier-1-unit/consistency/commands-frontmatter.test.ts#L29)

> Tests: `/api-go-live has a non-empty description`, `/api-mock-refresh has a non-empty description`

Both files have NO YAML frontmatter at all â€” they start with `# /api-go-live` instead of `---`. Compare with [.claude/commands/api-status.md](.claude/commands/api-status.md), which has the correct shape.

**Fix:** Prepend a frontmatter block to each file. Length must be > 10 chars.

For [.claude/commands/api-go-live.md](.claude/commands/api-go-live.md):

```yaml
---
description: Switch from MSW mocks to the live backend and generate a manual verification checklist
---
```

For [.claude/commands/api-mock-refresh.md](.claude/commands/api-mock-refresh.md):

```yaml
---
description: Regenerate MSW handlers for endpoints whose OpenAPI spec has changed since the last sync
---
```

---

## 3 â€” [cross-doc-references.test.ts:57](QA-TESTS/tier-1-unit/consistency/cross-doc-references.test.ts#L57)

> Test: `README.md references every real agent at least once` (this checks the **root** [README.md](README.md))

Root README does not mention these 5 agents:

- `mock-setup-agent`
- `prototype-review-agent`
- `spec-compliance-watchdog`
- `test-designer`
- `type-generator-agent`

**Fix:** Open root [README.md](README.md), find the agents/workflow section, and ensure each name appears at least once. The simplest patch is to add a complete agent table mirroring `.claude/agents/README.md`, or extend an existing list. A literal substring match is enough â€” no link required.

---

## 4 â€” [bash-permission-checker.test.ts:62](QA-TESTS/tier-1-unit/hooks/bash-permission-checker.test.ts#L62)

> Test: `FAIL safely (must deny): grep password credentials.json â€” credentials file`
> Got: `fallthrough` â€” Want: `deny`

Root cause is in [.claude/hooks/bash-permission-checker.js:430](.claude/hooks/bash-permission-checker.js#L430):

```js
'grep\\b[^|;&]*\\s+\\S*[/\\\\]credentials(?:\\.\\w+)?' + segEnd,
```

The `\S*[/\\]` requires at least one path separator before `credentials`. The test command `grep password credentials.json` passes `credentials.json` as a bare leaf with **no path prefix**, so the regex never matches. Compare with the `dotEnvLeaf` in line 421, which correctly uses `(?:\S*[/\\])?` (optional prefix).

**Fix:** Change line 430 from:

```js
'grep\\b[^|;&]*\\s+\\S*[/\\\\]credentials(?:\\.\\w+)?' + segEnd,
```

to:

```js
'grep\\b[^|;&]*\\s+(?:\\S*[/\\\\])?credentials(?:\\.\\w+)?' + segEnd,
```

That makes the path-separator group optional so a bare `credentials` / `credentials.json` leaf is matched too. The same shape should arguably also be applied to the sibling `id_rsa` / `private_key` patterns on lines 426 and 431 if you want consistency, but only line 430 is currently failing. Re-run [bash-permission-checker.test.ts](QA-TESTS/tier-1-unit/hooks/bash-permission-checker.test.ts) afterward â€” the existing `cat ~/.ssh/id_rsa`, `sed -n 1p credentials`, etc. cases still pass because they hit the broader `fileReadCmds` deny rule on line 372.

---

## 5 â€” [stale-log-canary.test.ts:20](QA-TESTS/tier-2-log-replay/invariants/stale-log-canary.test.ts#L20)

> Test: `newest golden log is newer than orchestrator-rules.md and settings.json`

Confirmed by stat:
- [.claude/shared/orchestrator-rules.md](.claude/shared/orchestrator-rules.md) mtime: **2026-04-28 11:30**
- [.claude/settings.json](.claude/settings.json) mtime: **2026-04-28 11:30**
- Newest `*.md` in [QA-TESTS/fixtures/golden-logs/](QA-TESTS/fixtures/golden-logs/): **README.md, 2026-04-22 15:18**

That folder has **only** [QA-TESTS/fixtures/golden-logs/README.md](QA-TESTS/fixtures/golden-logs/README.md). There are no actual harvested logs. The freshness check in [verify-session-behavior.ts:67](QA-TESTS/tier-2-log-replay/verify-session-behavior.ts#L67) treats `README.md` as a candidate log file, so it goes into the "stale" branch instead of the empty-directory short-circuit on line 71.

There are two valid fixes â€” pick one:

- **(a) Fix the test helper (recommended):** in [verify-session-behavior.ts:67-69](QA-TESTS/tier-2-log-replay/verify-session-behavior.ts#L67-L69) exclude `README.md` from the candidate set:
  ```ts
  .filter(f => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
  ```
  After this change the directory is "empty of real logs" and the test's existing skip branch on line 16 takes over.
- **(b) Re-harvest:** follow [QA-TESTS/fixtures/golden-logs/README.md](QA-TESTS/fixtures/golden-logs/README.md) â€” run a full `/start` â†’ commit cycle, then copy `.claude/logs/<session>.md` into the folder. This is the canonical answer the test was designed to demand, but it requires running the workflow end-to-end and is much more work.

---

## Summary table

| # | File to edit | Change |
|---|---|---|
| 1 | [.claude/agents/README.md](.claude/agents/README.md) | Add table rows + file refs for `mock-setup-agent` and `spec-compliance-watchdog` |
| 2a | [.claude/commands/api-go-live.md](.claude/commands/api-go-live.md) | Prepend `---\ndescription: â€¦\n---\n` block |
| 2b | [.claude/commands/api-mock-refresh.md](.claude/commands/api-mock-refresh.md) | Prepend `---\ndescription: â€¦\n---\n` block |
| 3 | [README.md](README.md) | Mention all 5 agents at least once |
| 4 | [.claude/hooks/bash-permission-checker.js:430](.claude/hooks/bash-permission-checker.js#L430) | Change `\S*[/\\]credentials` â†’ `(?:\S*[/\\])?credentials` |
| 5 | [QA-TESTS/tier-2-log-replay/verify-session-behavior.ts:68](QA-TESTS/tier-2-log-replay/verify-session-behavior.ts#L68) | Exclude `README.md` from log candidates (recommended) â€” or re-harvest a real log |

Want me to apply any/all of these fixes? #1, #2, #4, and #5(a) are deterministic single-file edits I can do safely. #3 needs a touch more judgment about where in [README.md](README.md) the agent list should live â€” I'd want to look at the current README structure before editing.

[Logs saved]

---


_**User: shamima-g (2026-04-28 07:40Z)**_

Commit and push all

