/**
 * seedManifest() — writes generated-docs/context/intake-manifest.json with sensible defaults.
 *
 * Shape matches what intake-agent Call B produces and what downstream DESIGN
 * agents read. Override selectively for variant tests.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ArtifactEntry {
  generate: boolean;
  userProvided?: string | string[] | null;
  [k: string]: unknown;
}

export interface IntakeManifest {
  featureName?: string;
  context?: {
    dataSource?: 'existing-api' | 'new-api' | 'api-in-development' | 'mock-only';
    specCompleteness?: 'complete' | 'partial' | 'none';
    authMethod?: 'bff' | 'frontend-only' | 'custom';
    complianceDomains?: string[];
    projectDescription?: string | null;
    prototypeFormat?: 'v1' | 'v2' | null;
    [k: string]: unknown;
  };
  artifacts?: {
    apiSpec?: ArtifactEntry & { mockHandlers?: boolean };
    designTokensCss?: ArtifactEntry;
    designTokensMd?: ArtifactEntry;
    wireframes?: ArtifactEntry;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

const DEFAULT_MANIFEST: IntakeManifest = {
  featureName: 'Team Task Manager',
  context: {
    dataSource: 'api-in-development',
    specCompleteness: 'none',
    authMethod: 'frontend-only',
    complianceDomains: [],
    projectDescription: 'A task management tool for small teams.',
    prototypeFormat: null,
  },
  artifacts: {
    apiSpec: { generate: true, userProvided: null, mockHandlers: true },
    designTokensCss: { generate: true, userProvided: null },
    designTokensMd: { generate: true, userProvided: null },
    wireframes: { generate: true, userProvided: null },
  },
};

export function seedManifest(root: string, overrides: Partial<IntakeManifest> = {}): string {
  const stateDir = path.join(root, 'generated-docs', 'context');
  fs.mkdirSync(stateDir, { recursive: true });
  const filePath = path.join(stateDir, 'intake-manifest.json');
  const merged = deepMerge(DEFAULT_MANIFEST, overrides);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  return filePath;
}

export function readManifest(root: string): IntakeManifest {
  const filePath = path.join(root, 'generated-docs', 'context', 'intake-manifest.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as IntakeManifest;
}

function deepMerge<T extends object>(base: T, overrides: Partial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(overrides)) {
    const baseVal = (base as Record<string, unknown>)[k];
    if (isPlainObject(v) && isPlainObject(baseVal)) {
      out[k] = deepMerge(baseVal as object, v as object);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
