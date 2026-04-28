/**
 * Tier 2 invariant — TEST-GUIDE test 26.
 *
 * The /continue dispatcher pattern caps the parent orchestrator at ≤3 tool
 * calls before delegating to a coordinator subagent. More than 3 and the
 * hook-dispatch bug starts dropping events.
 */

import { describe, it, expect } from 'vitest';
import { loadGoldenLog } from '../verify-session-behavior';
import { parentToolCallsBeforeFirstSubagent } from '../../helpers/assertions';

describe('Tier 2 — dispatcher tool-call limit', () => {
  const loaded = loadGoldenLog('full-happy-path');

  it.skipIf(!loaded.available)(
    'PASS: parent makes ≤ 3 tool calls before first subagent launch',
    () => {
      const result = parentToolCallsBeforeFirstSubagent(loaded.log!, 3);
      expect(result.ok, result.message).toBe(true);
    }
  );

  it.skipIf(!loaded.available)(
    'FAIL: assertion correctly rejects a log where parent makes 10 calls first',
    () => {
      // The assertion returns false when count > maxCalls.
      // Construct a synthetic case to verify.
      const log = loaded.log!;
      const synthetic = {
        ...log,
        events: [
          ...Array.from({ length: 10 }, (_, i) => ({
            type: 'tool_call' as const,
            timestamp: null,
            toolName: `Tool${i}`,
            raw: '',
            content: '',
            lineNumber: i,
          })),
          {
            type: 'subagent_start' as const,
            timestamp: null,
            subagentType: 'general-purpose',
            raw: '',
            content: '',
            lineNumber: 100,
          },
        ],
      };
      const result = parentToolCallsBeforeFirstSubagent(synthetic as any, 3);
      expect(result.ok).toBe(false);
    }
  );
});
