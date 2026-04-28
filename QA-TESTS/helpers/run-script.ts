/**
 * runScript() — spawn wrapper for invoking a Claude Code script in a temp project.
 *
 * Captures stdout, stderr, exit code, and parses stdout as JSON when possible
 * (all Claude Code scripts output JSON by convention).
 */

import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from './temp-project';

export interface ScriptResult {
  /** Resolved absolute path of the script that ran. */
  scriptPath: string;
  /** Exit code (0 = success). */
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Parsed stdout if it was valid JSON, otherwise undefined. */
  parsedJson?: unknown;
  /** Convenient JSON accessor that throws if parse failed. */
  json<T = Record<string, unknown>>(): T;
}

export interface RunScriptOptions extends Pick<SpawnSyncOptions, 'env' | 'timeout'> {
  /** Working directory (defaults to the temp project root). */
  cwd: string;
  /** Stdin to feed the script. */
  input?: string;
  /**
   * Which .claude/scripts/ copy to use. If 'repo' (default), runs the script
   * from the real repo — tests use the local working tree. If 'temp', runs
   * the copy under <root>/.claude/scripts/ (only when copyScripts: true was
   * passed to createTempProject).
   */
  scriptLocation?: 'repo' | 'temp';
}

export function runScript(
  relativeScriptPath: string,
  args: string[],
  opts: RunScriptOptions
): ScriptResult {
  const { cwd, input, env, timeout = 15_000, scriptLocation = 'repo' } = opts;
  const base = scriptLocation === 'repo' ? REPO_ROOT : cwd;
  const scriptPath = path.resolve(base, relativeScriptPath);

  const res = spawnSync('node', [scriptPath, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    timeout,
    env: {
      ...process.env,
      CLAUDE_TEST_MODE: '1',
      CLAUDE_PROJECT_DIR: cwd,
      ...env,
    } as NodeJS.ProcessEnv,
  });

  const stdout = (res.stdout ?? '').toString();
  const stderr = (res.stderr ?? '').toString();
  let parsedJson: unknown = undefined;
  try {
    parsedJson = JSON.parse(stdout);
  } catch {
    // Not JSON — fine, some tests inspect stdout as text.
  }

  return {
    scriptPath,
    exitCode: typeof res.status === 'number' ? res.status : 1,
    stdout,
    stderr,
    parsedJson,
    json<T = Record<string, unknown>>(): T {
      if (parsedJson === undefined) {
        throw new Error(
          `Script output was not JSON.\nstdout:\n${stdout}\nstderr:\n${stderr}`
        );
      }
      return parsedJson as T;
    },
  };
}
