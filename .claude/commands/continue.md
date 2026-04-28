---
description: Resume interrupted TDD workflow
---

You are helping a developer resume the TDD workflow from where it was interrupted.

**Read and follow all rules in [orchestrator-rules.md](../shared/orchestrator-rules.md) — they are mandatory.**

## Dispatcher Pattern (CRITICAL)

`/continue` uses a **dispatcher pattern** to work around a Claude Code bug where hook and permission dispatch ceases mid-response after approximately 4 tool calls. The parent orchestrator is limited to **2–3 tool calls maximum** before delegating everything to a coordinator subagent.

**Architecture:**
1. **Parent** runs 1 Bash call to collect workflow state
2. **Parent** launches 1 coordinator subagent (general-purpose) with the state JSON
3. **Coordinator** handles all file reads, TodoWrite reconstruction, and work agent launches in its own fresh dispatch context

**Parent orchestrator rules:**
- **NEVER** read files, run additional scripts, or call TodoWrite directly
- **ONLY** collect state (Bash), handle repair if needed (Bash), launch coordinator (Agent), and handle AskUserQuestion on coordinator return
- After user responds to AskUserQuestion → new turn with fresh hooks → safe to launch another coordinator

## Workflow Reminder

The TDD workflow has four stages:

0. **Requirements gathering**: INTAKE (intake-agent → [prototype-review-agent, v2 only] → intake-brd-review-agent)
1. **One-time setup**: DESIGN (mandatory) → SCOPE (define all epics, no stories yet)
2. **Per-epic**: STORIES (define stories for the current epic only)
3. **Per-story iteration**: REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA → commit → (next story)

After QA passes for a story:

- If more stories in epic → REALIGN for next story
- If no more stories but more epics → STORIES for next epic
- If last story in a phase's last epic (phasing enabled) → PHASE-BOUNDARY (user chooses Continue or Stop)
- If no more stories and no more epics → Feature complete!

## Step 1: Validate Workflow State

Collect enriched workflow data with a single script call:

```bash
node .claude/scripts/collect-dashboard-data.js --format=json
```

### If `status: "no_state"`:

**Automatically attempt to repair the state first:**

```bash
node .claude/scripts/transition-phase.js --repair
```

If repair succeeds, show the user the detected state and ask them to confirm before proceeding.

If repair fails (no artifacts found), ask the user:

> "No workflow state or artifacts found. Would you like to start fresh with `/start`, or describe the current state so I can help you continue?"

**Important:** After repair, check the **confidence level** in the output:

- `"confidence": "high"` - State is reliable, show summary and proceed
- `"confidence": "medium"` - Show the `detected` and `assumed` arrays, ask user to confirm
- `"confidence": "low"` - **REQUIRE** user to verify before proceeding, show warning prominently

After repair succeeds, re-run `collect-dashboard-data.js --format=json` to get the enriched data.

### If `status: "ok"` (state exists):

Display a brief summary:

```
Resuming: Epic [N], Story [M], Phase: [phase]
```

Then proceed directly to Step 2.

## Step 2: Launch Coordinator

**Immediately** launch a `general-purpose` coordinator subagent. Do NOT read files, reconstruct TodoWrite, or make any additional tool calls first.

Build the coordinator prompt from three parts:

1. **Base instructions** (always included — see below)
2. **State JSON** from Step 1
3. **Phase-specific instructions** for the current phase (see Phase Sections below)

### Base Coordinator Prompt

Always include this at the top of the coordinator prompt:

