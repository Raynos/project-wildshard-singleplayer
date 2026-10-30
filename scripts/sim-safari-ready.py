"""Wait for a native Safari document's frame callbacks within one wall deadline."""
import sys
import time

IMPORT_STARTED = time.monotonic()

from contextlib import contextmanager
import math
import json
import os
from pathlib import Path
import secrets
from socketserver import StreamRequestHandler, ThreadingTCPServer
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


def owned_launch_pid(text):
    """A complete PID receipt from our exact UDID-bound launch command.

    This permits asking for the owned probe URL, never granting readiness.
    Read only that command's output; no process inventory is spawned.
    """
    for line in text.splitlines(keepends=True):
        if not line.endswith('\n'):
            continue
        app, separator, value = line.rstrip('\r\n').partition(':')
        value = value.strip()
        if (separator and app == 'com.apple.mobilesafari'
                and value.isascii() and value.isdigit() and int(value) > 0):
            return int(value)
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

    class Handler(StreamRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(1)

        def reply(self, code, body, probe=False):
            reason = {200: 'OK', 400: 'Bad Request', 404: 'Not Found',
                      431: 'Request Header Fields Too Large', 501: 'Not Implemented'}[code]
            headers = [f'HTTP/1.0 {code} {reason}', 'Content-Type: text/html; charset=utf-8',
                       f'Content-Length: {len(body)}', 'Cache-Control: no-store', 'Connection: close']
            if probe:
                headers.append(f'X-Safari-Ready: {callback}')
            self.wfile.write(('\r\n'.join(headers) + '\r\n\r\n').encode() + body)
            self.wfile.flush()

        def handle(self):
            # Only the owned loopback GET probe is served. Bound parsing under
            # the same one-second connection limit; no HTTP/email/MIME stack.
            line = self.rfile.readline(8193)
            parts = line.split()
            if len(line) > 8192 or len(parts) != 3 or parts[2] not in (b'HTTP/1.0', b'HTTP/1.1'):
                self.reply(400, b'Bad request')
                return
            size = len(line)
            for _ in range(100):
                header = self.rfile.readline(8193)
                size += len(header)
                if not header or len(header) > 8192 or size > 16384:
                    self.reply(431, b'Invalid headers')
                    return
                if header in (b'\r\n', b'\n'):
                    break
            else:
                self.reply(431, b'Too many headers')
                return
            if parts[0] != b'GET':
                self.reply(501, b'GET only')
                return
            path = parts[1]
            if path not in (page.encode(), callback.encode()):
                self.reply(404, b'Not found')
                return
            probe = path == page.encode()
            if probe and not requested.is_set():
                requested.set()
                print(f'sim-lane: Safari readiness document requested in {time.monotonic() - started:.3f}s', file=sys.stderr)
            self.reply(200, document if probe else b'ready', probe)
            if not probe and time.monotonic() <= deadline:
                ready.set()
                print(f'sim-lane: Safari owned frame callback received in {time.monotonic() - started:.3f}s', file=sys.stderr)

    # TCPServer binds the fixed loopback address without reverse-DNS work.
    with ThreadingTCPServer(('127.0.0.1', 0), Handler) as server:
        server.daemon_threads = True
        thread = threading.Thread(target=lambda: server.serve_forever(poll_interval=.02), daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_address[1]}{page}', ready
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
    evidence = {'source': 'owned-launch-output', 'checks': 0, 'totalMs': 0.0, 'maxMs': 0.0}
    next_receipt_check = started
    def report_receipt_evidence():
        print(f'sim-lane: Safari launch receipt evidence {json.dumps(evidence)}', file=sys.stderr)
    with native_transcript() as output, native_transcript() as errors:
        with subprocess.Popen(['xcrun', 'simctl', 'launch', udid, 'com.apple.mobilesafari'],
                              stdout=output, stderr=errors, text=True) as launch:
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
                        report_receipt_evidence()
                        return 124
                    if time.monotonic() >= next_receipt_check:
                        sample = time.monotonic()
                        # Read at most one small page of our already-open output.
                        # A ps spawn exceeded its nominal timeout by72s in ff31.
                        pid = owned_launch_pid(os.pread(output.fileno(), 4096, 0).decode(errors='replace'))
                        cost = (time.monotonic() - sample) * 1000
                        evidence['checks'] += 1
                        evidence['totalMs'] = round(evidence['totalMs'] + cost, 3)
                        evidence['maxMs'] = round(max(evidence['maxMs'], cost), 3)
                        next_receipt_check = time.monotonic() + .25
                        if pid is not None:
                            report_receipt_evidence()
                            print(f'sim-lane: owned Safari launch receipt {pid} in {time.monotonic() - started:.3f}s before launch client replied; '
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
    report_receipt_evidence()
    elapsed = time.monotonic() - started
    if launch.returncode != 0:
        print(f'sim-lane: Safari app launch failed in {elapsed:.3f}s: {launch_error.strip()}', file=sys.stderr)
        return launch.returncode if launch.returncode > 0 else 128 - launch.returncode
    print(f'sim-lane: Safari app launched in {elapsed:.3f}s: {launch_output.strip()}', file=sys.stderr)
    with readiness_page(deadline, started) as (url, ready):
        return open_ready_page(udid, url, ready, deadline, timeout, started)


if __name__ == '__main__':
    print(f'sim-lane: Safari readiness Python imports finished in {time.monotonic() - IMPORT_STARTED:.3f}s', file=sys.stderr, flush=True)
    if sys.argv[2:] == ['--await-bootstatus']:
        status = sys.stdin.readline().strip()
        if not status.isdecimal() or not 0 <= int(status) <= 255:
            print('sim-lane: missing or invalid bootstatus prerequisite', file=sys.stderr)
            sys.exit(64)
        if int(status) != 0:
            sys.exit(int(status))
        print(f'sim-lane: bootstatus prerequisite accepted after {time.monotonic() - IMPORT_STARTED:.3f}s; starting original Safari proof deadline', file=sys.stderr)
    elif sys.argv[2:]:
        print('sim-lane: invalid Safari readiness arguments', file=sys.stderr)
        sys.exit(64)
    sys.exit(wait_for_safari(sys.argv[1]))
