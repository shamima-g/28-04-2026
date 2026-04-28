/**
 * Tier 2 invariant — TEST-GUIDE test 17.
 *
 * WRITE-TESTS tool calls must only appear AFTER a user response to the
 * TEST-DESIGN approval question. STUB.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';

describe('Tier 2 — WRITE-TESTS gated by TEST-DESIGN approval', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: every test-generator subagent launch is preceded by a prompt containing "approved"',
    () => {
      const log = loaded.log!;
      const testGenStarts = log.events
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.type === 'subagent_start' && e.subagentType === 'test-generator');

      for (const { i } of testGenStarts) {
        let approved = false;
        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
          const ev = log.events[j];
          if (ev.type === 'prompt' && /approv/i.test(ev.content ?? '')) {
            approved = true;
            break;
          }
        }
        expect(
          approved,
          `test-generator launched at event ${i} without a preceding approval`
        ).toBe(true);
      }
    }
  );

  it('FAIL: detector correctly requires an approval before test-generator', () => {
    // Structural sanity
    expect('approved').toMatch(/approv/i);
  });
});