```
You are a workflow coordinator for the TDD workflow, delegated by the parent orchestrator to handle /continue resumption.

## Your Tasks (in order)

1. **Reconstruct TodoWrite progress display:**
   Run: node .claude/scripts/generate-todo-list.js
   Parse the JSON output and call TodoWrite with the resulting array.

2. **Read the shared orchestrator rules:**
   Read .claude/shared/orchestrator-rules.md for scoped call patterns, commit policy, and dashboard update policy.

3. **Execute the phase-specific instructions** provided below.

4. **Return results** to the parent orchestrator.

## Critical Rules

- Do NOT use AskUserQuestion — it silently auto-resolves in subagents. When you have content that needs user approval, return it as text in your response with the prefix "NEEDS_APPROVAL:" on its own line, followed by the content. The parent orchestrator will present it to the user.
- When launching work agents, include a reminder to update workflow state via transition-phase.js.
- Follow all rules in orchestrator-rules.md — especially scoped call patterns, voice guidelines, commit policy, and the FRS-Over-Template Rule.
- Fire dashboard updates (node .claude/scripts/generate-dashboard-html.js --collect) at workflow milestones per the Dashboard Update Policy.
- Verify all script JSON output: "status": "ok" = proceed, "status": "error" = STOP and return the error.
- When launching WRITE-TESTS, IMPLEMENT, or TEST-DESIGN agents, include the FRS-over-template reminder from orchestrator-rules.md in the prompt.
- **NEVER suppress spec drift findings.** When composing prompts for the spec-compliance-watchdog, do NOT include instructions to ignore, skip, or excuse any changes — regardless of how or why the drift occurred (including user-approved QA fix-cycle changes). The watchdog must detect ALL spec-vs-code drift so that spec documents get updated. Pass fix-cycle context as informational background only, never as a suppression instruction.
```

### State JSON Block

Include the raw JSON from `collect-dashboard-data.js`:

```
## Current Workflow State

[paste JSON here]
```

### Phase-Specific Instructions

Based on the current phase from the state JSON, append the matching section below to the coordinator prompt.

---

#### INTAKE

```
## Phase: INTAKE

INTAKE has two or three sequential agents depending on prototype format. Determine which one to resume based on artifacts:

1. Check if generated-docs/context/intake-manifest.json exists:
   - No → Recover onboarding context (see below), then resume with intake-agent
   - Yes → Check step 2

2. If the manifest has context.prototypeFormat === "v2", check if prototype review has completed:
   - Check if generated-docs/prototype-screenshots/ has PNG files OR artifacts.wireframes.generate === false in the manifest
   - Neither is true → Resume with prototype-review-agent (it was interrupted between intake-agent and BRD review)
   - Either is true → Prototype review is done, check step 3

3. Check if generated-docs/specs/feature-requirements.md exists:
   - No → Resume with intake-brd-review-agent
   - Yes → INTAKE is complete. Inform user and transition to DESIGN.

### Recovering onboarding context (no manifest yet)

Step 1 — Infer onboardingPath from documentation/:
- If documentation/prototype-src/ contains subdirectories → "prototype"
- Else if documentation/ contains substantive files (not just .gitkeep) → "docs"
- Else → "qa"

Step 2 — Recover projectDescription:
- If "docs" or "prototype" → null (docs serve as description)
- If "qa" → Return to parent with: "NEEDS_APPROVAL:" followed by the question: "We're picking up where we left off on requirements. I don't have the project description from last session — could you give me the elevator pitch again?"

Step 3 — Use the scoped call patterns from orchestrator-rules.md. Call A (scan) is idempotent. Pass recovered onboardingPath and projectDescription into Call B.

After the agent completes:
- If intake-agent finished AND context.prototypeFormat === "v2" → invoke prototype-review-agent first, then intake-brd-review-agent
- If intake-agent finished AND NOT v2 → invoke intake-brd-review-agent directly
- If prototype-review-agent finished → pass accepted enrichments, confirmed assumptions, and genesis→FRS mapping to intake-brd-review-agent Call A as additional context
- If intake-brd-review-agent finished → fire dashboard update, then return with message instructing user to /clear then /continue (clearing boundary #1)
```

---

#### DESIGN

```
## Phase: DESIGN

DESIGN is a multi-agent phase with parallel Call A execution. Read the full DESIGN Execution Model in orchestrator-rules.md.

1. Read the intake manifest: generated-docs/context/intake-manifest.json

2. Check which artifacts with generate == true are still missing. Use the artifact-to-agent mapping in orchestrator-rules.md to determine output paths. Check whether each agent's expected output file exists on disk. **E6 wireframe skip:** If artifacts.wireframes.generate === false (set by prototype-review-agent when .pen screenshots exist), do NOT include design-wireframe-agent — the .pen screenshots serve as wireframes.

3. For user-provided files that need copying (generate == false + userProvided set): use the copy script:
   node .claude/scripts/copy-with-header.js --from "<path>" --to "generated-docs/specs/<target>"

4. Determine resumption strategy:
   a. No outputs exist → Follow full parallel execution model (launch all Call A in parallel)
   b. Some outputs exist → Launch Call A only for agents whose output is missing. Also check for web/src/types/api-generated.ts if api-spec.yaml exists.
   c. All agent outputs exist but dependents haven't run → Launch mock-setup-agent and/or type-generator-agent as needed
   d. All outputs exist, transition not run → DESIGN is complete. Run finalize step.

5. If all artifacts exist and transition was already run → inform user, state should be SCOPE.

For Call A results that need user approval (API spec, design tokens, screen list):
Return with "NEEDS_APPROVAL:" followed by the summary for each agent that produced output. Include which agent produced each summary so the parent knows what approval is for.

For autonomous agents (mock-setup-agent, type-generator-agent): handle their full flow internally and report completion.
```

