#!/usr/bin/env python3
"""Machine-wide full-test / app-build lanes. flock lifetime follows the owned child, not a PID file."""
import argparse
import contextlib
import fcntl
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import uuid

# The push gate has its own lease (process audit 2026-10-09: a lane's suite delayed pushes by a median 115 s). A gate
# lease covers every heavy resource for its own descendants, so its nested vitest / vite build need no second lease.
RESOURCES = {'full-test': ('full-test',), 'build': ('build',), 'check': ('full-test', 'build'), 'gate': ('push-gate',)}
LANES = ('full-test', 'build', 'push-gate')


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def ancestors():
    rows = subprocess.check_output(['ps', '-Ao', 'pid=,ppid='], text=True)
    parents = {int(p): int(pp) for p, pp in (line.split() for line in rows.splitlines())}
    current, result = os.getpid(), set()
    while current > 1 and current not in result:
        result.add(current)
        current = parents.get(current, 0)
    return result


def inherited(root, resources):
    token = os.environ.get('WS_HEAVY_TOKEN')
    if not token:
        return False
    family = ancestors()
    if owns(root, 'push-gate', token, family):
        return True
    return all(owns(root, resource, token, family) for resource in resources)


def owns(root, resource, token, family):
    try:
        lease = json.loads((root / (resource + '.active.json')).read_text())
    except (OSError, ValueError):
        return False
    return lease.get('token') == token and bool(family.intersection([lease.get('runnerPid'), lease.get('childPid')]))


@contextlib.contextmanager
def scheduler(root):
    with (root / 'scheduler.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = root / 'queue.json'
        try:
            state = json.loads(path.read_text())
        except FileNotFoundError:
            state = {'next': 0, 'queue': []}
        state['queue'] = [entry for entry in state['queue'] if alive(entry['pid'])]
        yield state
        temporary = root / ('queue.' + str(os.getpid()) + '.tmp')
        temporary.write_text(json.dumps(state))
        temporary.replace(path)


def write_active(root, resource, entry):
    path = root / (resource + '.active.json')
    temporary = root / (resource + '.' + str(os.getpid()) + '.tmp')
    temporary.write_text(json.dumps(entry))
    temporary.replace(path)


def remove_ticket(root, token):
    with scheduler(root) as state:
        state['queue'] = [entry for entry in state['queue'] if entry['token'] != token]


def acquire(root, entry):
    with scheduler(root) as state:
        ordered = sorted(state['queue'], key=lambda row: (row['priority'], row['ticket']))
        # FIFO per resource. An older request for the independent lane does not block us.
        for previous in ordered:
            if previous['token'] == entry['token']:
                break
            if set(previous['resources']).intersection(entry['resources']):
                return None
        held = []
        for resource in sorted(entry['resources']):
            lock = (root / (resource + '.lock')).open('a+')
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                lock.close()
                for fd in held:
                    fd.close()
                return None
            held.append(lock)
        state['queue'] = [row for row in state['queue'] if row['token'] != entry['token']]
        for resource in entry['resources']:
            write_active(root, resource, entry)
        return held


def terminate(child):
    if child is None:
        return
    # start_new_session gives this command its own process group; never match unrelated commands by name.
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        child.wait(timeout=3)
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    child.wait()


def status(root):
    with scheduler(root) as state:
        active = []
        for resource in LANES:
            with (root / (resource + '.lock')).open('a+') as fd:
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    try:
                        active.append({'resource': resource, **json.loads((root / (resource + '.active.json')).read_text())})
                    except (OSError, ValueError):
                        active.append({'resource': resource, 'state': 'held'})
        return {'active': active, 'queue': sorted(state['queue'], key=lambda row: (row['priority'], row['ticket']))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=[*RESOURCES, 'status'])
    parser.add_argument('--max', type=float, default=30, help='owned command timeout in minutes; queue time is separate')
    argv = sys.argv[1:]
    separator = argv.index('--') if '--' in argv else len(argv)
    command = argv[separator + 1:]
    args = parser.parse_args(argv[:separator])
    root = Path(os.environ.get('WS_HEAVY_ROOT', str(Path.home() / '.wildshard-heavy-lanes'))).resolve()
    root.mkdir(parents=True, exist_ok=True)
    if args.kind == 'status':
        print(json.dumps(status(root), indent=2))
        return 0
    if not command or not math.isfinite(args.max) or args.max <= 0:
        parser.error('give a command after -- and a positive --max')
    resources = RESOURCES[args.kind]
    if inherited(root, resources):
        env = dict(os.environ)
        if args.kind == 'gate':
            env['WS_HEAVY_GATE'] = '1'
        os.execvpe(command[0], command, env)
    if os.environ.get('WS_HEAVY_TOKEN'):
        parser.error('cannot upgrade an inherited lane; release it before requesting different resources')
    token = uuid.uuid4().hex
    entry = {'token': token, 'pid': os.getpid(), 'runnerPid': os.getpid(), 'childPid': None,
             'resources': resources, 'priority': 0 if args.kind == 'gate' else 1,
             'cwd': os.getcwd(), 'command': command, 'queuedAt': time.time()}
    held, child = None, None
    def interrupted(_signal, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        with scheduler(root) as state:
            entry['ticket'] = state['next']
            state['next'] += 1
            state['queue'].append(entry)
        print('heavy-lane: queued ' + args.kind + ' ticket ' + str(entry['ticket']), file=sys.stderr, flush=True)
        while held is None:
            held = acquire(root, entry)
            if held is None:
                time.sleep(0.1)
        started = time.time()
        print('heavy-lane: acquired ' + args.kind + ' after %.2fs queue' % (started - entry['queuedAt']), file=sys.stderr, flush=True)
        env = {**os.environ, 'WS_HEAVY_TOKEN': token, 'WS_HEAVY_ROOT': str(root)}
        if args.kind == 'gate':
            env['WS_HEAVY_GATE'] = '1'
        child = subprocess.Popen(command, env=env, start_new_session=True, pass_fds=tuple(fd.fileno() for fd in held))
        entry['childPid'] = child.pid
        with scheduler(root):
            for resource in resources:
                write_active(root, resource, entry)
        try:
            code = child.wait(timeout=args.max * 60)
        except subprocess.TimeoutExpired:
            print('heavy-lane: owned command timed out', file=sys.stderr)
            terminate(child)
            code = 124
        print('heavy-lane: finished ' + args.kind + ' in %.2fs' % (time.time() - started), file=sys.stderr, flush=True)
        return code if code >= 0 else 128 - code
    except KeyboardInterrupt:
        terminate(child)
        return 130
    finally:
        remove_ticket(root, token)
        if held is not None:
            with scheduler(root):
                for resource in resources:
                    path = root / (resource + '.active.json')
                    if path.exists() and json.loads(path.read_text()).get('token') == token:
                        path.unlink()
            for fd in held:
                fd.close()


if __name__ == '__main__':
    sys.exit(main())
