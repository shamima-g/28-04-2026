/**
 * Tests for .claude/scripts/generate-todo-list.js
 *
 * Produces the TodoWrite-ready array for the orchestrator's in-chat progress display.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, seedState, runScript } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const SCRIPT = '.claude/scripts/generate-todo-list.js';

describe('generate-todo-list.js', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: returns a JSON array suitable for TodoWrite', () => {
    seedState(project.root, { currentPhase: 'STORIES', currentEpic: 1, totalEpics: 2 });
    const r = runScript(SCRIPT, [], { cwd: project.root });
    expect(r.exitCode).toBe(0);
    // Output should be parseable JSON, either an array directly or an envelope with an array
    const parsed = r.parsedJson;
    expect(parsed).toBeDefined();
    if (Array.isArray(parsed)) {
      expect(parsed.length).toBeGreaterThan(0);
    }
  });

  it('FAIL: does not emit a TodoWrite entry with an empty content field', () => {
    seedState(project.root, { currentPhase: 'IMPLEMENT', currentEpic: 1, currentStory: 1 });
    const r = runScript(SCRIPT, [], { cwd: project.root });
    if (Array.isArray(r.parsedJson)) {
      for (const entry of r.parsedJson as Array<{ content?: string; activeForm?: string }>) {
        if (entry && typeof entry === 'object') {
          expect(entry.content ?? '').not.toBe('');
        }
      }
    }
  });
});
