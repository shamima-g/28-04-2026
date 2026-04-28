# File Operations Policy

**Scope:** Documentation-scanning agents (intake-agent, intake-brd-review-agent, prototype-review-agent). Agents that run builds and tests (developer, test-generator) need pipeline filters (`grep`, `tail` on command output) and should NOT use this policy.

## Allowed Bash

| Category | Examples | Notes |
|----------|----------|-------|
| **Node scripts** | `node .claude/scripts/...`, `node web/...`, `node generated-docs/...` | Includes `scan-doc.js` for file metadata |
| **Git** | `git add`, `git commit`, `git push`, `git status` | Only when the agent's instructions call for it |
| **Directory listing** | `ls` | For quick directory checks |

## Use Dedicated Tools Instead

| Instead of... | Use... | Why |
|---------------|--------|-----|
| `cat`, `head`, `tail` | `Read` tool with `offset`/`limit` | Returns line numbers, handles all encodings, supports partial reads |
| `grep`, `rg` | `Grep` tool | Regex support, glob filtering, multiple output modes |
| `find` | `Glob` tool | Fast pattern matching, sorted by modification time |
| `wc -l` | `scan-doc.js` | Returns `.lines` field with total line count |
| `sed -n` | `Read` tool with `offset`/`limit` | Read specific line ranges without Bash |
| `awk` | `Read` + `Grep` tools | No file analysis needs require awk |
| `python3 -c` | `Read`/`Grep` or `scan-doc.js` | Never pipe files through interpreters |
| `cut`, `perl` | `Read`/`Grep` tools | Dedicated tools handle all text extraction needs |
