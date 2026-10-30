"""Nonblocking POSIX slot lease for hosts without BSD lockf.

The lock stays in this supervisor, never in a browser or timer descendant.
The existing browser-lane child owns admission, timeout and tree cleanup.
"""
import fcntl
import signal
import subprocess
import sys


def run(path, command):
    with open(path, 'a+') as lease:
        try:
            fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 75
        child = subprocess.Popen(command, close_fds=True)
        def forward(signum, _frame):
            try:
                child.send_signal(signum)
            except ProcessLookupError:
                pass
        handlers = {kind: signal.signal(kind, forward) for kind in (signal.SIGINT, signal.SIGTERM)}
        try:
            code = child.wait()
            return code if code >= 0 else 128 - code
        finally:
            for kind, handler in handlers.items():
                signal.signal(kind, handler)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit('usage: browser-slot-lock.py LOCK COMMAND [ARG ...]')
    sys.exit(run(sys.argv[1], sys.argv[2:]))
