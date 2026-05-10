# Release Notes Template

## Version
- `vX.Y.Z`

## Summary
- One-paragraph summary of what changed and why.

## Highlights
- Feature 1
- Feature 2
- Fix 1

## Breaking changes
- None / list details

## Migration notes
- Any manual steps for users.

## Validation
- [ ] Install in clean Pi profile
- [ ] Core commands smoke-tested
- [ ] Tools smoke-tested
- [ ] UI starts and loads
- [ ] Tests pass

## Publish
```bash
npm version <patch|minor|major>
npm publish --access public
```
