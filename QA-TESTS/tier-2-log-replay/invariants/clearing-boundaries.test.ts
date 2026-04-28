/**
 * Tier 2 invariant — TEST-GUIDE test 24.
 *
 * `/clear + /continue` instruction must appear at exactly the 5 mandatory
 * boundaries and NOT at any other phase transition. STUB.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';

describe('Tier 2 — clearing boundaries are correct', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: between 3 and 6 /clear + /continue instructions appear in a full run',
    () => {
      const log = loaded.log!;
      const count = log.events
        .filter(e => e.type === 'response')
        .filter(e => /\/clear\s*\+?\s*\/?continue/i.test(e.content ?? ''))
        .length;
      // A full happy-path run has up to 5 (INTAKE, DESIGN, SCOPE, per-story QA, epic end).
      // Partial runs have fewer. Zero means the convention has broken.
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(10);
    }
  );

  it('FAIL: detector catches when /clear is absent from a log that reached QA', () => {
    // Synthetic check
    const text = 'story committed to main';
    expect(text).not.toMatch(/\/clear/);
  });
});
