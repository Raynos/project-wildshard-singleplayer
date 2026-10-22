#!/usr/bin/env bash
# D9: the one commit entry. Only named files; serialize Git's shared files.
# Usage: scripts/commit.sh [--patch file.patch] "message" -- files...
set -euo pipefail
[ -z "${GIT_INDEX_FILE:-}" ] || { echo 'commit.sh: private indexes are retired' >&2; exit 2; }
patch=''
if [ "${1:-}" = --patch ]; then
  [ "$#" -ge 5 ] || { echo 'usage: commit.sh --patch file.patch "message" -- <files...>' >&2; exit 2; }
  patch="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
  [ -r "$patch" ] || { echo "commit.sh: unreadable patch: $patch" >&2; exit 2; }
  shift 2
fi
[ "$#" -ge 3 ] && [ "$2" = -- ] || { echo 'usage: scripts/commit.sh "message" -- <files...>' >&2; exit 2; }
message=$1; shift 2
cd "$(git rev-parse --show-toplevel)"
for path in "$@"; do
  case "$path" in .|:/|/*|../*|*:*|*\**|*\?*|*\[*) echo "commit.sh: name literal repository files: $path" >&2; exit 2 ;; esac
  [ ! -d "$path" ] || { echo "commit.sh: name files, not directories: $path" >&2; exit 2; }
done
common="$(git rev-parse --path-format=absolute --git-common-dir)"
exec lockf -k -t 120 "$common/commit.lock" bash -c '
  set -euo pipefail
  message=$1; patch=$2; common=$3; shift 3
  export WS_COMMIT_WRAPPER=1
  if [ -n "$patch" ]; then
    index=$(mktemp "$common/commit-patch.XXXXXX")
    rm -f "$index"
    export GIT_INDEX_FILE="$index"
    trap '\''rm -f "$GIT_INDEX_FILE" "$GIT_INDEX_FILE.lock"'\'' EXIT
    git read-tree HEAD
    git apply --cached -- "$patch"
    while IFS= read -r -d "" changed; do
      allowed=0
      for path in "$@"; do [ "$path" != "$changed" ] || allowed=1; done
      [ "$allowed" = 1 ] || { echo "commit.sh: patch changes undeclared path: $changed" >&2; exit 2; }
    done < <(git diff --cached --name-only -z)
    git commit -q -m "$message"
    exit
  fi
  for path in "$@"; do
    git ls-files --error-unmatch -- "$path" >/dev/null 2>&1 || git add -N -- "$path"
  done
  exec git commit -q -m "$message" -- "$@"
' commit.sh "$message" "$patch" "$common" "$@"
