"""Real queued commits retain their entry-time budget and fatal hook status."""
import fcntl
import json
import os
from pathlib import Path
import re
import select
import shutil
import subprocess
import sys
import tempfile
import time

source = Path(sys.argv[1]).resolve()
wrapper = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else source / 'scripts/commit.sh'
env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
with tempfile.TemporaryDirectory(dir=source / 'tmp', prefix='commit-timing-') as temporary:
    root = Path(temporary)
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=root, env=env, text=True).strip()
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Fixture')
    git('config', 'user.email', 'fixture@example.invalid')
    git('config', 'core.hooksPath', '/dev/null')
    (root / 'owned.txt').write_text('base\n')
    git('add', '--', 'owned.txt')
    git('commit', '-qm', 'base')
    (root / 'scripts').mkdir()
    shutil.copy2(wrapper, root / 'scripts/commit.sh')
    (root / '.githooks').mkdir()
    hook = root / '.githooks/pre-commit'
    hook.write_text('''#!/usr/bin/env python3
import os, sys, time
print('HOOK_AGE_MS=' + str(time.time() * 1000 - int(os.environ['WS_COMMIT_STARTED_AT'])), flush=True)
sys.exit(23 if os.environ.get('FIXTURE_REFUSE') else 0)
''')
    hook.chmod(0o755)
    git('config', 'core.hooksPath', '.githooks')
    def metrics(output):
        split = re.search(r'commit.sh: (\d+) ms lock wait; (\d+) ms serialized work', output)
        total = re.search(r'commit.sh: (\d+) ms total wall', output)
        age = re.search(r'HOOK_AGE_MS=([\d.]+)', output)
        assert split and total and age, output
        wait, work, wall = int(split[1]), int(split[2]), int(total[1])
        assert abs(wait + work - wall) <= 1, output
        assert wait <= float(age[1]) + 2 <= wall + 50, output
        return {'waitMs': wait, 'workMs': work, 'totalMs': wall}
    (root / 'owned.txt').write_text('queued\n')
    with (root / '.git/commit.lock').open('a') as lease:
        fcntl.flock(lease, fcntl.LOCK_EX)
        child = subprocess.Popen(['scripts/commit.sh', 'fixture queued', '--', 'owned.txt'],
                                 cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            ready, _, _ = select.select([child.stdout], [], [], 3)
            assert ready, 'commit wrapper did not announce its lock wait'
            first = child.stdout.readline()
            assert first.strip() == 'commit.sh: waiting for commit lock', first
            # The requested-lock marker fences startup before the controlled wait.
            time.sleep(.15)
            assert child.poll() is None and git('show', 'HEAD:owned.txt') == 'base'
        finally:
            fcntl.flock(lease, fcntl.LOCK_UN)
            output, error = child.communicate(timeout=5)
        assert child.returncode == 0, output + error
        queued = metrics(first + output + error)
        assert queued['waitMs'] >= 140, queued
    assert git('show', 'HEAD:owned.txt') == 'queued'
    head = git('rev-parse', 'HEAD')
    (root / 'owned.txt').write_text('refused\n')
    refused = subprocess.run(['scripts/commit.sh', 'fixture refused', '--', 'owned.txt'],
                             cwd=root, env={**env, 'FIXTURE_REFUSE': '1'}, capture_output=True, text=True)
    assert refused.returncode != 0 and git('rev-parse', 'HEAD') == head, refused
    red = metrics(refused.stdout + refused.stderr)
    print(json.dumps({'queued': queued, 'refused': red, 'budgetIncludesWait': True, 'hookRedRefuses': True}))
