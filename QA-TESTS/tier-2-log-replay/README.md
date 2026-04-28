# Tier 2 — Log-Replay Invariants

Parses harvested `.claude/logs/*.md` session logs and asserts behavioural invariants that would otherwise require a live Claude run.

## How it works

1. A human runs `/start` end-to-end with the Team Task Manager scripted answers from `/TEST-INPUTS.md`.
2. The resulting `.claude/logs/<timestamp>-<slug>-<sessionid>.md` is copied into `../fixtures/golden-logs/`.
3. Every invariant test reads that log via `parseSessionLog()` (from `@helpers`) and asserts a structural property — tool-call order, counts, content-before-question relationships, etc.

## Why not just live-test?

Live tests (Tier 3, `/TEST-GUIDE.md`) are expensive — a full workflow pass takes ~30 minutes of human + Claude time. Tier 2 amortises that cost: one live run produces one log, against which ~40 invariants can be re-checked in seconds on every PR.

## Invariants implemented

| File | Covers TEST-GUIDE test(s) | Status |
|---|---|---|
| `logs-saved-marker.test.ts` | TG-1 | Implemented |
| `dashboard-timing.test.ts` | TG-3a, 3c, 3i, 24 | Implemented |
| `two-step-approval.test.ts` | TG-7 | Implemented |
| `askuser-not-for-text-input.test.ts` | TG-4B | Stub |
| `q3-combined.test.ts` | TG-5 | Stub |
| `developer-called-twice.test.ts` | TG-19 | Implemented |
| `dispatcher-tool-call-limit.test.ts` | TG-26 | Implemented |
| `realign-auto-completes.test.ts` | TG-15 | Stub |
| `write-tests-gates-approval.test.ts` | TG-17 | Stub |
| `issues-found-delegates.test.ts` | TG-22 | Stub |
| `clearing-boundaries.test.ts` | TG-24 | Stub |

Stubbed invariants show the expected shape — extend when you have a golden log that exercises the scenario.

## Re-harvesting

Run Tier 2 locally; if the stale-log canary warns that the golden log is older than `.claude/shared/orchestrator-rules.md`, run a fresh live workflow and replace the log. See `../fixtures/golden-logs/README.md`.
