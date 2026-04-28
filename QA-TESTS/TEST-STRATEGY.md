# Test Strategy for the Claude Code Workflow Template (v2)

A proposal for a layered test suite that exercises every part of the Claude Code workflow/template itself — not a feature built on top of it.

**Goals:**
- Fully automated where possible; clearly-marked manual tier where not
- Each test covers a specific, named behaviour
- Tests are independent and any-time-runnable (own setup, one-time-setup, teardown, one-time-teardown)
- No test depends on another's output
- One file per script/area
- Reusable helpers
- Isolated (no shared state)
- Minimum work per scenario
- **Every test has both a PASS path AND a FAIL path** (proves the test actually distinguishes them)

---

## 0. Executive Summary

This strategy replaces the original "just write Vitest unit tests" approach with a **three-tier pyramid** that composes with the already-present `TEST-GUIDE.md` and `TEST-INPUTS.md` rather than duplicating them:

| Tier | Name | Runs in CI? | Needs live Claude? | Test count target |
|---|---|---|---|---|
| **1** | Pure automation — scripts, hooks, schemas, doc-lint, artifact-lint | Yes | No | ~150 |
| **2** | Log-replay — assertions over harvested `.claude/logs/*.md` | Yes | No (one-time harvest) | ~40 |
| **3** | Live behavioural — the existing `TEST-GUIDE.md` | No (manual / scheduled) | Yes | 38 |

**Key insight:** `TEST-GUIDE.md` is not redundant. It defines the **observable behaviour** Claude must exhibit when the workflow runs for real. What this strategy adds is (a) mechanical tests of the underlying scripts/hooks, and (b) a middle tier that replays logs captured from live runs so that most behavioural assertions can re-run in CI without Claude.

---

## 1. Relationship to the Existing Docs

| Document | Purpose | Tier it serves |
|---|---|---|
| `TEST-GUIDE.md` (3189 lines, 38 tests) | Manual/live test cases. Each has Setup / PASS steps / FAIL steps / How to Test / Rollback / Actual Result | Tier 3 |
| `TEST-INPUTS.md` | Canonical scripted answers for the Team Task Manager scenario + Variants A–F | Shared fixture source for Tiers 2 and 3 |
| `TEST-STRATEGY.md` (this file) | The automated layers underneath — what to build, how to organise it, what conventions to borrow | Tiers 1 and 2 |

**Conventions borrowed verbatim from `TEST-GUIDE.md`:**
- **State Checkpoints CP-0 through CP-6** — named starting states (INTAKE complete, DESIGN complete, etc.). Serialised as tarball fixtures for fast integration-test startup.
- **Rollback IDs RB-0 through RB-7** — standardised cleanup recipes. Each test's `afterEach` cites the rollback it performs.
- **PASS path AND FAIL path for every test** — the single most valuable convention in TEST-GUIDE.md. Every test in this strategy must demonstrate both.
- **Variants A–F** for specific code paths (BFF auth, no-backend, user-provided spec, TypeScript error injection, FRS-override, discovered impacts) — parameterised fixture overlays.
- **Team Task Manager** as the canonical scenario — no need to invent new fixtures.
- **"Depends on" and "Variant" metadata** per test — makes state requirements explicit.
- **"What This Catches" regression table** at the bottom — one-line failure description for each test.

---

## 2. Scope — What Actually Needs Testing

The testable surface splits into 9 categories. Each maps to one of the three tiers:

| # | Test Area | What lives there | Tier |
|---|---|---|---|
| A | **State machine** | `.claude/scripts/transition-phase.js`, `detect-workflow-state.js`, `validate-phase-output.js` | 1 |
| B | **Quality gates runner** | `.claude/scripts/quality-gates.js` | 1 |
| C | **Dashboard & progress generators** | `collect-dashboard-data.js`, `generate-dashboard-html.js`, `generate-progress-index.js`, `generate-todo-list.js`, `generate-traceability-matrix.js` | 1 |
| D | **Import / copy utilities** | `import-prototype.js`, `copy-with-header.js`, `init-preferences.js`, `scan-doc.js` | 1 |
| E | **Permission / safety hooks** | `bash-permission-checker.js`, `claude-md-permission-checker.js` | 1 |
| F | **PowerShell hooks** | `workflow-guard.ps1`, `inject-phase-context.ps1`, `inject-agent-context.ps1`, `capture-context.ps1` | 1 (Pester) |
| G | **Static consistency** | Agent `.md` frontmatter, command `.md` frontmatter, CLAUDE.md / settings.json / README.md cross-refs | 1 |
| H | **JSON schema validation** | `workflow-state.json`, `intake-manifest.json`, `preferences.json` | 1 |
| I | **Artifact lint** (generated `web/src/` code) | No `@ts-ignore`, API path exactness, Shadcn imports, plain-language in QA checklists, role fields in stories | 1 |
| J | **Log-replay invariants** | Tool-call order, approval-content-before-question, dashboard timing, `[Logs saved]` marker, dispatcher pattern ≤3 tool calls | 2 |
| K | **Live behavioural** | Everything in `TEST-GUIDE.md` — the final arbiter of correctness | 3 |

