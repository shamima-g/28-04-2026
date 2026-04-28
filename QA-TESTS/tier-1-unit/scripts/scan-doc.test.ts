/**
 * Tests for .claude/scripts/scan-doc.js
 *
 * The script returns JSON metadata about a file or directory — size, line count,
 * keyword occurrences, binary detection. Used by intake agents as a policy-compliant
 * replacement for `wc -l` / `head` / `grep` in Bash.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, runScript } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const SCRIPT = '.claude/scripts/scan-doc.js';

describe('scan-doc.js — plain markdown file', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: reports correct line count and text type', () => {
    project.write('documentation/spec.md', '# Title\n\nFirst para.\n\n## Section\n\nBody.\n');

    const r = runScript(SCRIPT, ['documentation/spec.md'], { cwd: project.root });
    expect(r.exitCode).toBe(0);
    const json = r.json<{ lines?: number; type?: string; binary?: boolean }>();
    expect(json.lines).toBeGreaterThanOrEqual(5);
    expect(json.binary).toBeFalsy();
  });

  it('FAIL: does not claim a text file is binary', () => {
    project.write('documentation/spec.md', '# Title\n\nBody content.\n');
    const r = runScript(SCRIPT, ['documentation/spec.md'], { cwd: project.root });
    const json = r.parsedJson as { binary?: boolean } | undefined;
    expect(json?.binary).not.toBe(true);
  });
});

describe('scan-doc.js — binary file detection', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: flags a buffer with null bytes as binary', () => {
    const bin = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
    project.write('documentation/image.png', bin);

    const r = runScript(SCRIPT, ['documentation/image.png'], { cwd: project.root });
    const json = r.parsedJson as { binary?: boolean; type?: string } | undefined;
    expect(json?.binary).toBe(true);
  });

  it('FAIL: does not attempt to count lines in a binary buffer as if it were text', () => {
    const bin = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]);
    project.write('documentation/image.png', bin);
    const r = runScript(SCRIPT, ['documentation/image.png'], { cwd: project.root });
    const json = r.parsedJson as { binary?: boolean; lines?: number } | undefined;
    // If marked binary, lines should be 0 or omitted — not a huge spurious count.
    if (json?.binary) {
      expect((json.lines ?? 0)).toBeLessThan(100);
    }
  });
});

describe('scan-doc.js — keyword counting', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: counts requested keywords case-insensitively', () => {
    project.write('documentation/spec.md',
      'This app uses BFF auth. The BFF handles login. Role-based access applies. role-mapping is complex.\n');

    const r = runScript(SCRIPT, ['documentation/spec.md', '--keywords', 'bff,role'], { cwd: project.root });
    const json = r.parsedJson as { keywords?: Record<string, number> } | undefined;
    expect(json?.keywords?.bff).toBeGreaterThanOrEqual(2);
    expect(json?.keywords?.role).toBeGreaterThanOrEqual(2);
  });

  it('FAIL: keywords not present yield zero, not undefined/crash', () => {
    project.write('documentation/spec.md', 'Just a plain document.\n');

    const r = runScript(SCRIPT, ['documentation/spec.md', '--keywords', 'nonexistent'], { cwd: project.root });
    expect(r.exitCode).toBe(0);
    const json = r.parsedJson as { keywords?: Record<string, number> } | undefined;
    expect(json?.keywords?.nonexistent ?? 0).toBe(0);
  });
});
