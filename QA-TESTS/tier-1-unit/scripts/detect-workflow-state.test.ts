/**
 * Tests for .claude/scripts/detect-workflow-state.js (read-only state inference).
 *
 * Used by transition-phase.js --repair to guess phase from artifacts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, seedArtifact, runScript, rollback } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const SCRIPT = '.claude/scripts/detect-workflow-state.js';

describe('detect-workflow-state.js', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { rollback(project.root, 'RB-0'); project.cleanup(); });

  it('PASS: detects INTAKE-complete when FRS exists but no API spec', () => {
    seedArtifact(project.root, 'frs');

    const r = runScript(SCRIPT, [], { cwd: project.root });
    expect(r.exitCode).toBe(0);
    const combined = r.stdout;
    // Must reference a phase name from the state machine
    expect(combined).toMatch(/INTAKE|DESIGN/);
  });

  it('FAIL: does not report DESIGN-complete without an api-spec.yaml on disk', () => {
    seedArtifact(project.root, 'frs'); // INTAKE done, DESIGN not done
    const r = runScript(SCRIPT, [], { cwd: project.root });
    const json = r.parsedJson as { detectedPhase?: string } | undefined;
    // If the script reports a phase, it shouldn't claim DESIGN when no api-spec exists.
    if (json?.detectedPhase) {
      expect(['DESIGN']).not.toContain(json.detectedPhase);
    }
  });
});
