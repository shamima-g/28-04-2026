/**
 * TEST-GUIDE.md Test 32 — Shadcn UI MCP Enforcement.
 *
 * All UI component imports in web/src/app/ and web/src/components/ must come
 * from `@/components/ui/` (Shadcn). No hand-crafted component files in
 * web/src/components/ that imitate Shadcn patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, createTempProject } from '../../helpers';
import type { TempProject } from '../../helpers/temp-project';

const COMMON_UI = new Set([
  'Button', 'Card', 'Dialog', 'Input', 'Label', 'Select', 'Table',
  'Textarea', 'Alert', 'Badge', 'Form', 'Tabs', 'Tooltip',
]);

function extractImports(code: string): Array<{ names: string[]; from: string }> {
  const out: Array<{ names: string[]; from: string }> = [];
  const re = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
    out.push({ names, from: m[2] });
  }
  return out;
}

function* walkTsx(dir: string): Iterable<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      yield* walkTsx(full);
    } else if (entry.isFile() && /\.tsx$/.test(entry.name)) {
      yield full;
    }
  }
}

describe('artifact-lint — Shadcn imports in real repo', () => {
  it('PASS: UI component imports use @/components/ui/ in web/src', () => {
    const srcDir = path.join(REPO_ROOT, 'web', 'src');
    if (!fs.existsSync(srcDir)) return;

    const violations: string[] = [];
    for (const file of walkTsx(srcDir)) {
      const code = fs.readFileSync(file, 'utf8');
      for (const imp of extractImports(code)) {
        const looksLikeUi = imp.names.some(n => COMMON_UI.has(n));
        if (!looksLikeUi) continue;
        const isShadcn = imp.from.startsWith('@/components/ui/') || imp.from.includes('components/ui');
        if (!isShadcn) {
          violations.push(`${path.relative(REPO_ROOT, file)}: { ${imp.names.join(', ')} } from '${imp.from}'`);
        }
      }
    }
    expect(violations, `Non-Shadcn UI imports: ${violations.join('\n')}`).toHaveLength(0);
  });
});

describe('artifact-lint — Shadcn detector correctness', () => {
  let project: TempProject;
  beforeEach(() => { project = createTempProject(); });
  afterEach(() => { project.cleanup(); });

  it('FAIL: detects a hand-crafted Button import', () => {
    const code = `import { Button } from "./CustomButton";\nexport default () => <Button />;\n`;
    const imports = extractImports(code);
    const violations = imports
      .filter(i => i.names.some(n => COMMON_UI.has(n)))
      .filter(i => !i.from.includes('components/ui'));
    expect(violations).toHaveLength(1);
  });

  it('PASS: accepts an @/components/ui/ Button import', () => {
    const code = `import { Button } from "@/components/ui/button";\n`;
    const imports = extractImports(code);
    const violations = imports
      .filter(i => i.names.some(n => COMMON_UI.has(n)))
      .filter(i => !i.from.includes('components/ui'));
    expect(violations).toHaveLength(0);
  });
});
