# QA Maintenance — Keeping Tests and Docs in Sync with the Template

A pocket kit of prompts for updating the QA test suite (`QA/`) and the
four template-level documents (`TEST-STRATEGY.md`, `TEST-GUIDE.md`,
`TEST-INPUTS.md`, `HOW-IT-WORKS.md`) whenever the `.claude/` template
itself changes.

The template evolves — new scripts, renamed agents, changed phases,
updated hooks. When it does, two things go stale:

1. The **QA suite** under `QA/` — automated tests that encode
   template invariants (agent names, script outputs, settings shape).
2. The **template docs** at repo root — human-readable descriptions
   of phases, agents, hooks, and test conventions. These are also
   the context Claude itself reads when running the workflow, so
   drift here actively misleads future sessions.

Both need to follow the template. This file is the playbook.

---

## Guiding principles

- **Every prompt separates "test bug" from "template regression."**
  When a test fails after a template change, it's either the test
  that needs updating (template moved on) or the template that
  broke (test caught a real regression). Never let a prompt
  blindly rewrite assertions to make failures go away — that defeats
  the point of having tests.
- **Docs drift is worse than test drift.** `TEST-GUIDE.md` and
  `HOW-IT-WORKS.md` are context Claude reads during workflow runs.
  If they lie, future sessions follow wrong instructions.
- **Triage before fixing.** The first prompt in each kit is always
  a diagnose-only pass. Read its report, then pick the targeted
  fix prompt. Don't skip straight to "update everything."
- **Cross-references cascade.** `TEST-STRATEGY` quotes IDs
  (CP-0..CP-6, RB-0..RB-7, Variants A-F) from `TEST-GUIDE` and
  `TEST-INPUTS`. A change in one often needs a ripple-fix in the
  others. Prompt 8 of the Docs kit is the consistency checker.
- **Commits stay focused.** Docs are long; mixing unrelated edits
  into one commit makes `git blame` useless later. Commit per
  concern.

---

## Recommended order after any template change

1. **Docs kit Prompt 1** → drift report for the four docs.
2. **QA kit Prompt 1** → triage of failing tests.
3. Fix `HOW-IT-WORKS.md` first if it's wrong — it's the
   source-of-truth doc Claude reads as context. Bad info here
   poisons subsequent fixes.
4. Fix QA tests that reference now-correct behavior.
5. Fix `TEST-STRATEGY.md` / `TEST-GUIDE.md` / `TEST-INPUTS.md`.
6. **Docs kit Prompt 8** → cross-consistency check.
7. **Docs kit Prompt 9 and QA kit Prompt 9** for residual
   follow-the-template housekeeping.

---

# Part 1 — QA Kit

Prompts for updating `QA/**/*.test.ts` and helpers when the template
changes.

## Q1. Diagnose drift after any template change

Run this whenever `npm test` in `QA/` has new failures and you don't
know why.

```
The template files under .claude/ have changed recently. Run
`cd QA && npm test` and classify each failure as one of:

  (a) TEST BUG — the test encodes an assumption about the old template
      that's no longer accurate. The template change is intentional and
      correct; the test needs to follow.
  (b) TEMPLATE REGRESSION — the test is still correct; something in
      .claude/ broke or drifted unintentionally.
  (c) CONTENT DRIFT — a README or docs file fell out of sync with
      .claude/agents/, .claude/commands/, or similar. Fix the docs.

For each failure, quote: the test file + line, the script/file it's
checking, the actual vs. expected output, and your classification
with one-sentence justification. Don't fix anything yet. Just triage.
```

## Q2. New agent added to `.claude/agents/`

```
I added a new agent at .claude/agents/<FILENAME>.md. Update:

  (1) .claude/agents/README.md — add an entry in the same format as
      the other agents there.
  (2) Root README.md — add the agent to any agent table/list.
  (3) Confirm the agent's frontmatter has `name` (matching filename
      stem) and a `description` field longer than 20 chars — that's
      what QA/tier-1-unit/consistency/agents-frontmatter.test.ts
      checks.

Then run `cd QA && npm test tier-1-unit/consistency` and paste the
summary. No other edits — do not alter tests.
```

## Q3. Agent renamed or removed

```
An agent under .claude/agents/ was renamed/removed:
  old: <OLD-NAME>
  new: <NEW-NAME or DELETED>

Find every reference to the old name in:
  - .claude/agents/README.md
  - Root README.md
  - .claude/commands/*.md (some commands spawn specific agents)
  - .claude/CLAUDE.md / .template-docs/
  - QA/tier-1-unit/ (search test files for hardcoded agent names)

Update or remove each reference. If QA tests mention the old name
explicitly (not via listAgentFiles() iteration), update them — those
aren't "test bugs," they're correctly encoding the invariant and just
need the new name. Then run `cd QA && npm test` and report.
```