---

#### SCOPE

```
## Phase: SCOPE

Use the SCOPE scoped-call pattern from orchestrator-rules.md.

Launch feature-planner Call A:
"This is Call A — Propose Epics. You are in SCOPE mode. Read the FRS at generated-docs/specs/feature-requirements.md and propose an epic breakdown. Return the epic list with descriptions and dependency map. If you propose 6 or more epics, also include a phase grouping proposal (see your Phase Grouping instructions). Do NOT write any files. Do NOT commit. Do NOT use AskUserQuestion."

After Call A returns, check whether the proposal includes a phase grouping.

If NO phase grouping (fewer than 6 epics):
Return with "NEEDS_APPROVAL:" followed by the epic list (unchanged behavior).

If phase grouping is included (6+ epics):
Return with "NEEDS_APPROVAL:" followed by the epic list AND the phase grouping, with these 4 options:
1. "Approve both (epics and phases as proposed)"
2. "Approve epics, but change the phase grouping" — follow up to get the user's custom grouping
3. "Approve epics, no phases — just do them all in order"
4. "Revise the epics" — standard epic revision flow

When launching Call B, include the user's phase decision:
- Option 1: "Write _feature-overview.md with the proposed phase grouping."
- Option 2: "Write _feature-overview.md with this custom phase grouping: [user's grouping]."
- Option 3: "Write _feature-overview.md without a ## Phases section."
- Option 4: (re-run Call A with revisions, then re-present)
```

---

#### STORIES

```
## Phase: STORIES

Current epic: [N]

Use the STORIES scoped-call pattern from orchestrator-rules.md.

Launch feature-planner Call A:
"This is Call A — Propose Stories. You are in STORIES mode for Epic [N]. Read the FRS and epic overview. Propose stories for this epic. Return the story list. Do NOT write story files. Do NOT commit."

Return with "NEEDS_APPROVAL:" followed by the story list.
```

---

#### REALIGN

```
## Phase: REALIGN

Current epic: [N], Current story: [M]

Launch feature-planner Call A:
"This is Call A — Check Impacts. You are in REALIGN mode for Epic [N], Story [M]. Read discovered-impacts.md. If no impacts exist, run the state transition to TEST-DESIGN and return 'No impacts — auto-completed.' If impacts exist, analyze them and return proposed revisions."

If agent returns "No impacts — auto-completed":
- The agent has already run the state transition.
- Fire dashboard update
- Proceed directly to TEST-DESIGN (execute the TEST-DESIGN instructions below)

If agent returns with proposed revisions:
- Return with "NEEDS_APPROVAL:" followed by the proposed revisions
```

---

#### TEST-DESIGN

