"""Reproduce a real private-index commit's post-hook under the message lock."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

repo = Path(sys.argv[1]).resolve()
results = []
for attributed in (True, False):
    with tempfile.TemporaryDirectory(prefix='sweep-ledger-fixture-') as directory:
        root = Path(directory)

        def git(*args, env=None):
            return subprocess.check_output(['git', *args], cwd=root, env=env,
                                           text=True).strip()

        def put(path, text):
            file = root / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(text)

        git('init', '-q', '-b', 'main')
        git('config', 'user.name', 'Ledger fixture')
        git('config', 'user.email', 'fixture@example.invalid')
        ledger = 'project/sweepguard-ledger.md'
        put(ledger, '# Fixture ledger\n')
        put('a', 'baseline\n')
        put('foreign', 'baseline\n')
        git('add', '--', ledger, 'a', 'foreign')
        git('commit', '-qm', 'fixture baseline')
        for file in ('scripts/commit-sweep-ledger.py', 'scripts/commit-message-lock.py',
                     '.githooks/commit-msg-conventions'):
            put(file, (repo / file).read_text())
        put('.githooks/pre-commit', '#!/bin/sh\npython3 scripts/commit-message-lock.py "$PPID"\n')
        put('.githooks/commit-msg', '#!/bin/sh\npython3 .githooks/commit-msg-conventions "$1"\n')
        # Git's hook pauses after the real post-hook returned. Its parent still
        # owns the message lock, so a nested commit cannot finish here.
        post = (repo / '.githooks/post-commit').read_text()
        assert post.rstrip().endswith('exit 0')
        put('.githooks/post-commit', post.rsplit('exit 0', 1)[0]
            + 'if [ "${LEDGER_AUTOCOMMIT:-0}" != 1 ]; then\n'
            ' touch parent-post-ready\n read token < parent-release\nfi\nexit 0\n')
        for name in ('pre-commit', 'commit-msg', 'post-commit'):
            (root / '.githooks' / name).chmod(0o755)
        git('config', 'core.hooksPath', '.githooks')
        os.mkfifo(root / 'parent-release')
        release = os.open(root / 'parent-release', os.O_RDWR | os.O_NONBLOCK)
        parent = None
        try:
            put('foreign', 'foreign staged bytes\n')
            git('add', '--', 'foreign')
            staged = git('ls-files', '--stage', '--', 'foreign')
            private = dict(os.environ, GIT_INDEX_FILE=str(root / 'source.index'),
                           GIT_DIR=str(root / '.git'), GIT_WORK_TREE=str(root),
                           WS_COMMIT_LOCK_TIMEOUT='2')
            if not attributed:
                private['SKIP_ATTRIB'] = '1'
            git('read-tree', 'HEAD', env=private)
            put('a', 'source bytes\n')
            git('add', '--', 'a', env=private)
            put(ledger, '# Fixture ledger\n\n- Mechanical bypass receipt\n')
            message = 'fix(source): retain the source message\n'
            trailer = 'Assisted-by: Fixture:source-model'
            if attributed:
                message += '\n' + trailer + '\n'
            put('source.message', message)
            parent = subprocess.Popen(['git', 'commit', '-q', '-F', 'source.message'], cwd=root,
                                      env=private, text=True, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, start_new_session=True)
            deadline = time.monotonic() + 5
            while not (root / 'parent-post-ready').exists():
                if parent.poll() is not None or time.monotonic() > deadline:
                    raise AssertionError('post-hook did not return under its parent message lock')
                time.sleep(.01)
            source = git('rev-parse', 'HEAD')
            assert git('show', '-s', '--format=%B') == message.strip()
            assert git('show', f'HEAD:{ledger}') == '# Fixture ledger'
            assert git('ls-files', '--stage', '--', 'foreign') == staged
            assert parent.poll() is None
            os.write(release, b'continue\n')
            out, err = parent.communicate(timeout=5)
            assert parent.returncode == 0, (out, err)
            assert 'deferred until parent PID' in err, err
            deadline = time.monotonic() + 8
            log = root / '.git/sweep-ledger.log'
            while not log.exists() or '; complete' not in log.read_text():
                if time.monotonic() > deadline:
                    raise AssertionError(log.read_text() if log.exists() else 'worker did not start')
                time.sleep(.02)
            after = git('rev-parse', 'HEAD')
            assert git('rev-parse', 'HEAD^') == source
            assert git('show', '-s', '--format=%s') == 'chore(git): record sweep-guard bypasses'
            actual = git('show', '-s', '--format=%B')
            assert actual.endswith(trailer) if attributed else 'Assisted-by:' not in actual
            assert git('show', '-s', '--format=%B', source) == message.strip()
            assert git('diff-tree', '--no-commit-id', '--name-only', '-r', after) == ledger
            assert git('show', f'HEAD:{ledger}').endswith('- Mechanical bypass receipt')
            assert git('ls-files', '--stage', '--', 'foreign') == staged
            assert not (root / '.git/index.lock').exists()
            results.append({'attributed': attributed, 'parentExited': True,
                            'sourceMessagePreserved': True, 'foreignIndexPreserved': True,
                            'ledgerOnly': True})
        finally:
            os.close(release)
            if parent is not None and parent.poll() is None:
                os.killpg(parent.pid, signal.SIGTERM)
                parent.wait(timeout=3)
print(json.dumps(results))
