# Pi Memory Implementation Plan (Practical MVP)

## Goal
Improve coding outcomes by capturing high-signal session memory and returning compact, relevant context.

## MVP scope (implemented now)
1. **Decision capture**
   - New command: `/memory.decision add <decision>|<rationale>|[alternatives]`
   - Stores structured decision memory (`meta.playbookCategory = decision`) and pins it.

2. **Token-budgeted recall**
   - New command: `/memory.recall <query> [--tokens N]`
   - Uses existing ranking and returns best memories that fit budget.

## Next implementation slices

### Slice A — Session brief & resume pack
- Command: `/memory.session.brief [--tokens N]`
- Output sections:
  - what changed
  - decisions
  - gotchas
  - follow-ups
  - touched files
- Persist as one summary memory per session (domain/project scoped).

### Slice B — Repo-aware links
- Add `meta.links: { file?: string; symbol?: string; module?: string }[]` to memories.
- On `tool_execution_end`, extract file and symbol hints from tool payloads.
- Boost retrieval score when prompt references linked file/symbol.

### Slice C — Memory hygiene
- Merge duplicate preferences/decisions by normalized intent.
- Auto-decay stale low-value items (already partly in retention; tune thresholds).
- Keep pinned decisions/rules protected.

### Slice D — Skill suggestion layer ✅
- Detect task pattern from prompt intent.
- Inject matching skills/plugins in a short `<skill_suggestions>` block.
- Current mappings: Next.js, browser debugging, PRD, web research, .NET review, skill discovery/creation, OSS internals.

## Data model updates (proposed)
- `MemoryItem.meta`
  - `playbookCategory?: "code-rule" | "code-standard" | "decision" | "preference" | "good-example" | "bad-example"`
  - `links?: Array<{ file?: string; symbol?: string; module?: string }>`
  - `sessionId?: string`

## Ranking strategy (target)
`score = semantic + confidence + quality + pin + recency + linkMatch - staleness`

## Acceptance checks
- Save decision, then `/memory.playbook` shows it.
- `/memory.recall api auth --tokens 300` returns compact high-signal set.
- No regression in existing commands, timeline, or startup injection.

## Suggested 2-week execution
- Days 1-2: Decision + recall polish (done baseline)
- Days 3-5: Session brief command + persistence
- Days 6-8: Repo-link extraction + ranking boost
- Days 9-10: Hygiene tuning + tests
- Days 11-14: Skill suggestion prototype + docs
