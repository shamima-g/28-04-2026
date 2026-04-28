/**
 * Static consistency check — .claude/settings.json is well-formed and every hook
 * command references a file that actually exists.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../helpers';

const SETTINGS = path.join(REPO_ROOT, '.claude', 'settings.json');

type HookEntry = { type: string; command: string; timeout?: number };
type HookEvent = { matcher: string; hooks: HookEntry[] };
type Settings = {
  permissions?: { deny?: string[]; allow?: string[] };
  hooks?: Record<string, HookEvent[]>;
};

describe('settings.json structural validity', () => {
  let settings: Settings;

  it('PASS: parses as valid JSON', () => {
    const raw = fs.readFileSync(SETTINGS, 'utf8');
    expect(() => { settings = JSON.parse(raw) as Settings; }).not.toThrow();
  });

  it('PASS: has expected top-level sections', () => {
    settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) as Settings;
    expect(settings.permissions).toBeDefined();
    expect(settings.hooks).toBeDefined();
  });

  it('FAIL: deny list is not empty (security invariant)', () => {
    settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) as Settings;
    expect(settings.permissions?.deny).toBeDefined();
    expect(settings.permissions?.deny?.length).toBeGreaterThan(5);
    // Must deny rm -rf / variants
    const denyStr = JSON.stringify(settings.permissions?.deny ?? []);
    expect(denyStr).toContain('rm -rf');
    expect(denyStr.toLowerCase()).toContain('id_rsa');
  });
});

describe('settings.json hook files exist', () => {
  const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) as Settings;

  // Collect all referenced file paths from hook commands
  const hookPaths = new Set<string>();
  for (const events of Object.values(settings.hooks ?? {})) {
    for (const event of events) {
      for (const hook of event.hooks) {
        // Commands like: powershell -NoProfile -ExecutionPolicy Bypass -File ".claude/logging/capture-context.ps1" -EventType prompt
        // or: node ".claude/hooks/bash-permission-checker.js"
        const m = hook.command.match(/["']([^"']+\.(?:ps1|js))["']/);
        if (m) hookPaths.add(m[1]);
        // Unquoted form
        const m2 = hook.command.match(/(?:node|powershell[^"]*-File)\s+([^\s"]+\.(?:ps1|js))/);
        if (m2) hookPaths.add(m2[1]);
      }
    }
  }

  for (const relPath of hookPaths) {
    it(`PASS: hook file referenced in settings.json exists: ${relPath}`, () => {
      // settings.json uses $CLAUDE_PROJECT_DIR / ${CLAUDE_PROJECT_DIR} as a
      // project-root placeholder. At runtime Claude Code expands it; on disk
      // the files live at REPO_ROOT, so strip the placeholder before joining.
      const stripped = relPath
        .replace(/^\$\{?CLAUDE_PROJECT_DIR\}?[\\/]/, '')
        .replace(/^[\\/]/, '');
      const abs = path.join(REPO_ROOT, stripped);
      expect(fs.existsSync(abs), `${abs} referenced in settings.json does not exist`).toBe(true);
    });
  }
});

describe('settings.json hook timeouts are reasonable', () => {
  it('PASS: no hook declares a timeout over 60 seconds', () => {
    const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) as Settings;
    const over60: string[] = [];
    for (const events of Object.values(settings.hooks ?? {})) {
      for (const event of events) {
        for (const hook of event.hooks) {
          if ((hook.timeout ?? 0) > 60) {
            over60.push(`${hook.command} (timeout=${hook.timeout}s)`);
          }
        }
      }
    }
    expect(over60, `Hooks with excessive timeouts: ${over60.join(', ')}`).toEqual([]);
  });
});
