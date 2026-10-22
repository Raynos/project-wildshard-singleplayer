#!/usr/bin/env bash
# D9: the one commit entry. Only named files; serialize Git's shared files.
# Usage: scripts/commit.sh "subject and body" -- path/to/file ...
set -euo pipefail
[ -z "${GIT_INDEX_FILE:-}" ] || { echo 'commit.sh: private indexes are retired' >&2; exit 2; }
[ "$#" -ge 3 ] && [ "$2" = -- ] || { echo 'usage: scripts/commit.sh "message" -- <files...>' >&2; exit 2; }
message=$1; shift 2
cd "$(git rev-parse --show-toplevel)"
for path in "$@"; do
  case "$path" in .|:/|/*|../*|*:*|*\**|*\?*|*\[*) echo "commit.sh: name literal repository files: $path" >&2; exit 2 ;; esac
  [ ! -d "$path" ] || { echo "commit.sh: name files, not directories: $path" >&2; exit 2; }
done
common="$(git rev-parse --path-format=absolute --git-common-dir)"
exec lockf -k -t 120 "$common/commit.lock" bash -c '
  message=$1; shift
  for path in "$@"; do
    git ls-files --error-unmatch -- "$path" >/dev/null 2>&1 || git add -N -- "$path"
  done
  export WS_COMMIT_WRAPPER=1
  exec git commit -q -m "$message" -- "$@"
' commit.sh "$message" "$@"
