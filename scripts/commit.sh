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
# Advance untouched shared stages while holding Git's own index lock.
align_shared_index() {
  python3 - "$@" <<'PYALIGN'
import os, subprocess, sys
from pathlib import Path
common, parent, landed, *paths = sys.argv[1:]
env = dict(os.environ)
env.pop("GIT_INDEX_FILE", None)
index = Path(common) / "index"
lock = Path(str(index) + ".lock")
try:
    handle = lock.open("xb")
except FileExistsError:
    print("commit.sh: shared index busy; committed patch left unchanged", file=sys.stderr)
    raise SystemExit(0)
try:
    with handle:
        handle.write(index.read_bytes())
    env["GIT_INDEX_FILE"] = str(lock)
    def git(*args, **kwargs):
        return subprocess.check_output(["git", *args], env=env, **kwargs)
    def tree(revision):
        return {path: mode + b" " + oid + b" 0" for record in git("ls-tree", "-rz", revision, "--", *paths).split(b"\0") if record
                for metadata, path in [record.split(b"\t", 1)] for mode, _, oid in [metadata.split()]}
    before, after = tree(parent), tree(landed)
    staged = {}
    for record in git("ls-files", "--stage", "-z", "--", *paths).split(b"\0"):
        if record:
            metadata, path = record.split(b"\t", 1)
            staged.setdefault(path, []).append(metadata)
    updates = []
    for name in paths:
        path = os.fsencode(name)
        if staged.get(path, []) != ([] if path not in before else [before[path]]):
            continue
        row = after.get(path, b"0 " + b"0" * 40 + b" 0")
        updates.append(row + b"\t" + path + b"\0")
    if updates:
        git("update-index", "-z", "--index-info", input=b"".join(updates))
        os.replace(lock, index)
finally:
    lock.unlink(missing_ok=True)
PYALIGN
}
export -f align_shared_index
exec python3 -c '
import fcntl, signal, subprocess, sys
def timeout(*_):
    raise SystemExit("commit.sh: commit lock timed out")
signal.signal(signal.SIGALRM, timeout)
signal.alarm(120)
with open(sys.argv[1], "a") as lease:
    fcntl.flock(lease, fcntl.LOCK_EX)
    signal.alarm(0)
    raise SystemExit(subprocess.run(sys.argv[2:]).returncode)
' "$common/commit.lock" bash -c '
  set -euo pipefail
  message=$1; patch=$2; common=$3; shift 3
  export WS_COMMIT_WRAPPER=1
  if [ -n "$patch" ]; then
    index=$(mktemp "$common/commit-patch.XXXXXX")
    rm -f "$index"
    export GIT_INDEX_FILE="$index"
    trap '\''rm -f "$GIT_INDEX_FILE" "$GIT_INDEX_FILE.lock"'\'' EXIT
    parent=$(git rev-parse HEAD)
    git read-tree "$parent"
    git apply --cached -- "$patch"
    while IFS= read -r -d "" changed; do
      allowed=0
      for path in "$@"; do [ "$path" != "$changed" ] || allowed=1; done
      [ "$allowed" = 1 ] || { echo "commit.sh: patch changes undeclared path: $changed" >&2; exit 2; }
    done < <(git diff --cached --name-only -z)
    git commit -q -m "$message"
    align_shared_index "$common" "$parent" "$(git rev-parse HEAD)" "$@"
    exit
  fi
  for path in "$@"; do
    git ls-files --error-unmatch -- "$path" >/dev/null 2>&1 || git add -N -- "$path"
  done
  exec git commit -q -m "$message" -- "$@"
' commit.sh "$message" "$patch" "$common" "$@"