## Q4. New script added to `.claude/scripts/`

```
I added a new script at .claude/scripts/<FILENAME>.js. There's no
test for it yet. Using the other script tests in QA/tier-1-unit/scripts/
as reference (same PASS/FAIL describe pattern, uses runScript() and
createTempProject() helpers), write a new test file at
QA/tier-1-unit/scripts/<FILENAME>.test.ts that covers:

  - Happy path: run with expected args, seed any prerequisite
    artifacts (via seedArtifact), assert the JSON output shape.
  - At least one failure path: wrong args, missing prerequisites,
    or invalid input — assert the script exits non-zero or returns
    status=error.
  - Edge cases the script's header comment documents.

Do NOT assume behavior — read the script first and test what it
actually does. Then run the new test file in isolation and fix any
issues.
```

## Q5. Existing script's behavior changed

```
.claude/scripts/<FILENAME>.js has been updated. Changes:
<PASTE CHANGE SUMMARY or commit message>

The QA test QA/tier-1-unit/scripts/<FILENAME>.test.ts may now be
out of date. For each assertion in that test file, decide:

  - Does the change make the old expectation wrong? → update the
    test to match the new behavior, add a code comment linking to
    the reason (commit, issue, or one-line rationale).
  - Does the change break an invariant the test was correctly
    enforcing (e.g., output shape, exit code contract)? → this is
    a regression; STOP and report back for a decision rather than
    relaxing the test.

Show me the diff before committing.
```

The "stop and report back" line is the important one — without it,
Claude will quietly loosen assertions to make failures go away.

## Q6. New slash command added to `.claude/commands/`

```
I added a new slash command at .claude/commands/<NAME>.md. The QA
suite's commands-frontmatter test iterates every file in that
folder and requires:
  - Valid YAML frontmatter
  - A `description:` field longer than 10 chars

Confirm the new command's frontmatter meets both. Then run
`cd QA && npm test tier-1-unit/consistency/commands-frontmatter.test.ts`
and report. No test changes should be needed.
```

## Q7. Workflow state machine changed (phases, transitions, artifacts)

This is the scariest category — the fixture helpers hardcode the
state/artifact shape.

```
The workflow state machine changed in one or more of these ways:
  - New phase added
  - Phase renamed or removed
  - VALID_TRANSITIONS edited in .claude/scripts/transition-phase.js
  - Artifact locations moved (e.g., FRS path, manifest path)
  - intake-manifest.json schema changed

Audit the QA helpers and tests for hardcoded assumptions:
  - QA/helpers/state-fixtures.ts — Phase union type, DEFAULT_STATE,
    seedArtifact's `kind` union and the paths each case writes to.
  - QA/helpers/manifest-fixtures.ts — manifest shape.
  - QA/tier-1-unit/scripts/transition-phase.test.ts — hardcoded
    phase names in seedState calls and --to targets.
  - QA/tier-1-unit/scripts/validate-phase-output.test.ts — hardcoded
    phase names passed to --phase.

Produce a checklist of every place the old shape is embedded, propose
updates, and WAIT for approval before editing — these helpers are
shared infrastructure and a wrong edit cascades through the whole suite.
```

## Q8. `.claude/settings.json` changed (hooks, permissions)

```
.claude/settings.json was modified. Check:

  (1) QA/tier-1-unit/consistency/settings-schema.test.ts still passes —
      especially the "hook files exist" check, which parses hook
      commands with a regex.
  (2) If a new hook was wired up, there should be a matching test
      under QA/tier-1-unit/hooks/<HOOK-NAME>.test.ts. If absent,
      draft one based on the pattern in existing hook tests
      (spawnSync with JSON stdin, assert exit code + stdout).
  (3) If deny/allow rules changed, check
      QA/tier-1-unit/hooks/bash-permission-checker.test.ts —
      its DENY_CASES / ALLOW_CASES matrix may need new rows.

Report gaps; don't fix yet.
```

## Q9. Accept-the-new-reality escape hatch

For when a batch of failures are all "template moved on, update the
tests":

```
I'm accepting that these failures reflect intentional template
changes, not bugs:
  <list of failing test names>

Update each test to match the current behavior. For every edit, add
a one-line code comment stating WHY it changed (e.g., "// phase
VALIDATE renamed to QA in <commit-sha>"). No comments without a
concrete reason. Run `cd QA && npm test` and report the final count.
```

