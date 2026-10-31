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


def selected_simctl():
    # The runner already pins this Xcode. Avoid PATH and xcrun tool resolution
    # without another discovery RPC; unavailable installations keep the old CLI.
    developer = os.environ.get('DEVELOPER_DIR', '')
    if os.path.isabs(developer):
        executable = Path(developer) / 'usr/bin/simctl'
        try:
            if executable.is_file() and os.access(executable, os.X_OK):
                return (str(executable),)
        except OSError:
            pass
    return ('xcrun', 'simctl')


# One selection, charged to the existing import/admission interval.
SIMCTL_COMMAND = selected_simctl()


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
def readiness_page(deadline, started=None, lifecycle=None):
    # Port 9 is a Fetch bad port, not a usable Safari warm-up document.
    # An unpredictable local page proves two real frames, without app assets,
    # external networking, an error page or a LaunchServices exit-code guess.
    token = secrets.token_hex(12)
    page, callback = f'/safari/{token}', f'/ready/{token}'
    ready = threading.Event()
    requested = threading.Event()
    started = time.monotonic() if started is None else started
    # Transport milestones are diagnostic; only the owned callback grants frames.
    phases = {name: {'count': 0, 'firstSeconds': None, 'lastSeconds': None}
              for name in ('accept', 'request', 'flush', 'callbackRequest', 'callbackFlush')}
    phase_lock = threading.Lock()
    listener = {'boundAddress': None, 'startedAt': None, 'cycles': 0,
                'firstCycleAt': None, 'lastCycleAt': None, 'stoppedAt': None,
                'aliveBeforeShutdown': None, 'errorType': None}

    def record_http(name):
        with phase_lock:
            when = round(time.monotonic() - started, 3)
            phase = phases[name]
            phase['count'] += 1
            if phase['firstSeconds'] is None:
                phase['firstSeconds'] = when
            phase['lastSeconds'] = when

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
            record_http('request' if probe else 'callbackRequest')
            first_probe = probe and not requested.is_set()
            if first_probe:
                requested.set()
            self.reply(200, document if probe else b'ready', probe)
            record_http('flush' if probe else 'callbackFlush')
            if first_probe:
                print(f'sim-lane: Safari readiness document requested in {time.monotonic() - started:.3f}s', file=sys.stderr)
            if not probe and time.monotonic() <= deadline:
                ready.set()
                print(f'sim-lane: Safari owned frame callback received in {time.monotonic() - started:.3f}s', file=sys.stderr)

    class ReadinessServer(ThreadingTCPServer):
        def service_actions(self):
            # Observe the existing selector cycle, without adding a poll, a
            # connection, or a readiness condition of our own.
            super().service_actions()
            with phase_lock:
                when = round(time.monotonic() - started, 3)
                listener['cycles'] += 1
                if listener['firstCycleAt'] is None:
                    listener['firstCycleAt'] = when
                listener['lastCycleAt'] = when

        def get_request(self):
            connection = super().get_request()
            record_http('accept')
            return connection

        def handle_error(self, request, client_address):
            # socketserver's default logger imports traceback after printing
            # its heading. Keep the actual exception/phase in one flushed
            # record, without importing or reading source on this cold path.
            _, error, trace = sys.exc_info()
            frames = []
            for _ in range(8):
                if trace is None:
                    break
                code = trace.tb_frame.f_code
                frames.append({'file': code.co_filename, 'function': code.co_name, 'line': trace.tb_lineno})
                trace = trace.tb_next
            evidence = {'elapsedSeconds': time.monotonic() - started,
                        'documentRequested': requested.is_set(), 'ownedFrames': ready.is_set(),
                        'errorType': type(error).__name__, 'message': str(error)[:512], 'frames': frames}
            print('sim-lane: Safari readiness handler error ' + json.dumps(evidence), file=sys.stderr, flush=True)

    # TCPServer binds the fixed loopback address without reverse-DNS work.
    with ReadinessServer(('127.0.0.1', 0), Handler) as server:
        server.daemon_threads = True
        listener['boundAddress'] = {'host': server.server_address[0], 'port': server.server_address[1]}

        def serve():
            listener['startedAt'] = round(time.monotonic() - started, 3)
            try:
                server.serve_forever(poll_interval=.02)
            except BaseException as error:
                listener['errorType'] = type(error).__name__
                raise
            finally:
                listener['stoppedAt'] = round(time.monotonic() - started, 3)

        thread = threading.Thread(target=serve, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_address[1]}{page}', ready
        finally:
            listener['aliveBeforeShutdown'] = thread.is_alive()
            server.shutdown()
            thread.join()
            if lifecycle is not None:
                with phase_lock:
                    lifecycle['http'] = {name: dict(phase) for name, phase in phases.items()}
                    lifecycle['listener'] = dict(listener)


