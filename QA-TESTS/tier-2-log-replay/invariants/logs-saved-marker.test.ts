/**
 * Tier 2 invariant — TEST-GUIDE test 1.
 *
 * Every non-empty Claude response must end with "[Logs saved]".
 * The Stop hook writes this marker after capturing the session log.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';
import { everyResponseEndsWithLogsSaved } from '../../helpers/assertions';

describe('Tier 2 — [Logs saved] marker', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: every response in the golden log ends with [Logs saved]',
    () => {
      const result = everyResponseEndsWithLogsSaved(loaded.log!);
      expect(result.ok, result.message).toBe(true);
    }
  );

  it.skipIf(!loaded.available)(
    'FAIL: assertion correctly rejects a log where one response is missing the marker',
    () => {
      // Synthetically corrupt a response and verify the assertion catches it
      const log = loaded.log!;
      if (log.responses.length === 0) return;
      const corrupted = { ...log };
      corrupted.responses = log.responses.map((r, i) =>
        i === 0 ? { ...r, content: 'response body with no marker' } : r
      );
      const result = everyResponseEndsWithLogsSaved(corrupted);
      expect(result.ok).toBe(false);
    }
  );

  it('PASS: skip notice when no golden log is available', () => {
    if (!loaded.available) {
      // Record the reason so someone reading test output knows why the main tests didn't run
      expect(loaded.reason).toBeTruthy();
    }
  });
});
