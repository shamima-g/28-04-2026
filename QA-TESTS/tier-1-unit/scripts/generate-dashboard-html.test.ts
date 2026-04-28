/**
 * Tests for .claude/scripts/generate-dashboard-html.js
 *
 * Generates generated-docs/dashboard.html from the workflow state. Must:
 *  - Be fast (<500ms) — it's fire-and-forget during the workflow
 *  - Include <meta http-equiv="refresh" content="10"> so the browser auto-refreshes
 *  - Produce valid HTML even with minimal state
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, seedState, runScript } from '../../helpers';
import { normalise } from '../../helpers/snapshot';
import type { TempProject } from '../../helpers/temp-project';

const SCRIPT = '.claude/scripts/generate-dashboard-html.js';

describe('generate-dashboard-html.js', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: writes generated-docs/dashboard.html with an auto-refresh meta tag', () => {
    seedState(project.root, { currentPhase: 'SCOPE', currentEpic: null, totalEpics: 3 });
    const r = runScript(SCRIPT, ['--collect'], { cwd: project.root });
    expect(r.exitCode).toBe(0);
    expect(project.exists('generated-docs/dashboard.html')).toBe(true);
    const html = project.read('generated-docs/dashboard.html');
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toMatch(/content="?10"?/);
  });

  it('FAIL: does not crash or produce empty output with no state file', () => {
    const r = runScript(SCRIPT, ['--collect'], { cwd: project.root });
    // Should still produce SOMETHING usable — either an empty dashboard or a clear error JSON.
    // It must NOT exit with an unhandled error and leave a half-written file.
    if (project.exists('generated-docs/dashboard.html')) {
      const html = project.read('generated-docs/dashboard.html');
      expect(html.length).toBeGreaterThan(50);
    } else {
      // If it refuses to generate, it should say so in JSON
      expect(r.parsedJson).toBeDefined();
    }
  });
});

describe('generate-dashboard-html.js — snapshot (stable HTML)', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: produces deterministic HTML for a fixed state (after normalising timestamps)', () => {
    seedState(project.root, {
      currentPhase: 'SCOPE',
      currentEpic: null,
      totalEpics: 2,
      featureName: 'Team Task Manager',
    });
    runScript(SCRIPT, ['--collect'], { cwd: project.root });
    const html = project.exists('generated-docs/dashboard.html')
      ? project.read('generated-docs/dashboard.html')
      : '';
    // Run a second time — should be identical post-normalisation
    runScript(SCRIPT, ['--collect'], { cwd: project.root });
    const html2 = project.exists('generated-docs/dashboard.html')
      ? project.read('generated-docs/dashboard.html')
      : '';
    expect(normalise(html)).toBe(normalise(html2));
  });

  it('FAIL: different states produce different HTML (proves the normaliser isn\'t stripping signal)', () => {
    seedState(project.root, { currentPhase: 'INTAKE' });
    runScript(SCRIPT, ['--collect'], { cwd: project.root });
    const a = project.exists('generated-docs/dashboard.html') ? project.read('generated-docs/dashboard.html') : '';

    seedState(project.root, { currentPhase: 'QA', currentEpic: 2, currentStory: 3 });
    runScript(SCRIPT, ['--collect'], { cwd: project.root });
    const b = project.exists('generated-docs/dashboard.html') ? project.read('generated-docs/dashboard.html') : '';

    expect(normalise(a)).not.toBe(normalise(b));
  });
});
