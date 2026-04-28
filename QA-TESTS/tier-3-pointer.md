# Tier 3 — Live Behavioural Tests

Tier 3 is **not implemented in QA/**. It lives in the repository root as two documents:

- **`/TEST-GUIDE.md`** — 38 manual test cases with PASS/FAIL steps, verification commands, and rollback instructions
- **`/TEST-INPUTS.md`** — canonical scripted answers for the Team Task Manager scenario and Variants A–F

## When to run Tier 3

- Before a major template release
- After changes to `.claude/shared/orchestrator-rules.md`
- After adding or removing an agent
- After modifying the hook configuration in `.claude/settings.json`
- When a Tier 2 golden log needs re-harvesting

## How a Tier 3 run feeds Tier 2

Every live run produces a `.claude/logs/<timestamp>-<slug>-<sessionid>.md` file. After a successful end-to-end run:

```bash
cp .claude/logs/<session>.md QA/fixtures/golden-logs/YYYY-MM-DD-full-happy-path.md
```

Then run Tier 2 locally to confirm all invariants still hold. If any fail, either the change broke the workflow (fix the workflow) or it invalidated an invariant (update the invariant).

## What Tier 3 catches that Tiers 1 and 2 cannot

- The real AI behaviour of each agent, not just the scripts supporting it
- Interactions between hooks, agents, and commands that only manifest in live sessions
- Whether Claude actually obeys policy rules (e.g., FRS-over-template, plain-language)
- End-to-end timing and UX (dashboard auto-refresh, dev server interaction)

Tier 3 is expensive but irreplaceable. Tiers 1 and 2 exist to let most regressions be caught cheaply so Tier 3 only needs to run occasionally.
