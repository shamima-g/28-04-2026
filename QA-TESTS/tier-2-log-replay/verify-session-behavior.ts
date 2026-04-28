/**
 * verify-session-behavior — shared utilities for Tier 2 invariant tests.
 *
 * Every invariant test calls loadGoldenLog() to get the parsed timeline, then
 * asserts a specific property. If no golden log is present, the test is
 * skipped gracefully with a warning rather than failing — that lets CI pass
 * on a fresh checkout even before the first live run has been harvested.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseSessionLog, type SessionLog } from '../helpers/parse-session-log';

const GOLDEN_LOGS_DIR = path.resolve(__dirname, '..', 'fixtures', 'golden-logs');

export interface LoadResult {
  available: boolean;
  log?: SessionLog;
  reason?: string;
  path?: string;
}

/**
 * Load the most recent golden log matching a name pattern (e.g. "full-happy-path").
 * Returns { available: false, reason } when no matching log exists — callers
 * should skip the test in that case rather than fail.
 */
export function loadGoldenLog(pattern: string = 'full-happy-path'): LoadResult {
  if (!fs.existsSync(GOLDEN_LOGS_DIR)) {
    return { available: false, reason: `golden-logs directory not found at ${GOLDEN_LOGS_DIR}` };
  }

  const matches = fs.readdirSync(GOLDEN_LOGS_DIR)
    .filter(f => f.endsWith('.md'))
    .filter(f => f.toLowerCase().includes(pattern.toLowerCase()))
    .sort()
    .reverse(); // most recent by filename (logs start with a date)

  if (matches.length === 0) {
    return {
      available: false,
      reason: `no golden log matching "${pattern}" in ${GOLDEN_LOGS_DIR}. Run a live workflow and harvest one — see fixtures/golden-logs/README.md.`,
    };
  }

  const logPath = path.join(GOLDEN_LOGS_DIR, matches[0]);
  return {
    available: true,
    log: parseSessionLog(logPath),
    path: logPath,
  };
}

/**
 * Stale-log canary — fail if the newest golden log is older than the most
 * recently modified orchestrator-rules.md or settings.json. Logs that predate
 * a rules change cannot meaningfully guard against regressions.
 */
export function checkFreshness(): { stale: boolean; message: string } {
  const rules = path.resolve(__dirname, '..', '..', '.claude', 'shared', 'orchestrator-rules.md');
  const settings = path.resolve(__dirname, '..', '..', '.claude', 'settings.json');

  if (!fs.existsSync(GOLDEN_LOGS_DIR)) {
    return { stale: true, message: 'no golden logs harvested yet' };
  }

  const logs = fs.readdirSync(GOLDEN_LOGS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(GOLDEN_LOGS_DIR, f)).mtimeMs }));

  if (logs.length === 0) {
    return { stale: true, message: 'golden-logs directory is empty' };
  }

  const newestLog = Math.max(...logs.map(l => l.mtime));
  const rulesMtime = fs.existsSync(rules) ? fs.statSync(rules).mtimeMs : 0;
  const settingsMtime = fs.existsSync(settings) ? fs.statSync(settings).mtimeMs : 0;
  const criticalMtime = Math.max(rulesMtime, settingsMtime);

  if (newestLog < criticalMtime) {
    return {
      stale: true,
      message: 'golden log is older than orchestrator-rules.md or settings.json — re-harvest',
    };
  }
  return { stale: false, message: 'logs are fresh' };
}
