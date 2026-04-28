#!/usr/bin/env node
/**
 * Automated tests for the requirements traceability helpers in workflow-helpers.js.
 *
 * Tests: expandRange, parseFRSRequirements, parseStoryRequirements,
 *        parseFeatureOverviewRequirements, getRequirementsCoverage, coveragePct.
 *
 * Follows the same standalone test-runner pattern as bash-permission-checker.tests.js.
 * Creates temp fixtures on disk and runs the real helpers against them.
 *
 * Usage:
 *   node .claude/scripts/lib/workflow-helpers.tests.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, description) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m: ${description}`);
  } else {
    failed++;
    const msg = `FAIL: ${description}`;
    errors.push(msg);
    console.log(`  \x1b[31m${msg}\x1b[0m`);
  }
}

function assertDeepEqual(actual, expected, description) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m: ${description}`);
  } else {
    failed++;
    const msg = `FAIL: ${description}\n         expected: ${e}\n         actual:   ${a}`;
    errors.push(msg);
    console.log(`  \x1b[31m${msg}\x1b[0m`);
  }
}

// =============================================================================
// PURE FUNCTION TESTS (no filesystem needed)
// =============================================================================

// Load helpers from the real module location
const helpers = require('./workflow-helpers');

console.log('\nexpandRange: basic ranges');
assertDeepEqual(helpers.expandRange('R1–R3'), ['R1', 'R2', 'R3'], 'en-dash range R1–R3');
assertDeepEqual(helpers.expandRange('R1-R3'), ['R1', 'R2', 'R3'], 'hyphen range R1-R3');
assertDeepEqual(helpers.expandRange('R1—R3'), ['R1', 'R2', 'R3'], 'em-dash range R1—R3');
assertDeepEqual(helpers.expandRange('BR5–BR8'), ['BR5', 'BR6', 'BR7', 'BR8'], 'BR range');
assertDeepEqual(helpers.expandRange('NFR1–NFR3'), ['NFR1', 'NFR2', 'NFR3'], 'NFR range');
assertDeepEqual(helpers.expandRange('CR1–CR2'), ['CR1', 'CR2'], 'CR range');

console.log('\nexpandRange: prefix omitted on right side');
assertDeepEqual(helpers.expandRange('R1–3'), ['R1', 'R2', 'R3'], 'R1–3 (prefix omitted)');
assertDeepEqual(helpers.expandRange('BR10-12'), ['BR10', 'BR11', 'BR12'], 'BR10-12 (prefix omitted)');

console.log('\nexpandRange: single ID (not a range)');
assertDeepEqual(helpers.expandRange('R5'), ['R5'], 'single R5 returned as-is');
assertDeepEqual(helpers.expandRange('BR1'), ['BR1'], 'single BR1 returned as-is');
assertDeepEqual(helpers.expandRange('NFR2'), ['NFR2'], 'single NFR2 returned as-is');

console.log('\nexpandRange: edge cases');
assertDeepEqual(helpers.expandRange('R5–R5'), ['R5'], 'same start and end');
assertDeepEqual(helpers.expandRange('R1–BR3'), ['R1–BR3'], 'cross-prefix rejected');
assertDeepEqual(helpers.expandRange('R10–R5'), ['R10–R5'], 'reversed range rejected');
assertDeepEqual(helpers.expandRange('not a range'), ['not a range'], 'non-range string returned as-is');
assertDeepEqual(helpers.expandRange(''), [''], 'empty string returned as-is');

console.log('\nexpandRange: whitespace around dash');
assertDeepEqual(helpers.expandRange('R1 – R3'), ['R1', 'R2', 'R3'], 'spaces around en-dash');
assertDeepEqual(helpers.expandRange('R1 - R3'), ['R1', 'R2', 'R3'], 'spaces around hyphen');

console.log('\ncoveragePct: percentage calculation');
assert(helpers.coveragePct({ total: 10, covered: 10 }) === 100, '10/10 = 100%');
assert(helpers.coveragePct({ total: 10, covered: 5 }) === 50, '10/5 = 50%');
assert(helpers.coveragePct({ total: 0, covered: 0 }) === 100, '0/0 = 100% (nothing to cover)');
assert(helpers.coveragePct({ total: 3, covered: 1 }) === 33, '1/3 = 33% (rounded)');
assert(helpers.coveragePct({ total: 3, covered: 2 }) === 67, '2/3 = 67% (rounded)');

// =============================================================================
// FILESYSTEM TESTS — run in a temp directory with fixtures
// =============================================================================

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceability-tests-'));
const originalCwd = process.cwd();

let fixtureCounter = 0;

function setupFixtures(fixtures) {
  // Each test gets its own subdirectory to avoid Windows EPERM on rmSync
  process.chdir(originalCwd);
  fixtureCounter++;
  const subdir = path.join(tempDir, `t${fixtureCounter}`);
  fs.mkdirSync(subdir, { recursive: true });

  for (const [relativePath, content] of Object.entries(fixtures)) {
    const fullPath = path.join(subdir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  process.chdir(subdir);
}

function teardown() {
  process.chdir(originalCwd);
}

// Re-require helpers in the temp directory context is not needed —
// the helpers use relative paths from cwd, so chdir is sufficient.

// ---------------------------------------------------------------------------
// parseFRSRequirements
// ---------------------------------------------------------------------------
console.log('\nparseFRSRequirements: basic parsing');

setupFixtures({
  'generated-docs/specs/feature-requirements.md': [
    '# Feature: Test Feature',
    '',
    '## Functional Requirements',
    '',
    '- **R1:** User can enter first name and last name',
    '- **R2:** User can enter ID number',
    '- **R3:** System validates ID with Luhn algorithm',
    '',
    '## Business Rules',
    '',
    '- **BR1:** Minimum age is 18 years',
    '- **BR2:** Maximum 5 dependents allowed',
    '',
    '## Non-Functional Requirements',
    '',
    '- **NFR1:** Page load under 2 seconds on 3G',
    '',
    '## Compliance Requirements',
    '',
    '- **CR1:** Card data handled by Stripe hosted fields only',
  ].join('\n')
});

{
  const reqs = helpers.parseFRSRequirements();
  assert(reqs.size === 7, `found all 7 requirements (got ${reqs.size})`);

  assert(reqs.has('R1'), 'has R1');
  assert(reqs.has('R2'), 'has R2');
  assert(reqs.has('R3'), 'has R3');
  assert(reqs.has('BR1'), 'has BR1');
  assert(reqs.has('BR2'), 'has BR2');
  assert(reqs.has('NFR1'), 'has NFR1');
  assert(reqs.has('CR1'), 'has CR1');

  assert(reqs.get('R1').type === 'functional', 'R1 classified as functional');
  assert(reqs.get('BR1').type === 'businessRules', 'BR1 classified as businessRules');
  assert(reqs.get('NFR1').type === 'nonFunctional', 'NFR1 classified as nonFunctional');
  assert(reqs.get('CR1').type === 'compliance', 'CR1 classified as compliance');

  assert(reqs.get('R1').description === 'User can enter first name and last name', 'R1 description captured');
  assert(reqs.get('CR1').description === 'Card data handled by Stripe hosted fields only', 'CR1 description captured');
}

console.log('\nparseFRSRequirements: multi-line descriptions');

setupFixtures({
  'generated-docs/specs/feature-requirements.md': [
    '## Functional Requirements',
    '',
    '- **R1:** User can enter personal details including',
    '  first name, last name, and ID number',
    '- **R2:** System validates the ID',
  ].join('\n')
});

{
  const reqs = helpers.parseFRSRequirements();
  assert(reqs.size === 2, `found 2 requirements (got ${reqs.size})`);
  assert(
    reqs.get('R1').description === 'User can enter personal details including first name, last name, and ID number',
    'multi-line description joined with space'
  );
}

console.log('\nparseFRSRequirements: missing file returns empty map');

setupFixtures({});
{
  const reqs = helpers.parseFRSRequirements();
  assert(reqs.size === 0, 'empty map when FRS file missing');
}

console.log('\nparseFRSRequirements: no matching requirements returns empty map');

setupFixtures({
  'generated-docs/specs/feature-requirements.md': [
    '# Feature: Empty',
    '',
    '## Functional Requirements',
    '',
    '- Some plain text without IDs',
  ].join('\n')
});

{
  const reqs = helpers.parseFRSRequirements();
  assert(reqs.size === 0, 'empty map when no IDs found');
}

// ---------------------------------------------------------------------------
// parseStoryRequirements
// ---------------------------------------------------------------------------
console.log('\nparseStoryRequirements: basic parsing');

setupFixtures({
  'generated-docs/stories/epic-1-shell/story-1-wizard-shell.md': [
    '# Story: Wizard Shell',
    '',
    '**Requirements:** [R1](../specs/feature-requirements.md#functional-requirements), [R2](../specs/feature-requirements.md#functional-requirements)',
    '',
    '## User Story',
    'As a user...',
  ].join('\n'),
  'generated-docs/stories/epic-1-shell/story-2-navigation.md': [
    '# Story: Navigation',
    '',
    '**Requirements:** [R3](../specs/feature-requirements.md#functional-requirements), [BR1](../specs/feature-requirements.md#business-rules)',
    '',
    '## User Story',
    'As a user...',
  ].join('\n'),
  'generated-docs/stories/epic-2-forms/story-1-personal-details.md': [
    '# Story: Personal Details',
    '',
    '**Requirements:** [R1](../specs/feature-requirements.md#functional-requirements), [NFR1](../specs/feature-requirements.md#non-functional-requirements)',
    '',
    '## User Story',
    'As a user...',
  ].join('\n')
});

{
  const stories = helpers.parseStoryRequirements();
  assert(stories.length === 3, `found 3 stories (got ${stories.length})`);

  // Should be sorted by epic then story number
  assert(stories[0].epicNum === 1 && stories[0].storyNum === 1, 'first is epic 1 story 1');
  assert(stories[1].epicNum === 1 && stories[1].storyNum === 2, 'second is epic 1 story 2');
  assert(stories[2].epicNum === 2 && stories[2].storyNum === 1, 'third is epic 2 story 1');

  assert(stories[0].title === 'Wizard Shell', 'title extracted from heading');
  assertDeepEqual(stories[0].requirementIds, ['R1', 'R2'], 'story 1 requirement IDs from linked format');
  assertDeepEqual(stories[1].requirementIds, ['R3', 'BR1'], 'story 2 mixed types extracted');
  assertDeepEqual(stories[2].requirementIds, ['R1', 'NFR1'], 'story 3 cross-epic requirement');
}

console.log('\nparseStoryRequirements: plain-text IDs (no markdown links)');

setupFixtures({
  'generated-docs/stories/epic-1-shell/story-1-basics.md': [
    '# Story: Basics',
    '',
    '**Requirements:** R5, BR2, NFR1',
    '',
    '## User Story',
    'As a user...',
  ].join('\n')
});

{
  const stories = helpers.parseStoryRequirements();
  assert(stories.length === 1, `found 1 story (got ${stories.length})`);
  assertDeepEqual(stories[0].requirementIds, ['R5', 'BR2', 'NFR1'], 'plain-text IDs extracted');
}

console.log('\nparseStoryRequirements: missing Requirements field');

setupFixtures({
  'generated-docs/stories/epic-1-shell/story-1-no-reqs.md': [
    '# Story: No Requirements Field',
    '',
    '## User Story',
    'As a user...',
  ].join('\n')
});

{
  const stories = helpers.parseStoryRequirements();
  assert(stories.length === 1, `found 1 story (got ${stories.length})`);
  assertDeepEqual(stories[0].requirementIds, [], 'empty array when no Requirements field');
}

console.log('\nparseStoryRequirements: no stories directory');

setupFixtures({});
{
  const stories = helpers.parseStoryRequirements();
  assert(stories.length === 0, 'empty array when stories dir missing');
}

// ---------------------------------------------------------------------------
// parseFeatureOverviewRequirements
// ---------------------------------------------------------------------------
console.log('\nparseFeatureOverviewRequirements: basic table parsing');

setupFixtures({
  'generated-docs/stories/_feature-overview.md': [
    '# Feature: Test',
    '',
    '## Epics',
    '1. **Epic 1: Shell** - Layout | Status: Pending | Dir: `epic-1-shell/`',
    '2. **Epic 2: Forms** - User input | Status: Pending | Dir: `epic-2-forms/`',
    '',
    '## Requirements Coverage',
    '| Epic | Requirements |',
    '|------|-------------|',
    '| Epic 1 | [R1–R3](../specs/feature-requirements.md#functional-requirements), [BR1](../specs/feature-requirements.md#business-rules) |',
    '| Epic 2 | [R4–R6](../specs/feature-requirements.md#functional-requirements), [NFR1](../specs/feature-requirements.md#non-functional-requirements) |',
    '',
    '## Epic Dependencies',
    '- Epic 1: Shell (no dependencies)',
  ].join('\n')
});

{
  const claims = helpers.parseFeatureOverviewRequirements();
  assert(claims.size === 2, `found 2 epics (got ${claims.size})`);

  const epic1 = claims.get(1) || [];
  const epic2 = claims.get(2) || [];

  // R1–R3 should expand to R1, R2, R3 plus standalone BR1
  assert(epic1.includes('R1'), 'Epic 1 has R1 (from range)');
  assert(epic1.includes('R2'), 'Epic 1 has R2 (from range)');
  assert(epic1.includes('R3'), 'Epic 1 has R3 (from range)');
  assert(epic1.includes('BR1'), 'Epic 1 has BR1 (standalone)');
  assert(epic1.length === 4, `Epic 1 has 4 IDs (got ${epic1.length})`);

  assert(epic2.includes('R4'), 'Epic 2 has R4 (from range)');
  assert(epic2.includes('R5'), 'Epic 2 has R5 (from range)');
  assert(epic2.includes('R6'), 'Epic 2 has R6 (from range)');
  assert(epic2.includes('NFR1'), 'Epic 2 has NFR1 (standalone)');
  assert(epic2.length === 4, `Epic 2 has 4 IDs (got ${epic2.length})`);
}

console.log('\nparseFeatureOverviewRequirements: missing file');

setupFixtures({});
{
  const claims = helpers.parseFeatureOverviewRequirements();
  assert(claims.size === 0, 'empty map when feature-overview missing');
}

console.log('\nparseFeatureOverviewRequirements: no Requirements Coverage section');

setupFixtures({
  'generated-docs/stories/_feature-overview.md': [
    '# Feature: Test',
    '',
    '## Epics',
    '1. **Epic 1: Shell**',
    '',
    '## Epic Dependencies',
    '- Epic 1: Shell (no dependencies)',
  ].join('\n')
});

{
  const claims = helpers.parseFeatureOverviewRequirements();
  assert(claims.size === 0, 'empty map when section missing');
}

// ---------------------------------------------------------------------------
// getRequirementsCoverage (integration of all three parsers)
// ---------------------------------------------------------------------------
console.log('\ngetRequirementsCoverage: full integration');

setupFixtures({
  'generated-docs/specs/feature-requirements.md': [
    '## Functional Requirements',
    '',
    '- **R1:** User enters personal details',
    '- **R2:** System validates ID',
    '- **R3:** User selects a plan',
    '',
    '## Business Rules',
    '',
    '- **BR1:** Minimum age 18',
    '',
    '## Non-Functional Requirements',
    '',
    '- **NFR1:** Page load under 2s',
    '',
    '## Compliance Requirements',
    '',
    '- **CR1:** PCI compliance for card data',
  ].join('\n'),
  'generated-docs/stories/_feature-overview.md': [
    '# Feature: Test',
    '',
    '## Epics',
    '1. **Epic 1: Shell**',
    '2. **Epic 2: Forms**',
    '',
    '## Requirements Coverage',
    '| Epic | Requirements |',
    '|------|-------------|',
    '| Epic 1 | R1, R2, BR1, NFR1, CR1 |',
    '| Epic 2 | R3 |',
    '',
    '## Epic Dependencies',
  ].join('\n'),
  'generated-docs/stories/epic-1-shell/story-1-layout.md': [
    '# Story: Layout',
    '',
    '**Requirements:** R1, BR1, NFR1, CR1',
  ].join('\n'),
  'generated-docs/stories/epic-1-shell/story-2-validation.md': [
    '# Story: Validation',
    '',
    '**Requirements:** R2',
  ].join('\n'),
  // Epic 2 not yet scoped (no story files)
});

{
  const cov = helpers.getRequirementsCoverage();

  // Coverage counts
  assert(cov.overall.total === 6, `total 6 requirements (got ${cov.overall.total})`);
  assert(cov.overall.covered === 5, `5 covered (got ${cov.overall.covered})`);
  // R3 is uncovered (no epic-2 stories yet)
  assertDeepEqual(cov.overall.uncovered, ['R3'], 'overall.uncovered lists R3');
  assert(cov.byType.functional.total === 3, 'functional: 3 total');
  assert(cov.byType.functional.covered === 2, 'functional: 2 covered');
  assertDeepEqual(cov.byType.functional.uncovered, ['R3'], 'R3 is uncovered');
  assert(cov.byType.businessRules.total === 1, 'businessRules: 1 total');
  assert(cov.byType.businessRules.covered === 1, 'businessRules: 1 covered');
  assert(cov.byType.nonFunctional.total === 1, 'nonFunctional: 1 total');
  assert(cov.byType.nonFunctional.covered === 1, 'nonFunctional: 1 covered');
  assert(cov.byType.compliance.total === 1, 'compliance: 1 total');
  assert(cov.byType.compliance.covered === 1, 'compliance: 1 covered');

  // Epic scoping
  assert(cov.epicsScoped === 1, `1 epic scoped (got ${cov.epicsScoped})`);

  // Epic gap analysis: Epic 1 claims R2 — story-2 covers it. Claims R1, BR1, NFR1, CR1 — story-1 covers them.
  // Epic 2 claims R3 but has no stories.
  const gap2 = cov.epicGaps.get(2);
  assert(gap2 !== undefined, 'Epic 2 has a gap entry');
  assert(gap2 && gap2.missing.includes('R3'), 'Epic 2 gap includes R3');

  // No gap for Epic 1 — all claimed IDs have stories
  assert(!cov.epicGaps.has(1), 'Epic 1 has no gap');

  // Warnings: no stories with missing Requirements field, no unknown IDs
  assert(cov.warnings.length === 0, `no warnings (got ${cov.warnings.length})`);
}

console.log('\ngetRequirementsCoverage: warnings for missing field and unknown IDs');

setupFixtures({
  'generated-docs/specs/feature-requirements.md': [
    '## Functional Requirements',
    '',
    '- **R1:** User enters name',
  ].join('\n'),
  'generated-docs/stories/epic-1-shell/story-1-good.md': [
    '# Story: Good Story',
    '',
    '**Requirements:** R1, R99',
  ].join('\n'),
  'generated-docs/stories/epic-1-shell/story-2-no-field.md': [
    '# Story: Missing Field',
    '',
    '## User Story',
    'No requirements line here',
  ].join('\n')
});

{
  const cov = helpers.getRequirementsCoverage();
  assert(cov.warnings.length === 2, `2 warnings (got ${cov.warnings.length})`);
  assert(
    cov.warnings.some(w => w.includes('R99') && w.includes('does not exist')),
    'warning about R99 not in FRS'
  );
  assert(
    cov.warnings.some(w => w.includes('story-2-no-field') && w.includes('no Requirements')),
    'warning about missing Requirements field'
  );
}

console.log('\ngetRequirementsCoverage: requirement covered by multiple stories');

setupFixtures({
  'generated-docs/specs/feature-requirements.md': [
    '## Functional Requirements',
    '',
    '- **R1:** Shared requirement',
  ].join('\n'),
  'generated-docs/stories/epic-1-shell/story-1-first.md': [
    '# Story: First',
    '',
    '**Requirements:** R1',
  ].join('\n'),
  'generated-docs/stories/epic-2-forms/story-1-second.md': [
    '# Story: Second',
    '',
    '**Requirements:** R1',
  ].join('\n')
});

{
  const cov = helpers.getRequirementsCoverage();
  const coveredBy = cov.coveredBy.get('R1') || [];
  assert(coveredBy.length === 2, `R1 covered by 2 stories (got ${coveredBy.length})`);
  assert(cov.overall.covered === 1, 'still counts as 1 covered (not 2)');
  assert(cov.overall.percent === 100, '100% coverage');
  assertDeepEqual(cov.overall.uncovered, [], 'overall.uncovered empty when fully covered');
}

console.log('\ngetRequirementsCoverage: empty FRS');

setupFixtures({});
{
  const cov = helpers.getRequirementsCoverage();
  assert(cov.frsRequirements.size === 0, 'no requirements');
  assert(cov.overall.total === 0, 'total = 0');
  assert(cov.overall.percent === 100, 'percent = 100 (nothing to cover)');
}

// ---------------------------------------------------------------------------
// resolveTotalEpics
// ---------------------------------------------------------------------------
console.log('\nresolveTotalEpics: fallback tiers');

// Tier 3: no state file, no feature-overview claims — falls back to epicsScoped
setupFixtures({});
{
  const total = helpers.resolveTotalEpics(new Map(), 3);
  assert(total === 3, `fallback to epicsScoped=3 (got ${total})`);
}

// Tier 2: no state file, feature-overview has epic 5 as highest — uses max of claims vs scoped
setupFixtures({});
{
  const claims = new Map([[1, ['R1']], [5, ['R5']]]);
  const total = helpers.resolveTotalEpics(claims, 2);
  assert(total === 5, `uses max epic number from claims=5 (got ${total})`);
}

// Tier 1: state file has totalEpics — uses that
setupFixtures({
  'generated-docs/context/workflow-state.json': JSON.stringify({ totalEpics: 8 })
});
{
  const total = helpers.resolveTotalEpics(new Map(), 2);
  assert(total === 8, `uses workflow state totalEpics=8 (got ${total})`);
}

// =============================================================================
// CLEANUP AND RESULTS
// =============================================================================

teardown();
try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  for (const err of errors) {
    console.log(`  \x1b[31m${err}\x1b[0m`);
  }
}
console.log('========================================\n');
process.exit(failed === 0 ? 0 : 1);
