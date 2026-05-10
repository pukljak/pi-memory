# Pi Memory

**Long-term memory for Pi coding agent.**

Pi Memory helps Pi remember your project over time: decisions, preferences, rules, gotchas, and what changed. The goal is simple — fewer repeated instructions, more consistent implementation.

---

## Install

```bash
pi install npm:@pukljak/pi-memory
```

Restart Pi after install.

---

## What it does

Pi Memory continuously captures session context and turns it into reusable memory.

It tracks:
- user prompts
- assistant outputs
- tool execution outcomes
- timeline of important observations

Then, before new tasks, it injects compact relevant memory so Pi can work with your existing context instead of starting cold.

---

## How it works

### 1) Capture
During your normal work, it records observations and candidate memories.

### 2) Classify
It classifies memory into useful buckets like:
- preferences
- patterns
- lessons
- decisions / rules (playbook)

### 3) Rank + recall
For each new prompt, it ranks memories by relevance, quality, freshness, and scope.

### 4) Guardrails
For coding tasks, it injects playbook guardrails (rules/standards/decisions) so Pi follows project conventions.

### 5) Retain + prune
High-signal memories are reinforced over time; stale low-value memories are pruned.

---

## Why this is useful

After enough usage, Pi starts behaving like someone who has worked in your codebase for months:
- knows team preferences
- remembers architectural choices
- avoids repeated mistakes
- carries context across sessions

---

## Core commands

### Inspect / recall
- `/memory.status`
- `/memory.search <query>`
- `/memory.timeline <observation-id>`
- `/memory.recall <query> [--tokens N]`

### Playbook / standards
- `/memory.rule add <text>`
- `/memory.standard add <text>`
- `/memory.decision add <decision>|<rationale>|[alternatives]`
- `/memory.preference add <text>`
- `/memory.preference.confirm <id>`
- `/memory.playbook`

### Maintenance
- `/memory.pin <id>` / `/memory.unpin <id>`
- `/memory.forget <id|text>`
- `/memory.prune [--dry-run]`

### Codebase context
- `/memory.codebase.root set <root-path> [domain-id]`
- `/memory.codebase.root show`
- `/memory.explore [--deep] [root-path] [domain-id]`
- `/memory.snapshot [--deep] [root-path] [domain-id]`

### UI
- `/memory.ui`

---

## Example workflow (real-world)

### Scenario: add a new feature after weeks of work

1. You ship features and fixes normally over time.
2. Pi Memory captures decisions, preferences, and timeline evidence.
3. Later you ask: *"Add billing retry support for failed webhook deliveries."*
4. Before coding, Pi gets:
   - relevant architecture decisions
   - project standards/rules
   - recent related changes
5. Pi implements with fewer corrections and better consistency.

---

## Tools exposed to agent

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

- Memory injection is compact to reduce token usage.
- Domain-scoped memory can be shared across related services/repos.
- Private tagged content is sanitized before persistence.

---

## Development

```bash
npm install
npm test
npm pack --dry-run
```

---

If you use Pi every day on the same codebase, Pi Memory is one of the highest-leverage extensions you can add.