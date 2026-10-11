#!/usr/bin/env python3
"""Protect Git's shared COMMIT_EDITMSG until its owning commit process exits."""

import fcntl
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import time


def common_dir():
    return Path(subprocess.check_output(
        ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'],
        text=True).strip())


def read_holder(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def timeout(_signal, _frame):
    raise TimeoutError('commit-message lock wait expired')


def monitor_exit(pid):
    # The guardian installs this after fork: Darwin kqueue filters are not inherited.
    if sys.platform == 'darwin':
        monitor = select.kqueue()
        event = select.kevent(pid, filter=select.KQ_FILTER_PROC,
                             flags=select.KQ_EV_ADD | select.KQ_EV_ONESHOT,
                             fflags=select.KQ_NOTE_EXIT)
        monitor.control([event], 0, 0)
        return lambda: monitor.control(None, 1, None)
    if sys.platform.startswith('linux'):
        descriptor = os.pidfd_open(pid)
        monitor = select.poll()
        monitor.register(descriptor, select.POLLIN)
        return monitor.poll
    raise RuntimeError('commit-message lock needs Darwin kqueue or Linux pidfd')


def main():
    recording = sys.argv[1] == '--record'
    pid = int(sys.argv[2] if recording else sys.argv[1])
    root = common_dir()
    holder_file = root / 'commit-message-holder.json'
    if recording:
        holder = read_holder(holder_file)
        if holder.get('pid') != pid:
            return
        seconds = time.time() - holder['at']
        row = {**holder, 'seconds': seconds, 'status': int(sys.argv[3])}
        with (root / 'commit-hook-times.jsonl').open('a') as receipt:
            receipt.write(json.dumps(row) + '\n')
        print(f'commit-message-lock: pre-commit {seconds:.2f}s under lock',
              file=sys.stderr)
        return
    command = subprocess.check_output(['ps', '-p', str(pid), '-o', 'comm='],
                                      text=True).strip()
    if Path(command).name != 'git':
        return  # commit-tree callers already use private messages and their own CAS.
    limit = float(os.environ.get('WS_COMMIT_LOCK_TIMEOUT', '120'))
    if not 0 < limit <= 600:
        raise ValueError('WS_COMMIT_LOCK_TIMEOUT must be in (0, 600] seconds')
    lock = (root / 'commit-message.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        owner = read_holder(holder_file)
        print(f"commit-message-lock: waiting up to {limit:g}s for PID "
              f"{owner.get('pid', '?')} lane/pane {owner.get('lane', '?')}",
              file=sys.stderr, flush=True)
        signal.signal(signal.SIGALRM, timeout)
        signal.setitimer(signal.ITIMER_REAL, limit)
        try:
            fcntl.flock(lock, fcntl.LOCK_EX)
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
    holder = {'pid': pid, 'lane': os.environ.get('WS_COMMIT_LANE')
              or os.environ.get('HERDR_PANE_ID') or '?',
              'at': time.time()}
    holder_file.write_text(json.dumps(holder) + '\n')
    ready_read, ready_write = os.pipe()
    if os.fork() == 0:
        os.close(ready_read)
        os.setsid()
        try:
            wait_for_exit = monitor_exit(pid)
            os.write(ready_write, b'1')
        except OSError:
            os.write(ready_write, b'0')
            os._exit(1)
        os.close(ready_write)
        with open(os.devnull, 'r+b', buffering=0) as sink:
            for descriptor in (0, 1, 2):
                os.dup2(sink.fileno(), descriptor)
        try:
            wait_for_exit()
        finally:
            os._exit(0)  # Kernel releases the inherited flock, including on aborted commits.
    os.close(ready_write)
    ready = os.read(ready_read, 1)
    os.close(ready_read)
    if ready != b'1':
        raise RuntimeError('commit process exit monitor could not start')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, TimeoutError) as error:
        print(f'commit-message-lock: {error}; retry or use a validated private '
              'commit-tree message with CAS', file=sys.stderr)
        sys.exit(1)