---

## 3. Frameworks

- **Vitest** — already in `web/`. Use for A–E, G, H, I, J.
- **Pester** — PowerShell test runner for F. Native on Windows.
- **ajv** — JSON schema validation for H.
- **Node `child_process`** — subprocess tests in B (exit codes matter).
- **fast-check** (optional) — property-based tests for state-machine invariants.
- **Nothing new in CI** — reuse `.github/workflows/`.

Keep separate from the `web/` Vitest suite — different scope. Put at `./tests/workflow/` with its own `vitest.config.ts`, or as a second Vitest workspace.

---

## 4. File Organisation — One File Per Script

Lean toward **one test file per script**. Scripts are the natural unit, each has real behaviour, and failures are immediately traceable.

```
tests/workflow/
├── vitest.config.ts
├── helpers/
│   ├── temp-project.ts              # Scaffolds a throwaway project dir
│   ├── checkpoint-fixtures.ts       # Loads CP-0..CP-6 tarballs into the temp dir
│   ├── rollback.ts                  # RB-0..RB-7 cleanup recipes by ID
│   ├── state-fixtures.ts            # Pre-built workflow-state.json stubs
│   ├── manifest-fixtures.ts         # Pre-built intake-manifest.json stubs
│   ├── run-script.ts                # Spawns node script, captures stdout/exit
│   ├── git-sandbox.ts               # git init, user, commit helpers
│   ├── parse-session-log.ts         # Reads .claude/logs/*.md, returns tool-call timeline
│   ├── assertions.ts                # toolCallsInOrder(), toolCallCount(), etc.
│   └── schemas/
│       ├── workflow-state.schema.json
│       └── intake-manifest.schema.json
├── fixtures/
│   ├── checkpoints/                 # CP-0.tar, CP-1.tar, ... CP-6.tar
│   ├── scenarios/
│   │   ├── team-task-manager/       # The canonical scenario from TEST-INPUTS.md
│   │   │   ├── answers.json         # Scripted answers for each prompt
│   │   │   ├── manifest-expected.json
│   │   │   ├── frs-expected.md
│   │   │   └── ...
│   │   ├── variant-a-bff/           # Variant A overrides
│   │   ├── variant-b-no-backend/
│   │   ├── variant-c-user-spec/
│   │   ├── variant-d-ts-error/
│   │   ├── variant-e-frs-override/
│   │   └── variant-f-impacts/
│   ├── prototypes/                  # v1 and v2 prototype imports
│   └── golden-logs/                 # Harvested .claude/logs from real runs (for Tier 2)
│       ├── 2026-04-09-full-happy-path.md
│       ├── 2026-04-09-bff-variant.md
│       └── ...
├── tier-1-unit/
│   ├── scripts/
│   │   ├── transition-phase.test.ts
│   │   ├── detect-workflow-state.test.ts
│   │   ├── validate-phase-output.test.ts
│   │   ├── quality-gates.test.ts
│   │   ├── collect-dashboard-data.test.ts
│   │   ├── generate-dashboard-html.test.ts
│   │   ├── generate-progress-index.test.ts
│   │   ├── generate-todo-list.test.ts
│   │   ├── generate-traceability-matrix.test.ts
│   │   ├── scan-doc.test.ts
│   │   ├── copy-with-header.test.ts
│   │   ├── init-preferences.test.ts
│   │   └── import-prototype.test.ts
│   ├── hooks/
│   │   ├── bash-permission-checker.test.ts
│   │   ├── claude-md-permission-checker.test.ts
│   │   └── powershell/
│   │       ├── workflow-guard.Tests.ps1
│   │       ├── inject-phase-context.Tests.ps1
│   │       └── capture-context.Tests.ps1
│   ├── consistency/
│   │   ├── agents-frontmatter.test.ts
│   │   ├── commands-frontmatter.test.ts
│   │   ├── settings-schema.test.ts
│   │   └── cross-doc-references.test.ts
│   ├── schemas/
│   │   ├── workflow-state.test.ts
│   │   └── intake-manifest.test.ts
│   └── artifact-lint/                # Borrowed from TEST-GUIDE tests 32, 33, 34, 38
│       ├── no-suppression-directives.test.ts   # (TG-33)
│       ├── api-path-exactness.test.ts          # (TG-31)
│       ├── shadcn-imports-only.test.ts         # (TG-32)
│       ├── plain-language-checklists.test.ts   # (TG-34)
│       └── role-field-in-stories.test.ts       # (TG-38)
├── tier-2-log-replay/
│   ├── verify-session-behavior.ts              # The parser
│   ├── invariants/
│   │   ├── logs-saved-marker.test.ts           # (TG-1)
│   │   ├── dashboard-timing.test.ts            # (TG-3a..3j)
│   │   ├── two-step-approval.test.ts           # (TG-7)
│   │   ├── askuser-not-for-text-input.test.ts  # (TG-4B)
│   │   ├── q3-combined.test.ts                 # (TG-5)
│   │   ├── developer-called-twice.test.ts      # (TG-19)
│   │   ├── dispatcher-tool-call-limit.test.ts  # (TG-26)
│   │   ├── realign-auto-completes.test.ts      # (TG-15)
│   │   ├── write-tests-gates-approval.test.ts  # (TG-17)
│   │   ├── issues-found-delegates.test.ts      # (TG-22)
│   │   └── clearing-boundaries.test.ts         # (TG-24)
│   └── README.md                                # How to harvest fresh golden logs
└── tier-3-pointer.md                            # Just points to TEST-GUIDE.md
```