---

# Part 2 — Docs Kit

Prompts for updating the four template-level docs:

| File | Contains | Who reads it |
|---|---|---|
| `TEST-STRATEGY.md` | Three-tier pyramid, 9 test areas, helper conventions, directory layout | You + Claude (planning) |
| `TEST-GUIDE.md` | 38 numbered tests with Setup / PASS / FAIL / Rollback sections. RB-0..RB-7 library. "What This Catches" table | You + Claude (behavioral reference) |
| `TEST-INPUTS.md` | Canonical Team Task Manager scenario + Variants A–F scripted answers | You + Claude (fixture source) |
| `HOW-IT-WORKS.md` | Architecture: phase machine, agent roles, hook flow, state files | You + Claude (onboarding + runtime context) |

## D1. Detect doc drift

Run this after any template change, before touching any individual
doc.

```
The template under .claude/ has changed. Check the four template-level
docs for drift:

  TEST-STRATEGY.md
  TEST-GUIDE.md
  TEST-INPUTS.md
  HOW-IT-WORKS.md

For each doc, produce a table of:
  - Line range that's now factually wrong
  - What the doc currently claims
  - What the template now does
  - Severity: BREAKING (Claude would follow outdated instructions),
    MISLEADING (humans would misread), COSMETIC (line numbers /
    counts only)

Don't edit anything. Report. I'll choose which to fix and in what
order based on severity.
```

## D2. New / renamed / removed script under `.claude/scripts/`

```
A script under .claude/scripts/ was <added | renamed | removed>:
  <details>

Update:

  (1) TEST-STRATEGY.md Section 2 — the "9 categories" table (A-I)
      maps scripts to tiers. Add/rename/remove the row. If a new
      category is warranted, propose the letter and justify.
  (2) TEST-STRATEGY.md Section 4 ("Proposed directory layout") —
      the tier-1-unit/scripts/ listing.
  (3) TEST-GUIDE.md — grep for the old script name; update or
      remove any test steps that invoke it.
  (4) HOW-IT-WORKS.md — if the script is part of the user-visible
      workflow (phase transitions, dashboard, etc.), update the
      description.

Do NOT invent behavior — read the script header comment for its
actual purpose. Show me the diffs before committing.
```

## D3. New / changed phase in the workflow state machine

The highest-blast-radius change — every doc has phase-dependent
sections.

```
The workflow state machine changed:
  <describe: new phase added | phase renamed | transitions edited>

This cascades through all four docs. Update in this order:

  (1) HOW-IT-WORKS.md — the phase-machine section (diagram + prose).
      This is the source of truth; get it right first.
  (2) TEST-STRATEGY.md — the "State Checkpoints CP-0..CP-6" list
      (section "Conventions borrowed from TEST-GUIDE.md") may need
      a new checkpoint for the new phase.
  (3) TEST-GUIDE.md — for each of the 38 tests, check whether:
        - A new test is needed for the new phase
        - An existing test's Setup / PASS / FAIL steps reference
          an obsolete phase name
        - The rollback (RB-0..RB-7) section needs a new recipe
      Produce a checklist before editing en masse.
  (4) TEST-INPUTS.md — if the canonical scenario or any Variant
      exercises the changed phase, the scripted answers may need
      new or removed entries.

Then re-run the drift prompt (D1) to catch anything missed.
```

## D4. New / renamed / removed agent under `.claude/agents/`

```
An agent changed in .claude/agents/:
  <details>

Update:

  (1) HOW-IT-WORKS.md — the agent catalog section. Add/rename/remove
      the entry; describe when the agent is spawned and by whom.
  (2) TEST-GUIDE.md — grep for the old/new name. Any behavioral
      test that asserts "subagent X was launched" references a
      specific agent; update it.
  (3) TEST-INPUTS.md — if the agent prompts the user for input
      during its flow, the canonical / variant answers may need
      updating.
  (4) TEST-STRATEGY.md Section 2 — rarely needs changes for agent
      edits, but check if the "Test Area" table mentions the agent.

Read the agent's frontmatter description and tool list before
writing — don't paraphrase from memory.
```

## D5. New Variant or canonical-scenario change

