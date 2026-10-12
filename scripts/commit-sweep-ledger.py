#!/usr/bin/env python3
"""Commit the mechanical ledger after its parent exits, with a private index."""
import fcntl
import os
from pathlib import Path
import select
import subprocess
import sys
import tempfile


def wait_parent(pid, limit=120):
    try:
        if sys.platform == 'darwin':
            monitor = select.kqueue()
            try:
                event = select.kevent(pid, filter=select.KQ_FILTER_PROC,
                                     flags=select.KQ_EV_ADD | select.KQ_EV_ONESHOT,
                                     fflags=select.KQ_NOTE_EXIT)
                monitor.control([event], 0, 0)
                if not monitor.control(None, 1, limit):
                    raise TimeoutError(f'parent PID {pid} still live after {limit}s')
            finally:
                monitor.close()
        elif sys.platform.startswith('linux'):
            descriptor = os.pidfd_open(pid)
            try:
                monitor = select.poll()
                monitor.register(descriptor, select.POLLIN)
                if not monitor.poll(limit * 1000):
                    raise TimeoutError(f'parent PID {pid} still live after {limit}s')
            finally:
                os.close(descriptor)
        else:
            raise RuntimeError('ledger parent monitor needs Darwin or Linux')
    except ProcessLookupError:
        pass  # The parent already exited before the detached worker started.


def main():
    parent, source = int(sys.argv[1]), sys.argv[2]
    env = dict(os.environ)
    names = subprocess.check_output(['git', 'rev-parse', '--local-env-vars'], text=True)
    for name in names.splitlines():
        env.pop(name, None)
    for name in ('SKIP_ATTRIB', 'SKIP_ARCH_GUARDS', 'SKIP_SWEEPGUARD', 'LEDGER_AUTOCOMMIT'):
        env.pop(name, None)

    def git(*args, active_env=None, input=None):
        return subprocess.check_output(['git', *args], env=active_env or env,
                                       input=input, text=True).strip()

    root = Path(git('rev-parse', '--show-toplevel'))
    os.chdir(root)
    common = Path(git('rev-parse', '--path-format=absolute', '--git-common-dir'))
    if git('rev-parse', '--path-format=absolute', '--git-dir') != str(common):
        return  # Feature worktrees do not run checkout services.
    if git('symbolic-ref', '-q', '--short', 'HEAD') != 'main':
        return
    wait_parent(parent)
    print(f'ledger: parent PID {parent} exited; reading checkout ledger', flush=True)
    with (common / 'sweep-ledger.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return  # The active worker reads the current ledger, not a queued copy.
        if (common / 'quiet').exists():
            print('ledger: quiet active; leave bytes for the next post-commit', flush=True)
            return
        ledger = 'project/sweepguard-ledger.md'
        attribution = [line for line in git('show', '-s', '--format=%B', source).splitlines()
                       if line.startswith('Assisted-by: ')]
        if len(attribution) > 1:
            raise RuntimeError('source commit has ambiguous attribution')
        message = ('chore(git): record sweep-guard bypasses\n\n'
                   f'Record mechanical bypass receipts after {source[:9]}.\n')
        if attribution:
            message += '\n' + attribution[0] + '\n'
        with tempfile.TemporaryDirectory(prefix='ledger-commit-', dir=common) as directory:
            owned = Path(directory)
            msg = owned / 'message'
            msg.write_text(message)
            private = dict(env, GIT_INDEX_FILE=str(owned / 'index'))
            if not attribution:
                private['SKIP_ATTRIB'] = '1'
            for attempt in range(6):
                if (common / 'quiet').exists():
                    return
                tip = git('rev-parse', 'HEAD')
                if subprocess.run(['git', 'diff', '--quiet', tip, '--', ledger], env=env).returncode == 0:
                    return
                old = git('ls-tree', tip, '--', ledger).split()
                if len(old) != 4:
                    raise RuntimeError('ledger must already be a tracked file')
                text = (root / ledger).read_text()
                blob = git('hash-object', '-w', '--stdin', input=text)
                git('read-tree', tip, active_env=private)
                git('update-index', '--add', '--cacheinfo', old[0], blob, ledger, active_env=private)
                tree = git('write-tree', active_env=private)
                for command in (['python3', '.githooks/commit-msg-conventions', str(msg)],
                                ['bash', '.githooks/pre-commit'],
                                ['bash', '.githooks/commit-msg', str(msg)]):
                    if (common / 'quiet').exists():
                        return
                    subprocess.run(command, env=private, check=True)
                sha = git('commit-tree', tree, '-p', tip, '-F', str(msg), active_env=private)
                if (common / 'quiet').exists():
                    return
                if subprocess.run(['git', 'update-ref', 'refs/heads/main', sha, tip], env=env).returncode != 0:
                    continue
                staged = git('ls-files', '--stage', '--', ledger)
                if staged == f'{old[0]} {old[2]} 0\t{ledger}':
                    subprocess.run(['git', 'update-index', '--cacheinfo', old[0], blob, ledger],
                                   env=env, check=True)
                # Never overwrite ledger bytes appended while this immutable copy landed.
                subprocess.run(['bash', '.githooks/post-commit'],
                               env=dict(env, LEDGER_AUTOCOMMIT='1'), check=True)
                print(f'ledger: landed {sha}; complete', flush=True)
                return
            raise RuntimeError('ledger CAS moved six times; retry on the next commit')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, TimeoutError, subprocess.CalledProcessError) as error:
        print(f'ledger: deferred follow-up refused: {error}', file=sys.stderr)
        sys.exit(1)