---

## 5. Reusable Helpers to Build First

Build these before any test — everything else depends on them:

1. **`createTempProject()`** — copies `.claude/scripts/`, `.claude/policies/`, `.claude/agents/`, etc. into an `os.tmpdir()` dir. Returns `{ root, cleanup }`. Every test gets its own root. **The single biggest investment.**
2. **`loadCheckpoint(root, id)`** — unpacks `fixtures/checkpoints/CP-N.tar` into `root`. Gives Tier 1 integration tests instant access to any named state without running the full workflow.
3. **`applyVariant(root, id)`** — overlays variant files (e.g. Variant C drops `documentation/task-api.yaml` into `root`).
4. **`rollback(root, id)`** — runs RB-0..RB-7. Cited by tests in `afterEach` so intent is explicit.
5. **`seedState(root, state)`** — writes `generated-docs/context/workflow-state.json` with a given phase/epic/story.
6. **`seedManifest(root, overrides)`** — writes a valid intake-manifest with overrides.
7. **`seedArtifact(root, kind, content?)`** — writes FRS / api-spec / story file with sensible defaults.
8. **`runScript(root, path, args[])`** — `spawn` wrapper returning `{ stdout, stderr, exitCode, parsedJson }`.
9. **`gitSandbox(root)`** — `git init`, sets user, returns a commit helper.
10. **`parseSessionLog(path)`** — reads a `.claude/logs/*.md` file and returns a structured timeline: `{ prompts[], toolCalls[], responses[], askUserQuestions[] }`. Used by all of Tier 2.
11. **`assertions.toolCallsInOrder(log, names[])`**, **`.toolCallCount(log, name)`**, **`.askUserQuestionPrecededBy(log, text)`** — composable assertions for Tier 2.
12. **`snapshot(name, value)`** — Vitest snapshot wrapper for dashboard HTML and state transitions.

---

## 6. Isolation Strategy — Temp Dirs, Not Branches

**Don't use git branches per test.** Branches are slow, fight each other on shared working directory, and break parallelism.

**Do use `os.tmpdir()` + per-test directory.** Each test creates its own throwaway project root. That gives:
- True independence (no shared state)
- Parallel safe (Vitest defaults to parallel)
- Fast (hundreds of ms, not seconds)
- Easy cleanup (just `rm -rf` the temp dir)