def open_ready_page(udid, url, ready, deadline, timeout, started, launch_state=None, lifecycle=None):
    code, detail = 124, 'URL service did not respond'
    if lifecycle is not None:
        lifecycle['destination'] = url
    attempts, accepted, pending_delivery, pending_before_launch = 0, False, False, False
    ownership = launch_state if launch_state is not None else lambda: 0

    def stamp(record, phase):
        if record is not None:
            record[phase] = round(time.monotonic() - started, 3)

    while True:
        launch_code = ownership()
        if launch_code is not None and launch_code != 0:
            return launch_code
        if ready.is_set() and launch_code == 0:
            print(f'sim-lane: Safari readiness page reached two animation frames in {time.monotonic() - started:.3f}s; '
                  'owned launch and owned two-frame callback confirmed', file=sys.stderr)
            return 0
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            print(f'sim-lane: Safari URL readiness timed out after {timeout:g}s: {detail}', file=sys.stderr)
            return 124 if code == 0 else code
        if pending_delivery and pending_before_launch and launch_code == 0:
            # The app prerequisite changed after a request made during launch.
            # Permit its first launched-state delivery, never a timed replay
            # while that prerequisite remains unchanged.
            pending_delivery = False
            print('sim-lane: owned app launch confirmed; delivering its probe once in the launched state', file=sys.stderr)
        if ready.is_set() or accepted or pending_delivery:
            # A completed delivery or a stopped unresponsive client can leave
            # this exact URL queued in native services. Await its owned page
            # instead of issuing duplicates under the same launch state.
            threading.Event().wait(min(.05, remaining))
            continue
        attempts += 1
        launch_pending = launch_code is None
        attempt_started = time.monotonic()
        attempt_deadline = min(deadline, attempt_started + 10)
        record = None
        if lifecycle is not None:
            record = {'attempt': attempts, 'offeredAt': round(attempt_started - started, 3),
                      'deadlineAt': round(attempt_deadline - started, 3),
                      **{phase: None for phase in ('spawnRequestedAt', 'spawnedAt', 'killAt',
                         'reapRequestedAt', 'reapedAt', 'settledAt', 'exitedAt')},
                      'nativeReturnCode': None, 'result': None}
            lifecycle['count'] += 1
            if len(lifecycle['samples']) == 4:
                lifecycle['samples'].pop(0)
                lifecycle['omitted'] += 1
            lifecycle['samples'].append(record)
        print(f'sim-lane: Safari openurl attempt {attempts} started at {attempt_started - started:.3f}s', file=sys.stderr)
        stamp(record, 'spawnRequestedAt')
        with native_transcript() as errors, subprocess.Popen([*SIMCTL_COMMAND, 'openurl', udid, url],
                              stdout=subprocess.DEVNULL, stderr=errors, text=True) as child:
            stamp(record, 'spawnedAt')
            while child.poll() is None and not ready.is_set() and time.monotonic() < attempt_deadline:
                launch_code = ownership()
                if launch_code is not None and launch_code != 0:
                    break
                ready.wait(min(.05, max(0, attempt_deadline - time.monotonic())))
            if child.poll() is None:
                stamp(record, 'killAt')
                child.kill()
                stamp(record, 'reapRequestedAt')
                child.wait()
                stamp(record, 'reapedAt')
                code = 124
                pending_delivery, pending_before_launch = not ready.is_set(), launch_pending
                detail = 'openurl client stopped after frame proof' if ready.is_set() else 'openurl did not respond before its deadline; awaiting the same owned page'
                partial_error = native_text(errors).strip()
                if partial_error:
                    detail += f'; native stderr: {partial_error[-2048:]}'
            else:
                stamp(record, 'reapedAt')
                error = native_text(errors)
                code = child.returncode if child.returncode >= 0 else 128 - child.returncode
                detail = error.strip() or f'openurl exited {code}'
                if code == 0 and not ready.is_set():
                    accepted = True
                    print(f'sim-lane: Safari URL accepted in {time.monotonic() - started:.3f}s; awaiting owned frame callback', file=sys.stderr)
                    detail = 'URL accepted; owned two-frame callback pending'
            if record is not None:
                record['nativeReturnCode'], record['result'] = child.returncode, code
            stamp(record, 'settledAt')
            print(f'sim-lane: Safari openurl attempt {attempts} settled in {time.monotonic() - attempt_started:.3f}s; '
                  f'client exit {code}; ownedFrames={ready.is_set()}; {detail[-2048:]}', file=sys.stderr)
        stamp(record, 'exitedAt')
        if launch_code is not None and launch_code != 0:
            return launch_code
        if not ready.is_set() and not accepted and not pending_delivery:
            current_launch = ownership()
            if current_launch is not None and current_launch != 0:
                return current_launch
            if launch_pending and current_launch == 0:
                # The failed request raced app initialization. Its prerequisite
                # has now changed; no arbitrary backoff is needed for that edge.
                # Later failures retain the existing one-second service delay.
                continue
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
    # Start the app once and deliver its one owned probe concurrently. A slow
    # launch reply must not postpone the document until the final few seconds.
    # Neither proof alone grants a lease; both keep the same wall deadline.
    started = time.monotonic()
    evidence = {'source': 'owned-launch-output', 'checks': 0, 'totalMs': 0.0, 'maxMs': 0.0}
    next_receipt_check, admitted = started, False
    def report_receipt_evidence():
        print(f'sim-lane: Safari launch receipt evidence {json.dumps(evidence)}', file=sys.stderr)
    lifecycle = {'simctlCommand': list(SIMCTL_COMMAND), 'launch': {phase: None for phase in ('spawnRequestedAt', 'spawnedAt',
                 'ownedAt', 'completedAt', 'killAt', 'reapRequestedAt', 'reapedAt')},
                 'url': {'count': 0, 'omitted': 0, 'samples': []}, 'http': None}
    lifecycle['launch']['nativeReturnCode'] = None
    result, ready = None, None

    def stamp_launch(phase):
        lifecycle['launch'][phase] = round(time.monotonic() - started, 3)

    try:
        with native_transcript() as output, native_transcript() as errors, readiness_page(deadline, started, lifecycle) as (url, ready):
            stamp_launch('spawnRequestedAt')
            with subprocess.Popen([*SIMCTL_COMMAND, 'launch', udid, 'com.apple.mobilesafari'],
                                  stdout=output, stderr=errors, text=True) as launch:
                stamp_launch('spawnedAt')
                def launch_state():
                    nonlocal next_receipt_check, admitted
                    status = launch.poll()
                    if status is not None and lifecycle['launch']['completedAt'] is None:
                        stamp_launch('completedAt')
                        lifecycle['launch']['nativeReturnCode'] = status
                    if status is not None and status != 0:
                        print(f'sim-lane: Safari app launch failed in {time.monotonic() - started:.3f}s: '
                              f'{native_text(errors).strip()}', file=sys.stderr)
                        report_receipt_evidence()
                        return status if status > 0 else 128 - status
                    if admitted:
                        return 0
                    if time.monotonic() >= deadline:
                        print(f'sim-lane: Safari app launch timed out within {timeout:g}s readiness deadline; '
                              f'observed wall {time.monotonic() - started:.3f}s', file=sys.stderr)
                        for label, stream in (('stdout', output), ('stderr', errors)):
                            detail = native_text(stream).strip()
                            print(f'sim-lane: Safari timed-out launch {label}: {detail[-2048:] or "<empty>"}', file=sys.stderr)
                        report_receipt_evidence()
                        return 124
                    if status == 0:
                        stamp_launch('ownedAt')
                        admitted = True
                        print(f'sim-lane: Safari app launched in {time.monotonic() - started:.3f}s: '
                              f'{native_text(output).strip()}', file=sys.stderr)
                        report_receipt_evidence()
                        return 0
                    if time.monotonic() >= next_receipt_check:
                        sample = time.monotonic()
                        # Snapshot our exact launch output, never a process census.
                        pid = owned_launch_pid(os.pread(output.fileno(), 4096, 0).decode(errors='replace'))
                        cost = (time.monotonic() - sample) * 1000
                        evidence['checks'] += 1
                        evidence['totalMs'] = round(evidence['totalMs'] + cost, 3)
                        evidence['maxMs'] = round(max(evidence['maxMs'], cost), 3)
                        next_receipt_check = time.monotonic() + .25
                        # The native read itself can cross the wall deadline. An
                        # earlier document cannot make that late launch proof valid.
                        if time.monotonic() >= deadline:
                            print('sim-lane: Safari launch receipt read crossed the readiness deadline', file=sys.stderr)
                            report_receipt_evidence()
                            return 124
                        if pid is not None:
                            stamp_launch('ownedAt')
                            admitted = True
                            print(f'sim-lane: owned Safari launch receipt {pid} in {time.monotonic() - started:.3f}s before launch client replied; '
                                  'requiring owned frame proof', file=sys.stderr)
                            report_receipt_evidence()
                            return 0
                    return None
                try:
                    result = open_ready_page(udid, url, ready, deadline, timeout, started, launch_state, lifecycle['url'])
                    return result
                finally:
                    # Retire only our launch RPC, never the observed Safari app.
                    if launch.poll() is None:
                        stamp_launch('killAt')
                        launch.kill()
                        stamp_launch('reapRequestedAt')
                        launch.wait()
                    stamp_launch('reapedAt')
                    lifecycle['launch']['nativeReturnCode'] = getattr(launch, 'returncode', lifecycle['launch']['nativeReturnCode'])
    finally:
        lifecycle.update(result=result, ownedLaunch=admitted,
                         ownedFrames=ready.is_set() if ready is not None else None,
                         recordedAt=round(time.monotonic() - started, 3), limitSeconds=timeout)
        try:
            print('sim-lane: Safari lifecycle receipt ' + json.dumps(lifecycle), file=sys.stderr, flush=True)
        except OSError:
            # A broken diagnostic sink cannot replace the native result or
            # an exception already propagating from the owned operation.
            pass


