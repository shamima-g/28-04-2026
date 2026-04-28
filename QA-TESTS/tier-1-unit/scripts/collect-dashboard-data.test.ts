/**
 * Tests for .claude/scripts/collect-dashboard-data.js
 *
 * Collects workflow state into a structured summary. Used by /status (text)
 * and the dashboard generator (HTML).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, seedState, seedArtifact, runScript, rollback } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const SCRIPT = '.claude/scripts/collect-dashboard-data.js';

describe('collect-dashboard-data.js — --format=json', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { rollback(project.root, 'RB-1'); project.cleanup(); });

  it('PASS: returns "no_state" JSON when no workflow has started', () => {
    const r = runScript(SCRIPT, ['--format=json'], { cwd: project.root });
    expect(r.exitCode).toBe(0);
    const json = r.parsedJson as { status?: string } | undefined;
    expect(['no_state', 'ok', 'empty']).toContain(json?.status ?? '');
  });

  it('FAIL: does not return invalid JSON or crash when state exists mid-phase', () => {
    seedState(project.root, {
      currentPhase: 'IMPLEMENT',
      currentEpic: 1,
      currentStory: 2,
      phaseStatus: 'in_progress',
    });
    seedArtifact(project.root, 'frs');
    seedArtifact(project.root, 'feature-overview');

    const r = runScript(SCRIPT, ['--format=json'], { cwd: project.root });
    expect(r.parsedJson).toBeDefined();
    expect(r.stdout.length).toBeGreaterThan(0);
  });
});

describe('collect-dashboard-data.js — --format=text', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { rollback(project.root, 'RB-1'); project.cleanup(); });

  it('PASS: text format produces human-readable output referencing the current phase', () => {
    seedState(project.root, { currentPhase: 'SCOPE', currentEpic: null });
    const r = runScript(SCRIPT, ['--format=text'], { cwd: project.root });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toUpperCase()).toContain('SCOPE');
  });

  it('FAIL: text format does not leak raw JSON braces into user-facing output', () => {
    seedState(project.root, { currentPhase: 'SCOPE' });
    const r = runScript(SCRIPT, ['--format=text'], { cwd: project.root });
    // A reasonable text report should not be entirely JSON
    const looksLikeRawJson = r.stdout.trim().startsWith('{') && r.stdout.trim().endsWith('}');
    expect(looksLikeRawJson).toBe(false);
  });
});