**Where git matters** — tests covering `git add`/commit behaviour in `transition-phase.js` and the `code-reviewer` Call C simulation. For those, `git init` inside the temp dir is enough. No worktrees of the real repo needed.

**Exception:** verifying "CLAUDE.md still makes sense after a template sync" genuinely needs a worktree. Rare.

---

## 7. Test Shape — AAA With PASS and FAIL Paths

Each test must demonstrate both what passes and what fails. This is the rule `TEST-GUIDE.md` enforces throughout and it's worth preserving verbatim:

```typescript
describe('transition-phase.js — INTAKE → DESIGN transition', () => {
  let root: string; let cleanup: () => void;

  beforeAll(() => { /* resolve paths, load schemas once */ });
  beforeEach(() => ({ root, cleanup } = createTempProject()));
  afterEach(() => { cleanup(); /* cites RB-1 */ });

  // PASS PATH
  it('advances INTAKE → DESIGN when FRS exists', () => {
    seedState(root, { currentPhase: 'INTAKE' });
    seedArtifact(root, 'frs');

    const result = runScript(root, 'transition-phase.js', ['--to', 'DESIGN']);

    expect(result.exitCode).toBe(0);
    expect(result.parsedJson.status).toBe('ok');
    expect(readState(root).currentPhase).toBe('DESIGN');
  });

  // FAIL PATH — proves the test would catch a regression
  it('refuses INTAKE → DESIGN when FRS is missing', () => {
    seedState(root, { currentPhase: 'INTAKE' });
    // Deliberately no FRS

    const result = runScript(root, 'transition-phase.js', ['--to', 'DESIGN']);

    expect(result.parsedJson.status).toBe('error');
    expect(result.parsedJson.message).toMatch(/feature-requirements\.md/i);
    expect(readState(root).currentPhase).toBe('INTAKE'); // unchanged
  });
});
```

Keep each test **< 100ms** where possible. State-machine tests should be sub-10ms.

---

## 8. Test-Metadata Conventions

Borrowed from TEST-GUIDE.md — every test gets these tags/fields:

| Tag / Field | Values | Purpose |
|---|---|---|
| `@unit` / `@integration` / `@log-replay` / `@requires-server` | Tier discriminator | `vitest --tag @unit` for fast feedback |
| `Depends on: CP-N` | Required starting checkpoint | Helper loads the right fixture |
| `Variant: A..F` (optional) | Variant overlay | Helper applies the right overrides |
| `Catches: <one-liner>` | What regression this guards | Feeds the regression table at the bottom |

---

## 9. Minimum-Work Scenarios

For each script, the matrix is roughly:
- **Happy path** (1 test)
- **Each error branch** (1 test each)
- **Each status output** (`ok` / `error` / `warning`) (1 test each)
- **Idempotency** (run twice, second is `status: "exists"`)

For `transition-phase.js` that's ~20 tests. For `quality-gates.js` probably 10. For `bash-permission-checker.js` the permission matrix is table-driven — one `it.each([...])` with 40+ rows covering allow/deny/prompt, plus a fuzz harness.

Resist every-combination testing. Property-based testing (via `fast-check`) is a better fit if broader coverage is wanted.

---

## 10. Tier 1 — Pure Automation Details

Standard Vitest/Pester unit tests. Runs in CI on every PR. Target: ~150 tests, <30 seconds full suite.

### Standout patterns

- **Permission-hook fuzzing.** `bash-permission-checker.js` is security-critical. Run against 200+ adversarial inputs (`rm -rf /` variants, encoded, whitespace tricks, prefix smuggling). Dedicated fuzz harness.
- **Doc-lint / consistency tests.** The biggest rot in a template like this is docs drifting from reality:
  - Every file in `.claude/agents/` has valid frontmatter and a matching entry in `.claude/agents/README.md`
  - Every `/command` referenced in CLAUDE.md exists in `.claude/commands/`
  - Every `subagent_type` referenced in orchestrator-rules.md matches a real agent file
  - The agent list in root `README.md` matches the files on disk
- **State-machine invariants** (property-based):
  - "Any phase sequence the state machine accepts is also accepted by `--repair` from the resulting artifacts"
  - "`--show` after `--init X` reports phase X"
  - "`--repair` is idempotent — running it twice yields identical state"
