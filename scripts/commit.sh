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
# Checks own a detached index/HEAD view. Only freshness, Git completion and
# alignment hold the shared commit lease; every failed proof is discarded.
exec python3 - "$common" "$message" "$patch" "$@" <<'PYCOMMIT'
import fcntl, hashlib, json, os, runpy, shutil, signal, subprocess, sys, tempfile, time
from pathlib import Path
common, message, patch, *paths = sys.argv[1:]
started = time.monotonic()
waiting = acquired = released = None
os.environ["WS_COMMIT_STARTED_AT"] = str(int(time.time() * 1000))
os.environ["WS_COMMIT_MESSAGE"] = message
os.environ["WS_COMMIT_WRAPPER"] = "1"
base_env = dict(os.environ)
def git(*args, env=None, **kwargs):
    return subprocess.check_output(["git", *args], env=env or base_env, **kwargs)
def refuse(message):
    raise SystemExit("commit.sh: " + message)
def timeout(*_):
    refuse("commit lock timed out")
# The final pre-commit dispatcher consumes this invocation's completed proof.
# It runs again inside Git, so candidate mutation between the lock check and
# Git's own pre-commit boundary also refuses. No reusable skip switch exists.
verify = r"""import hashlib, json, os, subprocess, sys
from pathlib import Path
proof = json.loads(Path(sys.argv[1]).read_text())
def git(*args, env=None):
    return subprocess.check_output(['git', *args], env=env)
def working(name):
    path = Path(name)
    if path.is_symlink():
        return ['symlink', os.readlink(path)]
    if not path.exists():
        return None
    return [path.stat().st_mode & 0o777, hashlib.sha256(path.read_bytes()).hexdigest()]
def hooks():
    path = Path(proof['hooks'])
    return {file.name: [file.stat().st_mode & 0o777, hashlib.sha256(file.read_bytes()).hexdigest()]
            for file in path.iterdir() if file.is_file()} if path.is_dir() else {}
shared = dict(os.environ)
for key in ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE']:
    shared.pop(key, None)
shared.pop('GIT_CONFIG_PARAMETERS', None)
if proof['configParameters'] is not None:
    shared['GIT_CONFIG_PARAMETERS'] = proof['configParameters']
checks = [
    (git('rev-parse', 'HEAD').decode().strip() == proof['parent'], 'HEAD changed during checks'),
    (git('write-tree').decode().strip() == proof['tree'], 'candidate index changed during checks'),
    (git('ls-files', '--stage', '-z', '--', *proof['paths'], env=shared).hex() == proof['staged'], 'named stages changed during checks'),
    ({name: working(name) for name in proof['paths']} == proof['working'], 'named working inputs changed during checks'),
    (hooks() == proof['hookFiles'], 'hook source changed during checks'),
    (git('rev-parse', '--path-format=absolute', '--git-path', 'hooks', env=shared).decode().strip() == proof['hooks'], 'hook configuration changed during checks'),
]
for valid, reason in checks:
    if not valid:
        sys.exit('commit.sh: ' + reason + '; rerun against fresh inputs')
"""
try:
    validator = ".githooks/commit-msg-conventions"
    if os.path.isfile(validator):
        error = runpy.run_path(validator)["validate"](message, human=os.getenv("SKIP_ATTRIB") == "1")
        if error:
            refuse(error)
    with tempfile.TemporaryDirectory(prefix="commit-patch.", dir=common) as temporary:
        scratch = Path(temporary)
        parent = git("rev-parse", "HEAD").decode().strip()
        index = scratch / "index"
        shutil.copyfile(Path(common) / "index", index)
        candidate_env = {**base_env, "GIT_INDEX_FILE": str(index)}
        git("read-tree", "--reset", parent, env=candidate_env)
        entries = git("ls-files", "-z", env=candidate_env)
        for flag in ["--no-assume-unchanged", "--no-skip-worktree", "--no-fsmonitor-valid"]:
            git("update-index", flag, "-z", "--stdin", input=entries, env=candidate_env)
        staged = git("ls-files", "--stage", "-z", "--", *paths).hex()
        # Freeze working bytes before staging; Git must stage precisely that view.
        def working(name):
            path = Path(name)
            if path.is_symlink():
                return ["symlink", os.readlink(path)]
            if not path.exists():
                return None
            return [path.stat().st_mode & 0o777, hashlib.sha256(path.read_bytes()).hexdigest()]
        working_inputs = {name: working(name) for name in paths}
        if patch:
            git("apply", "--cached", "--", patch, env=candidate_env)
        else:
            git("add", "-A", "--", *paths, env=candidate_env)
        changed = git("diff", "--cached", "--name-only", "--no-renames", "-z", parent, env=candidate_env).split(b"\0")
        for name in changed:
            if name and os.fsdecode(name) not in paths:
                refuse("candidate changes undeclared path: " + os.fsdecode(name))
        tree = git("write-tree", env=candidate_env).decode().strip()
        hooks = Path(git("rev-parse", "--path-format=absolute", "--git-path", "hooks").decode().strip())
        hook_files = {file.name: [file.stat().st_mode & 0o777, hashlib.sha256(file.read_bytes()).hexdigest()]
                      for file in hooks.iterdir() if file.is_file()} if hooks.is_dir() else {}
        read_set = scratch / "reads.jsonl"
        proof = scratch / "proof.json"
        proof.write_text(json.dumps(dict(parent=parent, tree=tree, paths=paths, staged=staged,
            working=working_inputs, hooks=str(hooks), hookFiles=hook_files,
            configParameters=base_env.get("GIT_CONFIG_PARAMETERS"))))
        verifier = scratch / "verify.py"
        verifier.write_text(verify)
        # HEAD is pinned for every Git reader while other lanes advance main.
        # Objects/config remain shared; no checkout, branch or ref is created.
        view = scratch / "view"
        view.mkdir()
        (view / "HEAD").write_text(parent + "\n")
        (view / "commondir").write_text(common + "\n")
        check_env = {**candidate_env, "GIT_DIR": str(view), "GIT_COMMON_DIR": common,
                     "GIT_WORK_TREE": os.getcwd(), "GIT_EDITOR": ":", "WS_COMMIT_READ_SET": str(read_set)}
        code = subprocess.run(["git", "hook", "run", "--ignore-missing", "pre-commit"], env=check_env).returncode
        if code:
            raise SystemExit(code)
        # Keep all remaining hooks (message policy, signing and post-commit)
        # on Git's normal path. Only pre-commit consumes the already-run proof.
        dispatch = scratch / "hooks"
        dispatch.mkdir()
        for file in hooks.iterdir() if hooks.is_dir() else []:
            if file.name not in ("pre-commit", "commit-msg") and file.is_file():
                (dispatch / file.name).symlink_to(file.resolve())
        hook = dispatch / "pre-commit"
        hook.write_text("#!/usr/bin/env python3\n" + verify.replace("sys.argv[1]", repr(str(proof))))
        hook.chmod(0o755)
        message_hook = dispatch / "commit-msg"
        message_hook.write_text("#!/usr/bin/env python3\nimport os, subprocess, sys\n"
            + "original = " + repr(str(hooks / "commit-msg")) + "\n"
            + "if os.access(original, os.X_OK):\n"
            + "    code = subprocess.run([original, *sys.argv[1:]]).returncode\n"
            + "    if code: sys.exit(code)\n"
            + verify.replace("sys.argv[1]", repr(str(proof))))
        message_hook.chmod(0o755)
        signal.signal(signal.SIGALRM, timeout)
        signal.alarm(120)
        with open(Path(common) / "commit.lock", "a") as lease:
            print("commit.sh: waiting for commit lock", flush=True)
            waiting = time.monotonic()
            fcntl.flock(lease, fcntl.LOCK_EX)
            acquired = time.monotonic()
            signal.alarm(0)
            try:
                latest = git("rev-parse", "HEAD").decode().strip()
                if latest != parent:
                    inputs = set(paths)
                    inventory = False
                    budget = False
                    imports = {}
                    if read_set.exists():
                        for line in read_set.read_text().splitlines():
                            row = json.loads(line)
                            if row["root"] == os.getcwd():
                                inputs.update(row["paths"])
                                inventory = inventory or row.get("inventory", False)
                                budget = budget or row.get("budget", False)
                                imports.update(row.get("imports", {}))
                    elif (hooks / "pre-commit").is_file():
                        # Unknown hooks have no narrower declared read set.
                        inputs.update(os.fsdecode(name) for name in git("ls-tree", "-rz", "--name-only", parent).split(b"\0") if name)
                    moved = {os.fsdecode(name) for name in git("diff", "--name-only", "--no-renames", "-z", parent, latest).split(b"\0") if name}
                    overlap = sorted(moved & inputs)
                    if inventory:
                        membership = {os.fsdecode(name) for name in git("diff", "--name-only", "--no-renames", "--diff-filter=AD", "-z", parent, latest).split(b"\0") if name}
                        overlap = sorted(set(overlap) | {name for name in membership if name.startswith(("src/", "test/", "scripts/"))})
                    if overlap:
                        refuse("checked inputs changed: " + ", ".join(overlap[:8]) + "; rerun against fresh inputs")
                    syntax = {name: dict(before=imports[name], source=git("show", latest + ":" + name).decode())
                              for name in sorted(moved & imports.keys())}
                    if syntax:
                        program = """import {readFileSync} from 'node:fs';
import ts from '@typescript/typescript6';
const rows=JSON.parse(readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(Object.entries(rows).filter(([,row])=>JSON.stringify(row.before)!==
JSON.stringify(ts.preProcessFile(row.source,true,true).importedFiles.map(file=>file.fileName))).map(([name])=>name)));"""
                        changed_imports = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", program],
                            input=json.dumps(syntax).encode(), env=base_env))
                        if changed_imports:
                            refuse("checked import graph changed: " + ", ".join(changed_imports[:8]) + "; rerun against fresh inputs")
                    if budget:
                        # Push-size guards read pending binary history as well
                        # as this delta. Freshness must include a peer's newly
                        # counted bytes when this commit also contributes bytes.
                        program = """import {readFileSync} from 'node:fs';
import {isRuntime,isText} from './scripts/repo-size.mjs';
const row=JSON.parse(readFileSync(0,'utf8')),counted=name=>!isRuntime(name)&&!isText(name);
process.stdout.write(JSON.stringify(row.paths.some(counted)?row.moved.filter(counted):[]));"""
                        counted = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", program],
                            input=json.dumps(dict(paths=paths, moved=sorted(moved))).encode(), env=base_env))
                        if counted:
                            refuse("storage inputs changed: " + ", ".join(counted[:8]) + "; rerun against fresh inputs")
                    delta = git("diff", "--binary", "--no-renames", parent, tree)
                    git("read-tree", "--reset", latest, env=candidate_env)
                    git("apply", "--cached", "--binary", "-", input=delta, env=candidate_env)
                    fresh = json.loads(proof.read_text())
                    fresh["parent"] = latest
                    fresh["tree"] = git("write-tree", env=candidate_env).decode().strip()
                    proof.write_text(json.dumps(fresh))
                    print("commit.sh: fresh inputs; retain disjoint peer commits", flush=True)
                subprocess.run([sys.executable, str(verifier), str(proof)], env=candidate_env, check=True)
                result = subprocess.run(["git", "-c", "core.hooksPath=" + str(dispatch), "commit", "-q", "-m", message], env=candidate_env)
                if result.returncode:
                    raise SystemExit(result.returncode)
                landed = git("rev-parse", "HEAD").decode().strip()
                subprocess.run(["bash", "-c", 'align_shared_index "$@"', "commit.sh", common, parent, landed, *paths], env=base_env, check=True)
            finally:
                released = time.monotonic()
        raise SystemExit(0)
