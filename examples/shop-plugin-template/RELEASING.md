# Releases

CI runs on pull requests, main and manual dispatch. Release images are published to
`ghcr.io/harmellis/gms-shop-plugin-template` using the workflow's short-lived `GITHUB_TOKEN`; no registry
password or retailer credentials belong in GitHub secrets.

## Stable release

1. Review changes since the previous version and update `CHANGELOG.md` with a dated
   version section and Added/Changed/Fixed notes as appropriate.
2. Run `npm version X.Y.Z --no-git-tag-version` to update both package manifests.
3. Run the documented test scripts, commit, merge a PR into main, and wait for green
   **CI on that exact main commit**.
4. After explicit owner approval, tag that commit `vX.Y.Z` and push the tag.
5. The release workflow rechecks CI, package version and main ancestry, publishes
   `X.Y.Z`, `latest`, `X` and `X.Y`.
6. After the image workflow succeeds, manually create a draft GitHub release
   using the changelog notes (`gh release create vX.Y.Z --verify-tag --draft
   --latest=false --notes-file release-notes.md`). Review it before publishing.

## Prerelease

Use `npm version X.Y.Z-rc.N --no-git-tag-version` (or `alpha.N`/`beta.N`). Run tests,
commit and push a feature branch with a PR, or manually dispatch CI for that branch.
Wait for successful CI on the exact commit, request owner approval, then push
`vX.Y.Z-rc.N`. It may be outside main. Only the exact image version is published:
**never latest, major or minor aliases**. After the image workflow succeeds,
manually create the draft with `gh release create vX.Y.Z-rc.N --verify-tag --draft
--prerelease --latest=false --notes-file release-notes.md`. Increment N rather than
moving an existing tag.

No release is created just by merging code. Tag publication is an explicit final
step. Re-dispatch publication with an existing tag to recover a failed build.
Images currently target linux/amd64, avoiding extra runner minutes; add an arm64
job after validating the adapter there if needed.

GHCR packages start private. For a public template's first image, explicitly set
package visibility to public in GitHub package settings. Keep private adapters and
their packages private. Connect the package to its repository and inherit access.

## Cost control

Standard Linux Actions runners are free for public repositories. Private repositories
use the owner's monthly included quota (GitHub Free: 2,000 minutes; Pro: 3,000).
Over-quota usage can be charged if the account has a payment method. GHCR container
storage and bandwidth are currently free. Check the owner's billing dashboard and
spending budgets; this project does not enable paid usage or change those budgets.
Workflows use standard runners and no uploaded artifacts or Actions build caches.

Sources: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
and [Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages).
