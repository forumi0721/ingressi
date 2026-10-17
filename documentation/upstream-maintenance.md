# Downstream upstream maintenance

This repository tracks `ingres-si/ingressi`'s `develop` branch. The daily
Upstream sync workflow compares it with this repository's default branch,
creates a sync branch, applies a merge, and opens a pull request. Merge
conflicts are offered to Copilot CLI on an isolated job. Copilot cannot publish
branches or releases; a separate job checks policy, types, tests, the
production build, and all three Docker images before requesting auto-merge.

## Required repository secrets

Add these under **Settings → Secrets and variables → Actions**:

- `UPSTREAM_SYNC_TOKEN`: a fine-grained token with this repository's Contents
  read/write, Pull requests read/write, Issues read/write, and Actions read
  permissions. It is used to create PRs and release tags. Using this token
  ensures the normal PR and tag workflows run; workflow-generated
  `GITHUB_TOKEN` pushes do not start other workflows.
- `COPILOT_GITHUB_TOKEN`: a fine-grained personal access token owned by the
  user account, with the `Copilot Requests` permission (`write`). In the
  token UI, choose `Public repositories` so this permission is available for
  this public repository. Required only when a merge conflict needs AI
  resolution. Copilot CLI use and billing must be enabled for the account.

Trusted GHCR image builds use the workflow's built-in `GITHUB_TOKEN` with the
job-scoped `packages: write` permission; no GHCR PAT or other repository
variables are required. Ensure the GHCR packages are associated with this
repository or grant this repository Actions access to them.

Keep the sync and Copilot credentials separate: the sync token can write
repository content and create pull requests, while the Copilot token should
only authorize Copilot requests. This setup uses a Copilot Requests token
because the target is a personal repository; organization billing would need
an organization-policy change and a corresponding workflow permission change.

## Before enabling unattended sync

1. Ensure GitHub Actions is enabled and that the token owner can push to the
   repository and create releases.
2. Configure branch protection for the default branch. Require the existing
   `Tests`, `E2E`, `Build Docker Images (PR)`, and `Dependency Review` checks
   if those checks are part of the release policy, and allow auto-merge. The
   controller also runs deterministic validation before calling the merge API.
3. Review `.upstream/policy.yml` and `.upstream/protected-features.md`. Changes
   to workflow, policy, agent instructions, or the listed Host Mode feature
   files stop for review. Changes over 100 files also stop.
4. Run **Actions → Upstream sync → Run workflow** manually before relying on
   the daily schedule.

Validated upstream merges receive tags in the form
`v<upstream-version>-custom.<sequence>`. The tag triggers the existing
multi-architecture build, signs images, uploads SBOM/provenance, and creates a
GitHub release only after image publishing succeeds. Custom releases also
update the moving `latest` image tag. Set `INGRESSI_IMAGE_PREFIX` in `.env` to
`ghcr.io/<your-owner>/ingressi` to deploy those images; the default remains the
upstream image prefix.

AI is used only to propose conflict resolutions. It cannot modify protected
automation or tests, and its output is not treated as evidence that checks
passed. This automation still executes upstream source in CI; Actions and
Copilot permissions should be limited to the intended repository.