```
The canonical test scenario changed:
  <Variant A-F modified | new variant added | Team Task Manager
  scenario replaced>

  (1) TEST-INPUTS.md — this is the source of truth. Update the
      scripted answers for the affected variant. Keep the existing
      format (numbered-answer blocks per prompt).
  (2) TEST-STRATEGY.md — "Conventions borrowed from TEST-GUIDE.md"
      lists Variants A-F. Add/update the row.
  (3) TEST-GUIDE.md — every test's "Variant" metadata field
      references the variants. If a variant was removed or
      renamed, update each affected test.
  (4) QA/helpers/ — check if seedArtifact / seedManifest hardcodes
      scenario-specific content (paths, feature names). Flag, don't
      fix — fixture edits go through the QA kit, not this one.

TEST-INPUTS.md is where the new text lives; the other docs only
reference it. Don't duplicate scenario prose across files.
```

## D6. New hook or settings.json change

```
.claude/settings.json or .claude/hooks/ changed:
  <new hook wired up | deny rule added | permission scope changed>

Docs to update:

  (1) HOW-IT-WORKS.md — the hook-flow section (which hooks fire
      on which events, in what order). If a new hook is part of
      the user-facing workflow, describe it.
  (2) TEST-STRATEGY.md Section 2 — "Test Area E: Hooks" lists
      each hook. Add/remove the row.
  (3) TEST-GUIDE.md — the "Security invariants" group of tests
      (around tests 30+) covers deny-list behavior. If deny rules
      changed, add a test case entry with PASS / FAIL steps.

Quote actual file paths and event names from settings.json — don't
paraphrase.
```

## D7. New rollback or checkpoint convention

```
A new rollback (RB-*) or checkpoint (CP-*) is needed because
<reason: e.g., new phase introduced a new artifact that needs
cleaning up>.

  (1) TEST-GUIDE.md — the "Rollback Reference" section. Append
      the new RB-<N> with a code block showing the cleanup
      commands. Number sequentially after existing entries.
  (2) TEST-STRATEGY.md — the borrowed-conventions section lists
      RB IDs. Update the range.
  (3) QA/helpers/rollback.ts — if the rollback is mechanised for
      Tier 1 tests, add it there. This is code, not docs — flag
      and defer to the QA kit.

For checkpoints, same pattern but with CP-* and the
checkpoint-fixtures.ts file.
```

## D8. Cross-doc consistency check

Run this after editing any doc, to catch ripple effects.

```
I just edited <DOC-NAME>. Verify the other three template-level
docs are still consistent with it:

  - Search for every cross-reference. The common ones:
    * RB-<N>, CP-<N>, Variant <letter>
    * Phase names (INTAKE, DESIGN, SCOPE, STORIES, REALIGN,
      TEST-DESIGN, WRITE-TESTS, IMPLEMENT, QA, COMPLETE)
    * Script / agent / hook filenames
    * Tier 1 / Tier 2 / Tier 3 references

  - Flag any place where a reference now points at something that
    doesn't exist in the updated doc, or where the updated doc
    contradicts another doc.

Don't fix cross-doc conflicts silently — list them and let me
decide which doc is correct.
```

The "let me decide" line matters. When two docs contradict, it's
rarely obvious which was intended — often the mismatch is the sign
of an underlying decision that was never made.

## D9. Accept-the-new-reality escape hatch

When a batch of drift is all genuine follow-the-template work:

```
Accept the following as intentional template changes, and update
the docs accordingly:
  <list of drift items from D1's report>

Minimal edits only — preserve prose style, don't rewrite sections
that merely needed a name changed. Update "Prepared" dates at the
top of TEST-GUIDE.md and any similar metadata. Commit each doc as
a separate commit with a focused message so it's easy to review
or revert individually.
```

The separate-commit rule matters — these docs are long and mixing
unrelated edits makes `git blame` useless later.

---

## Appendix — What each prompt protects you from

| Prompt | Failure mode it prevents |
|---|---|
| Q1 / D1 | Blind rewrites that make failures vanish without investigating |
| Q2 / Q6 | Adding agents/commands that silently break iteration tests |
| Q3 / D4 | Stale references after renames — the classic `grep` oversight |
| Q4 | New scripts shipping without any test coverage |
| Q5 | Loosened assertions hiding real regressions |
| Q7 / D3 | Cascading helper edits that break the whole suite |
| Q8 / D6 | Policy/permission changes without matching tests |
| D2 | Docs describing scripts that no longer exist or have moved |
| D5 | Variant / fixture drift that diverges across docs |
| D7 | Rollback recipes that don't actually undo what the phase did |
| D8 | Silent contradictions between docs |
| Q9 / D9 | The cost of unstructured catch-up edits (bad `git blame`, mixed commits) |

Each prompt is written with the assumption that Claude will read the
actual current state of files before editing. Paste them as-is — the
placeholders in angle brackets are meant to be filled in with what
actually changed.
