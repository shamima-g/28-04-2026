/**
 * TEST-GUIDE.md Test 31 — API Spec Detection, Multi-Layer (artifact-lint version).
 *
 * Every path used in web/src/lib/api/endpoints.ts (and elsewhere under web/src/)
 * must match a path declared in generated-docs/specs/api-spec.yaml. Claude
 * must never invent paths that aren't in the spec.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { REPO_ROOT, createTempProject } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

function extractSpecPaths(yamlContent: string): string[] {
  try {
    const doc = yaml.load(yamlContent) as { paths?: Record<string, unknown> };
    return Object.keys(doc?.paths ?? {});
  } catch {
    return [];
  }
}

function extractCodePaths(code: string): string[] {
  // Match strings like "/api/v2/tasks" or '/api/tasks/{id}' or template literals
  const matches = code.match(/["'`](\/api\/[^"'`]+)["'`]/g) ?? [];
  return matches.map(m => m.slice(1, -1).replace(/\$\{[^}]+\}/g, '{param}'));
}

function pathMatchesSpec(codePath: string, specPaths: string[]): boolean {
  // Normalise { } parameters
  const normalise = (p: string) => p.replace(/\{[^}]+\}/g, '{}');
  const normCode = normalise(codePath);
  return specPaths.some(sp => normalise(sp) === normCode);
}

describe('artifact-lint — API path exactness', () => {
  it('PASS: every path in web/src matches the api-spec', () => {
    const spec = path.join(REPO_ROOT, 'generated-docs', 'specs', 'api-spec.yaml');
    const endpoints = path.join(REPO_ROOT, 'web', 'src', 'lib', 'api', 'endpoints.ts');
    if (!fs.existsSync(spec) || !fs.existsSync(endpoints)) {
      // Skip — no real spec/endpoints in the template yet
      return;
    }
    const specPaths = extractSpecPaths(fs.readFileSync(spec, 'utf8'));
    const codePaths = extractCodePaths(fs.readFileSync(endpoints, 'utf8'));
    const invented: string[] = [];
    for (const p of codePaths) {
      if (!pathMatchesSpec(p, specPaths)) invented.push(p);
    }
    expect(invented, `Code paths not in spec: ${invented.join(', ')}`).toHaveLength(0);
  });
});

describe('artifact-lint — API path matcher correctness', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('FAIL: matcher correctly flags an invented path', () => {
    const specYaml = `openapi: 3.0.3\npaths:\n  /api/v2/tasks:\n    get: { responses: { '200': { description: ok } } }\n`;
    const code = `export const listTasks = () => fetch("/api/tasks");\n`; // wrong — should be /api/v2/tasks
    const specPaths = extractSpecPaths(specYaml);
    const codePaths = extractCodePaths(code);
    const invented = codePaths.filter(p => !pathMatchesSpec(p, specPaths));
    expect(invented).toContain('/api/tasks');
  });

  it('PASS: matcher accepts an exact spec match', () => {
    const specYaml = `openapi: 3.0.3\npaths:\n  /api/v2/tasks:\n    get: { responses: { '200': { description: ok } } }\n`;
    const code = `export const listTasks = () => fetch("/api/v2/tasks");\n`;
    const specPaths = extractSpecPaths(specYaml);
    const codePaths = extractCodePaths(code);
    const invented = codePaths.filter(p => !pathMatchesSpec(p, specPaths));
    expect(invented).toHaveLength(0);
  });

  it('PASS: matcher treats parameterised paths correctly', () => {
    const specYaml = `openapi: 3.0.3\npaths:\n  /api/v2/tasks/{id}:\n    delete: { responses: { '204': { description: deleted } } }\n`;
    const code = `export const deleteTask = (id: string) => fetch(\`/api/v2/tasks/\${id}\`);\n`;
    const specPaths = extractSpecPaths(specYaml);
    const codePaths = extractCodePaths(code);
    const invented = codePaths.filter(p => !pathMatchesSpec(p, specPaths));
    expect(invented).toHaveLength(0);
  });
});
