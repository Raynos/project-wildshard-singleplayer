#!/usr/bin/env python3
"""Manual real-Git regression: pin commits must not hydrate excluded assets."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT / 'scripts/commit.sh').read_text()
SCOPED = 'entries = git("ls-files", "-z", *(["--", *paths] if sparse_pin_only else []), env=candidate_env)'
assert SCRIPT.count(SCOPED) == 1, 'Negative control must match the current scoped operation'
OLD = SCRIPT.replace(SCOPED, 'entries = git("ls-files", "-z", env=candidate_env)')
MESSAGE = 'chore(release): fixture pin\n\nAssisted-by: Codex:gpt-6.1-sol'


def git(folder, *args, env=None):
    return subprocess.check_output(['git', *args], cwd=folder, env=env,
                                   stderr=subprocess.PIPE).decode().strip()


def blobs_present(folder, blobs):
    env = dict(os.environ, GIT_NO_LAZY_FETCH='1')
    return sum(subprocess.run(['git', 'cat-file', '-e', blob], cwd=folder, env=env,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
               for blob in blobs)


started = time.monotonic()
(ROOT / 'tmp').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='commit-sparse-proof.', dir=ROOT / 'tmp') as owned:
    base = Path(owned)
    seed = base / 'seed'
    seed.mkdir()
    git(seed, 'init', '-q', '-b', 'main')
    for key, value in [('user.name', 'Commit fixture'), ('user.email', 'fixture@example.invalid')]:
        git(seed, 'config', key, value)
    (seed / 'scripts').mkdir()
    (seed / 'scripts/commit.sh').write_text(SCRIPT)
    (seed / '.githooks').mkdir()
    hook = seed / '.githooks/pre-commit'
    hook.write_text('#!/usr/bin/env python3\nimport json, pathlib, subprocess\n'
                    'common = pathlib.Path(subprocess.check_output(["git", "rev-parse", "--git-common-dir"]).decode().strip())\n'
                    '(common / "hook-ran").write_text("checked")\n'
                    '(common / "hook-asset-flags").write_text(subprocess.check_output(["git", "ls-files", "-v", "--", "art/0.txt"]).decode())\n'
                    'raise SystemExit(0 if json.loads(pathlib.Path("engine.pin.json").read_text())["saveEpoch"] == 1 else 17)\n')
    hook.chmod(0o755)
    (seed / 'engine.pin.json').write_text(json.dumps({'saveEpoch': 1, 'commit': 'a' * 40}))
    (seed / 'peer.txt').write_text('published peer\n')
    (seed / 'art').mkdir()
    for i in range(12):
        (seed / 'art' / f'{i}.txt').write_text(str(i) + 'x' * 4096)
    git(seed, 'add', '.')
    git(seed, 'commit', '-qm', MESSAGE)
    remote = base / 'remote.git'
    git(base, 'clone', '-q', '--bare', str(seed), str(remote))
    git(remote, 'config', 'uploadpack.allowFilter', 'true')
    blobs = [git(seed, 'rev-parse', f'HEAD:art/{i}.txt') for i in range(12)]
    results = []
    for name in ['old', 'pin', 'hidden-peer-refusal', 'hook-refusal', 'two-named-files', 'non-sparse-pin']:
        folder = base / name
        git(base, 'clone', '-q', '--filter=blob:none', '--no-checkout', remote.as_uri(), str(folder))
        git(folder, 'sparse-checkout', 'set', '--no-cone', '/*', '!/art/')
        git(folder, 'checkout', '-q', 'main')
        if name == 'non-sparse-pin':
            # Retain manually hidden index entries, but remove sparse authority.
            git(folder, 'config', '--worktree', 'core.sparseCheckout', 'false')
            assert git(folder, 'config', '--bool', 'core.sparseCheckout') == 'false'
        for key, value in [('user.name', 'Commit fixture'), ('user.email', 'fixture@example.invalid'),
                           ('core.hooksPath', '.githooks')]:
            git(folder, 'config', key, value)
        assert blobs_present(folder, blobs) == 0
        if name == 'old':
            (folder / 'scripts/commit.sh').write_text(OLD)
        git(folder, 'update-index', '--assume-unchanged', '--skip-worktree', 'engine.pin.json')
        git(folder, 'update-index', '--assume-unchanged', 'art/0.txt')
        hidden_peer = name == 'hidden-peer-refusal'
        peer_name = 'peer.txt'
        peer = folder / peer_name
        peer.parent.mkdir(exist_ok=True)
        peer.write_text('staged peer\n')
        git(folder, 'add', '--sparse', peer_name)
        if hidden_peer:
            git(folder, 'update-index', '--assume-unchanged', peer_name)
        peer_stage = git(folder, 'ls-files', '--stage', '--', peer_name)
        peer_flags = git(folder, 'ls-files', '-v', '--', peer_name)
        loose = 'loose peer\n' if hidden_peer else 'staged peer\n'
        peer.write_text(loose)
        parent = git(folder, 'rev-parse', 'HEAD')
        epoch = 2 if name == 'hook-refusal' else 1
        (folder / 'engine.pin.json').write_text(json.dumps({'saveEpoch': epoch, 'commit': 'b' * 40}))
        paths = ['engine.pin.json', 'peer.txt'] if name == 'two-named-files' else ['engine.pin.json']
        run = subprocess.run(['bash', 'scripts/commit.sh', MESSAGE, '--', *paths], cwd=folder,
                             capture_output=True, text=True, timeout=12)
        if name == 'hidden-peer-refusal':
            # Existing Git safety: resetting a hidden, separately staged and
            # loose entry refuses before hooks. Preserve that refusal and data.
            assert run.returncode != 0 and 'not uptodate' in run.stderr, run.stderr
            assert git(folder, 'rev-parse', 'HEAD') == parent
            assert git(folder, 'ls-files', '--stage', '--', peer_name) == peer_stage
            assert git(folder, 'ls-files', '-v', '--', peer_name) == peer_flags
            assert peer.read_text() == loose
            results.append({'case': name, 'exit': run.returncode, 'peerPreserved': True})
            continue
        assert (folder / '.git/hook-ran').exists(), f'{name}: hook not reached: {run.stderr}'
        assert (folder / '.git/hook-ran').read_text() == 'checked', name
        if name == 'hook-refusal':
            assert run.returncode == 17, run.stderr
            assert git(folder, 'rev-parse', 'HEAD') == parent
            assert blobs_present(folder, blobs) == 0
        else:
            assert run.returncode == 0, run.stderr
            assert json.loads(git(folder, 'show', 'HEAD:engine.pin.json'))['commit'] == 'b' * 40
            assert set(git(folder, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').splitlines()) == set(paths)
            if name == 'pin':
                assert blobs_present(folder, blobs) == 0
            if name in ['old', 'two-named-files']:
                fetched = blobs_present(folder, blobs)
                assert fetched == len(blobs), f'{name}: fetched {fetched}/{len(blobs)} excluded blobs'
            if name == 'non-sparse-pin':
                assert (folder / '.git/hook-asset-flags').read_text().startswith('H '), 'Ordinary pin commits must clear unselected hidden flags'
            if name == 'two-named-files':
                assert git(folder, 'show', 'HEAD:peer.txt') == 'staged peer'
        if name in ['pin', 'hook-refusal']:
            assert git(folder, 'ls-files', '--stage', '--', peer_name) == peer_stage
            assert git(folder, 'ls-files', '-v', '--', peer_name) == peer_flags
            assert peer.read_text() == loose
        results.append({'case': name, 'exit': run.returncode,
                        'excludedBlobsFetched': blobs_present(folder, blobs)})
    print(json.dumps({'cases': results, 'seconds': time.monotonic() - started}))
