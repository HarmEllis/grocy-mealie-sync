# AGENTS.md

## Project Notes

- Prefer the documented npm scripts in [`README.md`](README.md) instead of ad-hoc commands when a script already exists.
- Treat `src/lib/grocy/client/**` and `src/lib/mealie/client/**` as generated artifacts. Regenerate them via the documented OpenAPI workflow instead of editing them by hand.

## Release And Tag Prep

When asked to prepare or create a new release tag, complete all of the steps below before creating the tag.

1. Determine the previous tag with `git describe --tags --abbrev=0` and review the changes since that tag with `git log --oneline <previous-tag>..HEAD` plus `git diff --stat <previous-tag>..HEAD`.
2. Update `CHANGELOG.md` for the upcoming release:
   - add the new version section at the top using `## [x.y.z] - YYYY-MM-DD`
   - summarize the changes since the previous tag in concise release notes
   - group entries under `Added`, `Changed`, and `Fixed` when that structure fits the changes
   - add or update the bottom comparison link so the new version compares `<previous-tag>...v<x.y.z>`
3. Generate a fresh docs screenshot with `npm run docs:screenshot` and include the updated `docs/images/app-dashboard.png` in the release changes.
4. Bump the app version in `package.json` to the new release version. Keep `package-lock.json` in sync if its mirrored version fields change.
5. Verify the release-prep edits before tagging. At minimum, run `npm run typecheck` and any targeted tests needed for files touched during the release prep.
6. Create the git tag only after the changelog, screenshot, and version bump are all committed-ready.

## Version Format

- `package.json` uses plain semver like `1.2.0`.
- Git tags use a `v` prefix like `v1.2.0`.
