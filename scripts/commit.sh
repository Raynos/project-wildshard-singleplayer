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
# Advance untouched parent copies under the commit lock; stages use the index lock.
align_shared_index() {
  python3 - "$@" <<'PYALIGN'
import os, subprocess, sys
from pathlib import Path
common, parent, landed, *paths = sys.argv[1:]
env = dict(os.environ)
env.pop("GIT_INDEX_FILE", None)
def git(*args, **kwargs):
    return subprocess.check_output(["git", *args], env=env, **kwargs)
def tree(revision):
    return {path: mode + b" " + oid + b" 0" for record in git("ls-tree", "-rz", revision, "--", *paths).split(b"\0") if record
            for metadata, path in [record.split(b"\t", 1)] for mode, _, oid in [metadata.split()]}
before, after = tree(parent), tree(landed)
def contents(row):
    return None if row is None else git("cat-file", "blob", row.split()[1].decode())
def working(path):
    if path.is_symlink() or any(part.is_symlink() for part in path.parents):
        raise ValueError("symlink path")
    if not path.exists():
        return None
    if not path.is_file():
        raise ValueError("non-file path")
    return path.read_bytes()
advanced = 0
for name in paths:
    key, path = os.fsencode(name), Path(name)
    previous, current = before.get(key), after.get(key)
    if previous == current:
        continue
    temporary = None
    try:
        if any(row is not None and row.split()[0] not in (b"100644", b"100755") for row in (previous, current)):
            raise ValueError("unsupported Git mode")
        expected, desired = contents(previous), contents(current)
        actual = working(path)
        if actual == desired and (current is None or path.stat().st_mode & 0o777 == (0o755 if current.split()[0] == b"100755" else 0o644)):
            continue
        if actual != expected:
            raise ValueError("local edits")
        if desired is None:
            # Recheck immediately before changing this exact declared path.
            if working(path) != expected:
                raise ValueError("concurrent edits")
            path.unlink()
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            import tempfile
            descriptor, temporary = tempfile.mkstemp(prefix=".commit-next-", dir=path.parent)
            with os.fdopen(descriptor, "wb") as output:
                output.write(desired)
            os.chmod(temporary, 0o755 if current.split()[0] == b"100755" else 0o644)
            if working(path) != expected:
                raise ValueError("concurrent edits")
            os.replace(temporary, path)
        advanced += 1
    except (OSError, ValueError) as error:
        print(f"commit.sh: preserve working edits: {name} ({error})", file=sys.stderr)
    finally:
        if temporary is not None:
            Path(temporary).unlink(missing_ok=True)
if advanced:
    print(f"commit.sh: advanced {advanced} untouched working paths")
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
export WS_COMMIT_MESSAGE="$message"
exec python3 -c '
import fcntl, os, signal, subprocess, sys, time
started = time.monotonic()
acquired = None
os.environ["WS_COMMIT_STARTED_AT"] = str(int(time.time() * 1000))
def timeout(*_):
    raise SystemExit("commit.sh: commit lock timed out")
signal.signal(signal.SIGALRM, timeout)
signal.alarm(120)
try:
    with open(sys.argv[1], "a") as lease:
        print("commit.sh: waiting for commit lock", flush=True)
        fcntl.flock(lease, fcntl.LOCK_EX)
        acquired = time.monotonic()
        signal.alarm(0)
        validator = ".githooks/commit-msg-conventions"
        if os.path.isfile(validator):
            import runpy
            error = runpy.run_path(validator)["validate"](
                os.environ["WS_COMMIT_MESSAGE"], human=os.getenv("SKIP_ATTRIB") == "1")
            if error:
                print("Commit blocked: " + error, file=sys.stderr)
                raise SystemExit(1)
        raise SystemExit(subprocess.run(sys.argv[2:]).returncode)
finally:
    finished = time.monotonic()
    elapsed = (finished - started) * 1000
    wait = ((finished if acquired is None else acquired) - started) * 1000
    work = 0 if acquired is None else (finished - acquired) * 1000
    print(f"commit.sh: {wait:.0f} ms lock wait; {work:.0f} ms serialized work", flush=True)
    print(f"commit.sh: {elapsed:.0f} ms total wall (lock wait included)", flush=True)
    if elapsed > 60000:
        print("commit.sh: invocation exceeded 60 s; CF1 cannot renew its budget (serialized Git completion remains mandatory)", file=sys.stderr)
' "$common/commit.lock" bash -c '
  set -euo pipefail
  message=$1; patch=$2; common=$3; shift 3
  export WS_COMMIT_WRAPPER=1
  export WS_COMMIT_MESSAGE="$message"
  if [ -n "$patch" ]; then
    index=$(mktemp "$common/commit-patch.XXXXXX")
    # Seed only metadata; read-tree below resets every candidate blob to HEAD.
    cp "$common/index" "$index"
    export GIT_INDEX_FILE="$index"
    trap '\''rm -f "$GIT_INDEX_FILE" "$GIT_INDEX_FILE.lock"'\'' EXIT
    parent=$(git rev-parse HEAD)
    git read-tree --reset "$parent"
    # Hidden working-tree flags must not suppress exact candidate checks.
    git ls-files -z | git update-index --no-assume-unchanged -z --stdin
    git ls-files -z | git update-index --no-skip-worktree -z --stdin
    git ls-files -z | git update-index --no-fsmonitor-valid -z --stdin
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
