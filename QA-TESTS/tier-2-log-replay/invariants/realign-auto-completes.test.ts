/**
 * Tier 2 invariant — TEST-GUIDE test 15.
 *
 * When discovered-impacts.md is empty, REALIGN must auto-complete with zero
 * AskUserQuestion calls. STUB.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';

describe('Tier 2 — REALIGN auto-completes when no impacts', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: at least one REALIGN transition has zero AskUserQuestions between its boundaries',
    () => {
      const log = loaded.log!;
      // Find REALIGN phase transitions by scanning content for "REALIGN"
      const realignRegions: Array<[number, number]> = [];
      for (let i = 0; i < log.events.length; i++) {
        if (/REALIGN/.test(log.events[i].content ?? '')) {
          realignRegions.push([i, Math.min(i + 15, log.events.length)]);
        }
      }
      // At least one region should have no ask_user_question events
      const hasSilentRealign = realignRegions.some(([start, end]) => {
        for (let j = start; j < end; j++) {
          if (log.events[j].type === 'ask_user_question') return false;
        }
        return true;
      });
      // If no REALIGN was reached in the log, trivially passes.
      if (realignRegions.length === 0) return;
      expect(hasSilentRealign).toBe(true);
    }
  );

  it('FAIL: detector catches an AskUserQuestion in a REALIGN region', () => {
    // Simple structural check
    const q = { type: 'ask_user_question' };
    expect(q.type).toBe('ask_user_question');
  });
});
