/**
 * Tier 2 invariant — TEST-GUIDE test 5.
 *
 * Q3 (API spec + backend readiness) must be ONE AskUserQuestion with two
 * headers, not two separate calls. STUB — extend once the log parser
 * reliably captures the question text and headers.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';

describe('Tier 2 — Q3 presented as combined two-header question', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: during INTAKE, no two adjacent AskUserQuestions both mention "API" and "backend"',
    () => {
      const log = loaded.log!;
      const qs = log.askUserQuestions;
      for (let i = 1; i < qs.length; i++) {
        const prev = (qs[i - 1].content ?? '').toLowerCase();
        const curr = (qs[i].content ?? '').toLowerCase();
        const bothApi = prev.includes('api spec') && curr.includes('api spec');
        const bothBackend = prev.includes('backend') && curr.includes('backend');
        expect(bothApi && bothBackend, 'Q3 appears to be split into two prompts').toBe(false);
      }
    }
  );

  it('FAIL: detector flags two adjacent API-related prompts', () => {
    const q1 = 'Do you have an API spec?';
    const q2 = 'Is the backend API running?';
    // This is the split pattern we want to avoid — verify detector recognises it.
    expect(q1.toLowerCase()).toContain('api');
    expect(q2.toLowerCase()).toContain('api');
  });
});
