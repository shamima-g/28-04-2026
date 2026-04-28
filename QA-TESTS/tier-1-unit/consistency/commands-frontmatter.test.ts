/**
 * Static consistency check — every .claude/commands/*.md has valid YAML frontmatter
 * with a `description` field (required by Claude Code's slash-command loader).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { REPO_ROOT } from '../../helpers';

const COMMANDS_DIR = path.join(REPO_ROOT, '.claude', 'commands');

function listCommandFiles(): string[] {
  return fs.readdirSync(COMMANDS_DIR)
    .filter(f => f.endsWith('.md'))
    .filter(f => f !== 'README.md');
}

describe('command frontmatter', () => {
  const files = listCommandFiles();
  expect(files.length).toBeGreaterThan(3);

  for (const file of files) {
    it(`PASS: /${file.replace(/\.md$/, '')} has a non-empty description`, () => {
      const content = fs.readFileSync(path.join(COMMANDS_DIR, file), 'utf8');
      const parsed = matter(content);
      expect(parsed.data).toBeDefined();
      expect(typeof parsed.data.description).toBe('string');
      expect(parsed.data.description.length).toBeGreaterThan(10);
    });
  }
});

describe('command frontmatter — model field valid', () => {
  const files = listCommandFiles();

  for (const file of files) {
    it(`PASS: ${file} either omits model or uses a known value`, () => {
      const content = fs.readFileSync(path.join(COMMANDS_DIR, file), 'utf8');
      const parsed = matter(content);
      const model = parsed.data.model;
      if (model !== undefined) {
        expect(['haiku', 'sonnet', 'opus']).toContain(model);
      }
    });
  }
});

describe('CLAUDE.md → commands cross-reference', () => {
  it('PASS: every /command referenced in CLAUDE.md exists under .claude/commands/', () => {
    const claudeMd = fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
    const available = new Set(
      listCommandFiles().map(f => '/' + f.replace(/\.md$/, ''))
    );

    // Collect /command references from CLAUDE.md
    const referenced = new Set<string>();
    for (const m of claudeMd.matchAll(/`?\/([a-z][a-z0-9-]+)`?/g)) {
      const cmd = '/' + m[1];
      if (['/help', '/clear', '/context', '/feedback', '/start', '/continue', '/status',
           '/dashboard', '/quality-check', '/setup', '/api-status', '/api-mock-refresh',
           '/api-go-live'].includes(cmd)) {
        referenced.add(cmd);
      }
    }

    // Filter to commands that should resolve in THIS repo (exclude built-ins)
    const builtIns = new Set(['/help', '/clear', '/context', '/feedback']);
    const missing: string[] = [];
    for (const cmd of referenced) {
      if (builtIns.has(cmd)) continue;
      if (!available.has(cmd)) missing.push(cmd);
    }
    expect(missing, `CLAUDE.md references commands that don't exist: ${missing.join(', ')}`).toEqual([]);
  });
});
