/**
 * loadCheckpoint() — apply a named starting state (CP-0..CP-6) to a temp project.
 *
 * Rather than running the full workflow to reach each checkpoint (slow, requires
 * Claude), we seed the minimum files each checkpoint requires. This is enough
 * for mechanical tests of scripts that read state + artifacts.
 *
 * If you need a genuinely realistic CP-N state (e.g. for snapshot tests that
 * verify the dashboard renders correctly), harvest a real run's generated-docs/
 * tree into fixtures/checkpoints/CP-N.tar and load it instead.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { seedState } from './state-fixtures';
import { seedManifest } from './manifest-fixtures';
import { seedArtifact } from './state-fixtures';

export type CheckpointId = 'CP-0' | 'CP-1' | 'CP-2' | 'CP-3' | 'CP-4' | 'CP-5' | 'CP-6';

/** Human-readable description of each checkpoint, mirroring TEST-GUIDE.md. */
export const CHECKPOINT_DESCRIPTIONS: Record<CheckpointId, string> = {
  'CP-0': 'Clean repo, no workflow started',
  'CP-1': 'INTAKE complete, context cleared',
  'CP-2': 'DESIGN complete, context cleared',
  'CP-3': 'SCOPE complete, context cleared',
  'CP-4': 'STORIES complete for Epic 1',
  'CP-5': 'IMPLEMENT phase active — tests written, code incomplete',
  'CP-6': 'QA phase active — implementation done',
};

export function loadCheckpoint(root: string, id: CheckpointId): void {
  // If a tarball fixture exists, prefer it
  const tarPath = path.resolve(__dirname, '..', 'fixtures', 'checkpoints', `${id}.tar`);
  if (fs.existsSync(tarPath)) {
    const res = spawnSync('tar', ['-xf', tarPath, '-C', root], { encoding: 'utf8' });
    if (res.status === 0) return;
    // Fall through to synthetic checkpoint on tar failure
  }

  // Synthetic checkpoint — minimum files to pass validate-phase-output.js
  switch (id) {
    case 'CP-0':
      // Nothing — fresh project
      break;

    case 'CP-1':
      // INTAKE complete
      seedManifest(root);
      seedArtifact(root, 'frs');
      seedState(root, { currentPhase: 'INTAKE', phaseStatus: 'complete' });
      break;

    case 'CP-2':
      // DESIGN complete
      seedManifest(root);
      seedArtifact(root, 'frs');
      seedArtifact(root, 'api-spec');
      seedState(root, { currentPhase: 'DESIGN', phaseStatus: 'complete' });
      break;

    case 'CP-3':
      // SCOPE complete
      seedManifest(root);
      seedArtifact(root, 'frs');
      seedArtifact(root, 'api-spec');
      seedArtifact(root, 'feature-overview');
      seedState(root, {
        currentPhase: 'SCOPE',
        phaseStatus: 'complete',
        totalEpics: 2,
      });
      break;

    case 'CP-4':
      // STORIES complete for Epic 1
      seedManifest(root);
      seedArtifact(root, 'frs');
      seedArtifact(root, 'api-spec');
      seedArtifact(root, 'feature-overview');
      seedArtifact(root, 'epic-overview', undefined, { epicNum: 1, slug: 'browsing' });
      seedArtifact(root, 'story', undefined, { epicNum: 1, storyNum: 1, slug: 'browsing' });
      seedArtifact(root, 'story', undefined, { epicNum: 1, storyNum: 2, slug: 'browsing' });
      seedState(root, {
        currentPhase: 'STORIES',
        currentEpic: 1,
        phaseStatus: 'complete',
        totalEpics: 2,
      });
      break;

    case 'CP-5':
      // IMPLEMENT active — tests written
      loadCheckpoint(root, 'CP-4');
      fs.mkdirSync(path.join(root, 'web', 'src', '__tests__', 'integration'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'web', 'src', '__tests__', 'integration', 'example.test.tsx'),
        `import { describe, it, expect } from 'vitest';\ndescribe('example', () => { it('fails', () => { expect(false).toBe(true); }); });\n`
      );
      seedState(root, {
        currentPhase: 'IMPLEMENT',
        currentEpic: 1,
        currentStory: 1,
        phaseStatus: 'in_progress',
      });
      break;

    case 'CP-6':
      // QA active — implementation done
      loadCheckpoint(root, 'CP-5');
      fs.mkdirSync(path.join(root, 'web', 'src', 'app', 'tasks'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'web', 'src', 'app', 'tasks', 'page.tsx'),
        `export default function TasksPage() { return <div>Tasks</div>; }\n`
      );
      seedState(root, {
        currentPhase: 'QA',
        currentEpic: 1,
        currentStory: 1,
        phaseStatus: 'in_progress',
      });
      break;

    default:
      throw new Error(`Unknown checkpoint: ${id satisfies never}`);
  }
}
