"""D9: real pathspec commits preserve foreign stages and serialize messages."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

source = Path(sys.argv[1]).resolve()
env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
with tempfile.TemporaryDirectory(dir=source / 'tmp', prefix='commit-test-') as temp:
    root = Path(temp)
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=root, env=env, text=True).strip()
    def put(path, text):
        file = root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text)
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'fixture@example.invalid')
    git('config', 'user.name', 'fixture')
    git('config', 'core.hooksPath', '/dev/null')
    for name in ['own.txt', 'peer.txt', 'gone.txt']:
        put(name, 'base\n')
    git('add', '--', 'own.txt', 'peer.txt', 'gone.txt')
    git('commit', '-qm', 'base')
    (root / 'scripts').mkdir()
    shutil.copy2(source / 'scripts/commit.sh', root / 'scripts/commit.sh')
    put('peer.txt', 'staged peer\n')
    git('add', '--', 'peer.txt')
    peer = git('rev-parse', ':peer.txt')
    put('peer.txt', 'working peer\n')
    put('own.txt', 'own change\n')
    put('new file.txt', 'new file\n')
    (root / 'gone.txt').rename(root / 'renamed.txt')
    started = time.monotonic()
    subprocess.run(['scripts/commit.sh', 'fixture own', '--', 'own.txt', 'new file.txt', 'gone.txt'], cwd=root, env=env, check=True)
    assert git('show', 'HEAD:peer.txt') == 'base'
    assert git('rev-parse', ':peer.txt') == peer
    assert (root / 'peer.txt').read_text() == 'working peer\n'
    assert git('show', 'HEAD:new file.txt') == 'new file'
    assert 'gone.txt' not in git('ls-tree', '--name-only', 'HEAD').splitlines()
    first_seconds = time.monotonic() - started
    put('a.txt', 'a\n'); put('b.txt', 'b\n')
    a = subprocess.Popen(['scripts/commit.sh', 'fixture A', '--', 'a.txt'], cwd=root, env=env)
    b = subprocess.Popen(['scripts/commit.sh', 'fixture B', '--', 'b.txt'], cwd=root, env=env)
    assert a.wait(timeout=10) == 0 and b.wait(timeout=10) == 0
    assert set(git('log', '-2', '--format=%s').splitlines()) == {'fixture A', 'fixture B'}
    # The storage check still reads this pathspec's staged object and refuses it.
    shutil.copy2(source / 'scripts/repo-size.mjs', root / 'scripts/repo-size.mjs')
    put('scripts/storage-policy.json', json.dumps({'schemaVersion': 1, 'maxBlobBytes': 1000000,
        'maxPreviewBytes': 250000, 'maxBoardBytes': 500000, 'maxPushBytes': 10000000,
        'maxWeeklyBytes': 100000000, 'pins': []}))
    subprocess.run(['scripts/commit.sh', 'fixture storage policy', '--', 'scripts/storage-policy.json'],
                   cwd=root, env=env, check=True)
    put('.githooks/pre-commit', '#!/bin/sh\nnode scripts/repo-size.mjs --index\n')
    (root / '.githooks/pre-commit').chmod(0o755)
    git('config', 'core.hooksPath', '.githooks')
    put('oversized.txt', 'x' * 2000000)
    refused = subprocess.run(['scripts/commit.sh', 'fixture oversize', '--', 'oversized.txt'],
                              cwd=root, env=env, text=True, capture_output=True)
    assert refused.returncode != 0 and '1.00 MB blob cap' in refused.stderr + refused.stdout, refused
    print(json.dumps({'pathspec': 'passed', 'concurrent': 'passed', 'storageRefusal': 'passed',
                      'commitSeconds': round(first_seconds, 3)}))
