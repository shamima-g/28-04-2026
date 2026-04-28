# Shared Orchestrator Rules

These rules apply to both `/start` and `/continue` orchestrators. Both commands MUST follow everything in this file.

## Voice (mandatory)

You're a knowledgeable colleague pairing with the user. Use "I" and "we" — never refer to agents in the third person ("The intake-agent has scanned...", "The agent detected..."). When relaying what a subagent found, speak as if *you* found it: "I've gone through your docs" not "The intake-agent has scanned your documentation." Lead with what's solid, frame gaps as next steps not problems, and match the user's energy. No robot voice ("Processing complete. 3 artifacts detected."), no servile openers ("I'd be happy to help!"), no walls of text when a sentence will do. See [tone-guide.md](../agents/tone-guide.md) for full examples.

**Plain language (mandatory):** Our users are most often non-developers. All user-facing text — including acceptance criteria checklists, manual verification prompts, quality gate summaries, and status updates — must be free of technical jargon. Say "the app builds correctly" not "TypeScript compilation succeeded with zero diagnostics." Say "all automated checks passed" not "Gate 3 (ESLint + tsc) exited 0." When presenting acceptance criteria for manual testing, rephrase any developer-oriented language into what the user would actually see or do in the browser (e.g., "You should see a loading spinner while data loads" not "Verify the isLoading state renders the Skeleton component").

## User Questions (mandatory)

`AskUserQuestion` does NOT work inside Task subagents — it auto-resolves silently. Therefore, when a subagent returns with an unanswered question or needs user input relayed, YOU (the orchestrator) must use `AskUserQuestion` to present it to the user. Never relay questions as plain text output. This applies to all approval requests, clarifications, and choices throughout the workflow.

**Open-ended prompt exception:** When ONLY a free-text response is required (e.g., a project description or elevator pitch during INTAKE onboarding), use a plain-text prompt instead of `AskUserQuestion`. This avoids forcing the user to pick from predefined options when the answer is inherently open-ended.

## User Approval Policy (CRITICAL)

**NEVER auto-approve on behalf of the user.** When an agent returns with work that needs approval:

1. **STOP** and output the proposed content as **regular conversation text** so the user can read it
2. **Then** use `AskUserQuestion` to get explicit approval — never rely on plain text questions for the approval prompt itself
3. **Only proceed** after receiving actual user confirmation via `AskUserQuestion`

**Steps 1 and 2 are separate actions.** The content display (step 1) is regular text output. The approval prompt (step 2) is an `AskUserQuestion` call. Never combine them — the user must see the content before the approval prompt appears.

**Examples of what NOT to do:**
- "The feature-planner proposed 3 epics. Let me continue..." (auto-approving)
- "Epics look good, proceeding to stories..." (auto-approving)
- Spawning another Task to auto-approve
- Writing a question as plain text and hoping the user responds
- Calling `AskUserQuestion` with "Does this look right?" **without first outputting what "this" refers to** — the user sees only the question with no content to review

**Self-check before every `AskUserQuestion` call (mandatory):**

Before invoking the tool, silently check: *"Does my most recent assistant text include the full content the user is being asked to approve — the link, document, summary, or list — verbatim?"* If the content exists only in a subagent's return message, you have NOT displayed it. A subagent's return is visible to you but **invisible to the user**. STOP, output the payload as regular text, then call `AskUserQuestion`.

This applies to every approval prompt in every phase: INTAKE manifest, SCOPE epic list, STORIES list, TEST-DESIGN document, QA manual-verification checklist, spec-compliance reports — all of them.

**Examples of correct behavior:**
- Output the summary/content as regular text, **then** call `AskUserQuestion`: "Does this breakdown look right?"
- Wait for the user to respond via the `AskUserQuestion` prompt
- Only then continue to the next phase

**Fallback if agent return is empty or unclear:** If a subagent returns without a clear summary but wrote a file (e.g., the intake manifest), read that file and construct the summary yourself before calling `AskUserQuestion`. The user must always see concrete content before approving.

## Context Management Policy

Context clearing happens at **6 mandatory boundaries** where significant work completes and the next chunk is independent. The user must run `/clear` then `/continue` at each.

| # | Boundary | Handled by |
|---|----------|------------|
| 1 | INTAKE complete (FRS and manifest produced) | Orchestrator instructs the user |
| 2 | DESIGN complete (all artifacts generated/copied) | Orchestrator instructs the user |
| 3 | Epic list approval (SCOPE complete) | Orchestrator instructs the user |
| 4 | Story QA complete | Code-reviewer return message (display and stop) |
| 5 | Epic completion (last story in epic) | Code-reviewer return message (display and stop) |
| 6 | Phase completion (last epic in phase) | Code-reviewer return message (display and stop) |

**Boundaries #1-3:** You (the orchestrator) instruct the user to run `/clear` then `/continue`.

**Boundaries #4-6:** The code-reviewer's return message already contains the clearing instruction. Display it to the user and **STOP** — do not launch the next agent. The user's `/clear` + `/continue` handles resumption.

**Boundary #6 (phase completion):** Only applies when phasing is enabled. The code-reviewer's return message is the same as boundary #5 (epic completion), but the `/continue` handler detects the PHASE-BOUNDARY state and presents phase-level options before advancing.

**All other phase transitions proceed directly** — launch the next agent without stopping. This includes: STORIES → REALIGN, REALIGN → TEST-DESIGN, WRITE-TESTS → IMPLEMENT, IMPLEMENT → QA. Note: TEST-DESIGN → WRITE-TESTS has an **approval gate** (user reviews the test-design document) but is **not** a context-clearing boundary.

**Post-compaction safety net:** If auto-compaction fires, the `inject-phase-context.ps1` hook automatically restores workflow state and phase-specific instructions via `additionalContext`. This covers both the orchestrator and subagent sessions.

## Dashboard Update Policy

The HTML dashboard (`generated-docs/dashboard.html`) is regenerated at workflow milestones. The browser auto-refreshes every 10 seconds via `<meta http-equiv="refresh">`, so users see updates automatically if the dashboard is open. These updates are **non-blocking** — a failure must never halt the workflow.

### When to update

