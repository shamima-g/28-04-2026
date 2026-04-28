/**
 * Composable assertions over a parsed SessionLog. Used by Tier 2 invariant tests.
 *
 * Each function returns { ok: boolean, message: string } rather than throwing
 * directly — this lets tests use Vitest's expect() while still getting
 * human-readable failure messages.
 */

import type { SessionLog, LogEvent, EventType } from './parse-session-log';

export interface AssertResult {
  ok: boolean;
  message: string;
}

/** The named tool calls appear in the given order (not necessarily adjacent). */
export function toolCallsInOrder(log: SessionLog, expected: string[]): AssertResult {
  const actual = log.toolCalls.map(e => e.toolName).filter(Boolean) as string[];
  let i = 0;
  for (const name of actual) {
    if (name === expected[i]) i++;
    if (i === expected.length) return { ok: true, message: `All ${expected.length} calls in order` };
  }
  return {
    ok: false,
    message: `Expected tool call sequence ${JSON.stringify(expected)} not found. Got: ${JSON.stringify(actual)}`,
  };
}

/** Exact count of a named tool call across the whole session. */
export function toolCallCount(log: SessionLog, toolName: string): number {
  return log.toolCalls.filter(e => e.toolName === toolName).length;
}

/** Assert a specific tool was called exactly N times. */
export function toolCallCountEquals(log: SessionLog, toolName: string, expected: number): AssertResult {
  const actual = toolCallCount(log, toolName);
  return {
    ok: actual === expected,
    message: `Expected ${toolName} ×${expected}, got ×${actual}`,
  };
}

/**
 * Assert every AskUserQuestion is preceded (within a reasonable window) by a
 * response event or textual content — i.e. the user has something to review
 * before being asked to approve.
 */
export function everyAskUserQuestionPrecededByContent(log: SessionLog): AssertResult {
  const events = log.events;
  for (let i = 0; i < events.length; i++) {
    if (events[i].type !== 'ask_user_question') continue;
    // Scan backwards for a non-trivial response or tool_result within 20 events
    let precededByContent = false;
    for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
      const ev = events[j];
      if (ev.type === 'response' && ev.content && ev.content.length > 40) {
        precededByContent = true;
        break;
      }
      if (ev.type === 'tool_result' && ev.content && ev.content.length > 40) {
        precededByContent = true;
        break;
      }
    }
    if (!precededByContent) {
      return {
        ok: false,
        message: `AskUserQuestion at line ${events[i].lineNumber} has no substantive content immediately preceding it`,
      };
    }
  }
  return { ok: true, message: `All ${log.askUserQuestions.length} AskUserQuestion events preceded by content` };
}

/** The tool named `before` fires before any tool named `after` in the session. */
export function toolCallFiresBefore(log: SessionLog, before: string, after: string): AssertResult {
  const firstBefore = log.toolCalls.findIndex(e => e.toolName === before);
  const firstAfter = log.toolCalls.findIndex(e => e.toolName === after);
  if (firstBefore === -1) return { ok: false, message: `'${before}' tool call never fired` };
  if (firstAfter === -1) return { ok: true, message: `'${after}' never fired, so ordering trivially holds` };
  return {
    ok: firstBefore < firstAfter,
    message: `'${before}' index=${firstBefore}, '${after}' index=${firstAfter}`,
  };
}

/** Every response (except the last) ends with `[Logs saved]`. */
export function everyResponseEndsWithLogsSaved(log: SessionLog): AssertResult {
  for (const resp of log.responses) {
    const content = resp.content?.trim() ?? '';
    if (!content) continue; // empty responses don't count
    const lastLine = content.split(/\r?\n/).filter(Boolean).pop() ?? '';
    if (!lastLine.includes('[Logs saved]')) {
      return {
        ok: false,
        message: `Response at line ${resp.lineNumber} does not end with [Logs saved]. Last line: ${JSON.stringify(lastLine)}`,
      };
    }
  }
  return { ok: true, message: `All ${log.responses.length} responses end with [Logs saved]` };
}

/** Filter events to a given type. */
export function eventsOfType(log: SessionLog, type: EventType): LogEvent[] {
  return log.events.filter(e => e.type === type);
}

/** The parent orchestrator made <= N tool calls before the first subagent_start. */
export function parentToolCallsBeforeFirstSubagent(log: SessionLog, maxCalls: number): AssertResult {
  const firstSubagentIdx = log.events.findIndex(e => e.type === 'subagent_start');
  if (firstSubagentIdx === -1) return { ok: true, message: 'No subagent_start in session (trivially holds)' };
  let count = 0;
  for (let i = 0; i < firstSubagentIdx; i++) {
    if (log.events[i].type === 'tool_call') count++;
  }
  return {
    ok: count <= maxCalls,
    message: `Parent made ${count} tool calls before first subagent (limit: ${maxCalls})`,
  };
}
