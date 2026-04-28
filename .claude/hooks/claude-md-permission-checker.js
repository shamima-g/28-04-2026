#!/usr/bin/env node
/**
 * PreToolUse hook that auto-approves Edit/Write/MultiEdit on CLAUDE.md
 * ONLY when the current workflow phase is INTAKE or DESIGN (phases where
 * CLAUDE.md edits are part of the expected workflow).
 *
 * Outside those phases — or when no workflow is active, or when the state
 * file cannot be read — the tool call falls through to the normal
 * permission prompt, preserving user oversight.
 *
 * Exit codes:
 * - 0 with JSON output: Edit auto-approved
 * - 0 without output: Falls through to normal permission system
 *
 * Location: .claude/hooks/claude-md-permission-checker.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED_PHASES = new Set(['INTAKE', 'DESIGN']);
const GATED_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);

function fallThrough() {
  process.exit(0);
}

function allowAndExit(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

let inputJson;
try {
  inputJson = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  fallThrough();
}

if (!GATED_TOOLS.has(inputJson.tool_name)) fallThrough();

const filePath = inputJson.tool_input?.file_path;
if (!filePath) fallThrough();

if (path.basename(filePath).toLowerCase() !== 'claude.md') fallThrough();

const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateFile = path.join(
  projectRoot,
  'generated-docs',
  'context',
  'workflow-state.json'
);

if (!fs.existsSync(stateFile)) fallThrough();

let state;
try {
  state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
} catch {
  fallThrough();
}

const phase = state?.currentPhase;
if (!phase || !ALLOWED_PHASES.has(phase)) fallThrough();

allowAndExit(`CLAUDE.md edit auto-approved during ${phase} phase`);
