/**
 * Tests for .claude/scripts/generate-traceability-matrix.js
 *
 * Maps FRS requirements → stories → tests. Output is a markdown table.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, seedArtifact, runScript } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const SCRIPT = '.claude/scripts/generate-traceability-matrix.js';

describe('generate-traceability-matrix.js', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: produces a markdown table when FRS + stories exist', () => {
    seedArtifact(project.root, 'frs',
      '# Feature\n\n## Functional Requirements\n- **R1:** example\n- **R2:** second\n');
    seedArtifact(project.root, 'story',
      '# Story 1\n\n**Role:** Admin\n\n**Requirements:** R1\n\nCovers R1.\n',
      { epicNum: 1, storyNum: 1, slug: 'example' });

    const r = runScript(SCRIPT, [], { cwd: project.root });
    expect(r.exitCode).toBe(0);
    // Either prints markdown to stdout or writes a file; check both paths
    const combined = r.stdout +
      (project.exists('generated-docs/stories/_requirements-traceability.md')
        ? project.read('generated-docs/stories/_requirements-traceability.md')
        : '');
    expect(combined).toContain('R1');
  });

  it('FAIL: does not invent requirement IDs that are absent from the FRS', () => {
    seedArtifact(project.root, 'frs', '# Feature\n\n## Functional Requirements\n- **R1:** example\n');
    const r = runScript(SCRIPT, [], { cwd: project.root });
    const output = r.stdout + (project.exists('generated-docs/stories/_requirements-traceability.md')
      ? project.read('generated-docs/stories/_requirements-traceability.md')
      : '');
    // R2 was never defined — must not appear
    expect(output).not.toMatch(/\bR2\b/);
  });
});