- **Dashboard snapshot.** Regenerating from a known state should produce byte-identical HTML (modulo timestamps). Catches accidental template changes.
- **JSON schema tests.** Formal schema for `workflow-state.json` and `intake-manifest.json`; validate every fixture against it. Protects against silent schema drift.
- **Artifact-lint tests** — grep-style checks over `web/src/` after an IMPLEMENT phase. These map directly to TEST-GUIDE tests 32, 33, 34, 38:
  - No `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` / `eslint-disable` anywhere
  - All UI imports come from `@/components/ui/`
  - API paths in `web/src/lib/api/endpoints.ts` exactly match `generated-docs/specs/api-spec.yaml`
  - Every `generated-docs/stories/**/story-*.md` has a non-empty `**Role:**` field
  - `generated-docs/qa/**/*-verification-checklist.md` contains no engineering jargon (`tsc`, `ESLint`, `Gate 3`, `isLoading`, `Skeleton`, etc.)

---

## 11. Tier 2 — Log-Replay Invariants (NEW)

This tier is the bridge between "pure automation" and "needs live Claude." Pinched directly from the Tier 2 concept in TEST-GUIDE.md's automation note.

### How it works

1. **Harvest** — A human runs `/start` once end-to-end with the Team Task Manager answers from `TEST-INPUTS.md`. This is `tests/workflow/fixtures/golden-logs/2026-04-09-full-happy-path.md`. Re-harvest after every major change to `orchestrator-rules.md` or `settings.json`.
2. **Parse** — `parse-session-log.ts` converts the markdown log into a structured timeline: an ordered list of `{ type, name, args, timestamp }` events.
3. **Assert** — Each invariant test reads the parsed timeline and asserts on tool-call order, counts, content-before-question, etc. No Claude needed at test time.

### Invariants to assert

| Invariant | Covers TEST-GUIDE test(s) |
|---|---|
| `[Logs saved]` appears as the last non-blank line of every response | TG-1 |
| `generate-dashboard-html.js --collect` fires before any `/clear + /continue` instruction at each of the 5 clearing boundaries | TG-3a, 3c, 3i, 24 |
| Three separate `generate-dashboard-html.js --collect` calls during DESIGN (not one) | TG-3b |
| The `developer` agent is launched exactly 2× per IMPLEMENT (Call A + Call B) | TG-19 |
| The dashboard refresh after IMPLEMENT fires after the 2nd developer call, not the 1st | TG-3h |
| The parent orchestrator makes ≤ 3 tool calls before delegating to a coordinator (dispatcher pattern) | TG-26 |
| `AskUserQuestion` is never used for the elevator-pitch prompt — only plain text | TG-4B |
| Q3 (API + backend) is presented as one `AskUserQuestion` with two headers, not two calls | TG-5 |
| Every `AskUserQuestion` is preceded (within the same response) by content text — no naked approval prompts | TG-7 |
| REALIGN with empty `discovered-impacts.md` produces zero `AskUserQuestion` calls | TG-15 |
| WRITE-TESTS tool calls only appear after the user responds to the TEST-DESIGN approval question | TG-17 |
| On "Issues found" in QA, the orchestrator launches a coordinator agent rather than calling `Edit`/`Write` itself | TG-22 |

### Re-harvesting policy

The golden log is a committed fixture. When it goes stale (orchestrator rules changed, agent prompts updated), a human runs the Tier 3 guide and the resulting log replaces the fixture. A CI test asserts the harvest date is within N days of the last change to `.claude/shared/orchestrator-rules.md` — a stale-log canary.

---

## 12. Tier 3 — Live Behavioural (Existing)

**No changes proposed here — the existing `TEST-GUIDE.md` is the authoritative reference.** 38 tests, manual, run at major releases. Each updates the golden logs for Tier 2.

`tier-3-pointer.md` in the test tree simply says: "See `/TEST-GUIDE.md` and `/TEST-INPUTS.md`. Run the suite before a template release. Re-harvest `tests/workflow/fixtures/golden-logs/` after each full pass."

---

## 13. Things to Add That Neither Doc Mentions

