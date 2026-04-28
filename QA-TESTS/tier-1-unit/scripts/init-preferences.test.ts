/**
 * Tests for .claude/scripts/init-preferences.js
 *
 * Writes .claude/preferences.json with git auto-approval flags. Must be:
 *  - Idempotent (skips if the file exists unless --force)
 *  - Validating (rejects non-boolean flag values)
 *  - Path-safe (always writes to .claude/preferences.json, no traversal)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTempProject, runScript } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const SCRIPT = '.claude/scripts/init-preferences.js';

describe('init-preferences.js — initial write', () => {
  let project: TempProject;
  beforeEach(() => {
    project = createTempProject();
    // Ensure no leftover prefs file
    fs.mkdirSync(path.join(project.root, '.claude'), { recursive: true });
  });
  afterEach(() => { project.cleanup(); });

  it('PASS: writes .claude/preferences.json with the given flags', () => {
    const r = runScript(SCRIPT, [
      '--autoApproveCommit', 'true',
      '--autoApprovePush', 'false',
    ], { cwd: project.root });

    expect(r.exitCode).toBe(0);
    const prefsPath = path.join(project.root, '.claude', 'preferences.json');
    expect(fs.existsSync(prefsPath)).toBe(true);
    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    // Script nests flags under `git` (see init-preferences.js).
    expect(prefs.git.autoApproveCommit).toBe(true);
    expect(prefs.git.autoApprovePush).toBe(false);
  });

  it('FAIL: rejects non-boolean flag values', () => {
    const r = runScript(SCRIPT, [
      '--autoApproveCommit', 'maybe',
      '--autoApprovePush', 'false',
    ], { cwd: project.root });

    expect(r.exitCode).not.toBe(0);
    const json = r.parsedJson as { status?: string; message?: string } | undefined;
    expect(json?.status).toBe('error');
    // Must NOT have written the file
    expect(fs.existsSync(path.join(project.root, '.claude', 'preferences.json'))).toBe(false);
  });
});

describe('init-preferences.js — idempotency', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: second invocation without --force skips (reports "skipped" or similar)', () => {
    runScript(SCRIPT, ['--autoApproveCommit', 'true', '--autoApprovePush', 'true'], { cwd: project.root });

    const r2 = runScript(SCRIPT, ['--autoApproveCommit', 'false', '--autoApprovePush', 'false'], { cwd: project.root });

    // Should not crash; should report the file already exists or similar
    expect(r2.exitCode).toBe(0);
    const prefs = JSON.parse(fs.readFileSync(path.join(project.root, '.claude', 'preferences.json'), 'utf8'));
    // Original values preserved (flags nested under `git`)
    expect(prefs.git.autoApproveCommit).toBe(true);
    expect(prefs.git.autoApprovePush).toBe(true);
  });

  it('FAIL: --force overwrites, proving idempotency can be bypassed deliberately', () => {
    runScript(SCRIPT, ['--autoApproveCommit', 'true', '--autoApprovePush', 'true'], { cwd: project.root });
    runScript(SCRIPT, ['--force', '--autoApproveCommit', 'false', '--autoApprovePush', 'false'], { cwd: project.root });
    const prefs = JSON.parse(fs.readFileSync(path.join(project.root, '.claude', 'preferences.json'), 'utf8'));
    expect(prefs.git.autoApproveCommit).toBe(false);
    expect(prefs.git.autoApprovePush).toBe(false);
  });
});
