<!-- Source: optional-phasing-plan.md (Item 7) — keep in sync when phase boundary handler changes -->

## Phase: PHASE-BOUNDARY

A phase has completed. Handle two cases based on `state.phaseStatus`:

### Case A: Fresh arrival (phaseStatus: "ready")

The previous phase has just completed (last epic in the current phase passed
QA). The user must choose how to proceed before any further work happens.

1. Call `getPhases()` to identify which phase just finished and what's next.
2. Use `AskUserQuestion` with two options:
   - "Continue to [next phase] as planned"
   - "Stop here — [completed phase] is enough for now"
3. Based on the user's choice, run the matching transition:
   - Continue: `--advance-phase` → transition to STORIES for next epic
   - Stop here: `--pause-phase` → display dashboard summary and STOP

### Case B: Resume from pause (phaseStatus: "paused")

The user previously picked "Stop here" (pausing the workflow) and has now run
`/continue` to resume. Auto-resume without re-asking — running `/continue` is
itself the intent signal.

1. Call `checkStaleness(state.pausedAt)` (from workflow-helpers.js).
2. If result is `'silent'`: run `--advance-phase` and transition to STORIES.
3. If result is `'notify'`: print the one-line notification, then run
   `--advance-phase` and transition. Do not use AskUserQuestion.
4. If result is `'halt'`: something is broken. Use AskUserQuestion to describe
   the problems and ask how to proceed. Do NOT auto-advance.

### Do not auto-advance in Case A

In the fresh-arrival case, never proceed past a PHASE-BOUNDARY without
explicit user input. This is a mandatory checkpoint.
