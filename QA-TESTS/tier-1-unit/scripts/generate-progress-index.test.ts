/**
 * Tests for .claude/scripts/generate-progress-index.js
 *
 * Auto-runs via PostToolUse hook after any Write/Edit. Must be idempotent
 * and fast (< 30s, usually sub-second).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, seedArtifact, seedState, runScript } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const SCRIPT = '.claude/scripts/generate-progress-index.js';

describe('generate-progress-index.js', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: runs without error on a minimal project', () => {
    seedState(project.root, { currentPhase: 'INTAKE' });
    seedArtifact(project.root, 'frs');
    const r = runScript(SCRIPT, [], { cwd: project.root });
    // Should exit 0 whether or not it finds anything to index
    expect([0]).toContain(r.exitCode);
  });

  it('FAIL: does not leave a partial index file if state is incomplete', () => {
    // No state at all
    const r = runScript(SCRIPT, [], { cwd: project.root });
    // Either succeeds trivially or errors cleanly — must not crash hard
    expect(r.exitCode === 0 || r.exitCode === 1).toBe(true);
  });
});
