# Agent instructions

All published text must be English. Keep retailer credentials and runtime `/data`
out of Git. Use documented npm scripts for validation.

Release prep: follow [RELEASING.md](RELEASING.md). Update changelog and both package
versions for stable releases. Prereleases skip the stable changelog section, use an
incrementing semver suffix and never own moving Docker tags. Complete validation
and commit prep before asking for release approval. Do not push any version tag
without explicit owner approval. Stable tags must reference main and successful CI
on the exact commit; prereleases also require successful exact-commit CI. Do not
publish draft releases automatically.
