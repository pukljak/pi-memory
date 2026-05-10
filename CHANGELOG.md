# Changelog

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
