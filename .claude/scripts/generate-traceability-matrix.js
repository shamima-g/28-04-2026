#!/usr/bin/env node
/**
 * generate-traceability-matrix.js
 *
 * Generates a requirements traceability matrix by cross-referencing the FRS
 * requirement IDs against story Requirements fields. Produces both a
 * human-readable markdown file and a machine-readable JSON sidecar.
 *
 * Usage:
 *   node .claude/scripts/generate-traceability-matrix.js
 *
 * Outputs:
 *   generated-docs/stories/_requirements-traceability.md   (markdown matrix)
 *   generated-docs/stories/_requirements-traceability.json  (JSON sidecar)
 */

const fs = require('fs');
const path = require('path');
const helpers = require('./lib/workflow-helpers');

const OUTPUT_MD = path.join(helpers.STORIES_DIR, '_requirements-traceability.md');
const OUTPUT_JSON = path.join(helpers.STORIES_DIR, '_requirements-traceability.json');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const coverage = helpers.getRequirementsCoverage();
  const { frsRequirements, coveredBy, byType, overall, totalEpics, epicsScoped, epicGaps, warnings } = coverage;

  if (frsRequirements.size === 0) {
    console.error('Error: No requirements found in FRS. Check that generated-docs/specs/feature-requirements.md exists and uses **R1:**/**BR1:**/**NFR1:**/**CR1:** format.');
    process.exit(1);
  }

  const featureName = helpers.extractFeatureNameFromFiles() || 'Unknown Feature';

  // Generate markdown
  const md = generateMarkdown({ frsRequirements, coveredBy, byType, overall, featureName, epicsScoped, totalEpics });
  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
  fs.writeFileSync(OUTPUT_MD, md, 'utf-8');

  // Generate JSON sidecar
  const json = {
    generated: new Date().toISOString(),
    featureName,
    epicsScoped,
    totalEpics,
    coverage: {
      functional: byType.functional,
      businessRules: byType.businessRules,
      nonFunctional: byType.nonFunctional,
      compliance: byType.compliance,
      overall
    },
    epicGaps: Object.fromEntries(epicGaps),
    warnings
  };
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2), 'utf-8');

  // Report
  console.log(`Traceability matrix generated: ${overall.covered}/${overall.total} requirements covered (${overall.percent}%)`);
  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.length}`);
    for (const w of warnings) {
      console.log(`  - ${w}`);
    }
  }
  if (epicGaps.size > 0) {
    for (const [, gap] of epicGaps) {
      console.log(`  - ${gap.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Markdown Generation
// ---------------------------------------------------------------------------

function generateMarkdown({ frsRequirements, coveredBy, byType, overall, featureName, epicsScoped, totalEpics }) {
  const pendingByReq = new Map();
  for (const p of (overall.pending || [])) pendingByReq.set(p.id, p.claimedByEpic);
  const lines = [];
  const now = new Date().toISOString().split('T')[0];

  lines.push('# Requirements Traceability Matrix');
  lines.push('');
  lines.push(`Generated: ${now} | Feature: ${featureName} | Epics scoped: ${epicsScoped}/${totalEpics}`);
  lines.push('');

  // Coverage summary
  lines.push('## Coverage Summary');
  lines.push(`- **Functional Requirements:** ${byType.functional.covered}/${byType.functional.total} covered (${helpers.coveragePct(byType.functional)}%)`);
  lines.push(`- **Business Rules:** ${byType.businessRules.covered}/${byType.businessRules.total} covered (${helpers.coveragePct(byType.businessRules)}%)`);
  lines.push(`- **Non-Functional:** ${byType.nonFunctional.covered}/${byType.nonFunctional.total} covered (${helpers.coveragePct(byType.nonFunctional)}%)`);
  lines.push(`- **Compliance:** ${byType.compliance.covered}/${byType.compliance.total} covered (${helpers.coveragePct(byType.compliance)}%)`);

  // Pending = claimed by some epic in feature-overview but not yet covered by a story.
  // Real gap = not claimed by any epic — a true coverage hole.
  if (overall.pending && overall.pending.length > 0) {
    const pendingIds = overall.pending.map(p => p.id).join(', ');
    lines.push(`- **Pending (claimed by future epics):** ${pendingIds}`);
  }
  if (overall.realGaps && overall.realGaps.length > 0) {
    lines.push(`- **Real gaps (no epic claims this):** ${overall.realGaps.join(', ')}`);
  }
  lines.push('');

  // Pre-group requirements by type for single-pass rendering
  const reqsByType = new Map();
  for (const req of frsRequirements.values()) {
    if (!reqsByType.has(req.type)) reqsByType.set(req.type, []);
    reqsByType.get(req.type).push(req);
  }

  // Sections by type
  const sections = [
    { title: 'Functional Requirements', type: 'functional', header: 'Req ID' },
    { title: 'Business Rules', type: 'businessRules', header: 'Rule ID' },
    { title: 'Non-Functional Requirements', type: 'nonFunctional', header: 'Req ID' },
    { title: 'Compliance Requirements', type: 'compliance', header: 'Req ID' }
  ];

  for (const section of sections) {
    const reqs = reqsByType.get(section.type) || [];
    if (reqs.length === 0) continue;

    // Sort by numeric part
    reqs.sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, ''), 10);
      const numB = parseInt(b.id.replace(/\D/g, ''), 10);
      return numA - numB;
    });

    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(`| ${section.header} | Description | Covered By |`);
    lines.push('|--------|-------------|------------|');

    for (const req of reqs) {
      const stories = coveredBy.get(req.id) || [];
      let coveredByText;
      if (stories.length === 0) {
        // Distinguish pending (claimed by a future epic) from real gaps (no epic claims it).
        if (pendingByReq.has(req.id)) {
          coveredByText = `Pending: Epic ${pendingByReq.get(req.id)}`;
        } else {
          coveredByText = '*UNCOVERED — NO EPIC ASSIGNED*';
        }
      } else {
        coveredByText = stories.map(s =>
          `[Story ${s.storyNum}: ${s.title}](${s.epicSlug}/${s.fileName})`
        ).join(', ');
      }

      // Truncate description for table readability
      const desc = req.description.length > 80
        ? req.description.slice(0, 77) + '...'
        : req.description;

      lines.push(`| ${req.id} | ${desc} | ${coveredByText} |`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main();
