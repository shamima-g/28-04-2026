# Fixtures

Deterministic test inputs. Grouped into three categories:

## scenarios/

Team Task Manager scenario from `/TEST-INPUTS.md`, plus Variants A–F:

- `team-task-manager/` — main scenario (no compliance, frontend-only auth, backend in development)
- `variant-a-bff/` — BFF auth with real URLs
- `variant-b-no-backend/` — no backend at all (`mock-only`)
- `variant-c-user-spec/` — user-provided `task-api.yaml`
- `variant-d-ts-error/` — TypeScript error injection (for quality-gates tests)
- `variant-e-frs-override/` — BFF-from-start to test NextAuth removal
- `variant-f-impacts/` — pre-populated `discovered-impacts.md`

Each folder contains the exact scripted answers, expected outputs, and any source files the variant introduces.

## checkpoints/

Tarball fixtures for `CP-0` through `CP-6`. Each is a `.tar` of `generated-docs/` and `web/src/` at the corresponding workflow state.

**These are NOT committed by default** (see `.gitignore`). To harvest:

```bash
# From a real run that's reached the checkpoint:
tar -cf QA/fixtures/checkpoints/CP-1.tar generated-docs/
```

If the tarballs are absent, `loadCheckpoint()` falls back to synthesising a minimum checkpoint — enough for state-machine tests but not for full snapshot tests.

## golden-logs/

Harvested `.claude/logs/*.md` files from full runs. Tier 2 invariant tests replay these.

Re-harvest after changes to `.claude/shared/orchestrator-rules.md`:

```bash
# After a full /start → commit live run:
cp .claude/logs/<latest-session>.md QA/fixtures/golden-logs/
```

A stale-log canary test in Tier 2 warns if these get too far behind the orchestrator rules.