1. **Cross-platform CI matrix.** Run Tier 1 on `ubuntu-latest` and `windows-latest`. Path handling is the #1 source of flakiness.
2. **Performance budgets.** `quality-gates.js --auto-fix` finishes under a known time on a fixed repo. Log the duration; fail if > 2× baseline. Guard against accidental N² walks.
3. **Golden-file tests for generated artifacts.** For `import-prototype.js` v1 and v2, keep a canned input fixture and assert the output tree matches a golden snapshot.
4. **Test the test-runner itself.** Keep one canary test that deliberately fails (`.skip`'d) — if CI ever goes green without running it, the harness is broken.
5. **Dry-run mode.** Consider adding `--dry-run` to `transition-phase.js` and `quality-gates.js`. Makes integration tests vastly cheaper — test logic without side effects.
6. **Hook-off mode for tests.** Add env var `CLAUDE_TEST_MODE=1` that disables the logging hook during tests — otherwise every test will spam `.claude/logs/`. Or point `CLAUDE_PROJECT_DIR` at the temp project so logs go there and are cleaned up with the rest.
7. **PowerShell hook tests (Pester) running on Linux.** Non-trivial — requires `pwsh` in CI. Alternative: rewrite hook logic in Node and shim the PS1 files as thin wrappers. Decide whether hook logic portability is worth it.
8. **Stale-log canary for Tier 2.** Fail if `fixtures/golden-logs/*` is older than `.claude/shared/orchestrator-rules.md`.

---

## 14. What to Skip (At Least Initially)

- **Testing the AI itself.** You can't reliably unit-test "does Claude generate the right code?" — that's for eval harnesses, not unit tests. If that's needed, it's a separate project using Anthropic's eval tooling.
- **Testing agent prompt contents.** Too brittle; they change often. Stick to structural checks (frontmatter valid, tools whitelisted).
- **End-to-end with a real LLM call in CI.** Expensive and flaky. Mock the `Agent` tool boundary; assert the *prompt shape*, not the response.
- **Manual Pass/Fail/Date/Notes boxes** from `TEST-GUIDE.md` — keep those on the Tier 3 guide only. Vitest reports pass/fail for Tiers 1 and 2.
- **Inline `cat > file << EOF` setup scripts.** Fine for a manual guide; in automated tests these become fixture files under `tests/workflow/fixtures/`.
- **CP-based sequential dependency** in Tiers 1 and 2. Each test must be independently runnable (your original brief). Checkpoints are a speed optimisation via tarball fixtures, not a chain.

---

## 15. Proposed Rollout in 3 Waves

Attempting all 11 categories at once will stall. Sequence:

- **Wave 1 (2 days):** Helpers (§5) + State machine (A) + JSON schemas (H) + artifact-lint (I). Biggest risk reduction per hour. ~50 tests.
- **Wave 2 (2 days):** Permission hooks (E) + PowerShell hooks (F) + doc-lint (G) + Tier 2 harness (J, empty-golden log). Security + doc drift + the infrastructure for log-replay. ~60 tests.
- **Wave 3 (2 days):** Quality gates (B) + generators (C) + utilities (D) + populate Tier 2 invariants against a real harvested log. The expensive stuff. ~80 tests.

**Target:** ~190 tests total (150 Tier 1 + 40 Tier 2), <45s full run, <5s watch-mode feedback on hot paths.

Tier 3 runs separately on demand against the existing guide — no new work needed there.

---

## 16. What Each Test Catches (Regression Table)

Condensed from `TEST-GUIDE.md` § Quick Reference, extended with Tier 1 additions. Gives reviewers a one-line justification per test.

| Test area | What it catches if it fails |
|---|---|
| transition-phase.js — happy path | State machine silently accepts invalid transitions |
| transition-phase.js — missing artifact | State machine advances even when prerequisites absent |
| transition-phase.js — idempotency | Re-running `--init` clobbers an existing state file |
| detect-workflow-state.js — from-artifacts | Repair guesses wrong phase when state file missing |
| validate-phase-output.js — per phase | Bad artifacts slip through validation |
| quality-gates.js — all pass | False-positive pass reports |
| quality-gates.js — each failure mode | False-negative failures reported as pass |
| bash-permission-checker.js — deny matrix | Dangerous command slips past deny rules |
| bash-permission-checker.js — fuzz | Novel adversarial input bypasses filter |
| claude-md-permission-checker.js | Silent edit of CLAUDE.md without user approval |
| workflow-guard.ps1 | Dev-work redirects fail; workflow guard silent |
| inject-phase-context.ps1 | Post-compaction restore returns wrong phase context |
| JSON schema — workflow-state | Schema drift breaks existing fixtures |
| JSON schema — intake-manifest | Schema drift breaks existing fixtures |
| Consistency — agents frontmatter | Agent added without YAML frontmatter |
| Consistency — README matches disk | Agent removed but still listed in docs |
| Consistency — CLAUDE.md commands | `/command` referenced in CLAUDE.md doesn't exist |
| Artifact-lint — no suppression (TG-33) | `@ts-ignore` / `eslint-disable` snuck into generated code |
| Artifact-lint — API path exactness (TG-31) | Generated endpoints use guessed paths instead of spec paths |
| Artifact-lint — Shadcn imports (TG-32) | Hand-crafted component used instead of Shadcn MCP |
| Artifact-lint — plain language (TG-34) | Engineering jargon leaks into user-facing checklists |
| Artifact-lint — role field (TG-38) | Story file missing `**Role:**` declaration |
| Dashboard generator — snapshot | Dashboard template silently changed |
| Generator — progress index | Progress index stops updating on write |
| Import-prototype v1 | v1 layout detection regression |
| Import-prototype v2 | v2 (Pencil/.pen) detection regression |
| Copy-with-header | File copied without source-traceability header |
| Init-preferences | Git-preference flags not persisted |
| Tier 2 — `[Logs saved]` (TG-1) | Session-logging hook silently broken |
| Tier 2 — dashboard before clear (TG-3a/3c/3i) | Dashboard updates after clearing instruction |
| Tier 2 — three DESIGN dashboard fires (TG-3b) | DESIGN dashboard update collapsed to one |
| Tier 2 — dashboard after Call B (TG-3h) | Dashboard reflects unfinished code |
| Tier 2 — Q3 combined (TG-5) | Q3 split into two `AskUserQuestion` calls |
| Tier 2 — no AskUserQuestion for text (TG-4B) | Elevator-pitch prompt forced into buttoned choices |
| Tier 2 — two-step approval (TG-7) | Approval prompt appears without content to review |
| Tier 2 — developer called 2× (TG-19) | Pre-flight test check skipped |
| Tier 2 — dispatcher ≤3 calls (TG-26) | Parent exceeds tool-call limit before delegating |
| Tier 2 — REALIGN auto-complete (TG-15) | REALIGN pauses for approval with no impacts |
| Tier 2 — WRITE-TESTS gates approval (TG-17) | Tests written before user approves design |
| Tier 2 — issues-found delegates (TG-22) | Orchestrator edits files directly instead of delegating |
| Tier 2 — clearing boundaries (TG-24) | Extra `/clear` at non-boundary phase; missing at boundary |
| Tier 3 — (full guide) | Anything the mechanical layers miss |

---

## 17. Summary of Decisions

| Decision | Recommendation |
|---|---|
| Model | Three-tier pyramid (Tier 1 unit + Tier 2 log-replay + Tier 3 live) |
| Relationship to TEST-GUIDE.md | Complementary — Tier 3 points to it verbatim |
| Relationship to TEST-INPUTS.md | Shared fixture source for Tiers 2 and 3 |
| Framework | Vitest (JS) + Pester (PowerShell) |
| Location | `tests/workflow/` (separate from `web/` tests) |
| File granularity | One test file per script |
| Isolation | `os.tmpdir()` per test (NOT git branches) |
| Git per test | Only when testing commit/add behaviour — `git init` in temp dir |
| Test shape | AAA with beforeEach/afterEach, **PASS and FAIL paths required** |
| Fixtures | Team Task Manager + Variants A–F + CP-0..CP-6 tarballs |
| Rollback | Named RB-0..RB-7 helpers cited in `afterEach` |
| First investment | The 12 reusable helpers — everything else depends on them |
| First wave | State machine + JSON schemas + artifact-lint |
| Second wave | Permission hooks + PS hooks + doc-lint + Tier 2 harness |
| Third wave | Generators + utilities + populated Tier 2 invariants |
| Target size | ~190 tests (150 Tier 1 + 40 Tier 2), <45s full run |
| Skip for now | LLM content, agent prompt bodies, real-agent E2E in CI |
