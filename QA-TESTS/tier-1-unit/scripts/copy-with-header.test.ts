/**
 * Tests for .claude/scripts/copy-with-header.js
 *
 * The script copies a file to a destination under generated-docs/, prepending
 * a source-traceability header. Used during DESIGN to copy user-provided
 * artifacts from documentation/.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTempProject, runScript, rollback } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const SCRIPT = '.claude/scripts/copy-with-header.js';

describe('copy-with-header.js — copies YAML with default header', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { rollback(project.root, 'RB-3'); project.cleanup(); });

  it('PASS: copies a user-provided api spec and prepends "# Source: ..." as line 1', () => {
    project.write('documentation/task-api.yaml',
      'openapi: 3.0.3\ninfo:\n  title: Task API\n  version: 1.0.0\npaths: {}\n');

    const r = runScript(SCRIPT, [
      '--from', 'documentation/task-api.yaml',
      '--to', 'generated-docs/specs/api-spec.yaml',
    ], { cwd: project.root });

    expect(r.exitCode).toBe(0);
    const json = r.parsedJson as { status?: string } | undefined;
    expect(json?.status).toBe('ok');

    const written = project.read('generated-docs/specs/api-spec.yaml');
    const firstLine = written.split('\n')[0];
    expect(firstLine).toContain('Source');
    expect(firstLine).toContain('task-api.yaml');
  });

  it('FAIL: refuses when --to is outside generated-docs/', () => {
    project.write('documentation/task-api.yaml', 'openapi: 3.0.3\n');

    const r = runScript(SCRIPT, [
      '--from', 'documentation/task-api.yaml',
      '--to', 'web/src/types/api-spec.yaml', // outside generated-docs/
    ], { cwd: project.root });

    const json = r.parsedJson as { status?: string } | undefined;
    expect(json?.status).toBe('error');
    expect(project.exists('web/src/types/api-spec.yaml')).toBe(false);
  });
});

describe('copy-with-header.js — missing source file', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: returns status=error when source does not exist', () => {
    const r = runScript(SCRIPT, [
      '--from', 'documentation/does-not-exist.yaml',
      '--to', 'generated-docs/specs/api-spec.yaml',
    ], { cwd: project.root });

    const json = r.parsedJson as { status?: string } | undefined;
    expect(json?.status).toBe('error');
    expect(project.exists('generated-docs/specs/api-spec.yaml')).toBe(false);
  });

  it('FAIL: does not silently create an empty destination on missing source', () => {
    const r = runScript(SCRIPT, [
      '--from', 'documentation/does-not-exist.yaml',
      '--to', 'generated-docs/specs/api-spec.yaml',
    ], { cwd: project.root });
    void r; // result already asserted above; here we assert no side effects
    expect(project.exists('generated-docs/specs/api-spec.yaml')).toBe(false);
  });
});

describe('copy-with-header.js — custom header', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: a CSS file gets a CSS-style custom header', () => {
    project.write('documentation/tokens.css', ':root { --primary: #2563EB; }\n');

    const r = runScript(SCRIPT, [
      '--from', 'documentation/tokens.css',
      '--to', 'generated-docs/specs/design-tokens.css',
      '--header', '/* Source: documentation/tokens.css */',
    ], { cwd: project.root });

    expect(r.exitCode).toBe(0);
    const written = project.read('generated-docs/specs/design-tokens.css');
    expect(written.split('\n')[0]).toContain('/* Source:');
  });

  it('FAIL: second line of the file is NOT accidentally the header (header must be line 1 only)', () => {
    project.write('documentation/tokens.css', ':root { --primary: #2563EB; }\n');

    runScript(SCRIPT, [
      '--from', 'documentation/tokens.css',
      '--to', 'generated-docs/specs/design-tokens.css',
      '--header', '/* Source: documentation/tokens.css */',
    ], { cwd: project.root });

    const written = project.read('generated-docs/specs/design-tokens.css');
    const lines = written.split('\n');
    // Header appears once, at line 1
    const headerCount = lines.filter(l => l.includes('Source: documentation/tokens.css')).length;
    expect(headerCount).toBe(1);
    expect(lines[0]).toContain('Source');
  });
});
