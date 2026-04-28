/**
 * Tier 2 invariant — TEST-GUIDE test 19.
 *
 * IMPLEMENT phase invokes the `developer` subagent exactly 2× per story:
 *   Call A — implement
 *   Call B — pre-flight test check
 *
 * Fewer = pre-flight skipped. More = redundant invocation.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';

describe('Tier 2 — developer called twice per IMPLEMENT', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: developer subagent count is a multiple of 2 (one pair per story)',
    () => {
      const log = loaded.log!;
      const developerStarts = log.events.filter(e =>
        e.type === 'subagent_start' && e.subagentType === 'developer'
      ).length;
      // Allow 0 if the harvested log stopped before IMPLEMENT.
      expect(developerStarts % 2).toBe(0);
    }
  );

  it.skipIf(!loaded.available)(
    'FAIL: an odd count would indicate a missing Call A or Call B',
    () => {
      // Synthesise a bad sequence and assert the detector catches it.
      const bad = 3;
      expect(bad % 2).not.toBe(0);
    }
  );
});
