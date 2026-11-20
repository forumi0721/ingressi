# Downstream upstream maintenance

This fork tracks `ingres-si/ingressi`'s `develop` branch. **Upstream sync**
runs every six hours (GitHub may delay scheduled runs) and supports manual
execution from Actions. It uses only the built-in `GITHUB_TOKEN`; no PAT,
Copilot subscription, or AI credits are required.

## Merge behavior

The workflow fetches upstream and prepares a normal merge with
`.upstream/merge.sh`. The fork owns `.github/workflows/**`: its existing
workflows and intentional deletions are preserved, and new upstream workflows
are not enabled automatically. Review upstream CI changes separately when
updating this fork's build or test configuration.

Changes elsewhere merge normally. Code conflicts abort the merge and fail
the workflow. The workflow keeps a single open **Resolve upstream merge
conflict** issue for investigation; an existing issue never suppresses failure
or skips a subsequent sync attempt. There is no automatic AI conflict resolver.
Preserve the Host Network Mode behavior in `.upstream/protected-features.md`
when resolving conflicts manually. The broader review policy in
`.upstream/policy.yml` and its checker remain tools for manual review; this
workflow does not claim to run the full release validation pipeline.

Successful merges are pushed without force. Concurrent branch updates reject
the push and leave a failed run for investigation; rerun to use the latest
branch. A scheduled no-op run creates no commit and starts no image build. A manual
run also requests a build, so it can retry a failed build dispatch.

After a changed sync, the workflow explicitly dispatches
`docker-build-trusted.yml`, because pushes using `GITHUB_TOKEN` do not start
push workflows. The image build has its own status; sync success means the
merge was pushed and its build was requested, not that image publishing
completed. Existing sync issues close only after all preceding steps succeed.
No releases or tags are created.

## Repository setup and verification

- Enable Actions and allow this workflow to write Contents, Actions, and Issues.
- Branch rules must permit the Actions bot to push to `develop`; if reviews
  are mandatory, use a reviewed merge instead of bypassing those rules.
- Run `bash tests/custom/upstream-sync.sh` to verify merge behavior locally.
- Run **Actions → Upstream sync → Run workflow** on `develop` after deployment.
  Check the sync summary, upstream commit ancestry, and the separate Docker
  build result. A red run requires investigation even when an issue exists.

Trusted GHCR builds use the build job's `packages: write` permission. No
additional GHCR token is required; grant this repository access to its package.
