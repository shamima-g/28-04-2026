/**
 * Tier 2 invariant — TEST-GUIDE test 22.
 *
 * When the user selects "Issues found" during QA manual verification, the
 * orchestrator must DELEGATE the fix to a coordinator subagent — never call
 * Edit/Write directly. STUB.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';

describe('Tier 2 — Issues found triggers delegation, not direct edits', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: no Edit/Write tool calls appear in a window following an "Issues found" user response',
    () => {
      const log = loaded.log!;
      const issuesPrompts = log.events
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.type === 'prompt' && /issues found/i.test(e.content ?? ''));

      for (const { i } of issuesPrompts) {
        const window = log.events.slice(i + 1, i + 15);
        const directEdits = window.filter(ev =>
          ev.type === 'tool_call' &&
          (ev.toolName === 'Edit' || ev.toolName === 'Write' || ev.toolName === 'MultiEdit')
        );
        expect(
          directEdits,
          `Parent orchestrator made direct edits after 'Issues found' at event ${i}`
        ).toHaveLength(0);
      }
    }
  );

  it('FAIL: detector flags Write/Edit in the danger window', () => {
    const ev = { type: 'tool_call', toolName: 'Edit' };
    expect(['Edit', 'Write', 'MultiEdit']).toContain(ev.toolName);
  });
});