except subprocess.CalledProcessError as error:
    raise SystemExit(error.returncode)
finally:
    finished = time.monotonic()
    elapsed = (finished - started) * 1000
    wait = 0 if waiting is None else ((finished if acquired is None else acquired) - waiting) * 1000
    hold = 0 if acquired is None else ((released or finished) - acquired) * 1000
    work = elapsed - wait
    print(f"commit.sh: {wait:.0f} ms lock wait; {hold:.0f} ms lock held; {work - hold:.0f} ms outside lock", flush=True)
    print(f"commit.sh: {elapsed:.0f} ms total wall (lock wait included)", flush=True)
    exception = sys.exc_info()[1]
    code = exception.code if isinstance(exception, SystemExit) else None
    code = code if code is None or isinstance(code, int) else 1
    timing = {"version": 1, "id": str(os.getpid()) + ":" + os.environ["WS_COMMIT_STARTED_AT"],
              "at": time.time(), "elapsedMs": round(elapsed), "waitMs": round(wait),
              "workMs": round(work), "lockMs": round(hold), "exitCode": code,
              "lane": os.getenv("WS_COMMIT_LANE") or os.getenv("HERDR_PANE_ID")}
    try:
        with open(Path(common) / "commit-times.jsonl", "a") as ledger:
            ledger.write(json.dumps(timing, separators=(",", ":")) + "\n")
    except OSError as error:
        print("commit.sh: timing log unavailable: " + str(error), file=sys.stderr)
    if elapsed > 60000:
        print("commit.sh: invocation exceeded 60 s; CF1 cannot renew its budget (serialized Git completion remains mandatory)", file=sys.stderr)
PYCOMMIT
