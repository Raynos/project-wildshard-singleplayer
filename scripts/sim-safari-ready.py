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
