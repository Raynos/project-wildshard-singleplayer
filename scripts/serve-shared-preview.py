#!/usr/bin/env python3
"""One pinned preview per SHA; concurrent lanes borrow it until their last release."""
import contextlib
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import sys
import time
import urllib.request

WAIT_SECONDS = 300


def read(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def write(path, state):
    temporary = path.with_suffix('.new')
    temporary.write_text(json.dumps(state))
    temporary.replace(path)


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False


def holder(state):
    started = state.get('started', time.time())
    return 'lane=%s slot=preview:%s pid=%s age=%.1fs start=%s command=%s' % (
        state.get('owner', 'unknown'), state.get('sha', 'unknown'), state.get('pid', 'unknown'),
        max(0, time.time() - started), datetime.fromtimestamp(started, timezone.utc).isoformat(),
        state.get('command', 'unknown'))


@contextlib.contextmanager
def lock(path):
    deadline = time.monotonic() + WAIT_SECONDS
    with path.with_suffix('.lock').open('a+') as lease:
        while True:
            try:
                fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise TimeoutError('serve-build: timed out after 5 min waiting for shared preview; ' + holder(read(path)))
                time.sleep(min(.1, max(0, deadline - time.monotonic())))
        yield


def verify(state, registry):
    row = (registry / str(state['port'])).read_text().split(maxsplit=4)
    if int(row[0]) != state['pid'] or row[2] != state['out'] or not alive(state['pid']):
        raise ValueError('Shared preview registry owner changed')
    # The build stamp is the pinned mirror's short SHA plus build time. Match its
    # exact value on disk and HTTP; full SHA and build options are held by this lease.
    expected = read(Path(state['out']) / 'dist/version.json')
    if not str(expected.get('build', '')).startswith(state['sha'][:7] + '-'):
        raise ValueError('Shared preview build does not match pinned SHA')
    with urllib.request.urlopen('http://127.0.0.1:%s/version.json' % state['port'], timeout=2) as response:
        actual = json.load(response)
    if actual != expected:
        raise ValueError('Shared preview HTTP build differs from its pinned dist')


def run(registry, sha, mode, owner, command):
    if re.fullmatch('[a-f0-9]{40}', sha) is None:
        raise ValueError('Shared preview requires a full commit SHA')
    directory = registry / '.shared'
    directory.mkdir(exist_ok=True)
    path = directory / (sha + '.json')
    with lock(path):
        state = read(path)
        if state.get('status') in ('building', 'failed'):
            raise ValueError('Shared preview did not complete; no automatic retry; ' + holder(state))
        if state.get('status') == 'ready' and alive(state['pid']):
            if state['mode'] != mode or state.get('coverage') != 'all':
                raise ValueError('Existing SHA preview has incompatible mode/coverage; ' + holder(state))
            verify(state, registry)
            state['owners'] = sorted(set([*state['owners'], owner]))
            write(path, state)
            print('serve-build: reuse pinned preview; ' + holder(state), file=sys.stderr)
            print('http://127.0.0.1:%s/' % state['port'])
            return 0
        state = dict(status='building', sha=sha, mode=mode, coverage='all', owner=owner,
                     owners=[owner], pid=os.getpid(), started=time.time(), command=shlex.join(command))
        write(path, state)
        env = dict(os.environ, SERVE_SHARED_SHA=sha)
        child = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, text=True, start_new_session=True)
        def interrupted(_signum, _frame):
            raise KeyboardInterrupt
        signal.signal(signal.SIGTERM, interrupted)
        signal.signal(signal.SIGINT, interrupted)
        try:
            output, _ = child.communicate()
            if child.returncode != 0:
                state['status'] = 'failed'; write(path, state)
                return child.returncode if child.returncode > 0 else 128 - child.returncode
            urls = re.findall(r'^http://127\.0\.0\.1:(\d+)/$', output, re.MULTILINE)
            if len(urls) != 1:
                raise ValueError('Preview did not publish exactly one URL')
            port = int(urls[0])
            row = (registry / str(port)).read_text().split(maxsplit=4)
            state.update(status='ready', pid=int(row[0]), port=port, out=row[2])
            verify(state, registry)
            (Path(state['out']) / '.shared-preview').write_text(sha)
            write(path, state)
            print(output, end='')
            return 0
        except BaseException:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)
                child.wait(timeout=5)
            state['status'] = 'failed'; write(path, state)
            raise


def release(registry, port, owner, all_mine, command):
    for path in (registry / '.shared').glob('*.json'):
        state = read(path)
        if state.get('status') != 'ready' or str(state.get('port')) != port:
            continue
        with lock(path):
            state = read(path)
            if str(state.get('port')) != port or state.get('status') != 'ready':
                return 3
            if owner not in state['owners']:
                if all_mine:
                    return 0
                raise ValueError('Caller does not hold this shared preview; ' + holder(state))
            state['owners'].remove(owner)
            if state['owners']:
                write(path, state)
                print('serve-build: released :%s; retained by %s' % (port, ', '.join(state['owners'])))
                return 0
            # Hold the SHA lock until the existing stop path has retired the
            # preview. A new borrower can never join between last release and kill.
            row = (registry / port).read_text().split(maxsplit=4)
            if int(row[0]) != state['pid'] or row[2] != state['out']:
                raise ValueError('Refuse to stop a replaced shared preview owner')
            result = subprocess.run(command, env=dict(os.environ, SERVE_SHARED_STOP='1'), check=False)
            if result.returncode == 0:
                path.unlink()
            return result.returncode
    return 3  # Legacy/working-tree preview: the caller retains its existing stop path.


def main():
    action, directory, *args = sys.argv[1:]
    registry = Path(directory)
    try:
        if action == 'run':
            sha, mode, owner, *command = args
            return run(registry, sha, mode, owner, command)
        port, owner, all_mine, *command = args
        return release(registry, port, owner, all_mine == '1', command)
    except TimeoutError as error:
        print(error, file=sys.stderr); return 124
    except (ValueError, OSError) as error:
        print('serve-build: ' + str(error), file=sys.stderr); return 1
    except KeyboardInterrupt:
        return 130


if __name__ == '__main__':
    sys.exit(main())