def wait_for_bootstatus(udid, remaining):
    # The shell supplies the remaining original admission budget. Importing
    # this one helper spends that budget; it cannot start a second full wait.
    deadline = IMPORT_STARTED + remaining
    budget = deadline - time.monotonic()
    if budget <= 0:
        print('sim-lane: bootstatus admission expired during Python imports', file=sys.stderr, flush=True)
        return 75
    started = time.monotonic()
    print('sim-lane: device bootstatus started', file=sys.stderr, flush=True)
    try:
        result = subprocess.run([*SIMCTL_COMMAND, 'bootstatus', udid, '-b', '-d'],
                                stdout=sys.stderr, timeout=budget, check=False)
        code = result.returncode if result.returncode >= 0 else 128 - result.returncode
        if code == 0 and time.monotonic() >= deadline:
            print('sim-lane: bootstatus success observed after admission deadline', file=sys.stderr, flush=True)
            code = 75
    except subprocess.TimeoutExpired:
        print(f'sim-lane: bootstatus admission timed out; owned helper {os.getpid()}, parent {os.getppid()}, device {udid}',
              file=sys.stderr, flush=True)
        code = 75
    print(f'sim-lane: device bootstatus finished in {time.monotonic() - started:.3f}s (exit {code})',
          file=sys.stderr, flush=True)
    return code


if __name__ == '__main__':
    print(f'sim-lane: Safari readiness Python imports finished in {time.monotonic() - IMPORT_STARTED:.3f}s', file=sys.stderr, flush=True)
    if len(sys.argv) == 4 and sys.argv[2] == '--bootstatus':
        try:
            remaining = float(sys.argv[3])
        except ValueError:
            remaining = 0
        if not math.isfinite(remaining) or not 0 < remaining <= 300:
            print('sim-lane: invalid remaining bootstatus admission budget', file=sys.stderr)
            sys.exit(64)
        code = wait_for_bootstatus(sys.argv[1], remaining)
        if code != 0:
            sys.exit(code)
        print(f'sim-lane: bootstatus prerequisite accepted after {time.monotonic() - IMPORT_STARTED:.3f}s; starting original Safari proof deadline', file=sys.stderr)
    elif sys.argv[2:] == ['--await-bootstatus']:
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
