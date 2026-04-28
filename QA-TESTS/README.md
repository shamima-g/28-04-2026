# QA — Test Suite for the Claude Code Workflow Template

> **Naming note:** This folder is named `QA/` because it contains the quality-assurance test suite for the template infrastructure itself. **Do not confuse** this with the workflow's per-story **QA phase** (§ 9 of `CLAUDE.md`) — that phase runs inside the TDD workflow and is owned by the `code-reviewer` agent. These tests exist outside the workflow entirely; they verify the scripts, hooks, schemas, and agents that make the workflow work.

Tests the **template itself** (scripts, hooks, schemas, agent/command definitions), not a feature built on top of it. Implements the three-tier strategy in `/TEST-STRATEGY.md`.

## Tiers

| Tier | Folder | Runs in CI? | Needs Claude? | Purpose |
|---|---|---|---|---|
| 1 | `tier-1-unit/` | Yes | No | Pure automation — scripts, hooks, schemas, doc-lint, artifact-lint |
| 2 | `tier-2-log-replay/` | Yes | No (harvest once) | Parses `.claude/logs/*.md` and asserts tool-call order / timing invariants |
| 3 | `tier-3-pointer.md` | No (manual) | Yes | Points to `/TEST-GUIDE.md` — the authoritative live behavioural suite |

## Running

```bash
# From repository root
cd QA
npm install

# All Tier 1 + Tier 2 tests
npm test

# Watch mode
npm run test:watch

# Specific tier
npm run test:tier1
npm run test:tier2

# Specific tag
npx vitest --testNamePattern "@unit"

# PowerShell hooks (Windows only — requires Pester v5, see below)
npm run test:pester
```

### Pester v5 prerequisite (one-time, Windows only)

The PowerShell hook tests require Pester v5. Windows ships with Pester v3.4, which does not understand the v5 syntax these tests use (`BeforeAll` at script scope, `Should -Match`, etc.). Install v5 side-by-side under the current user:

```powershell
pwsh -Command "Install-Module Pester -Scope CurrentUser -Force -SkipPublisherCheck -MinimumVersion 5.0"
```

Verify:

```powershell
pwsh -Command "Get-Module -ListAvailable Pester | Select-Object Name,Version"
```

`npm run test:pester` forces the v5 import so the bundled v3.4 does not take precedence.

## Conventions

Every test follows `TEST-GUIDE.md` conventions:

- **PASS path AND FAIL path** — every `describe` block has both an `it('works when ...')` and an `it('fails when ...')` case, proving the test distinguishes them.
- **Independent** — each test owns its setup and teardown. No shared state. No dependency on order.
- **Isolated** — uses `os.tmpdir()` per test (never git branches).
- **Fast** — Tier 1 tests target < 100 ms each. State-machine tests aim for < 10 ms.
- **Cited rollback** — `afterEach` calls `rollback(root, 'RB-N')` where N is the rollback ID from `TEST-GUIDE.md`.

## Folder Map

```
QA/
├── helpers/                  Reusable helpers (12 files)
│   ├── temp-project.ts       createTempProject() — per-test tmpdir
│   ├── checkpoint-fixtures.ts  loadCheckpoint() — CP-0..CP-6 starting states
│   ├── rollback.ts           RB-0..RB-7 cleanup recipes
│   ├── state-fixtures.ts     seedState()
│   ├── manifest-fixtures.ts  seedManifest()
│   ├── run-script.ts         spawn wrapper returning { exitCode, parsedJson }
│   ├── git-sandbox.ts        git init + commit helpers
│   ├── parse-session-log.ts  parses .claude/logs/*.md into an event timeline
│   ├── assertions.ts         toolCallsInOrder(), toolCallCount(), ...
│   ├── snapshot.ts           dashboard snapshot helper
│   ├── index.ts              barrel export
│   └── schemas/              JSON schemas for state files
├── fixtures/                 Test inputs
│   ├── scenarios/            Team Task Manager + Variants A..F
│   ├── checkpoints/          CP-N tarballs (generated; see README there)
│   └── golden-logs/          Harvested .claude/logs/*.md for Tier 2
├── tier-1-unit/              Pure-automation tests
│   ├── scripts/              One file per .claude/scripts/*.js
│   ├── hooks/                Node hooks + PowerShell hooks (Pester)
│   ├── consistency/          Static doc-lint — frontmatter, cross-file refs
│   ├── schemas/              JSON schema validation against fixtures
│   └── artifact-lint/        Grep-style checks over generated web/src/ code
├── tier-2-log-replay/        Assertions over harvested session logs
│   ├── verify-session-behavior.ts   The parser
│   └── invariants/                   One file per invariant (TG-1, TG-3a, ...)
├── tier-3-pointer.md         Pointer to TEST-GUIDE.md
├── vitest.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## How It Runs Without Installing Into the Repo

`QA/` is a **self-contained npm workspace** — its own `package.json` and `node_modules`. Tests import from the parent repo by path (`../.claude/scripts/...`). You never install anything into `/web` or `/` for the test suite to work.

## Current Status

This is a **scaffolded skeleton** with representative tests wired up. See each folder's header comment for which tests are fully implemented vs stubbed with TODO markers. Tier 1 coverage focuses on:

- State machine (transition-phase.js) — full
- Script utilities (copy-with-header, scan-doc, init-preferences) — full
- Permission hooks (bash-permission-checker) — substantial
- Consistency (agents frontmatter, cross-doc refs) — full
- Schemas (workflow-state, intake-manifest) — full
- Artifact lint — all 5 TEST-GUIDE categories implemented as fixture-based tests

Tier 2 includes the parser and two fully implemented invariants (`logs-saved-marker`, `dashboard-timing`). The remaining invariants are stubbed showing the expected shape.

Tier 3 is a pointer to `/TEST-GUIDE.md` — no new work needed.

## Contributing

To add a test:

1. Pick the right tier folder.
2. Create `<script-name>.test.ts` (one file per thing under test).
3. Write both a PASS and a FAIL path for every behaviour.
4. Use `createTempProject()` from `helpers/` — never write to the repo.
5. Cite the rollback ID (`rollback(root, 'RB-N')`) in `afterEach`.
6. Add a row to the regression table in `/TEST-STRATEGY.md` § 16.
