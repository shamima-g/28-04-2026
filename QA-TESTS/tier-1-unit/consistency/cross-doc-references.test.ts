/**
 * Static consistency — cross-document references between CLAUDE.md, README.md,
 * orchestrator-rules.md, and the agents/commands folders.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../helpers';

const CLAUDE_MD = path.join(REPO_ROOT, 'CLAUDE.md');
const README = path.join(REPO_ROOT, 'README.md');
const ORCH_RULES = path.join(REPO_ROOT, '.claude', 'shared', 'orchestrator-rules.md');
const AGENTS_DIR = path.join(REPO_ROOT, '.claude', 'agents');

function listAgentNames(): Set<string> {
  return new Set(
    fs.readdirSync(AGENTS_DIR)
      .filter(f => f.endsWith('.md'))
      .filter(f => !f.startsWith('_') && f !== 'README.md' && f !== 'tone-guide.md')
      .map(f => f.replace(/\.md$/, ''))
  );
}

describe('orchestrator-rules.md → agent files', () => {
  it('PASS: every agent mentioned by name in orchestrator-rules.md exists', () => {
    const rules = fs.readFileSync(ORCH_RULES, 'utf8');
    const agents = listAgentNames();

    // Collect "backtick-wrapped agent names" from orchestrator-rules.md.
    // e.g. `feature-planner`, `code-reviewer`.
    const backticked = new Set<string>();
    for (const m of rules.matchAll(/`([a-z][a-z0-9-]*-agent|[a-z]+-[a-z]+(?:-[a-z]+)*)`/g)) {
      backticked.add(m[1]);
    }

    const missing: string[] = [];
    for (const name of backticked) {
      // Only flag names that look like agents (end in -agent, -planner, -generator, -reviewer, -designer, -developer, -watchdog)
      if (/(agent|planner|generator|reviewer|designer|developer|watchdog)$/.test(name)) {
        if (!agents.has(name)) missing.push(name);
      }
    }

    expect(missing, `orchestrator-rules.md references non-existent agents: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('README.md agent table', () => {
  it('PASS: README.md references every real agent at least once', () => {
    const readme = fs.readFileSync(README, 'utf8');
    const agents = listAgentNames();
    const missing: string[] = [];
    for (const name of agents) {
      if (!readme.includes(name)) missing.push(name);
    }
    expect(missing, `README does not mention these agents: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('CLAUDE.md → policies/ files', () => {
  it('PASS: every policy file referenced in CLAUDE.md exists', () => {
    const content = fs.readFileSync(CLAUDE_MD, 'utf8');
    const referenced = new Set<string>();
    for (const m of content.matchAll(/\.claude\/policies\/([a-z0-9-]+\.md)/g)) {
      referenced.add(m[1]);
    }
    const missing: string[] = [];
    for (const file of referenced) {
      const abs = path.join(REPO_ROOT, '.claude', 'policies', file);
      if (!fs.existsSync(abs)) missing.push(file);
    }
    expect(missing).toEqual([]);
  });
});
