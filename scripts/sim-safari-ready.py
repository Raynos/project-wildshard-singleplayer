"""Wait for a native Safari document's frame callbacks within one wall deadline."""
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import math
import os
from pathlib import Path
import secrets
from socketserver import TCPServer
import subprocess
import sys
import tempfile
import threading
import time


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
    while True:
        if ready.is_set():
            print(f'sim-lane: Safari readiness page reached two animation frames in {time.monotonic() - started:.3f}s; {detail}', file=sys.stderr)
            return 0
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            print(f'sim-lane: Safari URL readiness timed out after {timeout:g}s: {detail}', file=sys.stderr)
            return code
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
    # Boot completion is not Safari launch completion. Start the actual app
    # once before asking its URL service to accept a page. This shares the
    # original readiness deadline; a failed launch never publishes a lease.
    started = time.monotonic()
    try:
        with native_transcript() as output, native_transcript() as errors:
            launch = subprocess.run(['xcrun', 'simctl', 'launch', udid, 'com.apple.mobilesafari'],
                stdout=output, stderr=errors, text=True,
                timeout=max(0.001, deadline - started), check=False)
            launch_output, launch_error = native_text(output), native_text(errors)
    except subprocess.TimeoutExpired:
        print(f'sim-lane: Safari app launch timed out within {timeout:g}s readiness deadline', file=sys.stderr)
        return 124
    elapsed = time.monotonic() - started
    if launch.returncode != 0:
        print(f'sim-lane: Safari app launch failed in {elapsed:.3f}s: {launch_error.strip()}', file=sys.stderr)
        return launch.returncode if launch.returncode > 0 else 128 - launch.returncode
    print(f'sim-lane: Safari app launched in {elapsed:.3f}s: {launch_output.strip()}', file=sys.stderr)
    with readiness_page(deadline, started) as (url, ready):
        return open_ready_page(udid, url, ready, deadline, timeout, started)


if __name__ == '__main__':
    sys.exit(wait_for_safari(sys.argv[1]))