```
## Phase: TEST-DESIGN

Current epic: [N], Current story: [M]
Story file: [path from state]

This phase requires user approval AND per-BA-decision persistence before proceeding. See the TEST-DESIGN section in orchestrator-rules.md for the full flow.

Launch test-designer Call A:
"This is Call A — Design test scenarios for Epic [N], Story [M]. Story file: [path]. Produce a specification-by-example document for BA review. You MUST follow the Required Template defined in your agent instructions — use Setup/Input/Expected tables (NOT Given/When/Then), and include ALL required sections: Story Summary, Review Purpose, Business Behaviors Identified, Key Decisions Surfaced by AI, Test Scenarios / Review Examples, Edge and Alternate Examples, Out of Scope, Coverage for WRITE-TESTS (AC → example mapping), and Handoff Notes for WRITE-TESTS. Every `BA decision required` block MUST carry a stable `(BA-<N>)` ID starting at BA-1. Write the document to generated-docs/test-design/. Return a summary listing scenario titles, counts (main examples, edge examples, BA decisions required), and any key ambiguities. Do NOT run the transition script. Do NOT commit. Do NOT use AskUserQuestion."

After it returns:
- Fire dashboard update
- Enumerate unresolved BA decisions: run `node .claude/scripts/list-ba-decisions.js --epic [N] --story [M]` and capture the JSON output (use the `decisions` array downstream)
- Read the full generated test-design document from generated-docs/test-design/ and return with "NEEDS_APPROVAL:" followed by:
  1. A clickable markdown link to the full document file (e.g., `[epic-N-story-M-title.md](generated-docs/test-design/epic-N-story-M-title.md)`)
  2. The COMPLETE document contents (not just a summary). The user needs to review every scenario table and decision to make an informed approval.
  3. The decisions array from list-ba-decisions.js (so the parent orchestrator can build the correct multi-question AskUserQuestion payload — one question for doc approval plus one question per BA decision, batched 4-at-a-time if there are more than 3 decisions)
- After the parent collects the user's answers, it MUST run `node .claude/scripts/resolve-ba-decision.js --epic [N] --story [M] --decision-id BA-X --option Y` once per decision before transitioning. Verify each returns status "ok" (or "warning" on idempotent re-run).
- Only proceed to WRITE-TESTS after user approves AND every BA decision has been persisted via resolve-ba-decision.js.
```

---

#### WRITE-TESTS

```
## Phase: WRITE-TESTS

Current epic: [N], Current story: [M]
Story file: [path from state]

This phase is fully autonomous. Handle everything internally.

Launch test-generator:
"Generate tests for Epic [N], Story [M]. Story file: [path]. Test design: [path to test-design doc in generated-docs/test-design/]. Write failing tests that define acceptance criteria as executable code."

After it returns:
- Fire dashboard update
- Proceed directly to IMPLEMENT (execute the IMPLEMENT instructions below)
```

---

#### IMPLEMENT

```
## Phase: IMPLEMENT

Current epic: [N], Current story: [M]

This phase is fully autonomous. Handle everything internally.

Step 1: Run npm test in web/ to identify failing tests for the current story. Capture the output.

Step 2: Launch developer Call A:
"This is Call A — Implement. Read the story at [path] and tests at [path]. Here are the current failing tests: [paste output]. Write code to make all failing tests pass. Do NOT run quality gates in this call."

Step 3: Launch developer Call B:
"This is Call B — Pre-flight Test Check. Run npm test to verify all tests pass. Fix any failures. Do NOT run lint, build, or test:quality. Do NOT commit."

After Call B returns:
- Fire dashboard update
- Proceed directly to QA (execute the QA instructions below)
```

---

#### QA

