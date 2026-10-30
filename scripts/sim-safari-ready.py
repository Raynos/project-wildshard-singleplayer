"""Wait for a native Safari document's frame callbacks within one wall deadline."""
import sys
import time

IMPORT_STARTED = time.monotonic()

from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import math
import json
import os
from pathlib import Path
import secrets
from socketserver import TCPServer
import subprocess
import tempfile
import threading


@contextmanager
def native_transcript():
    # A native service may inherit simctl's output handle. Pipe EOF then
    # waits for that service, not for the bounded client command to exit.
    scratch = Path(__file__).resolve().parent.parent / 'tmp'
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryFile(dir=scratch) as stream:
        yield stream


def native_text(stream):
    # Snapshot current output without EOF or changing an inherited offset.
    return os.pread(stream.fileno(), os.fstat(stream.fileno()).st_size, 0).decode(errors='replace')


def owned_safari_process(udid, remaining, evidence=None, read_snapshot=subprocess.run):
    """Observe only a Safari descending from this device's launchd_sim.

    A pid is permission to ask for the owned URL, never readiness proof.
    Do not launch another client or print unrelated process arguments.
    """
    started = time.monotonic()
    status = 'complete'
    try:
        result = read_snapshot(['ps', '-axo', 'pid=,ppid=,command='],
                                capture_output=True, text=True, errors='replace',
                                timeout=max(.001, min(.25, remaining)), check=False)
        raw = result.stdout if result.returncode == 0 else ''
        if result.returncode != 0:
            status = f'exit:{result.returncode}'
    except subprocess.TimeoutExpired as error:
        status = 'timeout'
        raw = error.stdout or b''
        if isinstance(raw, bytes):
            raw = raw.decode(errors='replace')
    except OSError:
        status, raw = 'unavailable', ''
    if evidence is not None:
        elapsed = (time.monotonic() - started) * 1000
        evidence['checks'] += 1
        evidence['timeouts'] += status == 'timeout'
        evidence['totalMs'] = round(evidence['totalMs'] + elapsed, 3)
        evidence['maxMs'] = round(max(evidence['maxMs'], elapsed), 3)
        evidence['lastStatus'] = status
    processes = {}
    # A timed-out ps can already have delivered a complete owned parent chain.
    # Incomplete final rows never grant permission; the frame proof still does.
    for line in raw.splitlines(keepends=True):
        if not line.endswith('\n'):
            continue
        parts = line.split(None, 2)
        if len(parts) == 3 and parts[0].isdigit() and parts[1].isdigit():
            processes[int(parts[0])] = (int(parts[1]), parts[2])
    roots = {pid for pid, (_, command) in processes.items()
             if 'launchd_sim' in command and udid in command}
    if evidence is not None:
        evidence['completeRows'] = len(processes)
        evidence['ownedRoots'] = len(roots)
        evidence['safariCandidates'] = sum('/MobileSafari.app/MobileSafari' in row[1] for row in processes.values())
    for pid, (_, command) in processes.items():
        if '/MobileSafari.app/MobileSafari' not in command:
            continue
        parent, seen = pid, set()
        while parent in processes and parent not in seen:
            if parent in roots:
                return pid
            seen.add(parent)
            parent = processes[parent][0]
    return None


@contextmanager
def readiness_page(deadline, started=None):
    # Port 9 is a Fetch bad port, not a usable Safari warm-up document.
    # An unpredictable local page proves two real frames, without app assets,
    # external networking, an error page or a LaunchServices exit-code guess.
    token = secrets.token_hex(12)
    page, callback = f'/safari/{token}', f'/ready/{token}'
    ready = threading.Event()
    requested = threading.Event()
    started = time.monotonic() if started is None else started
    document = ('<!doctype html><meta name="viewport" content="width=device-width">'
                '<script>requestAnimationFrame(()=>requestAnimationFrame(()=>'
                f'fetch("{callback}",{{cache:"no-store"}})));</script>').encode()

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(1)

        def do_GET(self):
            if self.path not in (page, callback):
                self.send_error(404)
                return
            if self.path == page and not requested.is_set():
                requested.set()
                print(f'sim-lane: Safari readiness document requested in {time.monotonic() - started:.3f}s', file=sys.stderr)
            body = document if self.path == page else b'ready'
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Connection', 'close')
            if self.path == page:
                self.send_header('X-Safari-Ready', callback)
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
            if self.path == callback and time.monotonic() <= deadline:
                ready.set()
                print(f'sim-lane: Safari owned frame callback received in {time.monotonic() - started:.3f}s', file=sys.stderr)

        def log_message(self, _format, *_args):
            pass

    class ProbeServer(ThreadingHTTPServer):
        def server_bind(self):
            # HTTPServer otherwise reverse-resolves the fixed loopback host.
            # This probe needs no resolver work inside its readiness budget.
            TCPServer.server_bind(self)
            self.server_name, self.server_port = self.server_address

    with ProbeServer(('127.0.0.1', 0), Handler) as server:
        server.daemon_threads = True
        thread = threading.Thread(target=lambda: server.serve_forever(poll_interval=.02), daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}{page}', ready
        finally:
            server.shutdown()
            thread.join()


