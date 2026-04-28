/**
 * seedState() — writes a workflow-state.json with sensible defaults plus overrides.
 *
 * Shape matches .claude/scripts/transition-phase.js expectations.
 */

import fs from 'node:fs';
import path from 'node:path';

export type Phase =
  | 'INTAKE'
  | 'SCOPE'
  | 'DESIGN'
  | 'STORIES'
  | 'REALIGN'
  | 'TEST-DESIGN'
  | 'WRITE-TESTS'
  | 'IMPLEMENT'
  | 'QA'
  | 'COMPLETE'
  | 'PHASE-BOUNDARY'
  | 'PENDING';

export interface WorkflowState {
  featureName?: string;
  currentPhase?: Phase;
  currentEpic?: number | null;
  currentStory?: number | null;
  phaseStatus?: 'ready' | 'in_progress' | 'paused' | 'complete';
  featureComplete?: boolean;
  totalEpics?: number;
  epics?: Record<string, unknown>;
  lastUpdated?: string;
  [k: string]: unknown;
}

const DEFAULT_STATE: WorkflowState = {
  featureName: 'Team Task Manager',
  currentPhase: 'INTAKE',
  currentEpic: null,
  currentStory: null,
  phaseStatus: 'ready',
  featureComplete: false,
  totalEpics: 0,
  epics: {},
  lastUpdated: '2026-04-21T00:00:00.000Z',
};

export function seedState(root: string, overrides: Partial<WorkflowState> = {}): string {
  const stateDir = path.join(root, 'generated-docs', 'context');
  fs.mkdirSync(stateDir, { recursive: true });
  const stateFile = path.join(stateDir, 'workflow-state.json');
  const merged: WorkflowState = { ...DEFAULT_STATE, ...overrides };
  fs.writeFileSync(stateFile, JSON.stringify(merged, null, 2));
  return stateFile;
}

export function readState(root: string): WorkflowState {
  const stateFile = path.join(root, 'generated-docs', 'context', 'workflow-state.json');
  return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as WorkflowState;
}

export function seedArtifact(
  root: string,
  kind: 'frs' | 'api-spec' | 'intake-manifest' | 'feature-overview' | 'epic-overview' | 'story' | 'discovered-impacts',
  content?: string,
  opts: { epicNum?: number; storyNum?: number; slug?: string } = {}
): string {
  const { epicNum = 1, storyNum = 1, slug = 'example' } = opts;
  let relPath: string;
  let defaultContent: string;

  switch (kind) {
    case 'frs':
      relPath = 'generated-docs/specs/feature-requirements.md';
      defaultContent = `# Feature: Example\n\n## Functional Requirements\n- **R1:** example\n`;
      break;
    case 'api-spec':
      relPath = 'generated-docs/specs/api-spec.yaml';
      defaultContent = `openapi: 3.0.3\ninfo:\n  title: Example\n  version: 1.0.0\npaths:\n  /api/example:\n    get:\n      responses:\n        '200':\n          description: ok\ncomponents: {}\n`;
      break;
    case 'intake-manifest':
      // Minimal manifest with the top-level keys validate-phase-output.js checks for.
      // By default it declares an API spec is expected; callers can override via `content`.
      relPath = 'generated-docs/context/intake-manifest.json';
      defaultContent = JSON.stringify({
        context: { featureName: 'Example' },
        artifacts: {
          apiSpec: { generate: true },
          wireframes: { generate: false },
          designTokensCss: { generate: false },
          designTokensMd: { generate: false },
        },
      }, null, 2);
      break;
    case 'feature-overview':
      relPath = 'generated-docs/stories/_feature-overview.md';
      defaultContent = `# Feature Overview\n\n## Epics\n- Epic 1: Example\n`;
      break;
    case 'epic-overview':
      relPath = `generated-docs/stories/epic-${epicNum}-${slug}/_epic-overview.md`;
      defaultContent = `# Epic ${epicNum}\n`;
      break;
    case 'story':
      relPath = `generated-docs/stories/epic-${epicNum}-${slug}/story-${storyNum}-${slug}.md`;
      defaultContent = `# Story ${storyNum}\n\n**Role:** Admin\n`;
      break;
    case 'discovered-impacts':
      relPath = 'generated-docs/discovered-impacts.md';
      defaultContent = '';
      break;
    default:
      throw new Error(`Unknown artifact kind: ${kind satisfies never}`);
  }

  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content ?? defaultContent);
  return abs;
}
