# Changelog

## 0.1.3 - 2026-05-10

### Added
- Superpowers memory extraction (`memory/superpowers.ts`) with structured types
- Superpowers UI tab with feedback actions (`accepted` / `rejected`) and type filters
- Suggestion feedback API endpoint: `/api/memory/superpowers-feedback`
- Adaptive memory scoring loop (`memory/adaptive.ts`)
- Outcome-aware learning from test/tool signals (`memory/outcomes.ts`)
- New tests:
  - `tests/superpowers-memory.test.ts`
  - `tests/memory-adaptive.test.ts`
  - `tests/memory-outcomes.test.ts`

### Changed
- Superpowers suggestion ranking now uses lexical relevance + feedback boost/penalty
- Suggestion quality gates now include confidence threshold and suppression of stale low-quality memories
- Agent end cycle now applies: derive → classify → outcome learning → adaptive scoring → prune

## 0.1.0 - 2026-05-10

### Added
- Publish scaffolding (`package.json`, `tsconfig.json`, `.gitignore`)
- README refresh with install/usage/lifecycle/publish checklist
- Starter tests for scope and retention

### Changed
- Refactored command registration into modules:
  - `commands/core.ts`
  - `commands/explore.ts`
  - `commands/playbook.ts`
  - `commands/maintenance.ts`
- Added `commands/helpers.ts` for scoped memory item creation
- Standardized command-created memory IDs and project keys
