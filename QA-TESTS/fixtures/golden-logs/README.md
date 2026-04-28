# Golden Session Logs

Harvested `.claude/logs/*.md` files from full end-to-end workflow runs. Tier 2 invariant tests replay these without needing to re-run Claude.

## How to harvest

1. Run a clean `/start` → ... → commit cycle end-to-end with the Team Task Manager answers from `/TEST-INPUTS.md`.
2. Find the resulting log:
   ```bash
   ls -lt .claude/logs/*.md | head -3
   ```
3. Copy it here with a descriptive name and date:
   ```bash
   cp .claude/logs/<session>.md QA/fixtures/golden-logs/2026-MM-DD-full-happy-path.md
   ```
4. Commit the file. Golden logs ARE committed (see `.gitignore`).

## What the invariants check

Each log is a single run. The invariants in `tier-2-log-replay/invariants/` make assertions like:
- "Every response ends with `[Logs saved]`"
- "`generate-dashboard-html.js` fires before each `/clear + /continue` instruction"
- "The `developer` agent is invoked exactly 2× per IMPLEMENT phase"
- "The parent orchestrator makes ≤ 3 tool calls before delegating to a coordinator"

See `/TEST-STRATEGY.md` § 11 for the full invariants list.

## When to re-harvest

A CI canary test warns if the newest golden log is older than `.claude/shared/orchestrator-rules.md`. When that fires:

1. Run a fresh end-to-end workflow with the main Team Task Manager scenario.
2. Replace the oldest `full-happy-path` log here.
3. Run the Tier 2 suite locally to confirm invariants still hold — if any fail, the rule change may have broken the workflow or the invariant needs updating.
