# pi-memory

Persistent memory + observation timeline for Pi coding agent.

## Install

```bash
pi install npm:pi-memory
```

Restart Pi after install.

## What it does

- Captures user/assistant/tool/system observations per session
- Stores reusable memory items (facts, patterns, lessons, preferences)
- Injects compact memory context before agent runs
- Adds timeline/search/stats tools and `/memory.*` commands
- Supports **domain-scoped memory** shared across related codebases
- Includes local UI for memory, observations, timeline, and summaries

## Commands

- `/memory.status`
- `/memory.search <query>`
- `/memory.timeline <observation-id>`
- `/memory.forget <id|text>`
- `/memory.pin <id>` / `/memory.unpin <id>`
- `/memory.prune [--dry-run]`
- `/memory.rule add <text>`
- `/memory.standard add <text>`
- `/memory.preference add <text>`
- `/memory.preference.confirm <id>`
- `/memory.decision add <decision>|<rationale>|[alternatives]`
- `/memory.recall <query> [--tokens N]`
- `/memory.session.brief [--tokens N]`
- `/memory.example good <file>|<snippet>|<why>`
- `/memory.example bad <file>|<whyBad>|<badSnippet>|<correctedSnippet>`
- `/memory.playbook`
- `/memory.ui`
- `/memory.codebase.root set <root-path> [domain-id]`
- `/memory.codebase.root show`
- `/memory.explore [--deep] [root-path] [domain-id]`
- `/memory.snapshot [--deep] [root-path] [domain-id]`

## Tools

- `memory_search`
- `memory_remember`
- `memory_forget`
- `memory_stats`
- `memory_timeline`

## Storage

- `~/.pi/pi-memory/memory.json`
- `~/.pi/pi-memory/summary-cache.json`

## Lifecycle hooks

- `session_start`
- `before_agent_start`
- `tool_execution_end`
- `agent_end`
- `session_shutdown`

## Development

```bash
# in extension folder
npm install
npm run typecheck
```

## Publishing checklist

1. Bump `package.json` version
2. Update README and changelog
3. Run typecheck/tests
4. Verify install in clean Pi profile
5. Publish with `npm publish --access public`

## Notes

- Memory blocks are injected compactly to reduce token usage
- File-aware read gate hints prior observations before redundant reads
- Pruning protects pinned and high-value items
- `<private>...</private>` content is sanitized before persistence
