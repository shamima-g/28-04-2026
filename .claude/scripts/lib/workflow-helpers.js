#!/usr/bin/env node
/**
 * workflow-helpers.js
 * Shared helpers used by transition-phase.js and detect-workflow-state.js
 *
 * Extracted to avoid duplication and ensure consistent behavior across scripts.
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// PHASE CONSTANTS
// =============================================================================

// Global phases run once for the entire feature (not per-epic)
const GLOBAL_PHASES = ['INTAKE', 'DESIGN', 'SCOPE'];

// Per-story phases in TDD cycle order
const STORY_PHASES = ['REALIGN', 'TEST-DESIGN', 'WRITE-TESTS', 'IMPLEMENT', 'QA'];

// Phase boundary marker (optional phasing feature) — used as state.currentPhase
// when a multi-phase project has finished all epics in one phase and is waiting
// on a Continue/Stop decision before advancing to the next phase's STORIES.
const PHASE_BOUNDARY = 'PHASE-BOUNDARY';

// All valid phases
const ALL_PHASES = [...GLOBAL_PHASES, 'STORIES', ...STORY_PHASES, 'COMPLETE', 'PENDING', PHASE_BOUNDARY];

// =============================================================================
// PATH CONSTANTS
// =============================================================================

const STORIES_DIR = 'generated-docs/stories';
const TEST_DIR = 'web/src/__tests__/integration';
const TEST_DESIGN_DIR = 'generated-docs/test-design';
const WIREFRAMES_DIR = 'generated-docs/specs/wireframes';
const IMPACTS_PATH = 'generated-docs/discovered-impacts.md';
const STATE_FILE = 'generated-docs/context/workflow-state.json';
const INTAKE_MANIFEST_FILE = 'generated-docs/context/intake-manifest.json';
const FRS_PATH = 'generated-docs/specs/feature-requirements.md';
const API_SPEC_PATH = 'generated-docs/specs/api-spec.yaml';
const HANDLERS_PATH = 'web/src/mocks/handlers.ts';
const SNAPSHOT_PATH = 'generated-docs/context/mock-spec-snapshot.yaml';

// =============================================================================
// DISPLAY CONSTANTS
// =============================================================================

const AGENT_DISPLAY_NAMES = {
  'design-api-agent': 'API Spec Agent',
  'design-style-agent': 'Style Agent',
  'design-wireframe-agent': 'Wireframe Agent',
  'mock-setup-agent': 'Mock Setup',
  'type-generator-agent': 'Type Generator'
};

// Shared regex source for AC identifiers (used by multiple traceability functions).
// Matches both "AC-1" (canonical) and "AC1" (legacy/bold format) — callers must
// normalize via capture group 1 (the digit) to ensure consistent Set lookups.
// Must call to get a fresh RegExp (global regexes are stateful).
function acIdRegex() { return /AC-?(\d+)/g; }

// =============================================================================
// FILE FINDING HELPERS
// =============================================================================

function findFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];

  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');

  try {
    return fs.readdirSync(dir)
      .filter(file => regex.test(file))
      .map(file => path.join(dir, file));
  } catch {
    return [];
  }
}

function findFilesRecursive(dir, pattern) {
  if (!fs.existsSync(dir)) return [];

  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  const results = [];

  function walk(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (regex.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Ignore permission errors on individual directories
    }
  }

  walk(dir);
  return results;
}

// =============================================================================
// EPIC / STORY DIRECTORY HELPERS
// =============================================================================

/**
 * Find the directory path for a given epic number.
 * Returns the full path (e.g., 'generated-docs/stories/epic-1-dashboard') or null.
 */
