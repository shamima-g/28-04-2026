/**
 * TEST-GUIDE.md Test 33 — No Error Suppression Policy (artifact-lint version).
 *
 * Generated code under web/src/ must never contain:
 *   - eslint-disable / eslint-disable-next-line
 *   - @ts-ignore
 *   - @ts-expect-error
 *   - @ts-nocheck
 *
 * These directives hide real problems. This test scans the real web/src/ (not a
 * temp project) because it's checking actual output of past workflow runs.
 *
 * For a PASS/FAIL contrast: the fixture-based path below verifies the scanner
 * actually detects suppressions when they are present.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, createTempProject } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const SUPPRESSION_PATTERN = /eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck/;

function* walkTsFiles(dir: string): Iterable<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      yield* walkTsFiles(full);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

describe('artifact-lint — no suppression directives in web/src', () => {
  it('PASS: real web/src/ has no suppression directives', () => {
    const srcDir = path.join(REPO_ROOT, 'web', 'src');
    if (!fs.existsSync(srcDir)) {
      // Skip when template has no web/src yet
      return;
    }
    const offenders: string[] = [];
    for (const file of walkTsFiles(srcDir)) {
      const content = fs.readFileSync(file, 'utf8');
      if (SUPPRESSION_PATTERN.test(content)) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }
    expect(offenders, `Suppression directives found in: ${offenders.join(', ')}`).toHaveLength(0);
  });
});

describe('artifact-lint — scanner catches injected suppressions', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('FAIL: scanner correctly flags a @ts-ignore in a fixture', () => {
    project.write('web/src/bad.ts',
      `export const x: number = "not a number"; // @ts-ignore\n`);

    let found = false;
    for (const file of walkTsFiles(path.join(project.root, 'web', 'src'))) {
      if (SUPPRESSION_PATTERN.test(fs.readFileSync(file, 'utf8'))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('FAIL: scanner correctly flags a // eslint-disable-next-line', () => {
    project.write('web/src/bad.tsx',
      `// eslint-disable-next-line\nexport const Foo = () => null;\n`);

    let found = false;
    for (const file of walkTsFiles(path.join(project.root, 'web', 'src'))) {
      if (SUPPRESSION_PATTERN.test(fs.readFileSync(file, 'utf8'))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('PASS: clean code passes the scanner', () => {
    project.write('web/src/good.ts', `export const x: number = 42;\n`);
    let found = false;
    for (const file of walkTsFiles(path.join(project.root, 'web', 'src'))) {
      if (SUPPRESSION_PATTERN.test(fs.readFileSync(file, 'utf8'))) found = true;
    }
    expect(found).toBe(false);
  });
});
