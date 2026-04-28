/**
 * JSON schema validation — intake-manifest.json must match the schema in
 * helpers/schemas/intake-manifest.schema.json.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createTempProject, seedManifest } from '../../helpers';

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'helpers', 'schemas', 'intake-manifest.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const validate = ajv.compile(schema);

describe('intake-manifest.json schema', () => {
  it('PASS: default manifest (Team Task Manager) validates', () => {
    const p = createTempProject();
    try {
      seedManifest(p.root);
      const manifest = JSON.parse(p.read('generated-docs/context/intake-manifest.json'));
      const ok = validate(manifest);
      expect(ok, JSON.stringify(validate.errors, null, 2)).toBe(true);
    } finally {
      p.cleanup();
    }
  });

  it('PASS: BFF variant overlay validates', () => {
    const p = createTempProject();
    try {
      seedManifest(p.root, {
        context: {
          authMethod: 'bff',
          bffEndpoints: {
            login: '/api/auth/login',
            userinfo: '/api/auth/userinfo',
            logout: '/api/auth/logout',
          },
        } as any,
      });
      const manifest = JSON.parse(p.read('generated-docs/context/intake-manifest.json'));
      expect(validate(manifest)).toBe(true);
    } finally {
      p.cleanup();
    }
  });

  it('FAIL: invalid dataSource value is rejected', () => {
    const invalid = {
      context: { dataSource: 'bogus-source' },
      artifacts: { apiSpec: { generate: true } },
    };
    expect(validate(invalid)).toBe(false);
  });

  it('FAIL: artifact entry without `generate` boolean is rejected', () => {
    const invalid = {
      context: { dataSource: 'new-api' },
      artifacts: { apiSpec: { userProvided: 'path.yaml' } }, // missing generate
    };
    expect(validate(invalid)).toBe(false);
  });

  it('FAIL: invalid authMethod is rejected', () => {
    const invalid = {
      context: { authMethod: 'magic-handshake' },
      artifacts: {},
    };
    expect(validate(invalid)).toBe(false);
  });
});
