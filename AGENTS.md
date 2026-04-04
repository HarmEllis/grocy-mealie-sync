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
3. Bump the app version in `package.json` to the new release version. Keep `package-lock.json` in sync as well, including its top-level `version` and the root package entry at `packages[""].version` when those mirrored fields change.
4. Generate a fresh docs screenshot with `npm run docs:screenshot` and include the updated `docs/images/app-dashboard.png` in the release changes.
5. Verify Drizzle migration completeness before tagging:
   - run `npm run db:generate`
   - if it generates new files or updates under `drizzle/`, review them, keep the generated migration artifacts, and do not tag until there are no missing schema migrations left to generate
6. Verify the database upgrade path from `<previous-tag>` to the release candidate:
   - create or migrate a database with the code at `<previous-tag>` in a temporary, non-destructive setup such as a separate git worktree
   - run the current code against that same database and confirm the app's startup migrations complete successfully
   - add or update targeted migration coverage when needed so release prep tests the specific upgrade path introduced since `<previous-tag>`
7. Verify the release-prep edits before tagging. At minimum, run `npm run typecheck`, `npm test`, `npm test -- src/lib/db/__tests__/migrations.test.ts`, and any targeted tests needed for files touched during the release prep.
8. Create the git tag only after the changelog, screenshot, version bump, and migration verification are all committed-ready.
9. As the final release step, ask the user whether to push the release.
   - only proceed when the user explicitly approves the push
   - when approved, push the release commit to `main` first, but do not push the new `v<x.y.z>` tag yet
   - wait for the `CI` workflow for that exact release commit on `main` to complete successfully before pushing the tag
   - if the `CI` workflow fails, is cancelled, or never reaches a successful conclusion, stop and do not push the tag or create the GitHub draft release
   - only after that successful `CI` run may the new `v<x.y.z>` tag be pushed to the remote
   - after the push succeeds, create or update a GitHub draft release for `v<x.y.z>` using the new changelog section as the release notes body, but omit the `## [x.y.z] - YYYY-MM-DD` heading from the body itself
   - keep the short introductory summary paragraph from the changelog section at the top of the GitHub release notes body, before any `### Added`, `### Changed`, or `### Fixed` headings
   - always end the GitHub release notes with `**Full Changelog**: https://github.com/HarmEllis/grocy-mealie-sync/compare/<previous-tag>...v<x.y.z>`
   - if any push, GitHub CLI auth, or GitHub release command fails in a way that may be caused by sandbox/network restrictions, retry that command with escalated permissions before concluding that auth or connectivity is actually broken
   - prefer validating `gh` authentication and running the GitHub release command outside the sandbox when the first sandboxed attempt is inconclusive or reports credential/network problems
   - if the user does not approve, stop after the local release commit/tag and report that the release has not been pushed or drafted on GitHub

## Version Format

- `package.json` uses plain semver like `1.2.0`.
- Git tags use a `v` prefix like `v1.2.0`.
