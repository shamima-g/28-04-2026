/**
 * parseSessionLog() — turns a .claude/logs/*.md file into a structured event timeline.
 *
 * Claude Code session logs are markdown files containing prompts, tool calls,
 * and responses in chronological order. This parser produces an ordered list
 * that Tier 2 invariant tests can assert against — tool-call order, counts,
 * content-before-question relationships, etc.
 *
 * The log format isn't formally specified, so this parser is resilient:
 * unknown sections are preserved as "unknown" events, never crash the parser.
 */

import fs from 'node:fs';

export type EventType =
  | 'session_start'
  | 'session_end'
  | 'prompt'
  | 'response'
  | 'tool_call'
  | 'tool_result'
  | 'ask_user_question'
  | 'permission_request'
  | 'notification'
  | 'subagent_start'
  | 'subagent_stop'
  | 'pre_compact'
  | 'unknown';

export interface LogEvent {
  type: EventType;
  /** ISO timestamp if parseable, else null. */
  timestamp: string | null;
  /** Tool name (for tool_call / tool_result). */
  toolName?: string;
  /** Subagent type (for subagent_start / subagent_stop). */
  subagentType?: string;
  /** Raw block text (the full section between --- separators). */
  raw: string;
  /** Parsed args/content where available. */
  content?: string;
  /** Line number in the source log where this event starts. */
  lineNumber: number;
}

export interface SessionLog {
  /** Absolute path of the log file. */
  path: string;
  /** Project name from the header (if present). */
  project?: string;
  /** Session ID from the header. */
  sessionId?: string;
  /** Every event in order. */
  events: LogEvent[];
  /** Convenience getters. */
  toolCalls: LogEvent[];
  prompts: LogEvent[];
  responses: LogEvent[];
  askUserQuestions: LogEvent[];
}

export function parseSessionLog(filePath: string): SessionLog {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const log: SessionLog = {
    path: filePath,
    events: [],
    toolCalls: [],
    prompts: [],
    responses: [],
    askUserQuestions: [],
  };

  // Parse header
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i];
    if (line.startsWith('**Project:**')) log.project = line.replace('**Project:**', '').trim();
    if (line.startsWith('**Session ID:**')) log.sessionId = line.replace('**Session ID:**', '').trim();
  }

  // Split into sections separated by horizontal rules.
  // Section headers follow the pattern:  ## <Kind> - <timestamp>
  // Or:  ## <Kind>
  let buffer: string[] = [];
  let bufferStartLine = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const event = classify(buffer, bufferStartLine);
    if (event) {
      log.events.push(event);
      switch (event.type) {
        case 'tool_call': log.toolCalls.push(event); break;
        case 'prompt': log.prompts.push(event); break;
        case 'response': log.responses.push(event); break;
        case 'ask_user_question': log.askUserQuestions.push(event); break;
      }
    }
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) {
      flush();
      buffer = [line];
      bufferStartLine = i + 1;
    } else if (line.trim() === '---') {
      flush();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return log;
}

function classify(block: string[], lineNumber: number): LogEvent | null {
  const header = block[0] ?? '';
  const raw = block.join('\n');
  const content = block.slice(1).join('\n').trim();
  const timestamp = extractTimestamp(header);

  // Pattern matching on header text
  const lower = header.toLowerCase();

  if (lower.includes('prompt')) {
    return { type: 'prompt', timestamp, raw, content, lineNumber };
  }
  if (lower.includes('response')) {
    return { type: 'response', timestamp, raw, content, lineNumber };
  }
  if (lower.includes('session start')) {
    return { type: 'session_start', timestamp, raw, content, lineNumber };
  }
  if (lower.includes('session end') || lower.includes('session summary')) {
    return { type: 'session_end', timestamp, raw, content, lineNumber };
  }
  if (lower.includes('tool call') || lower.includes('pre_tool_use') || lower.includes('pretoolcall')) {
    return {
      type: 'tool_call',
      timestamp,
      toolName: extractToolName(header, content),
      raw,
      content,
      lineNumber,
    };
  }
  if (lower.includes('tool result') || lower.includes('post_tool_use') || lower.includes('posttoolcall')) {
    return {
      type: 'tool_result',
      timestamp,
      toolName: extractToolName(header, content),
      raw,
      content,
      lineNumber,
    };
  }
  if (lower.includes('askuserquestion') || lower.includes('ask user question') || lower.includes('permission')) {
    if (lower.includes('permission')) {
      return { type: 'permission_request', timestamp, raw, content, lineNumber };
    }
    return { type: 'ask_user_question', timestamp, raw, content, lineNumber };
  }
  if (lower.includes('subagent start') || lower.includes('subagent_start')) {
    return {
      type: 'subagent_start',
      timestamp,
      subagentType: extractSubagentType(content),
      raw,
      content,
      lineNumber,
    };
  }
  if (lower.includes('subagent stop') || lower.includes('subagent_stop')) {
    return {
      type: 'subagent_stop',
      timestamp,
      subagentType: extractSubagentType(content),
      raw,
      content,
      lineNumber,
    };
  }
  if (lower.includes('compact')) {
    return { type: 'pre_compact', timestamp, raw, content, lineNumber };
  }
  if (lower.includes('notification')) {
    return { type: 'notification', timestamp, raw, content, lineNumber };
  }

  return { type: 'unknown', timestamp, raw, content, lineNumber };
}

function extractTimestamp(header: string): string | null {
  // Matches patterns like "## Prompt - 2026-04-21 14:30:15"
  const m = header.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : null;
}

function extractToolName(header: string, content: string): string | undefined {
  // Try header first: "## Tool Call: Bash"
  const h = header.match(/(?:Tool Call|Tool Result)\s*[:\-]\s*(\w+)/i);
  if (h) return h[1];
  // Fallback: scan content for "Tool: <Name>" or similar
  const c = content.match(/(?:Tool|tool_name)\s*[:=]\s*["']?(\w+)/);
  return c ? c[1] : undefined;
}

function extractSubagentType(content: string): string | undefined {
  const m = content.match(/(?:subagent_type|subagent)\s*[:=]\s*["']?([a-zA-Z0-9_-]+)/);
  return m ? m[1] : undefined;
}