```
## Phase: QA

Current epic: [N], Current story: [M]

QA has 3 calls plus an automated Playwright E2E pre-check and a manual verification checkpoint between Call B and Call C.

Launch code-reviewer Call A:
"This is Call A — code review only. Do NOT run quality gates or commit."

Launch code-reviewer Call B:
"This is Call B — run quality gates and return results. Also read the story file and compose the manual verification checklist. IMPORTANT: You MUST persist the checklist to generated-docs/qa/epic-N-[slug]/story-M-[slug]-verification-checklist.md (create the directory if needed) — this file is the single source of truth for all re-verification prompts during QA fix cycles. Return the checklist text in your response as well. Also return a `Route:` line (`Route: <path>` or `Route: N/A`) and a `Deferred stories:` line (e.g., `Deferred stories: epic-1-story-6, epic-1-story-7` or `Deferred stories: none`). Do NOT commit."

After Call B returns, EXECUTE THE E2E VERIFICATION STEP BEFORE ASKING THE USER ANYTHING (see below). The parent orchestrator delegates this to a coordinator — it never runs Playwright directly.

### E2E Verification (Gate 6a) — automated pre-check

Launch a coordinator with this prompt:

"You are an E2E verification coordinator.

## Story
Epic [N], Story [M]
Call B result — Route: [route], Deferred stories: [list]

## Your Tasks

1. Build the combined target set:
   - Always include: web/e2e/epic-[N]-story-[M]-*.spec.ts
   - For each deferred story (X,Y) from Call B: also include web/e2e/epic-X-story-Y-*.spec.ts

2. For each target glob, resolve the actual spec file on disk (via ls/glob). Classify:
   - Missing → return NEEDS_APPROVAL with the three-way halt prompt (see orchestrator-rules.md E2E Halt Prompts).
   - Exists but all tests wrapped in test.fixme( (grep check, no Playwright run) → if current story, treat as skip. If deferred story, halt with three-way prompt.
   - Exists with at least one live test( → include in Playwright run.

3. If Route is N/A, skip Playwright entirely. Record e2eStatus: auto-skipped:non-routable and return.

4. If all targets resolve as live:
   cd web && npx playwright test [glob1] [glob2] ... --reporter=json > /tmp/e2e-report.json
   Capture exit code.

5. On exit 0: record e2eStatus: passed via transition-phase.js; return a summary line (N tests passed across M specs). Parent proceeds to manual verification.

6. On non-zero exit:
   Parse the failing tests from /tmp/e2e-report.json.
   Launch developer with the failing-tests summary + report path as 'issues reported':
     'Fix these E2E failures in Epic [N], Story [M]: [summary]. The full Playwright JSON report is at /tmp/e2e-report.json and traces are under web/test-results/. Do NOT run quality gates. Do NOT commit. Do NOT use AskUserQuestion.'
   After developer returns, re-run the Playwright command from step 4.
   If re-run passes: record e2eStatus: passed-after-fix, return a fix summary + success line.
   If re-run fails: increment e2eFixCycleCount. Repeat from the developer call. Cap at 3 cycles.
   After 3 consecutive failures: record e2eStatus: escalated and return NEEDS_APPROVAL with the latest report and three options: 'Fix manually', 'Skip E2E this round', or 'Mark failing specs test.fixme()'.

7. Persist all state via: node .claude/scripts/transition-phase.js --e2e-status <status>

Do NOT use AskUserQuestion.
Do NOT run Vitest, lint, build, or test:quality.
Do NOT commit or run phase transitions other than --e2e-status.
Do NOT present manual verification — that's the parent's job."

### After E2E resolves

Read the e2eStatus from workflow state, then:

If Route was N/A:
  Return NEEDS_APPROVAL with Call B's component-only note only (no manual verification prompt) so spec compliance can proceed with auto-skipped status.

If Route is concrete AND E2E passed/skipped cleanly:
  Return with "NEEDS_APPROVAL:" followed by:
  1. The quality gate results (plain language)
  2. The E2E result line (e.g., "End-to-end tests passed in a live browser (N tests).")
  3. The manual verification checklist (verbatim)
  4. "Have you verified [Story Name] in the browser? Options: All tests pass / Issues found / Skip for now"

If Route is concrete AND E2E escalated to the user:
  Return with "NEEDS_APPROVAL:" followed by the escalation payload (latest Playwright report + three options). Manual verification comes AFTER the user resolves the escalation.
```

**Handling "Issues found" (QA fix cycle) — user-triggered:**

When the user selects "Issues found" after manual verification, the parent orchestrator must delegate fixes to a coordinator — NEVER fix issues directly (this triggers the hook-dispatch bug that the dispatcher pattern exists to prevent).

See the **QA Fix Cycle** section in orchestrator-rules.md for the full coordinator prompt and flow. In summary:

1. `AskUserQuestion`: ask user to describe the issues → **fresh turn**
2. Launch coordinator: developer fixes → coordinator re-runs the E2E Verification step (same combined target set) to catch any new regressions → returns NEEDS_APPROVAL with fix summary + E2E result (no Vitest quality gates — those run once in Call C)
3. Present fix summary → `AskUserQuestion` for re-verification → **fresh turn**
4. If "Issues found" again → repeat (each cycle gets fresh hooks)
5. If passed/skipped → proceed to spec compliance check (see below), then Call C

**Handling Playwright failures — E2E-triggered (no user prompt):**

Playwright failures during the E2E Verification step trigger an automatic fix cycle with no user interaction up to 3 attempts. The coordinator handles everything internally. The user is only prompted on the 4th attempt (escalation) with the three options. See orchestrator-rules.md for the full flow.

**Spec Compliance Check (Gate 6 — MANDATORY between manual verification and Call C):**

After manual verification passes (or is skipped), and BEFORE Call C, the spec-compliance-watchdog MUST run. See the full Spec Compliance Check section in orchestrator-rules.md for details. In summary:

1. Launch `spec-compliance-watchdog` Call A to analyze compliance for Epic [N], Story [M]. Pass the story file path, test-design path, and test-handoff path. The watchdog compares every AC and test-design scenario against actual implementation and test files.

