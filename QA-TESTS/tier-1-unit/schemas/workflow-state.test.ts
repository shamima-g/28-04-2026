/**
 * JSON schema validation — workflow-state.json must match the schema in
 * helpers/schemas/workflow-state.schema.json. Protects against silent schema
 * drift when transition-phase.js is edited.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createTempProject, seedState } from '../../helpers';

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'helpers', 'schemas', 'workflow-state.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const validate = ajv.compile(schema);

describe('workflow-state.json schema', () => {
  it('PASS: a fresh default-seeded state validates', () => {
    const p = createTempProject();
    try {
      seedState(p.root);
      const state = JSON.parse(p.read('generated-docs/context/workflow-state.json'));
      const ok = validate(state);
      expect(ok, JSON.stringify(validate.errors, null, 2)).toBe(true);
    } finally {
      p.cleanup();
    }
  });

  it('PASS: states across every phase value validate', () => {
    const phases = [
      'INTAKE', 'SCOPE', 'DESIGN', 'STORIES', 'REALIGN',
      'TEST-DESIGN', 'WRITE-TESTS', 'IMPLEMENT', 'QA', 'COMPLETE',
      'PHASE-BOUNDARY', 'PENDING',
    ] as const;

    for (const phase of phases) {
      const p = createTempProject();
      try {
        seedState(p.root, { currentPhase: phase });
        const state = JSON.parse(p.read('generated-docs/context/workflow-state.json'));
        const ok = validate(state);
        expect(ok, `${phase}: ${JSON.stringify(validate.errors)}`).toBe(true);
      } finally {
        p.cleanup();
      }
    }
  });

  it('FAIL: an invalid phase value is rejected', () => {
    const invalid = { currentPhase: 'BOGUS' };
    expect(validate(invalid)).toBe(false);
  });

  it('FAIL: a negative currentEpic is rejected', () => {
    const invalid = { currentPhase: 'STORIES', currentEpic: -1 };
    expect(validate(invalid)).toBe(false);
  });

  it('FAIL: a missing currentPhase is rejected', () => {
    const invalid = { featureName: 'Test' };
    expect(validate(invalid)).toBe(false);
  });
});
