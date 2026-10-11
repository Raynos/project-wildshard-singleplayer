"""Real concurrent Git/private-index proofs; no shared checkout mutations."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

helper = str(Path(sys.argv[1]).resolve())
results = []
for scenario in ('overlap', 'timeout', 'abort'):
    with tempfile.TemporaryDirectory(prefix='commit-message-fixture-') as directory:
        root = Path(directory)

        def git(*args, env=None, input=None):
            return subprocess.check_output(['git', *args], cwd=root, env=env,
                                           input=input, text=True).strip()

        git('init', '-q', '-b', 'main')
        git('config', 'user.name', 'Fixture')
        git('config', 'user.email', 'fixture@example.invalid')
        for name in ('a', 'b'):
            (root / name).write_text('baseline')
        git('add', 'a', 'b')
        git('commit', '-qm', 'baseline')
        hook = root / '.git/hooks/pre-commit'
        hook.write_text(f'#!/bin/sh\npython3 "{helper}" "$PPID" || exit $?\n'
                        f'trap \'python3 "{helper}" --record "$PPID" "$?"\' EXIT\n'
                        'sleep .12\n')
        hook.chmod(0o755)
        message_hook = root / '.git/hooks/commit-msg'
        message_hook.write_text('#!/bin/sh\ntouch "ready-$WS_COMMIT_LANE"\n'
                                'sleep "$FIXTURE_MESSAGE_SLEEP"\n')
        message_hook.chmod(0o755)
        jobs = []
        try:
            for name in ('a', 'b'):
                env = {**os.environ, 'GIT_INDEX_FILE': str(root / f'{name}.index'),
                       'WS_COMMIT_LANE': name,
                       'WS_COMMIT_LOCK_TIMEOUT': '.05' if scenario == 'timeout' and name == 'b' else '5',
                       'FIXTURE_MESSAGE_SLEEP': '10' if scenario == 'abort' and name == 'a' else '.3'}
                git('read-tree', 'HEAD', env=env)
                blob = git('hash-object', '-w', '--stdin', input=name)
                git('update-index', '--cacheinfo', f'100644,{blob},{name}', env=env)
                message = root / f'{name}.message'
                message.write_text(f'fix({name}): retain own message\n\nAssisted-by: Fixture:{name}-model\n')
                jobs.append(subprocess.Popen(['git', 'commit', '-F', str(message)],
                            cwd=root, env=env, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, start_new_session=True))
                if name == 'a':
                    deadline = time.monotonic() + 5
                    while not (root / 'ready-a').exists():
                        if time.monotonic() > deadline:
                            raise AssertionError('first commit never reached message hook')
                        time.sleep(.01)
            if scenario == 'abort':
                time.sleep(.05)
                os.killpg(jobs[0].pid, signal.SIGTERM)
            outputs = []
            for job in jobs:
                out, err = job.communicate(timeout=7)
                outputs.append({'status': job.returncode, 'stderr': err, 'stdout': out})
            if scenario == 'timeout':
                assert outputs[1]['status'] != 0
                assert 'wait expired' in outputs[1]['stderr']
                assert f'PID {jobs[0].pid} lane/pane a' in outputs[1]['stderr']
            else:
                assert 'waiting up to 5s' in outputs[1]['stderr'], outputs
                if scenario == 'abort':
                    assert outputs[1]['status'] == 0
            changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')
            message = git('show', '-s', '--format=%B')
            assert message.startswith(f'fix({changed}):')
            assert message.endswith(f'Assisted-by: Fixture:{changed}-model')
            receipts = [json.loads(line) for line in (root / '.git/commit-hook-times.jsonl').read_text().splitlines()]
            assert all(.1 <= row['seconds'] < 2 for row in receipts)
            results.append({'scenario': scenario, 'messageOwner': changed,
                            'hookSeconds': [row['seconds'] for row in receipts],
                            'statuses': [row['status'] for row in outputs]})
        finally:
            for job in jobs:
                if job.poll() is None:
                    os.killpg(job.pid, signal.SIGTERM)
                    job.wait(timeout=3)
print(json.dumps(results))
