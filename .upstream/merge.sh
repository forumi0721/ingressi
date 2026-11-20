#!/usr/bin/env bash
# Prepare an upstream merge without committing or pushing. Run in a clean checkout.
set -euo pipefail
upstream_ref="${1:?usage: merge.sh UPSTREAM_REF}"
if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to merge into a dirty checkout." >&2
  exit 1
fi
git rev-parse --verify "${upstream_ref}^{commit}" >/dev/null
if git merge-base --is-ancestor "$upstream_ref" HEAD; then
  echo "Already synchronized with $upstream_ref."
  exit 0
fi
merge_status=0
git -c core.hooksPath=/dev/null merge --no-commit --no-ff "$upstream_ref" || merge_status=$?
# This fork owns its CI configuration. Keep deletions and custom workflows,
# including when upstream modifies a workflow that the fork has removed.
if git rev-parse --verify -q MERGE_HEAD >/dev/null; then
  git rm -r -f --ignore-unmatch -- .github/workflows
  git restore --source=HEAD --staged --worktree -- .github/workflows
else
  echo "Upstream merge did not enter a merge state (exit $merge_status)." >&2
  exit 1
fi
conflicts="$(git diff --name-only --diff-filter=U)"
if [ -n "$conflicts" ]; then
  printf 'Unresolved upstream conflicts:\n%s\n' "$conflicts" >&2
  git merge --abort
  exit 1
fi
# A merge commit is required even if its tree matches HEAD, to record ancestry.
echo "Upstream merge prepared; downstream workflows preserved."
