#!/usr/bin/env node
/**
 * list-ba-decisions.js
 * Enumerates unresolved "BA decision required" blocks in a test-design document.
 *
 * Usage:
 *   node .claude/scripts/list-ba-decisions.js --epic <N> --story <M>
 *
 * Output (JSON to stdout):
 *   {
 *     "status": "ok",
 *     "file": "generated-docs/test-design/epic-.../story-...-test-design.md",
 *     "decisions": [
 *       {
 *         "id": "BA-1",
 *         "question": "Is ... acceptable?",
 *         "options": [
 *           { "letter": "A", "text": "Yes ..." },
 *           { "letter": "B", "text": "No ..." }
 *         ]
 *       }
 *     ]
 *   }
 *
 * Returns an empty decisions array if no unresolved blocks are found.
 * Only counts blocks tagged with an explicit ID "(BA-<n>)" — legacy blocks
 * without an ID are ignored (caller can still see them via the dashboard
 * counter, which uses a broader regex).
 *
 * Exit status:
 *   0 on success ({"status":"ok"} including empty decisions list)
 *   1 on error (missing args, test-design file not found, etc.)
 */

const fs = require('fs');
const helpers = require('./lib/workflow-helpers');

function exitWithError(message) {
  console.log(JSON.stringify({ status: 'error', message }, null, 2));
  process.exit(1);
}

function parsePositiveInt(value, label) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1) {
    exitWithError(`Invalid ${label}. Must be a positive integer.`);
  }
  return num;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--epic' && argv[i + 1]) {
      args.epic = parsePositiveInt(argv[++i], 'epic number');
    } else if (argv[i] === '--story' && argv[i + 1]) {
      args.story = parsePositiveInt(argv[++i], 'story number');
    }
  }
  if (args.epic === undefined) exitWithError('Missing --epic <N>.');
  if (args.story === undefined) exitWithError('Missing --story <M>.');
  return args;
}

/**
 * Parse a markdown string for unresolved BA decision blocks.
 * Returns an array of { id, question, options[{ letter, text }] }.
 *
 * Exposed as a named export so tests or other scripts can reuse the parser.
 */
function parseBADecisions(content) {
  const decisions = [];
  const markerRe = /^>\s*\*\*BA decision required \(BA-(\d+)\):\*\*\s*(.*)$/;
  const optionRe = /^>\s*-\s*Option\s+([A-Z]):\s*(.*)$/;
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(markerRe);
    if (!m) continue;

    const id = `BA-${m[1]}`;
    const question = m[2].trim();
    const options = [];

    // Scan forward within the same blockquote (contiguous '>' lines).
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].startsWith('>')) break;
      const om = lines[j].match(optionRe);
      if (om) {
        options.push({ letter: om[1], text: om[2].trim() });
      }
    }

    decisions.push({ id, question, options });
  }

  return decisions;
}

function main() {
  const args = parseArgs(process.argv);
  const tdPath = helpers.findTestDesignFile(args.epic, args.story);

  if (!tdPath) {
    exitWithError(
      `No test-design file found for epic ${args.epic}, story ${args.story}. Expected under generated-docs/test-design/epic-${args.epic}-*/story-${args.story}-*-test-design.md.`
    );
  }

  let content;
  try {
    content = fs.readFileSync(tdPath, 'utf-8');
  } catch (err) {
    exitWithError(`Could not read test-design file at ${tdPath}: ${err.message}`);
  }

  const decisions = parseBADecisions(content);

  console.log(JSON.stringify({
    status: 'ok',
    file: tdPath,
    decisions,
  }, null, 2));
}

// Only run main() when invoked as a CLI. Exporting parseBADecisions lets
// resolve-ba-decision.js and any future script reuse the parser.
if (require.main === module) {
  main();
}

module.exports = { parseBADecisions };