2. **If PASS:** Display "Spec compliance check passed" and proceed to Call C.

3. **If FAIL:** Return with "NEEDS_APPROVAL:" showing the compliance report. Ask user: "Fix the code to match the specs" (Option A) or "Update the specs to match the code" (Option B).
   - Option A: Launch fix coordinator → re-run watchdog to verify → proceed to Call C (must re-run quality gates since code changed)
   - Option B: Launch watchdog Call B to update spec documents → proceed to Call C (stage generated-docs changes)

4. After spec compliance resolves → proceed to Call C

---

#### PHASE-BOUNDARY

```
## Phase: PHASE-BOUNDARY

A project phase has completed. Handle two cases based on `state.phaseStatus`:

### Case A: Fresh arrival (phaseStatus: "ready")

The previous phase just completed (last epic in the current phase passed QA). The user must choose how to proceed.

1. Read workflow state and call getPhases() (from workflow-helpers.js) to determine:
   - Which phase just completed (name and epic list)
   - What comes next (next phase name and epics)

2. Return with "NEEDS_APPROVAL:" followed by:

   "[Phase name] is complete! All [N] epics have passed QA.

   Next up: [Next phase name] — [Epic list]

   Options:
   - Continue to [next phase] as planned
   - Stop here — [completed phase] is enough for now"

3. The parent orchestrator presents this to the user.
   - **Continue:** Run `node .claude/scripts/transition-phase.js --advance-phase`, then transition to STORIES for the next epic. Fire dashboard update.
   - **Stop here:** Run `node .claude/scripts/transition-phase.js --pause-phase` (sets phaseStatus: 'paused' and pausedAt to current ISO timestamp; keeps currentPhase: 'PHASE-BOUNDARY'). Fire dashboard update. Instruct user to /clear. STOP — do not advance.

### Case B: Resume from pause (phaseStatus: "paused")

The user paused earlier by picking "Stop here" and has now run /continue.
Auto-resume without asking — running /continue IS the intent signal. But run a staleness check first.

1. Call checkStaleness(state.pausedAt) (from workflow-helpers.js).

2. Branch on result:
   - **status: 'silent':** No files changed since pause. Run --advance-phase
     (clears pausedAt) and transition to STORIES for next epic. No user prompt.
   - **status: 'notify':** Print a single-line informational message listing
     what changed (e.g., "FRS edited since pause — your upcoming epics may
     reference content that changed. Resuming anyway."). Then run --advance-phase
     and transition. Do NOT prompt the user.
   - **status: 'halt':** Something is actually broken (missing feature-overview,
     corrupted state, etc.). Return with "NEEDS_APPROVAL:" describing the
     problems and asking the user how to proceed. Do NOT auto-advance.
```

---

#### COMPLETE

```
## Phase: COMPLETE

Check the next action from the state data:
- More stories in epic → Proceed to REALIGN for next story (execute REALIGN instructions)
- No more stories but more epics → Proceed to STORIES for next epic (execute STORIES instructions)
- No more stories and no more epics → Return with: "Feature complete! All epics and stories have been implemented and passed QA."
```

## Step 3: Handle Coordinator Return

### If the response contains "NEEDS_APPROVAL:"

The coordinator completed Call A and needs user approval. Handle this as **two separate actions**, in order. You MUST complete Gate A before Gate B.

**Gate A — DISPLAY the payload (text output, no tool call):**
Extract everything after "NEEDS_APPROVAL:" from the coordinator's response and output it verbatim as regular assistant text. This is a text-only message — do NOT combine it with a tool call. The coordinator's return is visible in your context but **invisible to the user**. A link or document referenced only in your context has not been "presented" until it appears in your assistant-visible output.

**Gate B — ASK for approval (AskUserQuestion):**
Self-check before invoking the tool: *"Does my most recent assistant text contain the coordinator's NEEDS_APPROVAL payload verbatim — including any markdown link and the full document or summary?"* If not, STOP and complete Gate A first. Only after the self-check passes, call `AskUserQuestion` with the phase-appropriate options (see orchestrator-rules.md).

**Follow-up rules (apply after Gate B):**

