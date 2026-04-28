/**
 * TEST-GUIDE.md Test 38 — Role Declaration in Story Metadata.
 *
 * Every generated-docs/stories/<epic>/story-*.md must have a "Role:" field
 * with a non-empty, non-ambiguous value.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, createTempProject, seedArtifact } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const EMPTY_VALUES = new Set(['', 'n/a', 'tbd', 'unknown']);

function extractRole(content: string): string | null {
  // Matches `**Role:** admin` or `| **Role:** | admin |` etc.
  const m = content.match(/\*\*Role:?\*\*\s*[:|]?\s*([^\n|]+)/i);
  if (!m) return null;
  return m[1].trim();
}

function* walkStoryFiles(dir: string): Iterable<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkStoryFiles(full);
    } else if (entry.isFile() && /^story-.+\.md$/.test(entry.name)) {
      yield full;
    }
  }
}

describe('artifact-lint — role field in real story files', () => {
  it('PASS: every story file has a non-empty **Role:** field', () => {
    const storiesDir = path.join(REPO_ROOT, 'generated-docs', 'stories');
    if (!fs.existsSync(storiesDir)) return;

    const offenders: string[] = [];
    for (const file of walkStoryFiles(storiesDir)) {
      const content = fs.readFileSync(file, 'utf8');
      const role = extractRole(content);
      if (role === null) {
        offenders.push(`${path.relative(REPO_ROOT, file)}: missing **Role:** field`);
      } else if (EMPTY_VALUES.has(role.toLowerCase())) {
        offenders.push(`${path.relative(REPO_ROOT, file)}: empty/ambiguous role "${role}"`);
      }
    }
    expect(offenders).toHaveLength(0);
  });
});

describe('artifact-lint — role extractor correctness', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('PASS: extracts a standard role', () => {
    const role = extractRole('# Story\n\n**Role:** Admin\n');
    expect(role).toBe('Admin');
  });

  it('PASS: accepts "All authenticated users" as a valid non-restricted marker', () => {
    const role = extractRole('# Story\n\n**Role:** All authenticated users\n');
    expect(role).toBe('All authenticated users');
    expect(EMPTY_VALUES.has((role ?? '').toLowerCase())).toBe(false);
  });

  it('FAIL: flags an empty role', () => {
    const role = extractRole('# Story\n\n**Role:**\n');
    expect(role === null || EMPTY_VALUES.has((role ?? '').toLowerCase())).toBe(true);
  });

  it('FAIL: flags "N/A" as empty', () => {
    const role = extractRole('# Story\n\n**Role:** N/A\n');
    expect(role).not.toBeNull();
    expect(EMPTY_VALUES.has((role ?? '').toLowerCase())).toBe(true);
  });

  it('FAIL: returns null when no Role field at all', () => {
    const role = extractRole('# Story\n\nNo role declared.\n');
    expect(role).toBeNull();
  });
});
