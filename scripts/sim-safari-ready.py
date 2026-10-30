"""Wait for the booted Simulator's actual URL service, with a wall deadline."""
import math
import os
import subprocess
import sys
import time


PROBE_URL = 'http://127.0.0.1:9/'


def wait_for_safari(udid):
    try:
        timeout = float(os.environ.get('SIM_SAFARI_READY_TIMEOUT', '120'))
    except ValueError:
        timeout = 0
    if not math.isfinite(timeout) or not 0 < timeout <= 600:
        print('sim-lane: SIM_SAFARI_READY_TIMEOUT must be in (0, 600] seconds', file=sys.stderr)
        return 64
    deadline = time.monotonic() + timeout
    # Boot completion is not Safari launch completion. Start the actual app
    # once before asking its URL service to accept a page. This shares the
    # original readiness deadline; a failed launch never publishes a lease.
    started = time.monotonic()
    try:
        launch = subprocess.run(['xcrun', 'simctl', 'launch', udid, 'com.apple.mobilesafari'],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            timeout=max(0.001, deadline - started), check=False)
    except subprocess.TimeoutExpired:
        print(f'sim-lane: Safari app launch timed out within {timeout:g}s readiness deadline', file=sys.stderr)
        return 124
    elapsed = time.monotonic() - started
    if launch.returncode != 0:
        print(f'sim-lane: Safari app launch failed in {elapsed:.3f}s: {launch.stderr.strip()}', file=sys.stderr)
        return launch.returncode if launch.returncode > 0 else 128 - launch.returncode
    print(f'sim-lane: Safari app launched in {elapsed:.3f}s: {launch.stdout.strip()}', file=sys.stderr)
    code, detail = 124, 'URL service did not respond'
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            print(f'sim-lane: Safari URL readiness timed out after {timeout:g}s: {detail}', file=sys.stderr)
            return code
        try:
            # an http URL: this runtime refuses about:blank with LSApplicationWorkspaceErrorDomain 115 even when Safari
            # opens pages (every sim-lane run failed its probe, 2026-10-21); nothing need listen on the discard port
            result = subprocess.run(['xcrun', 'simctl', 'openurl', udid, PROBE_URL],
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
                timeout=min(10, remaining), check=False)
            if result.returncode == 0:
                return 0
            code = result.returncode if result.returncode > 0 else 128 - result.returncode
            detail = result.stderr.strip() or f'openurl exited {code}'
        except subprocess.TimeoutExpired:
            code, detail = 124, 'openurl did not respond before its deadline'
        time.sleep(min(1, max(0, deadline - time.monotonic())))


if __name__ == '__main__':
    sys.exit(wait_for_safari(sys.argv[1]))
