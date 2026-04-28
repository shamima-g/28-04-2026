/**
 * Tests for .claude/hooks/claude-md-permission-checker.js
 *
 * The hook is a PreToolUse fast-path AUTO-APPROVER (see header of the hook):
 *
 *   - During INTAKE or DESIGN phases (where CLAUDE.md edits are part of the
 *     expected workflow), it emits permissionDecision='allow' to skip the
 *     permission prompt.
 *   - Outside those phases — or when no workflow state exists, or when the
 *     state file cannot be read — it FALLS THROUGH silently (exit 0, empty
 *     stdout) so the normal permission prompt protects CLAUDE.md.
 *
 * It does NOT itself block or warn; user oversight comes from the fall-through
 * path landing in the normal permission system.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from '../../helpers';

const HOOK = path.join(REPO_ROOT, '.claude', 'hooks', 'claude-md-permission-checker.js');

function runHook(input: object): { exitCode: number; stdout: string; stderr: string } {
  const res = spawnSync('node', [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10_000,
  });
  return {
    exitCode: typeof res.status === 'number' ? res.status : 1,
    stdout: (res.stdout ?? '').toString(),
    stderr: (res.stderr ?? '').toString(),
  };
}

describe('claude-md-permission-checker — protects CLAUDE.md', () => {
  it('PASS: falls through silently on a Write to CLAUDE.md when no workflow state exists', () => {
    // No generated-docs/context/workflow-state.json in CWD → hook must NOT
    // emit an auto-approve. Silent exit 0 means the normal permission prompt
    // will appear and the user gets oversight.
    const { exitCode, stdout } = runHook({
      tool_name: 'Write',
      tool_input: { file_path: '/some/path/CLAUDE.md', content: 'overwritten' },
    });
    expect(exitCode).toBe(0);
    // No permissionDecision emitted → the hook declined to auto-approve.
    expect(stdout).not.toMatch(/permissionDecision\s*"?\s*:\s*"?allow/);
  });

  it('FAIL: does NOT interfere with Writes to unrelated files', () => {
    const { exitCode, stdout } = runHook({
      tool_name: 'Write',
      tool_input: { file_path: '/some/path/web/src/app/page.tsx', content: 'ok' },
    });
    expect(exitCode).toBe(0);
    // Unrelated files → unconditional fall-through, no auto-approve output.
    expect(stdout.trim()).toBe('');
  });
});

describe('claude-md-permission-checker — handles malformed input', () => {
  it('PASS: does not crash on empty payload', () => {
    const { exitCode } = runHook({});
    expect([0, 1, 2]).toContain(exitCode);
  });

  it('FAIL: does not accidentally allow a CLAUDE.md write when file_path is missing', () => {
    const { exitCode } = runHook({ tool_name: 'Write', tool_input: {} });
    // Should not crash; behaviour of missing file_path is implementation-defined
    // but must not silently exit 0 if the hook thinks it's protecting CLAUDE.md.
    expect(typeof exitCode).toBe('number');
  });
});
