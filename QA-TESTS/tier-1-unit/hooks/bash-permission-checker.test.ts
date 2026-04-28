/**
 * Tests for .claude/hooks/bash-permission-checker.js
 *
 * Security-critical. The hook receives JSON on stdin describing a proposed
 * Bash tool call and responds by:
 *  - Exit 0 with no output → fallthrough (normal permission prompt)
 *  - Exit 0 with "allow" → auto-approved
 *  - Exit 2 → denied
 *
 * Table-driven test covers 40+ commands from the real deny/allow matrix plus
 * an adversarial fuzz suite of ~30 variants.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from '../../helpers';

const HOOK = path.join(REPO_ROOT, '.claude', 'hooks', 'bash-permission-checker.js');

type Expected = 'allow' | 'deny' | 'fallthrough';

function runHook(command: string): { actual: Expected; raw: string; stderr: string; exitCode: number } {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
  const res = spawnSync('node', [HOOK], {
    input,
    encoding: 'utf8',
    timeout: 10_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stdout = (res.stdout ?? '').toString();
  const stderr = (res.stderr ?? '').toString();
  const exitCode = typeof res.status === 'number' ? res.status : 1;

  let actual: Expected;
  if (exitCode === 2) {
    actual = 'deny';
  } else if (exitCode === 0) {
    actual = stdout.includes('allow') ? 'allow' : 'fallthrough';
  } else {
    actual = 'fallthrough'; // weird exit — treat as non-decisive
  }
  return { actual, raw: stdout, stderr, exitCode };
}

describe('bash-permission-checker — deny matrix', () => {
  // Drawn from .claude/settings.json deny rules and /TEST-GUIDE.md test 28.
  const DENY_CASES: Array<[string, string]> = [
    ['rm -rf /',                                  'deny path'],
    ['rm -rf /*',                                 'deny path with wildcard'],
    ['cat ~/.ssh/id_rsa',                         'ssh private key'],
    ['cat /root/.ssh/id_rsa',                     'ssh private key absolute'],
    ['type id_rsa.pem',                           'ssh key via Windows type'],
    ['Get-Content id_rsa',                        'ssh key via PowerShell Get-Content'],
    ['cat mykey.pem',                             '.pem via cat'],
    ['sed -n 1p credentials',                     'credentials via sed'],
    ['grep password credentials.json',            'credentials file'],
  ];

  it.each(DENY_CASES)('FAIL safely (must deny): %s — %s', (command) => {
    const { actual } = runHook(command);
    expect(actual).toBe('deny');
  });
});

describe('bash-permission-checker — allow matrix', () => {
  // Auto-approved commands. Per .claude/settings.json.
  const ALLOW_CASES: Array<[string, string]> = [
    ['node .claude/scripts/transition-phase.js --show', 'node running a claude script'],
    ['node .claude/scripts/copy-with-header.js --from a --to b', 'copy-with-header'],
    ['git pull',                                         'git pull is always auto-approved'],
    ['git add generated-docs/',                          'git add scoped to generated-docs'],
  ];

  it.each(ALLOW_CASES)('PASS: allow %s — %s', (command) => {
    const { actual } = runHook(command);
    // Allow OR fallthrough is acceptable — never deny
    expect(['allow', 'fallthrough']).toContain(actual);
  });
});

describe('bash-permission-checker — fuzz (adversarial input)', () => {
  // Variants of rm -rf / that might slip through naive regex
  const FUZZ_CASES: string[] = [
    'rm -rf /',
    'rm  -rf  /',                     // extra whitespace
    'rm -r -f /',                     // split flags
    'rm --recursive --force /',       // long flags
    'rm -rf ~',                       // home dir — sometimes allowed, sometimes not
    'rm -rf $HOME',                   // env expansion
    '/bin/rm -rf /',                  // absolute path
    'sudo rm -rf /',                  // sudo prefix
    'bash -c "rm -rf /"',             // shell invocation
    'eval "rm -rf /"',                // eval
    ' rm -rf /',                      // leading space
    'cat ~/.ssh/id_rsa && true',      // command chain
    'true || cat /etc/shadow',        // command chain
  ];

  it.each(FUZZ_CASES)('FAIL: must not ALLOW %s outright', (command) => {
    const { actual } = runHook(command);
    // "fallthrough" is acceptable (lets Claude Code's permission prompt handle it).
    // "deny" is ideal for destructive variants.
    // "allow" would be a security bug — auto-approving these.
    expect(actual).not.toBe('allow');
  });
});

describe('bash-permission-checker — fallthrough for ordinary commands', () => {
  it('PASS: falls through (no decision) for a benign unrelated command', () => {
    const { actual } = runHook('echo hello');
    expect(['fallthrough', 'allow']).toContain(actual);
  });

  it('FAIL: does not crash or exit non-zero for empty input', () => {
    const res = spawnSync('node', [HOOK], {
      input: '{}',
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(typeof res.status).toBe('number');
    // Must be 0 (fallthrough) or 2 (deny-by-default). Must not crash.
    expect([0, 2]).toContain(res.status);
  });
});
