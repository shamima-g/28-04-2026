/**
 * createTempProject() — scaffolds a throwaway project dir in os.tmpdir().
 *
 * Every test gets its own root. Copies enough of the real repo's .claude/
 * structure that scripts-under-test can run against it.
 *
 * Returns { root, cleanup }. Always call cleanup() in afterEach.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const REPO_ROOT = process.env.REPO_ROOT
  ? path.resolve(process.env.REPO_ROOT)
  : path.resolve(__dirname, '..', '..');

export interface TempProject {
  /** Absolute path to the throwaway project root. */
  root: string;
  /** Removes the project root recursively. Idempotent. */
  cleanup: () => void;
  /** Absolute path to a file under the project root. */
  join: (...segments: string[]) => string;
  /** Writes a file under root (creates dirs as needed). Returns the absolute path. */
  write: (relPath: string, content: string | Buffer) => string;
  /** Reads a file under root. */
  read: (relPath: string) => string;
  /** Checks if a file exists under root. */
  exists: (relPath: string) => boolean;
}

export interface CreateTempProjectOptions {
  /** Copy .claude/scripts/ from the repo into the temp root (default: true). */
  copyScripts?: boolean;
  /** Copy .claude/hooks/*.js (not ps1) into the temp root (default: false). */
  copyHooks?: boolean;
  /** Copy .claude/agents/ into the temp root (default: false). */
  copyAgents?: boolean;
  /** Copy .claude/policies/ into the temp root (default: false). */
  copyPolicies?: boolean;
  /** Initialise a bare generated-docs/ tree (default: true). */
  seedGeneratedDocs?: boolean;
  /** Custom prefix for the temp dir name (default: 'claude-query'). */
  prefix?: string;
}

export function createTempProject(opts: CreateTempProjectOptions = {}): TempProject {
  const {
    copyScripts = true,
    copyHooks = false,
    copyAgents = false,
    copyPolicies = false,
    seedGeneratedDocs = true,
    prefix = 'claude-query',
  } = opts;

  const id = crypto.randomBytes(6).toString('hex');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-${id}-`));

  if (copyScripts) {
    copyDir(path.join(REPO_ROOT, '.claude', 'scripts'), path.join(root, '.claude', 'scripts'));
  }

  if (copyHooks) {
    const srcHooks = path.join(REPO_ROOT, '.claude', 'hooks');
    const dstHooks = path.join(root, '.claude', 'hooks');
    fs.mkdirSync(dstHooks, { recursive: true });
    for (const entry of fs.readdirSync(srcHooks, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        fs.copyFileSync(path.join(srcHooks, entry.name), path.join(dstHooks, entry.name));
      }
    }
  }

  if (copyAgents) {
    copyDir(path.join(REPO_ROOT, '.claude', 'agents'), path.join(root, '.claude', 'agents'));
  }

  if (copyPolicies) {
    copyDir(path.join(REPO_ROOT, '.claude', 'policies'), path.join(root, '.claude', 'policies'));
  }

  if (seedGeneratedDocs) {
    fs.mkdirSync(path.join(root, 'generated-docs', 'context'), { recursive: true });
    fs.mkdirSync(path.join(root, 'generated-docs', 'specs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'generated-docs', 'stories'), { recursive: true });
    fs.mkdirSync(path.join(root, 'documentation'), { recursive: true });
  }

  const project: TempProject = {
    root,
    cleanup: () => {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch {
        /* swallow — tests shouldn't fail because cleanup couldn't unlink */
      }
    },
    join: (...segments: string[]) => path.join(root, ...segments),
    write: (relPath: string, content: string | Buffer) => {
      const abs = path.join(root, relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      return abs;
    },
    read: (relPath: string) => fs.readFileSync(path.join(root, relPath), 'utf8'),
    exists: (relPath: string) => fs.existsSync(path.join(root, relPath)),
  };

  return project;
}

function copyDir(src: string, dst: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

export { REPO_ROOT };
