#!/usr/bin/env bash
set -euo pipefail
script="$(cd "$(dirname "$0")/../.." && pwd)/.upstream/merge.sh"
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
# Commits exist only in this disposable fixture, never in the project checkout.
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.com
cd "$fixture"
git init -q --initial-branch=base
git config commit.gpgsign false
mkdir -p .github/workflows
printf 'base\n' > app.txt
printf 'base\n' > .github/workflows/test.yml
printf 'base\n' > .github/workflows/build.yml
git add .
git commit -qm base
git checkout -qb upstream
printf 'upstream\n' > app.txt
printf 'upstream\n' > .github/workflows/test.yml
printf 'upstream\n' > .github/workflows/build.yml
printf 'upstream\n' > .github/workflows/new.yml
git add .
git commit -qm upstream
git checkout -qb downstream base
git rm -q .github/workflows/test.yml
printf 'custom\n' > .github/workflows/build.yml
printf 'custom\n' > custom.txt
git add .
git commit -qm downstream
bash "$script" upstream
[ -f .git/MERGE_HEAD ]
[ "$(cat app.txt)" = upstream ]
[ "$(cat custom.txt)" = custom ]
[ "$(cat .github/workflows/build.yml)" = custom ]
[ ! -e .github/workflows/test.yml ]
[ ! -e .github/workflows/new.yml ]
[ -z "$(git diff --name-only --diff-filter=U)" ]
[ -z "$(git diff --cached --name-only -- .github/workflows)" ]
git commit -qm synchronized
git merge-base --is-ancestor upstream HEAD
before=$(git rev-parse HEAD)
bash "$script" upstream
[ "$before" = "$(git rev-parse HEAD)" ]
[ ! -e .git/MERGE_HEAD ]
[ -z "$(git status --porcelain)" ]
echo 'PASS: code sync, workflow preservation, ancestry, repeated no-op'

git checkout -qb conflict base
printf 'downstream\n' > app.txt
git add app.txt
git commit -qm conflict
before=$(git rev-parse HEAD)
if bash "$script" upstream; then
  echo 'Expected code conflict failure' >&2; exit 1
fi
[ "$before" = "$(git rev-parse HEAD)" ]
[ ! -e .git/MERGE_HEAD ]
[ -z "$(git status --porcelain)" ]
[ "$(cat app.txt)" = downstream ]
echo 'PASS: unresolved code conflict fails and aborts without data loss'

printf 'dirty\n' > untracked.txt
if bash "$script" upstream; then
  echo 'Expected dirty checkout failure' >&2; exit 1
fi
[ "$(cat untracked.txt)" = dirty ]
rm untracked.txt
if bash "$script" missing-ref; then
  echo 'Expected invalid reference failure' >&2; exit 1
fi
echo 'PASS: dirty checkout and invalid reference rejected'

# Even when only ignored CI files changed upstream, record its ancestry.
git checkout -qb workflow-only base
printf 'changed\n' > .github/workflows/test.yml
git add .
git commit -qm workflow-only
git checkout -qb tree-identical base
bash "$script" workflow-only
[ -f .git/MERGE_HEAD ]
[ -z "$(git diff --cached --name-only)" ]
git commit -qm synchronized-workflow-only
git merge-base --is-ancestor workflow-only HEAD
echo 'PASS: workflow-only updates record ancestry with an unchanged tree'
