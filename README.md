# Pi Memory

Persistent memory for Pi coding agent.

Pi Memory helps Pi remember your project over time: decisions, preferences, rules, gotchas, and what changed. It keeps context across sessions so you repeat yourself less and get more consistent output.

## Install

```bash
pi install npm:@pukljak/pi-memory
```

Restart Pi after install.

> Important: include the `@pukljak/` scope. `pi-memory` without scope is a different npm package.

---

## What this package is

Think of Pi Memory as a long-term context layer for coding work.

It does 4 things continuously:
1. **Learns** from your sessions (prompts, tool outputs, assistant responses)
2. **Stores** what matters (facts, patterns, lessons, preferences, decisions)
3. **Adjusts** memory quality using feedback + outcomes (accepted/rejected suggestions, test pass/fail signals, freshness)
4. **Injects** relevant memory before new tasks

So when you ask for a new feature next week, Pi can still remember key architectural decisions and team conventions.

---

## Core mode (simple + high value)

If you only use these, you already get strong value:

- `/memory.status` — quick health check
- `/memory.search <query>` — find known context
- `/memory.recall <query> [--tokens N]` — compact memory pack for the task
- `/memory.timeline <observation-id>` — inspect local chronology

### Typical daily flow

1. Work normally with Pi.
2. If needed, ask: `/memory.recall billing retries --tokens 600`
3. Implement feature with recalled context.
4. Pi Memory learns from the outcome automatically.

---

## Advanced mode (playbook + architecture memory)

Use this when you want Pi to become very opinionated about your codebase quality.

### Playbook commands

- `/memory.rule add <text>`
- `/memory.standard add <text>`
- `/memory.decision add <decision>|<rationale>|[alternatives]`
- `/memory.preference add <text>`
- `/memory.preference.confirm <id>`
- `/memory.playbook`

### Hygiene controls

- `/memory.pin <id>` / `/memory.unpin <id>`
- `/memory.forget <id|text>`
- `/memory.prune [--dry-run]`

### UI

- `/memory.ui`

Local web UI includes memory search, timeline view, playbook buckets, understanding summaries, and a Superpowers tab.

### Superpowers tab

If you use Superpowers workflows (brainstorming/plans/subagent execution), Pi Memory learns from those loops too.

- Captures Superpowers-style decisions/preferences/constraints from session outputs
- Shows them in a dedicated **Superpowers** tab
- Supports type filtering (`decision`, `preference`, `constraint`, `open-question`)
- When a similar question comes back later, Pi Memory suggests prior answers
- Suggestions track feedback (`accepted` / `rejected`) and ranking improves over time
- Low-quality stale suggestions are automatically suppressed

---

## Multi-service / monorepo workflow (domain memory)

In this extension, **domain** is a shared scope across related services/repos.

Example:

```bash
/memory.codebase.root set /repo platform
/memory.explore --deep /repo/services/auth platform
/memory.explore --deep /repo/services/billing platform
/memory.explore --deep /repo/services/orders platform
/memory.snapshot --deep /repo platform
```

This gives you:
- shared cross-service memory under `platform`
- service-specific findings from each scanned path
- stronger architecture recall for future implementation tasks

---

## Full command list

### Inspect / recall
- `/memory.status`
- `/memory.search <query>`
- `/memory.timeline <observation-id>`
- `/memory.recall <query> [--tokens N]`
- `/memory.session.brief [--tokens N]`

### Playbook
- `/memory.rule add <text>`
- `/memory.standard add <text>`
- `/memory.decision add <decision>|<rationale>|[alternatives]`
- `/memory.preference add <text>`
- `/memory.preference.confirm <id>`
- `/memory.example good <file>|<snippet>|<why>`
- `/memory.example bad <file>|<whyBad>|<badSnippet>|<correctedSnippet>`
- `/memory.playbook`

### Maintenance
- `/memory.pin <id>` / `/memory.unpin <id>`
- `/memory.forget <id|text>`
- `/memory.prune [--dry-run]`

### Codebase exploration
- `/memory.codebase.root set <root-path> [domain-id]`
- `/memory.codebase.root show`
- `/memory.explore [--deep] [root-path] [domain-id]`
- `/memory.snapshot [--deep] [root-path] [domain-id]`

### UI
- `/memory.ui`

---

## Tools exposed to the agent

- `memory_search`
- `memory_remember`
- `memory_forget`
- `memory_stats`
- `memory_timeline`

---

## Storage

- `~/.pi/pi-memory/memory.json`
- `~/.pi/pi-memory/summary-cache.json`

---

## Notes

- Memory injection is compact to reduce token overhead.
- Playbook entries get stronger over time via confirmations.
- Conflict and duplicate handling are built in.
- Superpowers suggestions have quality gates (confidence + low-quality suppression).
- Outcome-aware learning adjusts memory confidence from test/tool signals.
- Private-tagged content is sanitized before persistence.

---

## Updating

You can update manually anytime:

```bash
pi update npm:@pukljak/pi-memory
```

Pi Memory also performs a lightweight npm version check on session start (max once per ~12h) and shows an in-app reminder when a newer version is available.

---

## Development

```bash
npm install
npm test
npm pack --dry-run
```

If you use Pi on the same codebase every day, this extension compounds in value over time.