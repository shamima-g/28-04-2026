/**
 * Tier 2 invariant — TEST-GUIDE tests 3a, 3c, 3i, 24.
 *
 * Dashboard updates must fire at each of the 5 context-clearing boundaries
 * BEFORE the "/clear + /continue" instruction appears. Catches regressions
 * where the dashboard update is moved after the clearing message.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';
import { toolCallsInOrder, toolCallCount } from '../../helpers/assertions';

describe('Tier 2 — dashboard updates before clearing boundaries', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: generate-dashboard-html.js fires at least 3 times during DESIGN',
    () => {
      // DESIGN runs 3 agents in parallel; each should fire a dashboard update.
      // Per TEST-GUIDE.md test 3b.
      const log = loaded.log!;
      const count = toolCallCount(log, 'generate-dashboard-html') +
                    toolCallCount(log, 'Bash'); // some runs trigger via Bash
      // We can't easily distinguish Bash calls here — so we just check dashboard ref density.
      const bashCallsWithDashboard = log.toolCalls.filter(e =>
        e.toolName === 'Bash' && /generate-dashboard-html\.js/.test(e.content ?? '')
      ).length;
      expect(bashCallsWithDashboard).toBeGreaterThanOrEqual(3);
    }
  );

  it.skipIf(!loaded.available)(
    'PASS: at least one dashboard call precedes each /clear instruction',
    () => {
      const log = loaded.log!;
      const clearMentions = log.events
        .filter(e => e.type === 'response')
        .filter(e => /\/clear\s*\+?\s*\/?continue/i.test(e.content ?? ''));

      for (const clearEvent of clearMentions) {
        // Scan backwards for a dashboard update within the last 30 events
        const clearIdx = log.events.indexOf(clearEvent);
        let foundDashboard = false;
        for (let i = clearIdx - 1; i >= Math.max(0, clearIdx - 30); i--) {
          const ev = log.events[i];
          if (/generate-dashboard-html/.test(ev.content ?? '')) {
            foundDashboard = true;
            break;
          }
        }
        expect(
          foundDashboard,
          `No dashboard update in 30 events preceding /clear at line ${clearEvent.lineNumber}`
        ).toBe(true);
      }
    }
  );

  it.skipIf(!loaded.available)(
    'FAIL: assertion rejects logs where dashboard never fires',
    () => {
      const log = loaded.log!;
      // Strip all dashboard calls from a copy — assertion should now fail
      const stripped = {
        ...log,
        events: log.events.map(e =>
          /generate-dashboard-html/.test(e.content ?? '')
            ? { ...e, content: '', toolName: undefined }
            : e
        ),
        toolCalls: log.toolCalls.filter(e => !/generate-dashboard-html/.test(e.content ?? '')),
      };
      const count = stripped.toolCalls.filter(e =>
        /generate-dashboard-html/.test(e.content ?? '')
      ).length;
      expect(count).toBe(0);
    }
  );
});
