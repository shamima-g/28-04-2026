#!/usr/bin/env node
/**
 * resolve-ba-decision.js
 * Patches a single "BA decision required" block in a test-design document,
 * rewriting the marker to "BA decision resolved — Option <letter>:" and
 * appending a Resolution line inside the same blockquote.
 *
 * Usage:
 *   node .claude/scripts/resolve-ba-decision.js \
 *     --epic <N> \
 *     --story <M> \
 *     --decision-id BA-<X> \
 *     --option <A|B|C|...> \
 *     [--rationale "optional one-line justification"]
 *
 * Output (JSON to stdout):
 *   { "status": "ok",      "file": "<path>", "decisionId": "BA-<X>", "option": "<letter>" }
 *   { "status": "warning", "file": "<path>", "decisionId": "BA-<X>", "message": "already resolved" }
 *   { "status": "error",   "message": "<reason>" }
 *
 * Idempotent: re-running on an already-resolved block returns a warning
 * without modifying the file.
 *
 * Exit status:
 *   0 on ok or warning
 *   1 on error (missing args, file not found, ID not found in doc, etc.)
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

function parseDecisionId(value) {
  const m = /^BA-(\d+)$/.exec(value);
  if (!m) exitWithError(`Invalid --decision-id "${value}". Expected format: BA-<N> (e.g. BA-1).`);
  return m[1]; // return the numeric part; caller reconstructs "BA-N" as needed
}

function parseOptionLetter(value) {
  if (!/^[A-Z]$/.test(value)) {
    exitWithError(`Invalid --option "${value}". Expected a single uppercase letter (A-Z).`);
  }
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--epic' && next) {
      args.epic = parsePositiveInt(next, 'epic number');
      i++;
    } else if (flag === '--story' && next) {
      args.story = parsePositiveInt(next, 'story number');
      i++;
    } else if (flag === '--decision-id' && next) {
      args.decisionIdNum = parseDecisionId(next);
      i++;
    } else if (flag === '--option' && next) {
      args.option = parseOptionLetter(next);
      i++;
    } else if (flag === '--rationale' && next) {
      args.rationale = next;
      i++;
    }
  }
  if (args.epic === undefined) exitWithError('Missing --epic <N>.');
  if (args.story === undefined) exitWithError('Missing --story <M>.');
  if (args.decisionIdNum === undefined) exitWithError('Missing --decision-id BA-<N>.');
  if (args.option === undefined) exitWithError('Missing --option <letter>.');
  return args;
}

/**
 * Apply a resolution to a markdown string in-memory.
 * Returns { content, status, message? }:
 *   status 'ok'      — marker rewritten, Resolution line appended.
 *   status 'warning' — block already resolved for this ID; content unchanged.
 *   status 'error'   — ID not found in doc; content unchanged.
 *
 * Exposed for testing and reuse.
 */
function applyResolution(content, decisionIdNum, optionLetter, rationale) {
  const lines = content.split(/\r?\n/);

  const requiredMarkerRe = new RegExp(
    `^>\\s*\\*\\*BA decision required \\(BA-${decisionIdNum}\\):\\*\\*`,
  );
  const resolvedMarkerRe = new RegExp(
    `^>\\s*\\*\\*BA decision resolved — Option [A-Z] \\(BA-${decisionIdNum}\\):\\*\\*`,
  );

  let markerLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (resolvedMarkerRe.test(lines[i])) {
      return {
        content,
        status: 'warning',
        message: `BA-${decisionIdNum} is already resolved in this document.`,
      };
    }
    if (requiredMarkerRe.test(lines[i])) {
      markerLineIdx = i;
      break;
    }
  }

  if (markerLineIdx === -1) {
    return {
      content,
      status: 'error',
      message: `BA-${decisionIdNum} not found as an unresolved block in the test-design document.`,
    };
  }

  // Rewrite the marker line. Keep any trailing question text.
  // The ID is embedded in the resolved marker so the block remains
  // machine-addressable after resolution.
  lines[markerLineIdx] = lines[markerLineIdx].replace(
    /\*\*BA decision required \(BA-\d+\):\*\*/,
    `**BA decision resolved — Option ${optionLetter} (BA-${decisionIdNum}):**`,
  );

  // Find the end of the blockquote (last contiguous '>'-prefixed line).
  let endIdx = markerLineIdx;
  while (endIdx + 1 < lines.length && lines[endIdx + 1].startsWith('>')) {
    endIdx++;
  }

  // Build the Resolution line; include rationale if supplied.
  const date = new Date().toISOString().slice(0, 10);
  let resolutionLine = `> Resolution: Option ${optionLetter} approved ${date} by user.`;
  if (rationale && rationale.trim().length > 0) {
    // Keep rationale on the same line so the blockquote stays compact.
    resolutionLine += ` Rationale: ${rationale.trim()}`;
  }

  // Insert inside the blockquote right after the last '>' line.
  lines.splice(endIdx + 1, 0, resolutionLine);

  return { content: lines.join('\n'), status: 'ok' };
}

function main() {
  const args = parseArgs(process.argv);

  const tdPath = helpers.findTestDesignFile(args.epic, args.story);
  if (!tdPath) {
    exitWithError(
      `No test-design file found for epic ${args.epic}, story ${args.story}.`,
    );
  }

  let content;
  try {
    content = fs.readFileSync(tdPath, 'utf-8');
  } catch (err) {
    exitWithError(`Could not read test-design file at ${tdPath}: ${err.message}`);
  }

  const result = applyResolution(content, args.decisionIdNum, args.option, args.rationale);

  if (result.status === 'error') {
    exitWithError(result.message);
  }

  if (result.status === 'warning') {
    console.log(JSON.stringify({
      status: 'warning',
      file: tdPath,
      decisionId: `BA-${args.decisionIdNum}`,
      message: result.message,
    }, null, 2));
    return; // exit 0 on warning (idempotent success)
  }

  try {
    fs.writeFileSync(tdPath, result.content);
  } catch (err) {
    exitWithError(`Could not write test-design file at ${tdPath}: ${err.message}`);
  }

  console.log(JSON.stringify({
    status: 'ok',
    file: tdPath,
    decisionId: `BA-${args.decisionIdNum}`,
    option: args.option,
  }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { applyResolution };
