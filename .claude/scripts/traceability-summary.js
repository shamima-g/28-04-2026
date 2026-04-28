#!/usr/bin/env node
/**
 * Human-readable summary of _requirements-traceability.json
 *
 * Usage:
 *   node .claude/scripts/traceability-summary.js <path-to-json>            # default: warnings + coverage
 *   node .claude/scripts/traceability-summary.js <path-to-json> --gaps     # epic gaps + uncovered list
 *   node .claude/scripts/traceability-summary.js <path-to-json> --full     # both views combined
 *
 * Designed as a safe, auto-approved alternative to inline `python -c` for
 * ad-hoc inspection of traceability data. Also used by the feature-planner
 * agent in Step S4b.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node traceability-summary.js <path-to-json> [--gaps|--full]');
  process.exit(1);
}

let d;
try {
  d = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
} catch (err) {
  console.error(`Failed to read ${file}: ${err.message}`);
  process.exit(1);
}

const mode = process.argv.includes('--full') ? 'full'
  : process.argv.includes('--gaps') ? 'gaps'
  : 'summary';

const overall = (d.coverage || {}).overall || {};
const warnings = d.warnings || [];
const epicGaps = d.epicGaps || {};

// ---------------------------------------------------------------------------
// Summary view: warnings + overall coverage
// ---------------------------------------------------------------------------
function printSummary() {
  if (warnings.length) {
    console.log(`Warnings (${warnings.length}):`);
    warnings.forEach(w => console.log(`  - ${w}`));
  } else {
    console.log('No warnings');
  }

  console.log('---');
  console.log(`Coverage: ${overall.covered || 0}/${overall.total || 0} (${overall.percent || 0}%)`);
  console.log(`Scoped: ${d.epicsScoped || 0}/${d.totalEpics || 0} epics`);

  const uncovered = overall.uncovered || [];
  if (uncovered.length) {
    console.log(`Uncovered (${uncovered.length}): ${uncovered.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Gaps view: per-epic gaps + uncovered requirements
// ---------------------------------------------------------------------------
function printGaps() {
  const epicKeys = Object.keys(epicGaps);
  if (epicKeys.length) {
    console.log(`Epic gaps (${epicKeys.length}):`);
    for (const [epic, g] of Object.entries(epicGaps)) {
      console.log(`  Epic ${epic}: ${g.message}`);
    }
  } else {
    console.log('No epic gaps');
  }

  console.log('---');
  const uncovered = overall.uncovered || [];
  console.log(`Uncovered (${uncovered.length}): ${uncovered.length ? uncovered.join(', ') : 'none'}`);

  // Per-type breakdown
  const types = ['functional', 'businessRules', 'nonFunctional', 'compliance'];
  for (const t of types) {
    const cat = (d.coverage || {})[t];
    if (cat && cat.uncovered && cat.uncovered.length) {
      console.log(`  ${t}: ${cat.uncovered.join(', ')}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
if (mode === 'summary' || mode === 'full') printSummary();
if (mode === 'full') console.log('===');
if (mode === 'gaps' || mode === 'full') printGaps();