| Trigger | When | How |
|---------|------|-----|
| End of INTAKE | After BRD agent returns (boundary #1) | Fire-and-forget before `/clear` instruction |
| During DESIGN | After each agent completes (via `--design-agent complete`) | Fire-and-forget inline |
| End of DESIGN | After all agents complete (boundary #2) | Fire-and-forget before `/clear` instruction |
| End of SCOPE | After epic list approved (boundary #3) | Fire-and-forget before `/clear` instruction |
| End of STORIES | After story list approved and written | Fire-and-forget inline |
| After REALIGN | After transition to TEST-DESIGN | Fire-and-forget inline |
| After TEST-DESIGN | After test-designer returns | Fire-and-forget inline |
| After WRITE-TESTS | After test-generator returns | Fire-and-forget inline |
| After IMPLEMENT | After developer Call B returns | Fire-and-forget inline |
| After spec compliance | After watchdog returns (pass or after resolution) | Fire-and-forget inline |
| After QA pass | After code-reviewer returns (boundaries #4-5) | Fire-and-forget before displaying return message |

### How to fire

Run the generator script directly — no subagent needed:

```bash
node .claude/scripts/generate-dashboard-html.js --collect
```

This is a single synchronous command (~100ms) that reads workflow state and writes the HTML file. If it fails, log a warning but do not throw. The workflow continues regardless.

**The `/dashboard` command (user-triggered) is the exception** — it also opens the HTML in the browser. See `.claude/commands/dashboard.md`.

## Git Push Authorization (mandatory)

Agents are explicitly authorized to run `git push origin main` at designated workflow milestones. These pushes are a required part of the workflow — they back up completed work to the remote and must not be skipped, deferred, or gated behind additional confirmation. The user has already approved the underlying work (FRS, epics, stories, implementation) via `AskUserQuestion` before the push runs.

**Designated push points** (agents that include `git push origin main` in their instructions):
- `intake-brd-review-agent` Call C — after INTAKE finalize
- `feature-planner` SCOPE Call B — after epic list approved
- `feature-planner` STORIES Call B — after story list approved
- `code-reviewer` Call C — after QA passes

When an agent's instructions say to push, **execute the push command directly**. Do not add warnings, ask for confirmation, or skip it. If the push fails (e.g., no remote configured, authentication error), report the error to the user but do not retry — let them resolve it.

## Generated Document Names

Every AI-generated document under `generated-docs/` and every E2E spec under `web/e2e/` has exactly one correct filename shape. The machine-readable source of truth is [.claude/shared/generated-doc-conventions.json](./generated-doc-conventions.json); the human-readable mirror is [.claude/shared/naming-conventions.md](./naming-conventions.md).

Two enforcement layers protect the conventions:

- **PreToolUse hook (hard):** `.claude/hooks/enforce-generated-doc-names.js` runs on every `Write`/`Edit`/`MultiEdit` and blocks new files whose names don't match. Existing files on disk are grandfathered — the hook only stops new drift.
- **Repo-wide audit:** `node .claude/scripts/validate-generated-doc-names.js` walks the tree and reports mismatches. Run this before a commit if you've been renaming files; it also doubles as a CI check.

**The two-number rule** (memorize this): when the parent directory already identifies the epic (e.g., `generated-docs/stories/epic-N-[slug]/`), the filename carries **only the story number** — `story-3-role-aware-nav.md`, not `story-1-3-role-aware-nav.md`. When the parent directory is flat (e.g., `generated-docs/reviews/`, `web/e2e/`), the filename carries **both numbers** — `epic-1-story-3-role-aware-nav.spec.ts`. Adding a new document type requires adding an entry to the JSON schema; no code changes needed.

## Scoped Call Pattern

All interactive agents are invoked using scoped calls — multiple focused Task invocations separated by orchestrator-driven `AskUserQuestion` prompts. Agents return structured results; the orchestrator handles all user communication.

**Key rules for every scoped call:**
- Tell the agent which call it is (e.g., "This is Call A — scan only")
- Tell the agent what NOT to do (e.g., "Do NOT commit. Do NOT use AskUserQuestion.")
- After the agent returns, the orchestrator owns the next step (display results, ask user, launch next call)

**Per-phase call patterns:**

| Agent | Phase | Calls | Orchestrator Interaction Points |
|-------|-------|-------|-------------------------------|
| intake-agent | INTAKE | A (scan) + B (manifest) + C (revise, conditional) | Onboarding routing + optional project description + 5 checklist Qs + optional spec-completeness Q + optional wireframe Q + approval |
| prototype-review-agent | INTAKE (v2 only) | 1 (single call) | Screenshots display + enrichment accept/reject + assumption confirmation |
| intake-brd-review-agent | INTAKE | A (gap analysis) + B (produce FRS) + C (finalize) | 0-9 clarifying Qs + approval |
| design-api-agent | DESIGN | A (design spec) + B (commit/revise) | 1 approval |
| mock-setup-agent | DESIGN | A (handlers) + B (infrastructure) | 0 (fully autonomous) |
| type-generator-agent | DESIGN | 1 (single, autonomous) | 0 (fully autonomous) |
| design-style-agent | DESIGN | A (design tokens) + B (commit/revise) | 1 approval |
| design-wireframe-agent | DESIGN | A (screen list) + B (wireframes) + C (commit) | 2 approvals |
| feature-planner (SCOPE) | SCOPE | A (propose epics) + B (write/commit) | 1 approval |
| feature-planner (STORIES) | STORIES | A (propose stories) + B (write/commit) | 1 approval |
| feature-planner (REALIGN) | REALIGN | A (check/propose) + B (apply, conditional) | 0 or 1 approval |
| test-designer | TEST-DESIGN | A (design) + B (transition/revise) | 1 approval |
| test-generator | WRITE-TESTS | 1 (single, unsplit) | 0 (fully autonomous) |
| developer | IMPLEMENT | A (implement) + B (pre-flight test check) | 0 (fully autonomous) |
| code-reviewer | QA | A (review) + B (gates + checklist) + C (commit) | 1 manual verification |
| spec-compliance-watchdog | QA | A (analyze) + B (update specs, conditional) | 1 resolution choice |

## DESIGN Artifact-to-Agent Mapping

For each artifact in the intake manifest, apply this decision logic:

**If `artifact.generate == true`:** Invoke the corresponding agent using scoped calls. If `artifact.userProvided` is also set, include it in the agent prompt as reference input.

**Else if `artifact.userProvided != null` (but `generate == false`):** Copy the user-provided file to `generated-docs/specs/` with a `# Source: <original-path>` header prepended, using the copy script:
```bash
node .claude/scripts/copy-with-header.js --from "<userProvided-path>" --to "generated-docs/specs/<target-filename>"
```
No agent invocation needed.

**Else (generate == false, no userProvided):** Skip — this artifact is not needed.

| Manifest artifact(s) | Agent | Output path |
|----------------------|-------|-------------|
| `apiSpec` | `design-api-agent` | `generated-docs/specs/api-spec.yaml` |
| `apiSpec.mockHandlers` | `mock-setup-agent` | `web/src/mocks/` + `web/.env.local` |
| `apiSpec` (when spec exists) | `type-generator-agent` | `web/src/types/api-generated.ts` + `web/src/lib/api/endpoints.ts` |
| `designTokensCss` + `designTokensMd` | `design-style-agent` | `generated-docs/specs/design-tokens.css` + `generated-docs/specs/design-tokens.md` |
| `wireframes` | `design-wireframe-agent` | `generated-docs/specs/wireframes/` |

**`mockHandlers` special case:** Run `mock-setup-agent` after `design-api-agent` completes (or after copying the user's complete spec) when `artifacts.apiSpec.mockHandlers == true`. This agent is fully autonomous — no approval needed.

**`type-generator-agent` special case:** Run `type-generator-agent` after `design-api-agent` completes (or after copying the user's complete spec) whenever an `api-spec.yaml` exists. This agent is fully autonomous — no approval needed. It generates TypeScript types and typed endpoint functions from the spec.

**Special case — design-style-agent:** `designTokensCss` and `designTokensMd` both map to the same agent. Invoke `design-style-agent` **once** if either has `generate == true`. The agent reads both manifest entries internally. If one has `generate == false` with `userProvided` set, copy that file using the copy script before invoking the agent for the other:
```bash
node .claude/scripts/copy-with-header.js --from "<userProvided-path>" --to "generated-docs/specs/<target-filename>"
```

## DESIGN Execution Model — Parallel Call A

DESIGN agents are launched in parallel where dependencies allow. The only hard ordering constraint is: `mock-setup-agent` must run after `design-api-agent` (it reads `api-spec.yaml`). All other agents read only from INTAKE outputs (FRS + manifest) and have no cross-dependencies.

### Step 1 — Determine which agents need to run

Read the intake manifest and apply the artifact-to-agent mapping above. Build three lists:

- **`agentsToRun`**: agents where `generate == true` — any combination of: `design-api-agent`, `design-style-agent`, `design-wireframe-agent`. **E6 wireframe skip:** If `artifacts.wireframes.generate == false` (set by prototype-review-agent when .pen screenshots exist), do NOT include `design-wireframe-agent` — the .pen screenshots serve as wireframes.
- **`filesToCopy`**: artifacts where `generate == false` and `userProvided != null`. **P9 multi-spec:** When `artifacts.apiSpec.userProvided` is an array, copy each spec file individually.
- **`mockNeeded`**: boolean — `artifacts.apiSpec.mockHandlers == true`

**Register expected agents for dashboard tracking:**

After determining which agents will run, call `--design-agent set` with the full lists:

```bash
node .claude/scripts/transition-phase.js --design-agent set "<agentsToRun comma-separated>" --autonomous "<autonomous agents comma-separated>"
```

Only include agents that actually need to run. Example:
```bash
node .claude/scripts/transition-phase.js --design-agent set "design-api-agent,design-style-agent" --autonomous "mock-setup-agent,type-generator-agent"
```

### Step 2 — Copy user-provided files first

Run `copy-with-header.js` for each entry in `filesToCopy`. This must complete before launching agents that might reference copied files.

### Step 3 — Launch all Call A invocations in parallel

For every agent in `agentsToRun`, launch its Call A as a parallel `Agent` invocation **in a single tool-use message**. Use the Call A prompts defined in the DESIGN Scoped Calls section below — no changes to agent prompts are needed.

If only 1 or 2 agents need to run, launch whatever is needed simultaneously. Even a single agent is launched the same way — the model is the same regardless of count.

### Step 4 — Collect results and present approvals sequentially

Once **all** parallel agents have returned, present summaries and collect approvals in this fixed order (skipping agents that didn't run):

1. API spec
2. Design tokens + style guide
3. Screen list (wireframes)

For each: display the summary as regular text, then call `AskUserQuestion` for approval.

**Revision loops:** If the user requests changes to one agent's output, re-launch only that agent's Call A with the feedback. The other agents' approved results are held in conversation context — they do not need to re-run. After the revised agent returns, re-present its summary and re-ask approval. Only move to the next agent's approval after the current one is approved.

### Step 5 — Launch post-approval Call B invocations

Once all approvals are collected, **mark agents as started before launching them**, then launch Call B for `design-api-agent` and `design-style-agent` **in parallel** (they write to different files — no conflicts):

- API Call B writes to `generated-docs/specs/api-spec.yaml`
- Style Call B writes to `generated-docs/specs/design-tokens.*` and `web/src/app/globals.css`

**Before launching Call B agents**, mark them as in-progress and refresh the dashboard:
```bash
node .claude/scripts/transition-phase.js --design-agent start "design-api-agent"
node .claude/scripts/transition-phase.js --design-agent start "design-style-agent"
node .claude/scripts/generate-dashboard-html.js --collect
```

**After each Call B returns**, mark the agent as complete and fire a dashboard refresh:
```bash
node .claude/scripts/transition-phase.js --design-agent complete "design-api-agent"
node .claude/scripts/transition-phase.js --design-agent complete "design-style-agent"
```

**Dashboard update (fire-and-forget):** After each `--design-agent complete` call above, run `node .claude/scripts/generate-dashboard-html.js --collect`. See [Dashboard Update Policy](#dashboard-update-policy).

**Do NOT include `design-wireframe-agent` in this batch** — it has a multi-step flow (Call B generates wireframes → another approval → Call C commits).

### Step 6 — Handle wireframe Call B and mock-setup-agent

After the parallel Call B batch completes:

**Before launching Step 6 agents**, mark them as in-progress and refresh the dashboard:
```bash
node .claude/scripts/transition-phase.js --design-agent start "mock-setup-agent" --autonomous
node .claude/scripts/transition-phase.js --design-agent start "type-generator-agent" --autonomous
node .claude/scripts/transition-phase.js --design-agent start "design-wireframe-agent"
node .claude/scripts/generate-dashboard-html.js --collect
```

- **If `mockNeeded` and `api-spec.yaml` now exists on disk:** Launch `mock-setup-agent` Call A. Since mock-setup is fully autonomous (no approvals), it can run **in the foreground while wireframe approval is being collected** — launch mock Call A, then immediately launch wireframe Call B without waiting for mock to finish.
- **If `api-spec.yaml` exists on disk:** Launch `type-generator-agent` (single autonomous call). This can run **in parallel** with mock-setup-agent and wireframe Call B — it reads `api-spec.yaml` (read-only) and writes to `web/src/types/api-generated.ts` + `web/src/lib/api/endpoints.ts`, which have no file conflicts with either agent.
- **Launch `design-wireframe-agent` Call B** with the approved screen list. When it returns, present the wireframe summary, collect approval, then launch Call C (commit).

All three write to completely different file paths — no conflicts:
- type-generator-agent → `web/src/types/api-generated.ts`, `web/src/lib/api/endpoints.ts`
- mock-setup-agent → `web/src/mocks/`, `web/.env.local`
- wireframe agent → `generated-docs/specs/wireframes/`

**After each autonomous agent returns**, mark it complete:
```bash
node .claude/scripts/transition-phase.js --design-agent complete "mock-setup-agent" --autonomous
node .claude/scripts/transition-phase.js --design-agent complete "type-generator-agent" --autonomous
```

**After wireframe Call C returns**, mark wireframes complete:
```bash
node .claude/scripts/transition-phase.js --design-agent complete "design-wireframe-agent"
```

**Dashboard update (fire-and-forget):** After each `--design-agent complete` call above, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy).

After wireframe Call C returns, mock-setup-agent has completed both its calls, and type-generator-agent has returned, proceed to Finalize DESIGN.

### Step 7 — Finalize DESIGN

See the [Finalize DESIGN](#finalize-design) section below (unchanged).

## Per-Phase Scoped Call Prompts

These are the full call prompts for each phase. Both `/start` and `/continue` reference these when invoking agents.

### DESIGN Scoped Calls

**design-api-agent (2 calls):**

Call A: `"This is Call A — Design the API Spec. Read the FRS and manifest, design a complete OpenAPI specification, and write it to generated-docs/specs/api-spec.yaml. Return a human-readable summary of endpoints and models. Do NOT commit. Do NOT use AskUserQuestion."`

Orchestrator: Display summary. Adjust the approval question based on `context.dataSource`:
- **If `api-in-development`:** `AskUserQuestion`: "Here's the API spec — endpoints from your backend team are marked as user-provided, and any gaps I filled for mock coverage are marked as inferred. You can run `/api-status` at any time to see endpoint provenance, mock status, and drift detection. Any corrections before we proceed?" Options: "Looks good" / "I have corrections"
- **Otherwise:** `AskUserQuestion`: "How does this API design look?" Options: "Looks good" / "I have changes"

Call B (approved): `"This is Call B — Commit. The user approved the API spec. Commit and return completion message. Do NOT use AskUserQuestion."`
Call B (changes): `"This is Call B — Revise. Apply these changes: [feedback]. Return updated summary. Do NOT commit. Do NOT use AskUserQuestion."` Then re-approve.

**mock-setup-agent (2 calls — fully autonomous, no approval needed):**

Only invoke when `artifacts.apiSpec.mockHandlers == true`.

Call A: `"This is Call A — Generate Handlers. Read generated-docs/specs/api-spec.yaml and generated-docs/context/intake-manifest.json. Load sample data if context.sampleData is set. Generate web/src/mocks/handlers.ts with realistic mock data. Write generated-docs/context/mock-data-context.md documenting data conventions. Save a copy of the spec to generated-docs/context/mock-spec-snapshot.yaml. Do NOT set up browser infrastructure yet. Do NOT commit. Do NOT use AskUserQuestion."`

Call B: `"This is Call B — Infrastructure Setup. Create web/src/mocks/browser.ts, web/src/components/MockProvider.tsx. Modify web/src/app/layout.tsx to conditionally render MockProvider when NEXT_PUBLIC_USE_MOCK_API is true. Add NEXT_PUBLIC_USE_MOCK_API=true to web/.env.local. Run: cd web && npx msw init public/ --save. Do NOT commit. Do NOT use AskUserQuestion."`

After Call B returns, proceed directly to the next DESIGN artifact (no user interaction required).

**design-style-agent (2 calls):**

Call A: `"This is Call A — Design Tokens + Style Guide. Read the FRS, manifest, and styling notes. Formalize into CSS design tokens and a style reference guide. Write to generated-docs/specs/. Return a summary. Do NOT commit. Do NOT use AskUserQuestion."`

Orchestrator: Display summary. `AskUserQuestion`: "How do the design tokens and style guide look?" Options: "Looks good" / "I have changes"

Call B (approved): `"This is Call B — Commit. The user approved the design tokens and style guide. Integrate the CSS tokens into globals.css (add @import at top, remove Shadcn default :root/.dark blocks), commit, and return completion message. Do NOT use AskUserQuestion."`
Call B (changes): `"This is Call B — Revise. Apply these changes: [feedback]. Return updated summary. Do NOT commit. Do NOT use AskUserQuestion."` Then re-approve.

**design-wireframe-agent (3 calls):**

Call A: `"This is Call A — Screen List Only. Read the FRS and identify all screens needed. [IF prototype source exists: Also read the prototype source at documentation/prototype-src/ to derive the screen list from the actual React page components and routing structure. Cross-reference with the FRS to ensure coverage.] Return the proposed screen list with descriptions. Do NOT generate wireframes yet. Do NOT commit. Do NOT use AskUserQuestion."`

Orchestrator: Display screen list. `AskUserQuestion`: "Does this screen list cover everything?" Options: "Looks good, go ahead" / "I have changes"

If "I have changes": collect feedback, re-launch Call A with the feedback included.

Call B: `"This is Call B — Generate Wireframes. Here is the approved screen list: [paste]. [IF prototype source exists: Use the React component structure at documentation/prototype-src/ as the primary layout reference — read each page component and its children to produce wireframes that accurately reflect the prototype's layout, interactions, and data display patterns.] Generate text-based wireframes for each screen, write files to generated-docs/specs/wireframes/. Return a summary. Do NOT commit. Do NOT use AskUserQuestion."`

Orchestrator: Display wireframe summary. `AskUserQuestion`: "How do the wireframes look?" Options: "Looks good" / "I have changes"

If "I have changes": collect feedback. `"This is Call B — Revise Wireframes. The user wants these changes: [feedback]. Update the wireframe files accordingly. Return updated summary. Do NOT commit. Do NOT use AskUserQuestion."` Then re-approve.

Call C: `"This is Call C — Commit. The user approved the wireframes. Commit all wireframe files and return completion message. Do NOT use AskUserQuestion."`

**Prototype source conditional:** The `[IF prototype source exists: ...]` clauses in Call A and Call B above are conditional. Before invoking the wireframe agent, check the intake manifest for `context.prototypeSource`. If it exists, include the bracketed text in your prompt (removing the brackets and the IF prefix). If it does not exist, omit the bracketed text entirely.

**Parallel execution:** Follow the [DESIGN Execution Model — Parallel Call A](#design-execution-model--parallel-call-a) section above for the launch sequence. Do NOT run agents sequentially — launch all Call A invocations in a single tool-use message, then handle approvals and Call B invocations as described in the execution model.

### Finalize DESIGN

After all agents complete (or all copies are done):

1. If any files were copied (not generated by agents), commit them:
   ```bash
   git add generated-docs/specs/ .claude/logs/ && git commit -m "chore(design): copy user-provided artifacts to specs"
   ```
2. Transition state from DESIGN to SCOPE:
   ```bash
   node .claude/scripts/transition-phase.js --to SCOPE --verify-output
   ```

**If no artifacts needed generation AND no files needed copying:** Print a confirmation ("No DESIGN artifacts needed — all skipped per manifest.") and transition directly to SCOPE.

**Dashboard update (fire-and-forget):** Before instructing the user to clear, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy). This captures the finalized DESIGN state.

This is **clearing boundary #2**. Instruct user to `/clear` then `/continue`.

### SCOPE (2 scoped calls)

**Call A — Propose Epics:**

Launch `feature-planner` with prompt:
> "This is Call A — Propose Epics. You are in SCOPE mode. Read the FRS at [spec path] and propose an epic breakdown. Return the epic list with descriptions and dependency map. Do NOT write any files. Do NOT commit. Do NOT use AskUserQuestion."

**Orchestrator:** Display the epic list. Use `AskUserQuestion`:
- "Does this breakdown look right?"
- Options: "Looks good" / "I'd restructure"

If "I'd restructure": collect feedback, re-launch Call A with the feedback included.

**Call B — Write + Commit:**

> "This is Call B — Write and Commit. The user approved this epic breakdown: [paste approved list]. Write _feature-overview.md, update CLAUDE.md Project Overview section. Commit and push. Run the state transition."

After Call B returns:

**Dashboard update (fire-and-forget):** Fire a background dashboard refresh per the [Dashboard Update Policy](#dashboard-update-policy). This captures the new epic structure.

This is **clearing boundary #3**. Instruct user to `/clear` then `/continue`.

### STORIES (2 scoped calls)

**Call A — Propose Stories:**

Launch `feature-planner` with prompt:
> "This is Call A — Propose Stories. You are in STORIES mode for Epic [N]. Read the FRS and epic overview. Propose stories for this epic with descriptions. Return the story list. Do NOT write story files. Do NOT commit."

**Orchestrator:** Display the story list. Use `AskUserQuestion`:
- "Does this look right for Epic [N]?"
- Options: "Looks good" / "I'd change things"

If changes: collect feedback, re-launch Call A.

**Call B — Write Acceptance Criteria + Commit:**

> "This is Call B — Write Stories and Commit. The user approved these stories: [paste approved list]. Write story files with full acceptance criteria, create _epic-overview.md. Commit and push. Run the state transition."

After Call B returns:

**Dashboard update (fire-and-forget):** Fire a background dashboard refresh per the [Dashboard Update Policy](#dashboard-update-policy). This captures the newly defined stories.

Proceed directly to REALIGN for the first story (not a clearing boundary).

### REALIGN (1-2 scoped calls)

**Call A — Check Impacts:**

Launch `feature-planner` with prompt:
> "This is Call A — Check Impacts. You are in REALIGN mode for Epic [N], Story [M]. Read discovered-impacts.md. If no impacts exist, run the state transition to TEST-DESIGN and return 'No impacts — auto-completed.' If impacts exist, analyze them and return proposed revisions to the story."

**Orchestrator:**
- If "No impacts — auto-completed": the agent has already run the state transition. Proceed directly to TEST-DESIGN (no user interaction).
- If revisions proposed: display them, use `AskUserQuestion`:
  - "Does this revision make sense?"
  - Options: "Yes, looks good" / "I'd change it"

**Call B — Apply Revisions (only if impacts existed and were approved):**

> "This is Call B — Apply Revisions. Apply these approved revisions: [paste]. Update the story file, clear processed impacts, commit. Run the state transition."

**Dashboard update (fire-and-forget):** After REALIGN completes (whether auto-completed or after Call B), regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy). This captures the current story's phase progression.

After REALIGN completes, proceed directly to TEST-DESIGN.

### TEST-DESIGN (2 scoped calls + BA decision persistence)

**Call A — Design Test Scenarios:**

Launch `test-designer` with prompt:
> "This is Call A — Design Test Scenarios for Epic [N], Story [M]. Story file: [path]. Produce a specification-by-example document for BA review and downstream test generation. You MUST follow the Required Template defined in your agent instructions — use Setup/Input/Expected tables (NOT Given/When/Then), and include ALL required sections: Story Summary, Review Purpose, Business Behaviors Identified, Key Decisions Surfaced by AI, Test Scenarios / Review Examples, Edge and Alternate Examples, Out of Scope, Coverage for WRITE-TESTS (AC → example mapping), and Handoff Notes for WRITE-TESTS. Every `BA decision required` block MUST carry a stable `(BA-<N>)` ID starting at BA-1, as documented in the test-designer agent instructions. Write the document to generated-docs/test-design/. Return a summary listing scenario titles, counts (main examples, edge examples, BA decisions required), and any key ambiguities. Do NOT run the transition script. Do NOT commit. Do NOT use AskUserQuestion."

**Orchestrator — Enumerate BA decisions:** Before presenting the doc to the user, run:
```
node .claude/scripts/list-ba-decisions.js --epic N --story M
```
Parse the JSON to get the array of unresolved `{ id, question, options }` decisions. If the script returns a non-`ok` status, stop and surface the error — the rest of this flow depends on a readable test-design file.

**Orchestrator — Present doc + collect per-decision answers:** Read the full generated test-design document from `generated-docs/test-design/` and display its complete contents to the user (not just the agent's summary). Always include a clickable markdown link to the full document file (e.g., `[epic-N-story-M-title.md](generated-docs/test-design/epic-N-story-M-title.md)`) so the user can open it directly. Then compose a single `AskUserQuestion` call with:
- **Question 1 (always):** "How does this test design look for [Story Name]?" — options `Looks good` / `I have changes`.
- **Questions 2..k (one per BA decision):** For each decision returned by `list-ba-decisions.js`, add a question like `"[BA-X] [question text]"` with one option per `Option <letter>: <text>` entry.
- `AskUserQuestion` caps at 4 questions per call. If there are more than 3 decisions, present Question 1 + the first 3 decisions in the initial call, then issue a follow-up `AskUserQuestion` (fresh turn) carrying the next batch of up to 4 decisions, and repeat until every decision has an answer.

If Question 1 returns `I have changes`: do NOT call `resolve-ba-decision.js` and do NOT run the transition. Collect feedback and re-launch Call A with feedback:
> "This is Call A — Revise Test Design for Epic [N], Story [M]. Story file: [path]. Apply these changes: [feedback]. Update the test-design document at [test-design path] and the test-handoff document at [test-handoff path] (if feedback affects examples, coverage mapping, or testability classification). Preserve existing `(BA-<N>)` IDs on unchanged decision blocks; assign new consecutive IDs to any newly added decisions. Return updated summary. Do NOT run the transition script. Do NOT commit. Do NOT use AskUserQuestion."

After revision: re-enumerate via `list-ba-decisions.js`, re-present the doc, and re-ask approval.

**Note:** The test-designer also produces a test-handoff document alongside the test-design document. Do NOT display the handoff document to the user — it is an engineering artifact for downstream agents. Only the test-design document (sections 1-8) is presented for BA review.

**Orchestrator — Persist every resolved decision (MANDATORY, before Call B):** Once the user selects `Looks good` and has answered every decision question, run `resolve-ba-decision.js` once per decision:
```
node .claude/scripts/resolve-ba-decision.js \
  --epic N --story M \
  --decision-id BA-X \
  --option <letter the user selected>
```
Verify each invocation returned `"status": "ok"` (or `"status": "warning"` if the block was already resolved — that is also a success case for idempotency, e.g. after a re-run). A `"status": "error"` return means the ID is missing from the doc and must be treated as a blocker — stop and surface the error to the user. Do NOT proceed to Call B until every decision has been persisted. Skipping this step leaves the test-design doc in a stale "pending" state across machines, which is exactly the failure mode this plumbing exists to prevent.

If the test-design doc has zero BA decisions, skip the persistence step entirely and proceed to Call B.

**Call B — Transition (after approval + persistence):**

> "This is Call B — Transition. The user approved the test design for Epic [N], Story [M] and all BA decisions have been persisted to the test-design document via resolve-ba-decision.js. Run the transition script to move to WRITE-TESTS. Do NOT use AskUserQuestion."

**Dashboard update (fire-and-forget):** After Call B returns, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy). The dashboard's `baDecisionsPending` counter uses a `/BA decision required/gi` regex that no longer matches resolved blocks, so `baDecisionsPending` will drop to 0 automatically.

After Call B returns, proceed directly to WRITE-TESTS.

### WRITE-TESTS (single call — fully autonomous)

Launch `test-generator` with prompt:
> "Generate tests for Epic [N], Story [M]. Story file: [path]. Test design: [test-design path]. Test handoff: [test-handoff path]. Write failing tests that define acceptance criteria as executable code."

**Dashboard update (fire-and-forget):** After the test-generator returns, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy).

After it returns, proceed directly to IMPLEMENT.

### IMPLEMENT (2 scoped calls)

Before invoking `developer`, run `npm test` in `/web` to identify failing tests for the current story. Show the user which tests are failing and include the output when handing off.

**Call A — Implement:**

> "This is Call A — Implement. Read the story at [path] and tests at [path]. Here are the current failing tests: [paste output]. Write code to make all failing tests pass. Do NOT run quality gates in this call."

**Call B — Pre-flight Test Check:**

> "This is Call B — Pre-flight Test Check. Run `npm test` to verify all tests pass. Fix any failures. Do NOT run lint, build, or test:quality — the code-reviewer handles the full canonical quality gate suite during QA. Do NOT commit."

**Dashboard update (fire-and-forget):** After developer Call B returns, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy).

After Call B returns, proceed directly to QA.

### QA (3 scoped calls)

**Call A — Code Review:**

Launch `code-reviewer`:
> "This is Call A — code review only. Test handoff document: [test-handoff path]. Do NOT run quality gates or commit."

**Call B — Simplify + Quality Gates:**

Launch `code-reviewer`:
> "This is Call B — first run /simplify on the changed code, then run quality gates and return results. Also read the story file and the test-handoff document at [test-handoff path] (for any runtime verification checklist items) and compose the manual verification checklist. IMPORTANT: You MUST persist the checklist to generated-docs/qa/epic-N-[slug]/story-M-[slug]-verification-checklist.md (create the directory if needed) — this file is the single source of truth for all re-verification prompts during QA fix cycles. Return the checklist text in your response as well. If no test-handoff document exists at that path, proceed without it. Also return a `Route:` line (either `Route: <path>` for routable stories or `Route: N/A` for component-only work) and a `Deferred stories:` line listing any earlier non-routable stories whose verification items you folded into this story's checklist (format: `Deferred stories: epic-1-story-6, epic-1-story-7` or `Deferred stories: none`). Do NOT commit. Just return the gate results, the `Route:` line, the `Deferred stories:` line, and the checklist."

**E2E Verification (Gate 6a) — runs between Call B and Manual Verification:**

After Call B returns quality gates and the manual checklist, but BEFORE the user is asked to verify in the browser, Playwright runs against a live dev server. The goal is to catch runtime issues (broken auth flows, wrong redirects, missing backend calls) without the user having to reproduce them. **This step never asks the user on pass — only on escalation after 3 failed auto-fix cycles.**

Delegate this step to a coordinator subagent — the parent orchestrator never runs Playwright directly (2–3 tool-call limit).

1. **Resolve the target set from Call B's output:**
   - Parse `Route:` — if `Route: N/A`, record `e2eStatus: auto-skipped:non-routable` in workflow state and proceed directly to the non-routable manual-verification branch below. Do not check for spec files.
   - Parse `Deferred stories:` — extract the list of (epic-N, story-M) pairs.
   - Build target globs: `[web/e2e/epic-<N>-story-<M>-*.spec.ts]` for the current story PLUS one glob per deferred story. Call this the **combined target set**.

2. **Classify each target in the combined set** using a simple file inspection (grep, no Playwright run yet):

   | Target status | Decision |
   |---|---|
   | Spec file missing | Halt. Return `NEEDS_APPROVAL:` with the three-way prompt described in "Halt prompts" below. Record `e2eStatus: missing`. |
   | Spec exists, every `test(` block is inside a `test.fixme(` wrapper (grep for `test.fixme(` and absence of unwrapped `test(` or `test.only(`) | Target is a skip. If every target in the set is a skip, record `e2eStatus: auto-skipped:fixme` and proceed to manual verification. If this target is a deferred story being re-verified, halt with the three-way prompt — deferred re-verification is the forcing function that converts skips into live tests. |
   | Spec exists with at least one live `test(` | Target is live. Include it in the Playwright run. |

3. **Run Playwright against all live targets:**

   ```bash
   cd web && npx playwright test <glob-1> <glob-2> ... --reporter=json > /tmp/e2e-report.json
   ```

   Capture the JSON report and the exit code.

4. **On exit 0 (PASS):**
   - Record `e2eStatus: passed`, set `e2eLastRun`, `e2ePassCount`, `e2eFailCount`, `deferredE2eTargets` (the deferred globs that were included) in workflow state via the transition-phase script.
   - Display: "End-to-end tests passed in a live browser. (N tests across M specs)."
   - Proceed to manual verification (display checklist + AskUserQuestion).

5. **On non-zero exit (FAIL):**
   - Record `e2eStatus: failed`.
   - Auto-trigger the **E2E fix cycle** (see "QA Fix Cycle" below) — do NOT ask the user. Pass the failing-tests summary from the JSON report as the "issues reported" payload.

**Halt prompts (when a spec is missing or a deferred spec is still `test.fixme()`):**

> "<context sentence>. Options:
> - (a) Re-run test-generator to produce/replace the Playwright spec now.
> - (b) Mark the story `test.fixme()` permanently in the spec file, documenting the reason in a comment above.
> - (c) Skip E2E for this story this round (records `e2eStatus: user-skipped` and proceeds to manual verification)."

Context sentence templates:
- Missing current-story spec: "Story N-M was built as routable (`<path>`) but has no Playwright spec at web/e2e/epic-N-story-M-*.spec.ts."
- Missing deferred-story spec: "Deferred story X-Y is being re-verified because it's now reachable through the current story, but has no Playwright spec."
- Deferred `test.fixme()` on re-verification: "Deferred story X-Y has a Playwright spec wrapped in `test.fixme()` — reaching it via the current story's flow is the moment to convert the skip into a live assertion."

**Orchestrator — Manual Verification:**

After Call B returns AND E2E Verification resolves:
1. Display the quality gate results to the user (in plain, non-technical language)
2. Check if Call B's response indicates a **non-routable component** (Route: `N/A`)

**If non-routable (component only):**
3. Display Call B's component-only note to the user
4. Record `e2eStatus: auto-skipped:non-routable` (set by the E2E step above)
5. Auto-proceed to **Spec Compliance Check (Gate 6)** with verification status `auto-skipped` — do NOT ask the user to verify in the browser (they can't reach the component yet)

**If routable:**
3. Display the E2E result line ("End-to-end tests passed in a live browser." or the user-resolved outcome) so the user knows an automated pre-check ran.
4. Display the manual verification checklist from Call B's response (including any deferred verification items from earlier stories)
5. Use `AskUserQuestion` directly:
   - "Have you verified [Story Name] in the browser?"
   - Options: "All tests pass" / "Issues found" / "Skip for now"
6. If "All tests pass" or "Skip for now": proceed to **Spec Compliance Check (Gate 6)** below
7. If "Issues found": follow the **QA Fix Cycle** below

#### QA Fix Cycle (Issues Found OR E2E Failed)

**CRITICAL:** The orchestrator must NEVER fix issues directly — this triggers the hook-dispatch bug. Always delegate to a coordinator subagent.

The fix cycle has **two triggers**:

- **User-triggered:** the user selected "Issues found" during manual verification.
- **E2E-triggered:** Playwright produced failing results during the E2E Verification step, before the user saw the manual checklist. **The user is not prompted** — the orchestrator treats the Playwright JSON report as the "issues reported" payload and delegates automatically.

**User-triggered flow:**

1. Use `AskUserQuestion`: "What did you find? Describe the issues so I can fix them."
2. After user responds → **new turn with fresh hooks** → launch a new coordinator (see prompt template below) with the user's description as `## Issues Reported`.
3. When the fix coordinator returns with NEEDS_APPROVAL → re-run the **E2E Verification step** against the combined target set. If it passes, display the fix summary + full checklist → `AskUserQuestion` with the same three options. If it fails, the E2E-triggered flow takes over (step 3 onward below).

**E2E-triggered flow:**

1. Extract the failing-tests summary from the Playwright JSON report (`suites[].specs[].tests[].results[]` where `status !== 'passed'`). Include: test title, error message, relevant trace/snapshot paths, and the file:line of the failing assertion.
2. Launch a new coordinator (see prompt template below) with the extracted summary as `## Issues Reported (from Playwright)`, plus `## E2E report path: /tmp/e2e-report.json` so the developer can inspect traces.
3. When the coordinator returns → re-run the **E2E Verification step** against the same combined target set (not a broader run — we want targeted signal).
4. **If re-run passes:** proceed to the manual verification prompt with a note: "Fixed N failing E2E tests automatically; please still verify in the browser." Record `e2eStatus: passed-after-fix`, set `e2eFixCycleCount: <N>`.
5. **If re-run fails:** increment `e2eFixCycleCount` and loop from step 2. **Cap at 3 consecutive failed cycles** — on the 4th attempt, escalate to the user:
   - Record `e2eStatus: escalated`.
   - Return `NEEDS_APPROVAL:` with the latest Playwright report and the three options:
     - (a) "Fix manually" — exits the loop so the user can take over in the chat.
     - (b) "Skip E2E this round and continue to manual verification" — records `e2eStatus: user-skipped-after-escalation` and proceeds.
     - (c) "Mark the failing specs `test.fixme()` and proceed" — coordinator edits the spec file to wrap the failing `test()` blocks in `test.fixme()` with a comment explaining the escalation, then proceeds.

**Coordinator prompt template (both flows):**

```
You are a QA fix-cycle coordinator. <trigger sentence>

## Trigger
<"User found issues during manual verification." OR "Playwright E2E tests failed during the QA pre-check.">

## Issues Reported
[paste user's description OR the Playwright failing-tests summary]

## E2E report path (E2E-triggered only)
/tmp/e2e-report.json — includes per-test traces, screenshots in web/test-results/.

## Current State
[paste state JSON]

## Your Tasks
1. Launch developer agent to fix the reported issues:
   "Fix these issues in Epic [N], Story [M]: [issues]. <If E2E-triggered: "The Playwright JSON report at /tmp/e2e-report.json contains full failure details, traces, and screenshots."> Do NOT run quality gates. Do NOT commit. Do NOT use AskUserQuestion."
2. After the developer returns, summarize what was changed (files modified, what the fix does).
   Do NOT launch code-reviewer Call A or Call B. Do NOT run quality gates or Vitest tests.
   Quality gates will run once in Call C after the fix resolves.
3. Read the verification checklist from generated-docs/qa/epic-N-[slug]/story-M-[slug]-verification-checklist.md. Return with "NEEDS_APPROVAL:" followed by:
   a. A plain-language summary of the fix.
   b. The COMPLETE verification checklist (copied verbatim from the file — do not rephrase or abbreviate).
   c. Only for user-triggered cycles: "Have you verified [Story Name] in the browser? Options: All tests pass / Issues found / Skip for now"
   d. For E2E-triggered cycles: note that Playwright will re-run automatically — the user doesn't need to re-verify unless that run passes.

Follow all rules in orchestrator-rules.md — especially scoped call patterns and voice guidelines.
Do NOT use AskUserQuestion — return NEEDS_APPROVAL instead.
Do NOT commit or run transition scripts.
Do NOT run quality gates, Vitest, /simplify, or code review — those run once at the end.
Do NOT run Playwright yourself — the parent orchestrator re-runs it after you return.
```

**CRITICAL: Always re-present the full manual verification checklist.** Every time the user is asked to verify or re-verify in the browser — whether on first presentation or after any number of fix cycles — include the complete checklist from the `verification-checklist.md` file. Never abbreviate it, never remove steps, and never refer the user to a previous message. The checklist must be self-contained each time it is shown.

After a fix cycle (either trigger) resolves:
- User-triggered, user says "Issues found" again → repeat the user-triggered flow (fresh hooks each turn).
- Proceeding to manual verification → proceed to spec compliance check afterward, noting that a fix cycle occurred (see below).

#### Spec Compliance Check (Gate 6)

After the user confirms manual verification (or after the fix cycle completes), and BEFORE Call C, run the spec-compliance-watchdog.

**Watchdog Call A — Analyze:**

Launch `spec-compliance-watchdog`:
> "This is Call A — Analyze Compliance for Epic [N], Story [M]. Story file: [story path]. Test-design document: [test-design path]. Test-handoff document: [test-handoff path]. Compare every acceptance criterion and every test-design scenario against the actual implementation and test files. Return a structured compliance report. Do NOT modify any files. Do NOT commit. Do NOT use AskUserQuestion."

> **WARNING — NEVER SUPPRESS DRIFT FINDINGS**
>
> When composing the watchdog prompt, do NOT include instructions to ignore, skip, or excuse any changes — regardless of origin (QA fix cycle, user request, or otherwise). The watchdog must detect ALL spec-vs-code drift so that spec documents get updated. Pass fix-cycle context as informational background only (e.g., "A QA fix cycle occurred: [description]"), NOT as an instruction to skip findings. The orchestrator handles resolution (Option A or B) after the watchdog reports.

**Orchestrator — Handle Results:**

After Call A returns:

**If PASS (no inconsistencies):**
- Display: "Spec compliance check passed — everything matches what was planned."
- Proceed to Call C.

**If FAIL (inconsistencies found):**
1. Display the compliance report to the user in plain language. Frame each finding as: "The spec said X, but the code does Y."
2. Use `AskUserQuestion`:
   - "There are [X] differences between what was planned and what was built. How would you like to handle this?"
   - Options:
     - "Fix the code to match the specs" (Option A)
     - "Update the specs to match the code" (Option B)

**If Option A (fix code to match specs):**
1. Launch a QA fix-cycle coordinator (same pattern as manual verification fix cycle) with the compliance findings as the issue description:
   ```
   You are a spec-compliance fix coordinator. The spec-compliance-watchdog found inconsistencies.

   ## Findings
   [paste compliance report]

   ## Your Tasks
   1. Launch developer agent to fix each inconsistency so that the code matches the spec:
      "Fix these spec compliance issues in Epic [N], Story [M]: [findings]. Make the code match what the acceptance criteria and test-design scenarios describe. Do NOT run quality gates. Do NOT commit. Do NOT use AskUserQuestion."
   2. After the developer returns, summarize what was changed.
   3. Return with "NEEDS_APPROVAL:" followed by a summary of changes.

   Do NOT use AskUserQuestion — return NEEDS_APPROVAL instead.
   Do NOT commit or run transition scripts.
   Do NOT run quality gates, tests, /simplify, or code review — those run once at the end.
   ```
2. After the fix coordinator returns → display summary → re-run watchdog Call A to verify fixes resolved the inconsistencies
3. If watchdog still finds issues → present to user again with all three options (after 2 Option A cycles, suggest Option B as an alternative)
4. When watchdog passes → proceed to Call C (note: code was changed, so Call C must re-run quality gates)

**If Option B (update specs to match code):**

Launch `spec-compliance-watchdog`:
> "This is Call B — Update Specs for Epic [N], Story [M]. The user chose to update the generated docs to match the implementation. Here are the findings: [paste compliance report]. Update the story file, test-design document, and test-handoff document so they accurately describe what was actually implemented. Do NOT modify source code or test files. Do NOT commit. Do NOT use AskUserQuestion."

After Call B returns:
- Display the update summary to the user
- Proceed to Call C (generated-docs files were modified, so they will be staged in the commit)
**Dashboard update (fire-and-forget):** After the watchdog returns (pass or after resolution), regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy).

**Call C — Commit:**

Pass the verification status into Call C so it can record it in workflow state. **Adjust the prompt based on whether a QA fix cycle or spec compliance fix occurred:**

If **no fix cycle** occurred and **spec compliance passed or was skipped** (user confirmed on first attempt or auto-skipped):

> "The user confirmed manual verification. Status: [passed|auto-skipped|skipped]. E2E: [passed|auto-skipped:non-routable|auto-skipped:fixme|user-skipped]. [If deferred stories were included in the checklist and the user confirmed: Also mark stories N, M as deferred-passed.] IMPORTANT: Before staging, run `node .claude/scripts/transition-phase.js --pre-complete-checks --current --story M` (replacing M with the story number) to auto-check all acceptance criteria in the story file. Then proceed to commit and transition to COMPLETE. Do NOT run quality gates again — they already passed before manual verification, and E2E already ran. [If spec-compliance-watchdog Option B was used: Also stage generated-docs/test-design/ — the spec documents were updated to match the implementation.] Stage the Playwright spec file web/e2e/epic-N-story-M-*.spec.ts along with the Vitest tests."

If a **fix cycle occurred** (code was changed during QA — either user-triggered or E2E-triggered):

> "The user confirmed manual verification after a QA fix cycle. Status: [passed|skipped]. E2E: [passed|passed-after-fix|user-skipped-after-escalation]. Fix cycles: [user-triggered|e2e-triggered|both]. [If deferred stories were included in the checklist and the user confirmed: Also mark stories N, M as deferred-passed.] IMPORTANT: Before staging, run `node .claude/scripts/transition-phase.js --pre-complete-checks --current --story M` (replacing M with the story number) to auto-check all acceptance criteria in the story file. Code was changed during the fix cycle, so you MUST re-run all Vitest-side quality gates (lint, type-check, build, vitest, test:quality) before committing. Playwright does NOT need a re-run — it already passed (or was explicitly marked `test.fixme()` via user escalation). If any Vitest-side gate fails, fix the issue and re-run until all gates pass. Then proceed to commit and transition to COMPLETE. [If spec-compliance-watchdog Option B was used: Also stage generated-docs/test-design/.] Stage the Playwright spec file web/e2e/epic-N-story-M-*.spec.ts along with the Vitest tests."

**After Call C returns:**

**Dashboard update (fire-and-forget):** Before displaying the code-reviewer's return message, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy). This captures the completed story's final state.

Display its return message and **STOP**. The message contains the `/clear` + `/continue` instruction. Do not launch the next agent.

## COMPLETE — Next Step Routing

After a story's QA phase commits and the user runs `/clear` + `/continue`, the transition script determines what's next:

- More stories in epic → Proceed to REALIGN for next story
- No more stories but more epics → Proceed to STORIES for next epic
- No more stories and no more epics → Display success message - feature complete!

## TodoWrite Progress Display

After initializing or validating workflow state, display the TodoWrite progress list:

```bash
node .claude/scripts/generate-todo-list.js
```

Parse the JSON output and call `TodoWrite` with the resulting array. This gives the user an immediate visual of the workflow phases.

**After each agent completes and returns to you**, re-run this script and update TodoWrite to reflect the new state. This keeps the progress display current throughout the workflow.

**`/continue` dispatcher note:** When using the dispatcher pattern, the coordinator subagent handles TodoWrite reconstruction — the parent orchestrator must NOT call TodoWrite directly (to stay within the 2–3 tool call limit).

## Script Execution Verification

**All transition scripts output JSON. Always verify the result before proceeding:**

1. `"status": "ok"` = Success, proceed to next step
2. `"status": "error"` = **STOP**, report the error to the user
3. `"status": "warning"` = Proceed with caution, inform user

**Troubleshooting:**
- Check current state: `node .claude/scripts/transition-phase.js --show`
- Validate artifacts: `node .claude/scripts/validate-phase-output.js --phase <PHASE> --epic <N>`
- Repair if needed: `node .claude/scripts/transition-phase.js --repair`

## FRS-Over-Template Rule (CRITICAL)

The FRS (`generated-docs/specs/feature-requirements.md`) and story acceptance criteria are the **sole source of truth** for how features should be implemented. This repository was scaffolded from a starter template that includes default implementations (NextAuth, demo login pages, placeholder layouts, etc.) that may **conflict** with spec requirements.

**Before every WRITE-TESTS and IMPLEMENT invocation**, include this reminder in the agent prompt:

> "IMPORTANT: The FRS and story acceptance criteria override any pre-existing template code in the repo. If the spec requires a different approach than what the template provides (e.g., BFF auth instead of NextAuth), you must replace the template code — not extend it. Read the story and FRS requirements before looking at existing code."

**Why this exists:** In an earlier session, the developer agent built on the existing NextAuth template instead of implementing BFF auth as the FRS required (`R1: The Next.js app does not render a custom login page`). This caused multiple QA fix cycles. Template code is a starting point, not a constraint.

## Commit Policy

**IMPORTANT:** To avoid loss of work, create commits at every logical point:

- After INTAKE phase completes (FRS and manifest produced)
- After SCOPE phase completes (epics defined)
- After STORIES phase completes for each epic
- After each story's QA phase passes (commit includes tests + implementation)
- After creating multiple files (e.g., after every 2-3 wireframes)
- Before handing off to another agent

Each story is committed AFTER its QA phase passes, not after IMPLEMENT.

### Commit Message Format (Conventional Commits)

All commit messages MUST follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Description** must be lowercase, imperative mood ("add", not "added" or "adds"), and not end with a period.

**Allowed types:**

| Type | When to use |
|------|-------------|
| `feat` | New user-facing functionality (story implementation) |
| `fix` | Bug fix (story implementation when the story is a bug fix) |
| `docs` | Documentation-only changes (INTAKE, DESIGN, SCOPE, STORIES, REALIGN artifacts) |
| `refactor` | Code restructuring with no behavior change |
| `test` | Adding or updating tests only |
| `chore` | Housekeeping — copying artifacts, config changes, dependency updates |

**Scope conventions by workflow phase:**

| Phase | Scope | Example |
|-------|-------|---------|
| INTAKE | `intake` | `docs(intake): produce feature requirements specification` |
| DESIGN | `design` | `docs(design): generate OpenAPI spec for dashboard` |
| SCOPE | `scope` | `docs(scope): define epics for dashboard` |
| STORIES | `stories` | `docs(stories): add stories for epic 1 — user management` |
| REALIGN | `realign` | `docs(realign): update story 2 based on implementation learnings` |
| QA (story commit) | `epic-N` | `feat(epic-1): story 2 — add user profile page` |

**Story commits (QA phase)** use `feat`, `fix`, or `refactor` depending on the story's nature, with the epic as scope:

```
feat(epic-1): story 2 — add user profile page

- Implemented: profile card, avatar upload, edit form
- Tests: all passing
- Quality gates: all passing
- Manual verification: passed | auto-skipped (component only) | skipped

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Breaking changes** are indicated by appending `!` after the scope or by adding a `BREAKING CHANGE:` footer:

```
feat(epic-2)!: story 3 — replace legacy auth with OAuth2
```