1. **Re-ask rule (QA manual verification):** If the user responds with a free-text question instead of selecting an option, answer their question, then re-ask `AskUserQuestion` with the **full manual verification checklist** included. Read the checklist verbatim from `generated-docs/qa/epic-N-[slug]/story-M-[slug]-verification-checklist.md` — never omit or abbreviate it. The checklist must be visible every time the verification question is presented, not just the first time.
2. After user selects an option → **new turn with fresh hooks**
3. Launch a **new coordinator** for the follow-up work. Include in its prompt:
   - The base coordinator instructions (same as Step 2)
   - The user's approval decision and any feedback
   - Instructions for what to do next (Call B, revisions, etc.)
   - For QA after manual verification passes/skipped: **First run the spec-compliance-watchdog** before Call C. Launch a coordinator that runs `spec-compliance-watchdog` Call A for the current epic/story. **Do NOT tell the watchdog to ignore or skip any changes made during the fix cycle. Pass fix-cycle context as informational background only.** If it passes with no findings, proceed to Call C. If it fails, return NEEDS_APPROVAL with the compliance report and options (fix code vs update specs). See the Spec Compliance Check instructions in the QA phase section above for the full flow. Only after spec compliance resolves, launch Call C: `"Launch code-reviewer Call C: 'The user confirmed manual verification. Status: [passed|skipped]. Spec compliance: [passed|resolved]. [If deferred stories were verified: Also mark stories N, M as deferred-passed.] Proceed to commit and transition to COMPLETE. [If no fix cycle occurred: Do NOT run quality gates again.] [If fix cycle or spec-compliance code fix occurred: Re-run all quality gates before committing.]' After it returns, fire dashboard update. Display its return message — it contains the /clear + /continue instruction. STOP after displaying it."`
   - For QA "Issues found": follow the **QA Fix Cycle** in orchestrator-rules.md. Use `AskUserQuestion` to get the issue description (fresh turn), then launch a fix-cycle coordinator that delegates to developer + code-reviewer Call A + Call B, returning NEEDS_APPROVAL with the fix summary AND the complete manual verification checklist (read verbatim from `generated-docs/qa/epic-N-[slug]/story-M-[slug]-verification-checklist.md` — never rephrase or abbreviate) for re-verification. **Never fix issues directly from the parent orchestrator.** After the fix cycle resolves, proceed to the spec compliance check before Call C.

### If the response does NOT contain "NEEDS_APPROVAL:"

The coordinator handled an autonomous phase or a clearing boundary.

1. Display the coordinator's summary to the user
2. If the coordinator indicates a **clearing boundary** (end of INTAKE, DESIGN, SCOPE, or story QA): instruct user to `/clear` then `/continue` and **STOP**
3. If the coordinator completed an autonomous phase and there's a next phase: the coordinator should have already proceeded to it. If it didn't (e.g., it ran out of context), launch a new coordinator for the next phase.

## Script Execution Verification

**All transition scripts output JSON. Always verify the result before proceeding** (see [orchestrator-rules.md § Script Execution Verification](../shared/orchestrator-rules.md#script-execution-verification) for the full rules):

1. `"status": "ok"` = Success, proceed to next step
2. `"status": "error"` = **STOP**, report the error to the user
3. `"status": "warning"` = Proceed with caution, inform user

**Troubleshooting:**
- Check current state: `node .claude/scripts/transition-phase.js --show`
- Validate artifacts: `node .claude/scripts/validate-phase-output.js --phase <PHASE> --epic <N>`
- Repair if needed: `node .claude/scripts/transition-phase.js --repair`

## Error Handling

- **State file missing:** Use `--repair` to reconstruct from artifacts
- **State appears wrong:** Ask user to confirm or correct
- **Script fails:** Ask user to describe current state manually
- **Invalid transition:** Show allowed transitions and ask user what to do

## DO

- Always validate state at the start of the session
- Auto-proceed on high confidence state (no confirmation needed)
- Delegate to coordinator immediately after state validation
- Keep parent tool calls to 2-3 maximum before coordinator launch
- Use scoped calls for ALL interactive agents (not just IMPLEMENT and QA)

## DON'T

- Auto-approve anything on behalf of the user
- Read files or run scripts from the parent (coordinator handles this)
- Skip state validation
- Trust artifact detection over the state file
- Proceed if the user says the state is wrong
- Stop for context clearing at non-boundary phase transitions

## Related Commands

- `/start` - Start TDD workflow from the beginning
- `/status` - Show current progress without resuming
- `/quality-check` - Validate all 5 quality gates
