import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import tempfile
import time

root = Path(sys.argv[1])
hook = Path(sys.argv[2]) if len(sys.argv) > 2 else root / '.githooks/post-commit'
env = dict(os.environ)
for key in subprocess.check_output(['git', 'rev-parse', '--local-env-vars'], cwd=root, text=True).splitlines():
    env.pop(key, None)
env.pop('HERDR_PANE_ID', None)
env.pop('LEDGER_AUTOCOMMIT', None)
with tempfile.TemporaryDirectory(prefix='post-commit-pipes-') as directory:
    tree = Path(directory)
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=tree, env=env, stderr=subprocess.DEVNULL)
    git('init', '-q')
    git('config', 'user.name', 'fixture')
    git('config', 'user.email', 'fixture@invalid')
    git('config', 'core.hooksPath', '/dev/null')
    for folder in ['scripts', 'lint', 'project']:
        (tree / folder).mkdir()
    ledger = tree / 'project/sweepguard-ledger.md'
    ledger.write_text('committed\n')
    git('add', '.')
    git('commit', '-qm', 'fixture')
    ledger.write_text('dirty\n')
    (tree / 'lint/ratchet.mjs').write_text('')
    (tree / 'post-commit').write_bytes(hook.read_bytes())
    ready = tree / 'ready'
    os.mkfifo(ready)
    ready_fd = os.open(ready, os.O_RDWR | os.O_NONBLOCK)
    worker = '''import json, os, signal, sys
with open('ready', 'w') as pipe:
    pipe.write(json.dumps({'pid': os.getpid(), 'worker': sys.argv[1]}) + '\\n')
    pipe.flush()
signal.pause()
'''
    (tree / 'wait.py').write_text(worker)
    for name, label in [('auto-push.sh', 'push'), ('commit-ratchet.sh', 'ratchet')]:
        (tree / 'scripts' / name).write_text('exec python3 "$PWD/wait.py" ' + label + '\n')
    (tree / 'scripts/commit-sweep-ledger.py').write_text(
        "import runpy, sys; sys.argv = ['wait.py', 'ledger']; runpy.run_path('wait.py', run_name='__main__')\n")
    selector = selectors.DefaultSelector()
    selector.register(ready_fd, selectors.EVENT_READ)
    process = subprocess.Popen(['bash', 'post-commit'], cwd=tree, env=env,
                               stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    workers = []
    returned = False
    pending = b''
    try:
        try:
            process.communicate(timeout=2)
            returned = process.returncode == 0
        except subprocess.TimeoutExpired:
            pass
        deadline = time.monotonic() + 5
        while len(workers) < 3:
            left = deadline - time.monotonic()
            if left <= 0 or not selector.select(left):
                raise RuntimeError('Detached workers did not all signal readiness')
            pending += os.read(ready_fd, 4096)
            while b'\n' in pending:
                line, pending = pending.split(b'\n', 1)
                workers.append(json.loads(line))
        assert {row['worker'] for row in workers} == {'push', 'ratchet', 'ledger'}
        for row in workers:
            os.kill(row['pid'], 0)
        assert returned, 'Captured post-commit retained its output pipe until detached workers exited'
        print(json.dumps({'returnedBeforeWorkersExit': True, 'workers': sorted(row['worker'] for row in workers)}))
    finally:
        # Only the three PIDs emitted by this fixture's own bounded workers.
        for row in workers:
            try:
                os.kill(row['pid'], signal.SIGTERM)
            except ProcessLookupError:
                pass
        if process.poll() is None:
            process.terminate()
        process.communicate(timeout=5)
        selector.close()
        os.close(ready_fd)
