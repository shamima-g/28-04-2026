/**
 * Standardised cleanup recipes, matching the RB-0..RB-7 IDs in /TEST-GUIDE.md § Rollback Reference.
 *
 * Use in afterEach to both clean up AND document what state the test mutated:
 *
 *   afterEach(() => rollback(project.root, 'RB-1'));
 */

import fs from 'node:fs';
import path from 'node:path';

export type RollbackId =
  | 'RB-0'  // Full clean reset
  | 'RB-1'  // Reset workflow state only
  | 'RB-2'  // Revert single modified file (requires --file)
  | 'RB-3'  // Remove test documentation artifact
  | 'RB-4'  // Clear discovered-impacts.md
  | 'RB-5'  // Restore generated-docs write permissions (Windows)
  | 'RB-6'  // Reinstall node_modules (no-op here — we work in temp dirs)
  | 'RB-7'; // Revert most recently injected error (no-op in temp dirs)

export interface RollbackOptions {
  /** For RB-2: relative path to revert. */
  file?: string;
}

/**
 * Execute a rollback recipe against the given project root.
 *
 * Rollbacks in the QA suite are mostly no-ops because each test runs in an
 * isolated temp dir that's removed by the temp-project cleanup. They exist
 * primarily to document what each test mutates — cite the ID in afterEach
 * even if the implementation is a no-op.
 */
export function rollback(root: string, id: RollbackId, opts: RollbackOptions = {}): void {
  switch (id) {
    case 'RB-0':
      // Full clean reset — in temp dirs, this is handled by cleanup().
      // We deliberately don't nuke root here; let cleanup() handle it.
      removeIfExists(path.join(root, 'generated-docs'));
      removeIfExists(path.join(root, 'documentation'));
      fs.mkdirSync(path.join(root, 'generated-docs', 'context'), { recursive: true });
      fs.mkdirSync(path.join(root, 'generated-docs', 'specs'), { recursive: true });
      fs.mkdirSync(path.join(root, 'generated-docs', 'stories'), { recursive: true });
      fs.mkdirSync(path.join(root, 'documentation'), { recursive: true });
      break;

    case 'RB-1':
      removeIfExists(path.join(root, 'generated-docs', 'context', 'workflow-state.json'));
      break;

    case 'RB-2':
      if (!opts.file) throw new Error('RB-2 requires opts.file');
      removeIfExists(path.join(root, opts.file));
      break;

    case 'RB-3':
      // Remove test docs dropped into documentation/
      const docs = path.join(root, 'documentation');
      if (fs.existsSync(docs)) {
        for (const entry of fs.readdirSync(docs)) {
          if (entry.endsWith('.yaml') || entry.endsWith('.json')) {
            removeIfExists(path.join(docs, entry));
          }
        }
      }
      break;

    case 'RB-4': {
      const impacts = path.join(root, 'generated-docs', 'discovered-impacts.md');
      fs.mkdirSync(path.dirname(impacts), { recursive: true });
      fs.writeFileSync(impacts, '');
      break;
    }

    case 'RB-5':
      // Windows permissions — no-op in temp dirs (tests never chmod).
      break;

    case 'RB-6':
      // Reinstall node_modules — no-op; QA has its own deps, tests don't touch web/.
      break;

    case 'RB-7':
      // Revert injected error — no-op; temp-project cleanup handles the full dir.
      break;

    default:
      throw new Error(`Unknown rollback ID: ${id satisfies never}`);
  }
}

function removeIfExists(p: string): void {
  try {
    const stat = fs.lstatSync(p);
    if (stat.isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      fs.unlinkSync(p);
    }
  } catch {
    /* doesn't exist — fine */
  }
}
