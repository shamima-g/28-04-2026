/**
 * gitSandbox() — initialises git in a temp project and returns commit helpers.
 *
 * Used by tests that verify scripts which run `git add` / `git commit` / `git push`.
 * No actual remote is configured — pushes are tested by checking the script's
 * output/exit code, not by hitting a real remote.
 */

import { spawnSync } from 'node:child_process';

export interface GitSandbox {
  /** The working dir (== temp project root). */
  cwd: string;
  /** Run any git command. Returns { exitCode, stdout, stderr }. */
  git: (...args: string[]) => { exitCode: number; stdout: string; stderr: string };
  /** Add a file and commit with a message. */
  commit: (message: string, files?: string[]) => void;
  /** Return the short SHA of HEAD. */
  headSha: () => string;
  /** List commit subjects in reverse chronological order. */
  log: () => string[];
}

export function gitSandbox(cwd: string): GitSandbox {
  const git = (...args: string[]) => {
    const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
    return {
      exitCode: typeof res.status === 'number' ? res.status : 1,
      stdout: (res.stdout ?? '').toString(),
      stderr: (res.stderr ?? '').toString(),
    };
  };

  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'QA Test');
  git('config', 'commit.gpgsign', 'false');

  const commit = (message: string, files: string[] = ['-A']) => {
    git('add', ...files);
    const res = git('commit', '-m', message, '--allow-empty');
    if (res.exitCode !== 0) {
      throw new Error(`git commit failed: ${res.stderr}`);
    }
  };

  const headSha = () => git('rev-parse', '--short', 'HEAD').stdout.trim();

  const log = () => {
    const res = git('log', '--pretty=format:%s');
    return res.exitCode === 0 ? res.stdout.split('\n').filter(Boolean) : [];
  };

  return { cwd, git, commit, headSha, log };
}
