/**
 * Canary — warns if the newest golden log is older than the orchestrator rules
 * or settings.json. A stale log cannot reliably guard against regressions.
 *
 * This test is informational: it fails loudly to remind humans to re-harvest,
 * but does not block CI if no golden logs exist at all (fresh checkout).
 */

import { describe, it, expect } from 'vitest';
import { checkFreshness } from '../verify-session-behavior';

describe('Tier 2 — stale-log canary', () => {
  const freshness = checkFreshness();

  it('PASS: newest golden log is newer than orchestrator-rules.md and settings.json', () => {
    if (freshness.message === 'no golden logs harvested yet' || freshness.message === 'golden-logs directory is empty') {
      // Fresh checkout — skip
      return;
    }
    expect(freshness.stale, freshness.message).toBe(false);
  });
});
