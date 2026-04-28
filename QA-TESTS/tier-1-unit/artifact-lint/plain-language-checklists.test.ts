/**
 * TEST-GUIDE.md Test 34 — Plain Language Policy.
 *
 * Verification checklists under generated-docs/qa/**-verification-checklist.md
 * must not contain engineering jargon. The user is often a non-developer.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../helpers';

const JARGON_PATTERNS: Array<RegExp> = [
  /\bisLoading\b/,
  /\bSkeleton\b/,
  /\bexit code\b/i,
  /\btsc\b/,
  /\btypecheck\b/i,
  /\bESLint\b/,
  /\bGate\s*3\b/,
  /\buseState\b/,
  /\buseEffect\b/,
  /\bjsdom\b/,
  /\bvitest\b/i,
  /\bMSW\b/,
];

function* walkChecklists(dir: string): Iterable<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkChecklists(full);
    else if (entry.isFile() && entry.name.endsWith('-verification-checklist.md')) yield full;
  }
}

describe('artifact-lint — plain-language verification checklists', () => {
  it('PASS: no jargon in any verification-checklist.md', () => {
    const qaDir = path.join(REPO_ROOT, 'generated-docs', 'qa');
    if (!fs.existsSync(qaDir)) return; // no runs yet — nothing to check

    const offenders: string[] = [];
    for (const file of walkChecklists(qaDir)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const rx of JARGON_PATTERNS) {
        if (rx.test(content)) {
          offenders.push(`${path.relative(REPO_ROOT, file)}: matches ${rx}`);
        }
      }
    }
    expect(offenders, `Jargon found:\n${offenders.join('\n')}`).toHaveLength(0);
  });

  it('FAIL: detector correctly flags jargon in a synthetic string', () => {
    const bad = 'Verify the Skeleton renders when isLoading is true (ESLint passed).';
    const hits = JARGON_PATTERNS.filter(rx => rx.test(bad));
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });

  it('PASS: detector allows plain-language phrasing', () => {
    const good = 'Verify a loading spinner appears while data loads. The form shows an error if submitted without a title.';
    const hits = JARGON_PATTERNS.filter(rx => rx.test(good));
    expect(hits).toHaveLength(0);
  });
});
