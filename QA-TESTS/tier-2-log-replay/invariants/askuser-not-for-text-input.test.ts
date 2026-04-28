/**
 * Tier 2 invariant — TEST-GUIDE test 4B.
 *
 * The elevator-pitch prompt during INTAKE must be a plain-text prompt,
 * NOT an AskUserQuestion. Buttoned choices can't capture free-form text.
 *
 * Status: STUB — extend when log parser reliably distinguishes prompts asking
 * for the elevator pitch from other open-ended questions.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';

describe('Tier 2 — AskUserQuestion not used for elevator pitch', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: no AskUserQuestion in the first 20 events mentions "elevator pitch"',
    () => {
      const log = loaded.log!;
      const earlyQs = log.events.slice(0, 30)
        .filter(e => e.type === 'ask_user_question');
      for (const q of earlyQs) {
        const lower = (q.content ?? '').toLowerCase();
        expect(lower).not.toMatch(/elevator pitch|what are you building/);
      }
    }
  );

  it('FAIL: detector correctly flags a pitch prompt wrapped in AskUserQuestion', () => {
    const bad = 'What are you building? Give me the elevator pitch.';
    expect(bad.toLowerCase()).toMatch(/elevator pitch/);
  });
});