function findEpicDir(epicNum) {
  if (!fs.existsSync(STORIES_DIR)) return null;

  try {
    const entries = fs.readdirSync(STORIES_DIR);
    const match = entries.find(d => {
      const m = d.match(/^epic-(\d+)/);
      return m && parseInt(m[1]) === epicNum;
    });

    if (match) {
      const fullPath = path.join(STORIES_DIR, match);
      try {
        if (fs.statSync(fullPath).isDirectory()) return fullPath;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Find all story files in an epic directory.
 * Returns array of { num, title, path } sorted by story number.
 */
function findStoryFiles(epicDir) {
  const storyFiles = findFiles(epicDir, 'story-*.md').sort();
  const results = [];

  for (const file of storyFiles) {
    const basename = path.basename(file, '.md');
    const numMatch = basename.match(/story-(\d+)/);
    if (numMatch) {
      results.push({
        num: parseInt(numMatch[1]),
        title: basename,
        path: file
      });
    }
  }

  return results;
}

// =============================================================================
// ACCEPTANCE CRITERIA HELPERS
// =============================================================================

/**
 * Extract the Acceptance Criteria section from a story file's content.
 * Returns { text, startOffset, endOffset } or null if not found.
 * text is just the AC section body; startOffset/endOffset are byte offsets
 * into the original content for replacement operations.
 */
function extractACSection(content) {
  const acHeaderPattern = /^## Acceptance Criteria\s*$/m;
  const acStart = content.search(acHeaderPattern);
  if (acStart === -1) return null;

  const afterHeader = content.indexOf('\n', acStart) + 1;
  const nextH2 = content.indexOf('\n## ', afterHeader);
  const acEnd = nextH2 === -1 ? content.length : nextH2;

  return {
    text: content.slice(afterHeader, acEnd),
    startOffset: afterHeader,
    endOffset: acEnd
  };
}

/**
 * Count checked/unchecked ACs for a single story.
 * Scoped to ## Acceptance Criteria section only.
 */
function countStoryAC(epicDir, storyNum) {
  const storyFiles = findStoryFiles(epicDir);
  const story = storyFiles.find(s => s.num === storyNum);
  if (!story) return { total: 0, checked: 0 };

  try {
    const content = fs.readFileSync(story.path, 'utf-8');
    const ac = extractACSection(content);
    if (!ac) return { total: 0, checked: 0 };

    const checkedMatches = ac.text.match(/^\s*[-*] \[[xX]\]/gm);
    const uncheckedMatches = ac.text.match(/^\s*[-*] \[ \]/gm);

    const checked = checkedMatches ? checkedMatches.length : 0;
    const unchecked = uncheckedMatches ? uncheckedMatches.length : 0;

    return { total: checked + unchecked, checked };
  } catch {
    return { total: 0, checked: 0 };
  }
}

/**
 * Count checked/unchecked ACs across ALL stories in an epic.
 * Scoped to ## Acceptance Criteria section per file.
 */
function countEpicAC(epicDir) {
  const stories = findStoryFiles(epicDir);
  let checked = 0;
  let unchecked = 0;

  for (const story of stories) {
    const ac = countStoryAC(epicDir, story.num);
    checked += ac.checked;
    unchecked += ac.total - ac.checked;
  }

  return { checked, unchecked };
}

/**
 * Auto-check all ACs in a story file (replace [ ] with [x]).
 * Scoped to ## Acceptance Criteria section only.
 * Used by --pre-complete-checks before commit.
 */
function checkAllAcceptanceCriteria(epicDir, storyNum) {
  const storyFiles = findStoryFiles(epicDir);
  const story = storyFiles.find(s => s.num === storyNum);
  if (!story) return;

  let content;
  try {
    content = fs.readFileSync(story.path, 'utf-8');
  } catch {
    return;
  }

  const ac = extractACSection(content);
  if (!ac) return;

  const before = content.slice(0, ac.startOffset);
  const after = content.slice(ac.endOffset);

  const checkedSection = ac.text.replace(/^(\s*[-*] )\[ \]/gm, '$1[x]');
  const newContent = before + checkedSection + after;

  fs.writeFileSync(story.path, newContent);
}

// =============================================================================
// STORY METADATA HELPERS
// =============================================================================

/**
 * Extract the Route field from a story file's Story Metadata table.
 * Returns the route string (e.g., '/', '/dashboard', 'N/A') or null if not found.
 */
function extractStoryRoute(content) {
  // Match the Route row in the Story Metadata table: | **Route** | `/dashboard` |
  const routeMatch = content.match(/\|\s*\*?\*?Route\*?\*?\s*\|\s*`?([^`|\n]+?)`?\s*\|/i);
  if (!routeMatch) return null;
  return routeMatch[1].trim();
}

/**
 * Get all stories (in the given epic AND every prior epic) that had manual
 * verification auto-skipped (Route: N/A, phase: COMPLETE,
 * manualVerification: 'auto-skipped'). Walking prior epics matters because
 * a whole epic can be non-routable (e.g. foundation/auth work) — its
 * verification backlog should surface on the next routable story in the
 * workflow, not stay stranded.
 *
 * Returns array of { epic, number, name, route, acceptanceCriteria }.
 */
function getDeferredVerificationStories(epicNum) {
  const state = readWorkflowState();
  if (!state?.epics) return [];

  const deferred = [];

  for (const [eNum, epicState] of Object.entries(state.epics)) {
    const eNumInt = parseInt(eNum);
    if (eNumInt > epicNum) continue;
    if (!epicState?.stories) continue;

    const epicDir = findEpicDir(eNumInt);
    if (!epicDir) continue;

    const storyFiles = findStoryFiles(epicDir);

    for (const [sNum, storyState] of Object.entries(epicState.stories)) {
      if (storyState.manualVerification !== 'auto-skipped') continue;

      const storyFile = storyFiles.find(s => s.num === parseInt(sNum));
      if (!storyFile) continue;

      try {
        const content = fs.readFileSync(storyFile.path, 'utf-8');
        const ac = extractACSection(content);
        deferred.push({
          epic: eNumInt,
          number: parseInt(sNum),
          name: storyState.name || storyFile.title,
          route: extractStoryRoute(content) || 'N/A',
          acceptanceCriteria: ac ? ac.text.trim() : null
        });
      } catch {
        // Skip unreadable files
      }
    }
  }

  return deferred;
}

// =============================================================================
// TEST FILE HELPERS
// =============================================================================

/**
 * Count test files for a specific story.
 * Options:
 *   dirs: array of directories to search (default: [TEST_DIR])
 *   recursive: if true, search directories recursively (default: false)
 */
function countTestFiles(epicNum, storyNum, options) {
  const dirs = options?.dirs || [TEST_DIR];
  const recursive = options?.recursive || false;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, recursive ? { recursive: true } : undefined);
      const testFiles = entries.filter(f =>
        typeof f === 'string' &&
        f.includes(`epic-${epicNum}`) &&
        f.includes(`story-${storyNum}`) &&
        (f.endsWith('.test.tsx') || f.endsWith('.test.ts'))
      );
      if (testFiles.length > 0) return testFiles.length;
    } catch {
      // skip unreadable dirs
    }
  }
  return 0;
}

/**
 * Count wireframe files in the specs/wireframes directory.
 */
function countWireframes() {
  return findFilesRecursive(WIREFRAMES_DIR, '*.md').length;
}

// =============================================================================
// STORY PHASE DETERMINATION
// =============================================================================

/**
 * Find a test-design file for a given epic/story.
 * Returns the file path or null if not found.
 */
function findTestDesignFile(epicNum, storyNum) {
  if (!fs.existsSync(TEST_DESIGN_DIR)) return null;

  try {
    const epicDirs = fs.readdirSync(TEST_DESIGN_DIR)
      .filter(d => d.match(new RegExp(`^epic-${epicNum}`)));
    for (const epicDir of epicDirs) {
      const fullDir = path.join(TEST_DESIGN_DIR, epicDir);
      try {
        if (!fs.statSync(fullDir).isDirectory()) continue;
        const files = fs.readdirSync(fullDir)
          .filter(f => f.match(new RegExp(`^story-${storyNum}-.*test-design\\.md$`)));
        if (files.length > 0) return path.join(fullDir, files[0]);
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Determine if a story has a test-design document.
 */
function storyHasTestDesign(epicNum, storyNum) {
  return findTestDesignFile(epicNum, storyNum) !== null;
}

/**
 * Determine if a story has tests.
 */
function storyHasTests(epicNum, storyNum, options) {
  return countTestFiles(epicNum, storyNum, options) > 0;
}

/**
 * Find the first incomplete story in an epic.
 * Returns { name, number, phase } or null if all complete.
 *
 * CONTRACT: Returns a "raw" phase (TEST-DESIGN, WRITE-TESTS, or IMPLEMENT)
 * based solely on AC checkboxes, test-design doc, and test file existence.
 * It does NOT determine REALIGN — the caller must combine its result with
 * getDiscoveredImpactsForEpic():
 *
 *   const story = findFirstIncompleteStory(epicDir, epicNum);
 *   const impacts = getDiscoveredImpactsForEpic(epicNum);
 *   if (impacts.hasImpactsForEpic && story.phase === 'TEST-DESIGN') {
 *     story.phase = 'REALIGN';
 *   }
 */
function findFirstIncompleteStory(epicDir, epicNum) {
  const stories = getStoryStates(epicDir, epicNum);
  return stories.find(s => s.phase !== 'COMPLETE') || null;
}

/**
 * Get phase state for all stories in an epic.
 * Returns array of { name, number, phase, hasTests }.
 * Options (passed through to countTestFiles):
 *   dirs: array of directories to search for test files
 *   recursive: if true, search directories recursively
 */
function getStoryStates(epicDir, epicNum, options) {
  const storyFiles = findFiles(epicDir, 'story-*.md').sort();
  const stories = [];

  for (const file of storyFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const storyName = path.basename(file, '.md');
      const storyNumMatch = storyName.match(/story-(\d+)/);
      const storyNum = storyNumMatch ? parseInt(storyNumMatch[1]) : 0;

      const ac = extractACSection(content);
      const hasUncheckedCriteria = ac ? /^\s*[-*] \[ \]/m.test(ac.text) : false;
      const hasTestDesign = storyHasTestDesign(epicNum, storyNum);
      const hasTests = storyHasTests(epicNum, storyNum, options);

      let storyPhase;
      if (!hasUncheckedCriteria) {
        storyPhase = 'COMPLETE';
      } else if (!hasTestDesign && !hasTests) {
        storyPhase = 'TEST-DESIGN';
      } else if (!hasTests) {
        storyPhase = 'WRITE-TESTS';
      } else {
        storyPhase = 'IMPLEMENT';
      }

      const route = extractStoryRoute(content);

      stories.push({
        name: storyName,
        number: storyNum,
        phase: storyPhase,
        hasTestDesign,
        hasTests,
        route: route || null
      });
    } catch {
      // Skip unreadable files
    }
  }

  return stories;
}

// =============================================================================
// DISCOVERED IMPACTS
// =============================================================================

/**
 * Check discovered-impacts.md for impacts affecting a specific epic.
 */
function getDiscoveredImpactsForEpic(epicNum) {
  if (!fs.existsSync(IMPACTS_PATH)) {
    return { exists: false, hasImpactsForEpic: false, impactCount: 0 };
  }

  try {
    const content = fs.readFileSync(IMPACTS_PATH, 'utf-8');
    if (!content.trim()) {
      return { exists: true, hasImpactsForEpic: false, impactCount: 0 };
    }

    const epicPattern = new RegExp(`\\*\\*Affects:\\*\\*.*Epic\\s+${epicNum}[,:\\s]`, 'gi');
    const matches = content.match(epicPattern);
    const impactCount = matches ? matches.length : 0;

    return {
      exists: true,
      hasImpactsForEpic: impactCount > 0,
      impactCount
    };
  } catch {
    return { exists: false, hasImpactsForEpic: false, impactCount: 0 };
  }
}

// =============================================================================
// QA COMPLETION CHECK
// =============================================================================

/**
 * Check QA completion across 3 sources:
 * 1. workflow-state.json (phases.QA.status)
 * 2. review-findings.json (recommendation field)
 * 3. Epic-specific review file (epic-{N}-review.md)
 */
function checkQAComplete(epicNum) {
  // Source 1: workflow-state.json
  const state = readWorkflowState();
  if (state?.phases?.QA?.status === 'completed') {
    return true;
  }

  // Source 2: review-findings.json
  const reviewFindingsPath = 'generated-docs/context/review-findings.json';
  if (fs.existsSync(reviewFindingsPath)) {
    try {
      const content = fs.readFileSync(reviewFindingsPath, 'utf-8');
      const findings = JSON.parse(content);
      if (findings.recommendation) {
        return true;
      }
    } catch {
      // Invalid JSON
    }
  }

  // Source 3: epic-specific review file
  const reviewMarkerPath = `generated-docs/reviews/epic-${epicNum}-review.md`;
  if (fs.existsSync(reviewMarkerPath)) {
    return true;
  }

  return false;
}

// =============================================================================
// STATE FILE READERS
// =============================================================================

/**
 * Read and parse workflow-state.json. Returns the parsed object or null.
 */
function readWorkflowState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read and parse intake-manifest.json. Returns the parsed object or null.
 */
function readIntakeManifest() {
  if (!fs.existsSync(INTAKE_MANIFEST_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(INTAKE_MANIFEST_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

const FEATURE_OVERVIEW_PATH = 'generated-docs/stories/_feature-overview.md';

/**
 * Extract the feature name from the FRS or feature overview heading.
 * Looks for "# Feature: <name>" in FRS first, then feature overview.
 * Returns the name string or null.
 */
function extractFeatureNameFromFiles() {
  const candidates = [FRS_PATH, FEATURE_OVERVIEW_PATH];
  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const m = content.match(/^#\s+Feature:\s*(.+)/m);
      if (m) return m[1].trim();
    } catch { /* ignore missing/unreadable files */ }
  }
  return null;
}

/**
 * Parse the feature overview file for all planned epics.
 * Returns array of { number, name } sorted by epic number.
 * The name is the directory-style slug (e.g., "epic-5-wizard-submit").
 */
function parseFeatureOverview() {
  if (!fs.existsSync(FEATURE_OVERVIEW_PATH)) return [];
  try {
    const content = fs.readFileSync(FEATURE_OVERVIEW_PATH, 'utf-8');
    const results = [];
    // Format: 1. **Epic 1: Auth and Layout Shell** - description | ... | Dir: `epic-1-auth-layout-shell/`
    const re = /^\d+\.\s+\*\*Epic\s+(\d+):\s+(.+?)\*\*.*Dir:\s*`(epic-\d+[^`/]*)/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
      results.push({
        number: parseInt(m[1]),
        name: m[3] // directory slug like "epic-5-wizard-submit"
      });
    }
    results.sort((a, b) => a.number - b.number);
    return results;
  } catch {
    return [];
  }
}

/**
 * Convert a slug like "epic-1-onboarding-flow" to "Epic 1: Onboarding flow".
 */
function friendlyName(slug, type) {
  if (!slug) return slug;
  const prefixRe = new RegExp(`^${type}-(\\d+)-?`);
  const m = slug.match(prefixRe);
  if (!m) return slug;
  const num = m[1];
  const rest = slug.slice(m[0].length);
  if (!rest) return `${type.charAt(0).toUpperCase() + type.slice(1)} ${num}`;
  const words = rest.split('-');
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return `${type.charAt(0).toUpperCase() + type.slice(1)} ${num}: ${words.join(' ')}`;
}

// =============================================================================
// AC TRACEABILITY PARSING (for dashboard test coverage card)
// =============================================================================

/**
 * Extract AC entries from story file content.
 * Handles both canonical format (AC-1: text) and bold/legacy format (**AC1: text**).
 * Returns array of { id, text, checked } with ids normalized to AC-N format.
 */
function parseACsFromContent(content) {
  const results = [];
  // Matches:  - [x] AC-1: text       (canonical)
  //           - [x] **AC1: text**     (bold, no hyphen)
  //           - [x] **AC-1: text**    (bold, with hyphen)
  const re = /- \[([ xX])\] \*?\*?AC-?(\d+):\s*\*?\*?\s*(.+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    // Strip trailing bold-close markers then em-dash description suffixes
    // e.g., "Login page exists** — A login page..." → "Login page exists"
    const text = m[3].replace(/\*{1,2}\s*(?=[—–\s]|$)/, '').replace(/\s*[—–]\s.*$/, '').trim();
    results.push({ id: `AC-${m[2]}`, text, checked: m[1].toLowerCase() === 'x' });
  }
  return results;
}

/**
 * Parse AC-N identifiers from a story file.
 * Returns array of { id, text, checked } for each AC with an AC-N prefix.
 */
function parseACsFromStory(epicNum, storyNum) {
  const epicDir = findEpicDir(epicNum);
  if (!epicDir) return [];
  const storyFiles = findStoryFiles(epicDir);
  const story = storyFiles.find(s => s.num === storyNum);
  if (!story) return [];

  try {
    return parseACsFromContent(fs.readFileSync(story.path, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Parse the Coverage for WRITE-TESTS section of a test-design document.
 * Returns { coveredACs: Set<string>, baDecisionsPending: number }.
 * Only scans between "## Coverage for WRITE-TESTS" and the next "##" header.
 */
function parseTestDesignCoverage(epicNum, storyNum) {
  const result = { coveredACs: new Set(), baDecisionsPending: 0 };
  const tdPath = findTestDesignFile(epicNum, storyNum);
  if (!tdPath) return result;

  try {
    const tdContent = fs.readFileSync(tdPath, 'utf-8');

    // Count BA decisions in full document
    const baMatches = tdContent.match(/BA decision required/gi);
    result.baDecisionsPending = baMatches ? baMatches.length : 0;

    // Extract only the Coverage for WRITE-TESTS section
    const coverageHeader = '## Coverage for WRITE-TESTS';
    const coverageStart = tdContent.indexOf(coverageHeader);
    if (coverageStart === -1) return result;
    const afterCoverage = tdContent.slice(coverageStart + coverageHeader.length);
    const nextHeader = afterCoverage.indexOf('\n## ');
    const coverageText = nextHeader >= 0 ? afterCoverage.slice(0, nextHeader) : afterCoverage;

    // Scan for AC references within the coverage section only, normalize to AC-N
    const acRe = acIdRegex();
    let am;
    while ((am = acRe.exec(coverageText)) !== null) {
      result.coveredACs.add(`AC-${am[1]}`);
    }
  } catch { /* ignore */ }

  return result;
}

/**
 * Scan a test file for AC-N references anywhere in the file.
 * Returns Set<string> of AC IDs found.
 */
function scanTestFileForACs(epicNum, storyNum) {
  const tested = new Set();
  const testDirs = ['web/src/__tests__/integration', 'web/src/__tests__'];

  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { recursive: true });
      const testFiles = entries.filter(f =>
        typeof f === 'string' &&
        f.includes(`epic-${epicNum}`) &&
        f.includes(`story-${storyNum}`) &&
        (f.endsWith('.test.tsx') || f.endsWith('.test.ts'))
      );
      for (const tf of testFiles) {
        const content = fs.readFileSync(path.join(dir, tf), 'utf-8');
        const re = acIdRegex();
        let m;
        while ((m = re.exec(content)) !== null) {
          tested.add(`AC-${m[1]}`);
        }
      }
      if (testFiles.length > 0) break;
    } catch { /* ignore */ }
  }

  return tested;
}

/**
 * Combined traceability lookup — resolves epic/story paths once, then gathers
 * ACs, test-design coverage, and test-file references in a single pass.
 * Returns { acs, coverage, tested } matching the shapes of the individual helpers.
 */
function getACTraceability(epicNum, storyNum) {
  const empty = {
    acs: [],
    coverage: { coveredACs: new Set(), baDecisionsPending: 0 },
    tested: new Set()
  };

  // Single directory lookup
  const epicDir = findEpicDir(epicNum);
  if (!epicDir) return empty;
  const storyFiles = findStoryFiles(epicDir);
  const story = storyFiles.find(s => s.num === storyNum);

  // ACs from story file (delegates to shared parser)
  let acs = [];
  if (story) {
    try {
      acs = parseACsFromContent(fs.readFileSync(story.path, 'utf-8'));
    } catch { /* ignore */ }
  }

  // Test-design coverage (uses its own path lookup — no overlap with epic/story dirs)
  const coverage = parseTestDesignCoverage(epicNum, storyNum);

  // Test-file AC references
  const tested = scanTestFileForACs(epicNum, storyNum);

  return { acs, coverage, tested };
}

// =============================================================================
// REQUIREMENTS TRACEABILITY
// =============================================================================

/**
 * Regex to match requirement IDs in FRS format: **R1:**, **BR2:**, **NFR1:**, **CR3:**
 * Captures: [1] = full ID (e.g., "R1"), [2] = description text (rest of line)
 */
const FRS_REQ_RE = /^\s*-\s*\*\*(R\d+|BR\d+|NFR\d+|CR\d+):\*\*\s*(.+)/;

/**
 * Regex to match any requirement ID in free text (format-tolerant).
 * Catches linked [R5](path), plain R5, comma-separated, etc.
 */
const REQ_ID_RE = /\b(R\d+|BR\d+|NFR\d+|CR\d+)\b/g;

/**
 * Classify a requirement ID into its type bucket.
 */
function reqType(id) {
  if (id.startsWith('NFR')) return 'nonFunctional';
  if (id.startsWith('BR')) return 'businessRules';
  if (id.startsWith('CR')) return 'compliance';
  return 'functional';
}

/**
 * Expand a range like "R1–R3" or "BR5-BR8" into individual IDs.
 * Handles en-dash (–), em-dash (—), and hyphen (-) as delimiters.
 * Only expands within the same prefix.
 */
function expandRange(rangeStr) {
  // Match: PREFIX + NUMBER + dash + optional PREFIX + NUMBER
  const m = rangeStr.match(/^(R|BR|NFR|CR)(\d+)\s*[–—-]\s*(R|BR|NFR|CR)?(\d+)$/);
  if (!m) return [rangeStr]; // not a range, return as-is
  const prefix = m[1];
  // Reject cross-prefix ranges (e.g., "R1–BR3")
  if (m[3] && m[3] !== prefix) return [rangeStr];
  const start = parseInt(m[2], 10);
  const end = parseInt(m[4], 10);
  if (end < start || end - start > 100) return [rangeStr]; // safety: don't expand absurd ranges
  const result = [];
  for (let i = start; i <= end; i++) {
    result.push(`${prefix}${i}`);
  }
  return result;
}

/**
 * Parse FRS for all requirement IDs and descriptions.
 * Returns Map<string, { id: string, type: string, description: string }>
 * where key is the requirement ID (e.g., "R1").
 */
function parseFRSRequirements() {
  const reqs = new Map();
  if (!fs.existsSync(FRS_PATH)) return reqs;

  let lines;
  try {
    lines = fs.readFileSync(FRS_PATH, 'utf-8').split('\n');
  } catch {
    return reqs;
  }

  let currentId = null;
  let currentType = null;
  let descLines = [];

  function flush() {
    if (currentId) {
      reqs.set(currentId, {
        id: currentId,
        type: currentType,
        description: descLines.join(' ').trim()
      });
    }
    currentId = null;
    currentType = null;
    descLines = [];
  }

  for (const line of lines) {
    const m = FRS_REQ_RE.exec(line);
    if (m) {
      flush(); // save previous requirement
      currentId = m[1];
      currentType = reqType(currentId);
      descLines.push(m[2].trim());
    } else if (currentId) {
      if (/^\s*-\s*\*\*/.test(line) || /^##/.test(line) || /^\s*$/.test(line)) {
        flush();
      } else {
        descLines.push(line.trim());
      }
    }
  }
  flush(); // flush last requirement

  return reqs;
}

/**
 * Scan all story files for Requirements fields.
 * Returns array of { epicNum, storyNum, title, epicSlug, fileName, requirementIds[] }
 */
function parseStoryRequirements() {
  const results = [];
  if (!fs.existsSync(STORIES_DIR)) return results;

  let epicDirs;
  try {
    epicDirs = fs.readdirSync(STORIES_DIR).filter(d =>
      /^epic-\d+/.test(d) && fs.statSync(path.join(STORIES_DIR, d)).isDirectory()
    );
  } catch {
    return results;
  }

  for (const epicDir of epicDirs) {
    const epicMatch = epicDir.match(/^epic-(\d+)-?(.*)/);
    if (!epicMatch) continue;
    const epicNum = parseInt(epicMatch[1], 10);
    const epicSlug = epicDir;

    const epicPath = path.join(STORIES_DIR, epicDir);
    let files;
    try {
      files = fs.readdirSync(epicPath).filter(f => /^story-\d+.*\.md$/.test(f));
    } catch {
      continue;
    }

    for (const file of files) {
      const storyMatch = file.match(/^story-(\d+)/);
      if (!storyMatch) continue;
      const storyNum = parseInt(storyMatch[1], 10);

      let content;
      try {
        content = fs.readFileSync(path.join(epicPath, file), 'utf-8');
      } catch {
        continue;
      }

      // Extract title from first heading
      const titleMatch = content.match(/^#\s+Story:\s*(.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');

      // Extract Requirements field — look for **Requirements:** line
      const reqLine = content.match(/\*\*Requirements:\*\*\s*(.+)/);
      const requirementIds = [];
      if (reqLine) {
        let m2;
        const idRe = new RegExp(REQ_ID_RE.source, 'g');
        while ((m2 = idRe.exec(reqLine[1])) !== null) {
          requirementIds.push(m2[1]);
        }
      }

      results.push({
        epicNum,
        storyNum,
        title,
        epicSlug,
        fileName: file,
        requirementIds
      });
    }
  }

  // Sort by epic number, then story number
  results.sort((a, b) => a.epicNum - b.epicNum || a.storyNum - b.storyNum);
  return results;
}

/**
 * Parse the feature-overview's Requirements Coverage table.
 * Returns Map<epicNum, string[]> — each epic's claimed requirement IDs (ranges expanded).
 */
function parseFeatureOverviewRequirements() {
  const epicReqs = new Map();
  if (!fs.existsSync(FEATURE_OVERVIEW_PATH)) return epicReqs;

  let content;
  try {
    content = fs.readFileSync(FEATURE_OVERVIEW_PATH, 'utf-8');
  } catch {
    return epicReqs;
  }

  // Find the Requirements Coverage section
  const coverageStart = content.indexOf('## Requirements Coverage');
  if (coverageStart === -1) return epicReqs;

  const afterCoverage = content.slice(coverageStart);
  const nextSection = afterCoverage.indexOf('\n## ', 1);
  const coverageText = nextSection >= 0 ? afterCoverage.slice(0, nextSection) : afterCoverage;

  // Parse table rows: | Epic N | requirements... |
  const rows = coverageText.split('\n').filter(line => /^\|/.test(line) && !/^\|\s*[-]+/.test(line));
  for (const row of rows) {
    const epicMatch = row.match(/Epic\s+(\d+)/i);
    if (!epicMatch) continue;
    const epicNum = parseInt(epicMatch[1], 10);

    // Extract all requirement IDs and ranges from this row
    const ids = [];
    // First pass: find and expand ranges, blank them out to avoid double-counting
    const rangeRe = /(R|BR|NFR|CR)(\d+)\s*[–—-]\s*(?:R|BR|NFR|CR)?(\d+)/g;
    let remaining = row;
    let rangeMatch;
    while ((rangeMatch = rangeRe.exec(row)) !== null) {
      ids.push(...expandRange(rangeMatch[0]));
      remaining = remaining.slice(0, rangeMatch.index) + ' '.repeat(rangeMatch[0].length) + remaining.slice(rangeMatch.index + rangeMatch[0].length);
    }

    // Second pass: find standalone IDs in the blanked-out string
    const idRe = new RegExp(REQ_ID_RE.source, 'g');
    let idMatch;
    while ((idMatch = idRe.exec(remaining)) !== null) {
      ids.push(idMatch[1]);
    }

    epicReqs.set(epicNum, [...new Set(ids)]); // deduplicate
  }

  return epicReqs;
}

/**
 * Percentage helper for coverage buckets.
 * Returns 100 if total is 0 (nothing to cover = fully covered).
 */
function coveragePct(bucket) {
  if (bucket.total === 0) return 100;
  return Math.round((bucket.covered / bucket.total) * 100);
}

/**
 * Resolve totalEpics from workflow state, feature-overview claims, and epicsScoped.
 * 3-tier fallback: state.totalEpics → max epic number in feature-overview → epicsScoped.
 */
function resolveTotalEpics(featureOverviewClaims, epicsScoped) {
  try {
    const state = readWorkflowState();
    if (state && state.totalEpics) return state.totalEpics;
  } catch { /* fall through */ }
  if (featureOverviewClaims.size > 0) {
    return Math.max(epicsScoped, Math.max(...featureOverviewClaims.keys()));
  }
  return epicsScoped;
}

/**
 * Combined requirements coverage data.
 * Single call for both the traceability script and dashboard collector.
 *
 * Returns {
 *   frsRequirements: Map<id, { id, type, description }>,
 *   storyRequirements: Array<{ epicNum, storyNum, title, epicSlug, fileName, requirementIds[] }>,
 *   featureOverviewClaims: Map<epicNum, string[]>,
 *   coveredBy: Map<reqId, story[]>,
 *   byType: { functional, businessRules, nonFunctional, compliance } — each { total, covered, uncovered[] },
 *   overall: { total, covered, percent },
 *   totalEpics: number,
 *   epicsScoped: number,
 *   epicGaps: Map<epicNum, { claimed[], missing[], message }>,
 *   warnings: string[]
 * }
 */
function getRequirementsCoverage() {
  const frsRequirements = parseFRSRequirements();
  const storyRequirements = parseStoryRequirements();
  const featureOverviewClaims = parseFeatureOverviewRequirements();
  const warnings = [];

  // Build reverse map: requirement ID → stories that reference it
  const coveredBy = new Map();
  for (const story of storyRequirements) {
    if (story.requirementIds.length === 0) {
      warnings.push(`Story '${story.epicSlug}/${story.fileName}' has no Requirements field`);
    }
    for (const id of story.requirementIds) {
      if (!frsRequirements.has(id)) {
        warnings.push(`Story '${story.epicSlug}/${story.fileName}' references ${id} which does not exist in the FRS`);
        continue;
      }
      if (!coveredBy.has(id)) coveredBy.set(id, []);
      coveredBy.get(id).push(story);
    }
  }

  // Build per-type coverage
  const types = {
    functional: { total: 0, covered: 0, uncovered: [] },
    businessRules: { total: 0, covered: 0, uncovered: [] },
    nonFunctional: { total: 0, covered: 0, uncovered: [] },
    compliance: { total: 0, covered: 0, uncovered: [] }
  };

  for (const [id, req] of frsRequirements) {
    const bucket = types[req.type];
    if (!bucket) continue;
    bucket.total++;
    if (coveredBy.has(id)) {
      bucket.covered++;
    } else {
      bucket.uncovered.push(id);
    }
  }

  const overallBucket = { total: frsRequirements.size, covered: coveredBy.size };
  const uncoveredIds = [
    ...types.functional.uncovered,
    ...types.businessRules.uncovered,
    ...types.nonFunctional.uncovered,
    ...types.compliance.uncovered
  ];

  // Partition uncovered requirements into "pending" (claimed by some epic in
  // feature-overview, but that epic's STORIES phase hasn't run yet) vs "realGaps"
  // (not claimed by any epic at all). This lets consumers suppress warnings for
  // requirements that are legitimately deferred to a later epic.
  //
  // Build reverse map: requirement ID → first epic that claims it.
  // First-claim wins when multiple epics claim the same ID (shouldn't happen in
  // well-formed coverage tables, but guard against it).
  const claimedByEpic = new Map();
  for (const [epicNum, ids] of featureOverviewClaims) {
    for (const id of ids) {
      if (!claimedByEpic.has(id)) claimedByEpic.set(id, epicNum);
    }
  }

  const pending = [];
  const realGaps = [];
  for (const id of uncoveredIds) {
    if (claimedByEpic.has(id)) {
      pending.push({ id, claimedByEpic: claimedByEpic.get(id) });
    } else {
      realGaps.push(id);
    }
  }

  const overall = {
    ...overallBucket,
    percent: coveragePct(overallBucket),
    uncovered: uncoveredIds,
    pending,
    realGaps
  };

  // Pre-group stories by epic for gap analysis
  const storiesByEpic = new Map();
  for (const s of storyRequirements) {
    if (!storiesByEpic.has(s.epicNum)) storiesByEpic.set(s.epicNum, []);
    storiesByEpic.get(s.epicNum).push(s);
  }

  // Per-epic gap analysis: compare feature-overview claims vs actual story coverage.
  // Only flag an epic when it has at least one story on disk — without stories,
  // its claimed requirements are legitimately "pending" (see overall.pending),
  // not an epic-level gap. This avoids false positives for epics that haven't
  // been through STORIES yet.
  const epicGaps = new Map();
  for (const [epicNum, claimedIds] of featureOverviewClaims) {
    const epicStories = storiesByEpic.get(epicNum) || [];
    if (epicStories.length === 0) continue;  // epic not yet scoped → pending, not gap
    const epicActualIds = new Set(epicStories.flatMap(s => s.requirementIds));

    const missing = claimedIds.filter(id => !epicActualIds.has(id));
    if (missing.length > 0) {
      epicGaps.set(epicNum, {
        claimed: claimedIds,
        missing,
        message: `Epic ${epicNum} claims ${missing.join(', ')} in feature-overview but no story references ${missing.length === 1 ? 'it' : 'them'}`
      });
    }
  }

  const epicsScoped = storiesByEpic.size;
  const totalEpics = resolveTotalEpics(featureOverviewClaims, epicsScoped);

  return {
    frsRequirements,
    storyRequirements,
    featureOverviewClaims,
    coveredBy,
    byType: types,
    overall,
    totalEpics,
    epicsScoped,
    epicGaps,
    warnings
  };
}

// =============================================================================
// PHASE GROUPING (optional phasing feature)
// =============================================================================

// Sanity cap on epic-range parsing: rejects ranges wider than this to avoid
// allocating a huge array from a malformed or typo'd "Epics X-Y" cell.
const MAX_EPIC_RANGE = 100;

/**
 * Parse epic numbers from a Phases table "Epics" column value.
 * Handles: "Epics 1-3" (range), "Epic 6" (single), "Epics 1, 3, 5" (comma-list)
 * Returns sorted array of integers.
 */
function parseEpicNumbers(epicsStr) {
  if (!epicsStr) return [];
  const stripped = epicsStr.replace(/^Epics?\s*/i, '').trim();
  if (!stripped) return [];

  const rangeMatch = stripped.match(/^(\d+)\s*[–—-]\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    // Reject malformed ranges so the phase row is dropped rather than silently truncated.
    if (end < start || end - start > MAX_EPIC_RANGE) return [];
    const result = [];
    for (let i = start; i <= end; i++) result.push(i);
    return result;
  }

  const nums = stripped.split(/[,\s]+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n));
  return nums.sort((a, b) => a - b);
}

/**
 * Compute the display status for a phase group from state.epics.
 * Returns 'complete' | 'in_progress' | 'paused' | 'pending'.
 *
 * 'paused' is checked before 'complete' because at PHASE-BOUNDARY every epic
 * in the just-finished group has phase === 'COMPLETE' but the phase itself is
 * not yet resolved — the user still needs to pick Continue/Stop.
 */
function computeGroupStatus(group, epics, state, groupIndex, currentPhaseIndex) {
  if (groupIndex === currentPhaseIndex && state && state.phaseStatus === 'paused') {
    return 'paused';
  }

  const epicStates = group.epics.map(n => (epics && epics[n]) || null);
  if (epicStates.every(e => e && e.phase === 'COMPLETE')) return 'complete';
  if (epicStates.some(e => e && e.phase && e.phase !== 'PENDING')) return 'in_progress';
  return 'pending';
}

/**
 * Derive phase info from _feature-overview.md on every call.
 * Returns a consistent shape regardless of whether the project is phased.
 *
 * Consumed by: transition-phase.js, collect-dashboard-data.js,
 *              generate-todo-list.js, /continue handler
 *
 * Each group's position in `groups` is its phase index — use the array index directly.
 *
 * @param {object} [state] - Pre-read workflow state. When omitted, reads from disk.
 *   Callers that already have state in memory (e.g. transitionPhase) should pass it
 *   to avoid a redundant readWorkflowState() call.
 * @returns {{
 *   enabled: boolean,
 *   isMultiPhase: boolean,
 *   groups: Array<{label: string, name: string, epics: number[], description: string}>,
 *   currentPhaseIndex: number|null,
 *   current: {label: string, name: string, description: string}|null
 * }}
 */
function getPhases(state) {
  const disabled = { enabled: false, isMultiPhase: false, groups: [], currentPhaseIndex: null, current: null };

  if (!fs.existsSync(FEATURE_OVERVIEW_PATH)) return disabled;

  let content;
  try {
    content = fs.readFileSync(FEATURE_OVERVIEW_PATH, 'utf-8');
  } catch {
    return disabled;
  }

  const phasesMatch = content.match(/^## Phases\s*$/m);
  if (!phasesMatch) return disabled;

  const afterHeading = content.slice(phasesMatch.index + phasesMatch[0].length);
  const nextSection = afterHeading.search(/^## /m);
  const tableContent = nextSection >= 0 ? afterHeading.slice(0, nextSection) : afterHeading;

  const lines = tableContent.split('\n').filter(l => l.trim().startsWith('|'));
  // Need at least header + separator + 1 data row
  if (lines.length < 3) return disabled;

  const groups = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim()).filter(c => c);
    if (cells.length < 3) continue;

    const epics = parseEpicNumbers(cells[2]);
    if (epics.length === 0) continue;

    groups.push({
      label: cells[0],
      name: cells[1],
      epics,
      description: cells[3] || ''
    });
  }

  if (groups.length === 0) return disabled;

  let currentPhaseIndex = null;
  let current = null;
  const resolvedState = state || readWorkflowState();
  if (resolvedState && resolvedState.currentEpic) {
    const idx = groups.findIndex(g => g.epics.includes(resolvedState.currentEpic));
    if (idx !== -1) {
      currentPhaseIndex = idx;
      current = { label: groups[idx].label, name: groups[idx].name, description: groups[idx].description };
    }
  }

  return { enabled: true, isMultiPhase: groups.length > 1, groups, currentPhaseIndex, current };
}

/**
 * Check whether resumption from a paused state should be transparent, notify, or halt.
 * Called by the /continue handler when phaseStatus === 'paused'.
 *
 * @param {string|null|undefined} pausedAt - ISO timestamp from state.pausedAt
 * @returns {{ status: 'silent'|'notify'|'halt', changedFiles: Array<{path: string, mtime: string}>, problems: string[] }}
 */
function checkStaleness(pausedAt) {
  const silent = { status: 'silent', changedFiles: [], problems: [] };

  // Fail-safe: if no valid timestamp, don't block resume
  if (!pausedAt || typeof pausedAt !== 'string') return silent;
  const pausedTime = new Date(pausedAt);
  if (isNaN(pausedTime.getTime())) return silent;
  // Clock skew: if pausedAt is in the future, treat as "now" — nothing is stale
  if (pausedTime > new Date()) return silent;

  const problems = [];
  const changedFiles = [];

  // --- Halt conditions ---

  // Feature overview missing
  if (!fs.existsSync(FEATURE_OVERVIEW_PATH)) {
    problems.push('_feature-overview.md is missing — cannot determine project structure');
  }

  // State corruption: totalEpics < currentEpic
  const state = readWorkflowState();
  if (state && state.totalEpics && state.currentEpic && state.totalEpics < state.currentEpic) {
    problems.push(`totalEpics (${state.totalEpics}) is less than currentEpic (${state.currentEpic}) — state may be corrupted`);
  }

  // Unexpected epic directories (suggests external modification while paused)
  if (state && state.currentEpic && fs.existsSync(STORIES_DIR)) {
    try {
      const epicDirs = fs.readdirSync(STORIES_DIR).filter(d => {
        const m = d.match(/^epic-(\d+)/);
        if (!m) return false;
        const epicNum = parseInt(m[1], 10);
        return epicNum > state.currentEpic && (!state.epics || !state.epics[epicNum]);
      });
      if (epicDirs.length > 0) {
        problems.push(`Unexpected epic directories found: ${epicDirs.join(', ')} — these didn't exist when you paused`);
      }
    } catch (e) {
      console.error(`[checkStaleness] Could not scan ${STORIES_DIR}: ${e.message}`);
    }
  }

  if (problems.length > 0) {
    return { status: 'halt', changedFiles, problems };
  }

  // --- Notify conditions ---

  const filesToCheck = [
    FEATURE_OVERVIEW_PATH,
    FRS_PATH
  ];

  for (const filePath of filesToCheck) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtime > pausedTime) {
        changedFiles.push({ path: filePath, mtime: stat.mtime.toISOString() });
      }
    } catch { /* file missing or stat error — skip */ }
  }

  if (changedFiles.length > 0) {
    return { status: 'notify', changedFiles, problems: [] };
  }

  return silent;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Phase constants
  GLOBAL_PHASES,
  STORY_PHASES,
  ALL_PHASES,
  PHASE_BOUNDARY,

  // Path constants
  STORIES_DIR,
  TEST_DESIGN_DIR,
  STATE_FILE,
  INTAKE_MANIFEST_FILE,
  FRS_PATH,
  API_SPEC_PATH,
  HANDLERS_PATH,
  SNAPSHOT_PATH,

  // Display constants
  AGENT_DISPLAY_NAMES,

  // File finding
  findFiles,
  findFilesRecursive,

  // Epic/story directory
  findEpicDir,
  findStoryFiles,

  // Acceptance criteria
  extractACSection,
  countStoryAC,
  countEpicAC,
  checkAllAcceptanceCriteria,

  // Story metadata
  extractStoryRoute,
  getDeferredVerificationStories,

  // Test files
  countTestFiles,
  countWireframes,

  // Story phase determination
  findTestDesignFile,
  storyHasTestDesign,
  storyHasTests,
  findFirstIncompleteStory,
  getStoryStates,

  // Discovered impacts
  getDiscoveredImpactsForEpic,

  // QA completion
  checkQAComplete,

  // Display helpers
  friendlyName,
  extractFeatureNameFromFiles,
  parseFeatureOverview,

  // AC traceability (dashboard test coverage card)
  parseACsFromStory,
  parseTestDesignCoverage,
  scanTestFileForACs,
  getACTraceability,

  // Requirements traceability
  parseFRSRequirements,
  parseStoryRequirements,
  parseFeatureOverviewRequirements,
  getRequirementsCoverage,
  expandRange,
  coveragePct,
  resolveTotalEpics,

  // State file readers
  readWorkflowState,
  readIntakeManifest,

  // Phase grouping (optional phasing feature)
  parseEpicNumbers,
  getPhases,
  computeGroupStatus,
  checkStaleness
};