def open_ready_page(udid, url, ready, deadline, timeout, started):
    code, detail = 124, 'URL service did not respond'
    attempts = 0
    while True:
        if ready.is_set():
            print(f'sim-lane: Safari readiness page reached two animation frames in {time.monotonic() - started:.3f}s; {detail}', file=sys.stderr)
            return 0
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            print(f'sim-lane: Safari URL readiness timed out after {timeout:g}s: {detail}', file=sys.stderr)
            return code
        attempts += 1
        attempt_started = time.monotonic()
        print(f'sim-lane: Safari openurl attempt {attempts} started at {attempt_started - started:.3f}s', file=sys.stderr)
        with native_transcript() as errors, subprocess.Popen(['xcrun', 'simctl', 'openurl', udid, url],
                              stdout=subprocess.DEVNULL, stderr=errors, text=True) as child:
            attempt_deadline = min(deadline, time.monotonic() + 10)
            while child.poll() is None and not ready.is_set() and time.monotonic() < attempt_deadline:
                ready.wait(min(.05, max(0, attempt_deadline - time.monotonic())))
            if child.poll() is None:
                child.kill()
                child.wait()
                code = 124
                detail = 'openurl client stopped after frame proof' if ready.is_set() else 'openurl did not respond before its deadline'
                partial_error = native_text(errors).strip()
                if partial_error:
                    detail += f'; native stderr: {partial_error[-2048:]}'
            else:
                error = native_text(errors)
                code = child.returncode if child.returncode >= 0 else 128 - child.returncode
                detail = error.strip() or f'openurl exited {code}'
                if code == 0 and not ready.is_set():
                    # Accepted URL alone is insufficient; spend only the
                    # existing readiness budget waiting for actual frames.
                    print(f'sim-lane: Safari URL accepted in {time.monotonic() - started:.3f}s; awaiting owned frame callback', file=sys.stderr)
                    if ready.wait(max(0, deadline - time.monotonic())):
                        detail = 'owned two-frame callback confirmed'
                    else:
                        code, detail = 124, 'accepted URL but readiness page never reached frame callbacks'
            print(f'sim-lane: Safari openurl attempt {attempts} settled in {time.monotonic() - attempt_started:.3f}s; '
                  f'client exit {code}; ownedFrames={ready.is_set()}; {detail[-2048:]}', file=sys.stderr)
        if not ready.is_set():
            ready.wait(min(1, max(0, deadline - time.monotonic())))


def wait_for_safari(udid):
    try:
        timeout = float(os.environ.get('SIM_SAFARI_READY_TIMEOUT', '120'))
    except ValueError:
        timeout = 0
    if not math.isfinite(timeout) or not 0 < timeout <= 600:
        print('sim-lane: SIM_SAFARI_READY_TIMEOUT must be in (0, 600] seconds', file=sys.stderr)
        return 64
    deadline = time.monotonic() + timeout
    # Start the app once. Its launch RPC may remain pending after the actual
    # device-owned process exists; only the subsequent frame callback can
    # publish a lease. Every phase shares the original readiness deadline.
    started = time.monotonic()
    evidence = {'checks': 0, 'timeouts': 0, 'totalMs': 0.0, 'maxMs': 0.0}
    def report_process_evidence():
        print(f'sim-lane: Safari launch process evidence {json.dumps(evidence)}', file=sys.stderr)
    with native_transcript() as output, native_transcript() as errors:
        with subprocess.Popen(['xcrun', 'simctl', 'launch', udid, 'com.apple.mobilesafari'],
                              stdout=output, stderr=errors, text=True) as launch:
            next_process_check = started + 1
            try:
                while launch.poll() is None:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        launch.kill()
                        launch.wait()
                        elapsed = time.monotonic() - started
                        print(f'sim-lane: Safari app launch timed out within {timeout:g}s readiness deadline; '
                              f'observed wall {elapsed:.3f}s', file=sys.stderr)
                        for label, stream in (('stdout', output), ('stderr', errors)):
                            detail = native_text(stream).strip()
                            print(f'sim-lane: Safari timed-out launch {label}: {detail[-2048:] or "<empty>"}', file=sys.stderr)
                        report_process_evidence()
                        return 124
                    if time.monotonic() >= next_process_check:
                        pid = owned_safari_process(udid, remaining, evidence)
                        next_process_check = time.monotonic() + 1
                        if pid is not None:
                            report_process_evidence()
                            print(f'sim-lane: owned Safari process {pid} in {time.monotonic() - started:.3f}s before launch client replied; '
                                  'requiring owned frame proof', file=sys.stderr)
                            with readiness_page(deadline, started) as (url, ready):
                                return open_ready_page(udid, url, ready, deadline, timeout, started)
                    threading.Event().wait(max(0, min(.05, deadline - time.monotonic())))
            finally:
                # Retire only our launch RPC, never the observed Safari app.
                # A live app without the owned frames still refuses above.
                if launch.poll() is None:
                    launch.kill()
                    launch.wait()
            launch_output, launch_error = native_text(output), native_text(errors)
    report_process_evidence()
    elapsed = time.monotonic() - started
    if launch.returncode != 0:
        print(f'sim-lane: Safari app launch failed in {elapsed:.3f}s: {launch_error.strip()}', file=sys.stderr)
        return launch.returncode if launch.returncode > 0 else 128 - launch.returncode
    print(f'sim-lane: Safari app launched in {elapsed:.3f}s: {launch_output.strip()}', file=sys.stderr)
    with readiness_page(deadline, started) as (url, ready):
        return open_ready_page(udid, url, ready, deadline, timeout, started)


if __name__ == '__main__':
    print(f'sim-lane: Safari readiness Python imports finished in {time.monotonic() - IMPORT_STARTED:.3f}s', file=sys.stderr)
    sys.exit(wait_for_safari(sys.argv[1]))
