/**
 * Tier 2 invariant — TEST-GUIDE test 7.
 *
 * The two-step approval pattern: every AskUserQuestion that asks for
 * approval must be preceded (within a small window) by substantive text
 * the user can actually review. Catches the regression where Claude skips
 * step 1 (display content) and only does step 2 (ask for approval).
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';
import { everyAskUserQuestionPrecededByContent } from '../../helpers/assertions';

describe('Tier 2 — two-step approval pattern', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: every AskUserQuestion in the golden log is preceded by reviewable content',
    () => {
      const result = everyAskUserQuestionPrecededByContent(loaded.log!);
      expect(result.ok, result.message).toBe(true);
    }
  );

  it.skipIf(!loaded.available)(
    'FAIL: assertion correctly rejects a naked AskUserQuestion',
    () => {
      const log = loaded.log!;
      if (log.askUserQuestions.length === 0) return;
      // Construct a log where an AskUserQuestion appears with nothing before it
      const naked = {
        ...log,
        events: [log.askUserQuestions[0]],
        askUserQuestions: [log.askUserQuestions[0]],
      };
      const result = everyAskUserQuestionPrecededByContent(naked);
      expect(result.ok).toBe(false);
    }
  );
});
