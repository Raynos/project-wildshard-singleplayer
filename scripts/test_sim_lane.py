"""Real Bash startup/handover against an isolated simctl fixture."""
import json
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from types import FunctionType, SimpleNamespace
import os
from pathlib import Path
import runpy
import select
import signal
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.parse import urlsplit
from urllib.error import HTTPError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
UDID = '00000000-0000-0000-0000-000000000016'
READY = runpy.run_path(str(ROOT / 'scripts/sim-safari-ready.py'))


class SimulatorReadinessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='sim-readiness-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.env = {**os.environ, 'PATH': f'{self.bin}:{os.environ["PATH"]}',
            'SIM_LANE_DIR': str(self.root / 'lane'), 'SIM_FIXTURE': str(self.root),
            'SIM_SAFARI_READY_TIMEOUT': '5'}
        self.command('xcrun', '''import json,os,pathlib,sys,time
root=pathlib.Path(os.environ['SIM_FIXTURE']);args=sys.argv[1:]
if args[1]=='launch' and os.environ.get('SIM_REVERSE_CHILD_LOGS'):
    while not (root/'openurl-child-observed').exists(): time.sleep(.01)
with (root/'calls').open('a') as output: output.write(json.dumps(args)+'\\n')
if args[1]=='openurl': (root/'openurl-child-observed').touch()
if os.environ.get('SIM_HELD_NATIVE_OUTPUT')==args[1]:
    import subprocess
    child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'],stdin=subprocess.DEVNULL)
    (root/'output-holder').write_text(str(child.pid))
booted=root/'booted'
if args[:3]==['simctl','list','devices']:
    time.sleep(float(os.environ.get('SIM_LIST_DELAY','0')))
    rows=[{'udid':''' + repr(UDID) + ''','name':'wildshard-iphone'}]
    print(json.dumps({'devices':{'iOS':rows if 'booted' not in args or booted.exists() else []}}))
elif args[1]=='boot':
    code=int(os.environ.get('SIM_BOOT_RC','0'))
    if code==0: booted.touch()
    sys.exit(code)
elif args[1]=='bootstatus':
    print('Finished',flush=True)
    if os.environ.get('SIM_STATUS_HANG'): time.sleep(30)
    sys.exit(int(os.environ.get('SIM_STATUS_RC','0')))
elif args[1]=='launch':
    if os.environ.get('SIM_LAUNCH_NEEDS_DOCUMENT'):
        (root/'safari-launched').touch()
        while not (root/'safari-rendered').exists(): time.sleep(.01)
    if os.environ.get('SIM_LAUNCH_IPC_STALL'):
        (root/'safari-launched').touch()
        time.sleep(30)
    if os.environ.get('SIM_LAUNCH_PARTIAL_ERROR'):
        print('native launch pending reply',file=sys.stderr,flush=True)
    time.sleep(float(os.environ.get('SIM_LAUNCH_DELAY','0')))
    code=int(os.environ.get('SIM_LAUNCH_RC','0'))
    if code==0:
        (root/'safari-launched').touch();print('com.apple.mobilesafari: 123',flush=True)
        if os.environ.get('SIM_LAUNCH_RECEIPT_STALL'): time.sleep(30)
    sys.exit(code)
elif args[1]=='openurl':
    if os.environ.get('SIM_REQUIRES_LAUNCH') and not (root/'safari-launched').exists():
        print('Safari has no running application',file=sys.stderr);sys.exit(60)
    count=root/'attempts';n=int(count.read_text())+1 if count.exists() else 1;count.write_text(str(n))
    if os.environ.get('SIM_OPEN_HANG'): time.sleep(30)
    if n<=int(os.environ.get('SIM_OPEN_FAILURES','0')):
        print('URL service unavailable (60)',file=sys.stderr);sys.exit(60)
    import urllib.parse,urllib.request
    with urllib.request.urlopen(args[-1],timeout=2) as response:
        callback=response.headers['X-Safari-Ready'];body=response.read()
    if os.environ.get('SIM_OPEN_ASYNC_FRAME'):
        import subprocess
        code='import pathlib,sys,time,urllib.request;time.sleep(.1);pathlib.Path(sys.argv[1]).touch();urllib.request.urlopen(sys.argv[2],timeout=2).read()'
        subprocess.Popen([sys.executable,'-c',code,str(root/'safari-rendered'),urllib.parse.urljoin(args[-1],callback)],
            stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    elif not os.environ.get('SIM_OPEN_NO_FRAME'):
        assert b'requestAnimationFrame' in body
        (root/'safari-rendered').touch()
        with urllib.request.urlopen(urllib.parse.urljoin(args[-1],callback),timeout=2) as response:
            assert response.read()==b'ready'
    if os.environ.get('SIM_OPEN_HANG_AFTER_FRAME'): time.sleep(30)
elif args[1]=='shutdown': booted.unlink(missing_ok=True)
else: raise RuntimeError('Unexpected fixture command '+repr(args))
''')
        # No test touches real devices, Simulator.app or machine admission locks.
        self.command('lockf', 'pass\n')
        self.command('pgrep', 'import sys\nsys.exit(1)\n')
        self.command('osascript', "raise RuntimeError('No app should be touched')\n")
        self.child = self.root / 'child.py'
        self.child.write_text("import os,pathlib\nr=pathlib.Path(os.environ['SIM_FIXTURE']);assert (r/'safari-rendered').exists();(r/'child-ran').write_text((r/'attempts').read_text())\n")
        self.addCleanup(self.release_output_holder)
        self.assertIsNotNone(shutil.which('jq'))

    def release_output_holder(self):
        path = self.root / 'output-holder'
        if path.exists():
            try:
                os.kill(int(path.read_text()), signal.SIGTERM)
            except ProcessLookupError:
                pass

    def command(self, name, code):
        path = self.bin / name
        path.write_text(f'#!{sys.executable}\n' + code)
        path.chmod(0o755)

    def lane(self, mode='run', device='wildshard-iphone', **extra):
        args = ['/bin/bash', str(ROOT / 'scripts/sim-lane.sh'), mode, device]
        if mode == 'run':
            args.extend([sys.executable, str(self.child)])
        return subprocess.run(args, env={**self.env, **extra}, text=True,
            capture_output=True, timeout=10, check=False)

    def calls(self):
        return [json.loads(line) for line in (self.root / 'calls').read_text().splitlines()]

    def assert_not_handed_over(self):
        self.assertFalse((self.root / 'child-ran').exists())
        self.assertFalse((self.root / 'lane' / f'{UDID}.lease').exists())

    def immediate_url_failure_fixture(self):
        """Inject the service error without two unrelated Python cold starts.

        Delay, hang, late-frame and foreign-frame controls keep the full fake.
        This case checks native exit 60 propagation inside its original .15s.
        """
        command = self.bin / 'xcrun'
        original = self.bin / 'xcrun-python'
        original.write_bytes(command.read_bytes())
        original.chmod(0o755)
        command.write_text('''#!/bin/bash
if [ "$#" -eq 4 ] && [ "$1" = simctl ]; then
  case "$2:$4" in
    launch:com.apple.mobilesafari|openurl:http://127.0.0.1:*)
      printf '["%s","%s","%s","%s"]\\n' "$1" "$2" "$3" "$4" >> "$SIM_FIXTURE/calls"
      if [ "$2" = launch ]; then
        touch "$SIM_FIXTURE/safari-launched"
        printf 'com.apple.mobilesafari: 123\\n'
        exit 0
      fi
      n=0
      if [ -f "$SIM_FIXTURE/attempts" ]; then read -r n < "$SIM_FIXTURE/attempts"; fi
      printf '%s' "$((n+1))" > "$SIM_FIXTURE/attempts"
      printf 'URL service unavailable (60)\\n' >&2
      exit 60
      ;;
  esac
fi
exec "$SIM_FIXTURE/bin/xcrun-python" "$@"
''')

    def test_unlisted_device_is_refused_and_never_created(self):
        # G563: a lane never creates a device; only the machine's three named devices run
        result = self.lane(device='sf57-sp-x3-new-phone')
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn('refusing device', result.stderr)
        self.assert_not_handed_over()
        self.assertFalse(any(call[1:2] == ['create'] for call in self.calls()))

    def test_missing_listed_device_is_refused_not_created(self):
        result = self.lane(device='wildshard-loading')
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn('does not exist', result.stderr)
        self.assertFalse(any(call[1:2] == ['create'] for call in self.calls()))

    def test_system_bash_parses(self):
        subprocess.run(['/bin/bash', '-n', str(ROOT / 'scripts/sim-lane.sh')], check=True)

    def test_bootstatus_failure_propagates_and_releases_new_device(self):
        result = self.lane(SIM_STATUS_RC='23')
        self.assertEqual(result.returncode, 23, result.stderr)
        self.assertIn('Finished', result.stderr)
        self.assert_not_handed_over()
        self.assertFalse((self.root / 'booted').exists())
        self.assertFalse(any(row[1] == 'openurl' for row in self.calls()))

    def test_hung_bootstatus_keeps_the_admission_limit_and_never_launches_safari(self):
        started = time.monotonic()
        result = self.lane(SIM_STATUS_HANG='1', SIM_LANE_WAIT_SECONDS='1')
        self.assertEqual(result.returncode, 75, result.stderr)
        self.assertLess(time.monotonic() - started, 5)
        self.assertFalse((self.root / 'safari-launched').exists())
        self.assertFalse((self.root / 'safari-rendered').exists())
        self.assert_not_handed_over()

    def test_helper_imports_spend_the_original_bootstatus_budget(self):
        native = READY['wait_for_bootstatus']
        helper = FunctionType(native.__code__, {**native.__globals__,
            'IMPORT_STARTED': time.monotonic() - 2,
            'subprocess': SimpleNamespace(run=lambda *_args, **_kwargs: self.fail('Expired admission started a native RPC'))})
        self.assertEqual(helper(UDID, 1), 75)
        for budget in ['0', '301', 'nan']:
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/sim-safari-ready.py'),
                                    UDID, '--bootstatus', budget], env=self.env,
                                    capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 64, result.stderr)
        self.assertFalse((self.root / 'calls').exists())
        self.assert_not_handed_over()

    def test_bootstatus_observed_late_success_is_refused(self):
        native = READY['wait_for_bootstatus']
        for returned, completed, expected in [(0, 2, 75), (23, 2, 23), (0, .5, 0)]:
            clock = [0]
            requests = []

            def run(args, **kwargs):
                requests.append((args, kwargs['timeout']))
                clock[0] = completed
                return SimpleNamespace(returncode=returned)

            helper = FunctionType(native.__code__, {**native.__globals__,
                'IMPORT_STARTED': 0, 'time': SimpleNamespace(monotonic=lambda: clock[0]),
                'subprocess': SimpleNamespace(run=run, TimeoutExpired=subprocess.TimeoutExpired)})
            self.assertEqual(helper(UDID, 1), expected)
            self.assertEqual(requests, [(['xcrun', 'simctl', 'bootstatus', UDID, '-b', '-d'], 1)])
        self.assert_not_handed_over()

    def test_native_bootstatus_75_is_not_reported_as_a_queue_timeout(self):
        result = self.lane(SIM_STATUS_RC='75')
        self.assertEqual(result.returncode, 75, result.stderr)
        self.assertIn('Finished', result.stderr)
        self.assertNotIn('admission timed out', result.stderr)
        self.assertFalse((self.root / 'safari-launched').exists())
        self.assert_not_handed_over()

    def test_boot_failure_propagates(self):
        result = self.lane(SIM_BOOT_RC='17')
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assert_not_handed_over()
        self.assertFalse(any(row[1] == 'bootstatus' for row in self.calls()))

    def test_delayed_url_service_precedes_child_and_shutdown(self):
        result = self.lane(SIM_OPEN_FAILURES='2')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / 'child-ran').read_text(), '3')
        self.assertFalse((self.root / 'booted').exists())
        commands = [row[1] for row in self.calls()]
        self.assertLess(commands.index('bootstatus'), commands.index('openurl'))
        self.assertEqual(commands[-2:], ['shutdown', 'list'])
        for row in self.calls():
            if row[1] == 'openurl':
                url = urlsplit(row[-1])
                self.assertEqual(url.hostname, '127.0.0.1')
                self.assertGreater(url.port, 1024)
                self.assertTrue(url.path.startswith('/safari/'))
        self.assertIn('readiness page reached two animation frames', result.stderr)

    def test_no_frame_never_hands_over_regardless_of_url_rpc_phase(self):
        result = self.lane(SIM_OPEN_NO_FRAME='1', SIM_SAFARI_READY_TIMEOUT='.3')
        self.assertEqual(result.returncode, 124, result.stderr)
        # Shared load can exhaust this same budget before openurl replies.
        # The authority is the absent frame proof and lease, not an RPC phase.
        self.assertFalse((self.root / 'safari-rendered').exists())
        self.assertNotIn('owned two-frame callback confirmed', result.stderr)
        self.assertNotIn('readiness page reached two animation frames', result.stderr)
        self.assert_not_handed_over()

    def test_rendered_document_does_not_wait_for_a_stuck_openurl_client(self):
        result = self.lane(SIM_OPEN_HANG_AFTER_FRAME='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('client stopped after frame proof', result.stderr)
        self.assertEqual((self.root / 'child-ran').read_text(), '1')

    def test_frame_proof_after_url_acceptance_is_not_reported_as_a_timeout(self):
        result = self.lane(SIM_OPEN_ASYNC_FRAME='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('owned two-frame callback confirmed', result.stderr)
        self.assertNotIn('never reached frame callbacks', result.stderr)
        self.assertNotIn('readiness timed out', result.stderr)
        self.assertTrue((self.root / 'child-ran').exists())

    def test_completed_launch_does_not_wait_for_a_services_inherited_output(self):
        result = self.lane(SIM_HELD_NATIVE_OUTPUT='launch')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.root / 'child-ran').exists())
        # The service is still alive: readiness did not kill it to close EOF.
        os.kill(int((self.root / 'output-holder').read_text()), 0)

    def test_live_owned_safari_can_render_before_its_launch_client_replies(self):
        started = time.monotonic()
        result = self.lane(SIM_LAUNCH_RECEIPT_STALL='1', SIM_REQUIRES_LAUNCH='1', SIM_SAFARI_READY_TIMEOUT='2')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(time.monotonic() - started, 5)
        self.assertTrue((self.root/'child-ran').exists())
        self.assertTrue((self.root/'safari-rendered').exists())
        self.assertIn('before launch client replied', result.stderr)
        self.assertEqual(sum(row[1] == 'launch' for row in self.calls()), 1)
        # A pending app may refuse the first RPC through the existing URL
        # service retry policy. Every request must target the same owned probe.
        self.assertEqual(len({row[-1] for row in self.calls() if row[1] == 'openurl'}), 1)

    def test_document_can_complete_before_the_owned_launch_reply(self):
        result = self.lane(SIM_LAUNCH_NEEDS_DOCUMENT='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.root/'child-ran').exists())
        self.assertLess(result.stderr.index('readiness document requested'), result.stderr.index('Safari app launched'))
        self.assertEqual(sum(row[1] == 'launch' for row in self.calls()), 1)
        self.assertEqual(sum(row[1] == 'openurl' for row in self.calls()), 1)

    def test_early_owned_frames_cannot_hide_a_failed_launch(self):
        result = self.lane(SIM_LAUNCH_NEEDS_DOCUMENT='1', SIM_LAUNCH_RC='61')
        self.assertEqual(result.returncode, 61, result.stderr)
        self.assertTrue((self.root/'safari-rendered').exists())
        self.assertIn('Safari app launch failed', result.stderr)
        self.assert_not_handed_over()
        self.assertEqual(sum(row[1] == 'launch' for row in self.calls()), 1)

    def test_late_successful_launch_cannot_use_an_earlier_frame_proof(self):
        clock = SimpleNamespace(now=0)
        clock.monotonic = lambda: clock.now
        ready = SimpleNamespace(is_set=lambda: True)
        @contextmanager
        def page(_deadline, _started):
            yield 'http://127.0.0.1/owned', ready
        class Launch:
            def __enter__(self):
                clock.now = 2
                return self
            def __exit__(self, *_args):
                pass
            def poll(self):
                return 0
        native = READY['wait_for_safari']
        # Clone the helper's environment: parallel cases keep their real clock.
        helper = FunctionType(native.__code__, {**native.__globals__,
            'time': clock, 'readiness_page': page,
            'os': SimpleNamespace(environ={'SIM_SAFARI_READY_TIMEOUT': '1'}),
            'subprocess': SimpleNamespace(Popen=lambda *_args, **_kwargs: Launch())})
        self.assertEqual(helper(UDID), 124)

    def test_owned_pid_receipt_without_frames_cannot_substitute_for_readiness(self):
        result = self.lane(SIM_LAUNCH_RECEIPT_STALL='1', SIM_REQUIRES_LAUNCH='1',
                           SIM_OPEN_NO_FRAME='1', SIM_SAFARI_READY_TIMEOUT='2')
        self.assertEqual(result.returncode, 124, result.stderr)
        self.assert_not_handed_over()

    def test_owned_pid_read_crossing_deadline_cannot_use_earlier_frames(self):
        clock = SimpleNamespace(now=0, frames=False, reads=0)
        clock.monotonic = lambda: clock.now
        ready = SimpleNamespace(is_set=lambda: clock.frames)
        @contextmanager
        def page(_deadline, _started):
            yield 'http://127.0.0.1/owned', ready
        def read(_fd, _size, _offset):
            clock.reads += 1
            if clock.reads == 1:
                return b''
            clock.now = 2
            return b'com.apple.mobilesafari: 123\n'
        class Native:
            def __init__(self, kind):
                self.kind = kind
                self.returncode = None if kind == 'launch' else 0
            def __enter__(self):
                if self.kind == 'openurl':
                    clock.now, clock.frames = .3, True
                return self
            def __exit__(self, *_args):
                pass
            def poll(self):
                return self.returncode
            def kill(self):
                self.returncode = -9
            def wait(self):
                return self.returncode
        native = READY['wait_for_safari']
        ports = {**native.__globals__, 'time': clock, 'readiness_page': page,
            'os': SimpleNamespace(environ={'SIM_SAFARI_READY_TIMEOUT': '1'}, pread=read),
            'subprocess': SimpleNamespace(DEVNULL=subprocess.DEVNULL, Popen=lambda args, **_kwargs: Native(args[2]))}
        opening = READY['open_ready_page']
        ports['open_ready_page'] = FunctionType(opening.__code__, ports, argdefs=opening.__defaults__)
        helper = FunctionType(native.__code__, ports)
        self.assertEqual(helper(UDID), 124)
        self.assertEqual(clock.now, 2, 'the native read must have crossed the deadline')

    def test_complete_owned_receipt_survives_an_incomplete_output_tail(self):
        self.assertEqual(READY['owned_launch_pid']('com.apple.mobilesafari: 101\npending reply'), 101)
        self.assertIsNone(READY['owned_launch_pid']('foreign.application: 101\n'))
        self.assertIsNone(READY['owned_launch_pid']('com.apple.mobilesafari: 0\n'))
        self.assertIsNone(READY['owned_launch_pid']('com.apple.mobilesafari: -1\n'))

    def test_truncated_launch_receipt_cannot_unlock_a_launch(self):
        self.assertIsNone(READY['owned_launch_pid']('com.apple.mobilesafari: 101'))
        self.assertIsNone(READY['owned_launch_pid']('com.apple.mobilesafari: invalid\n'))

    def test_launch_observation_never_spawns_an_expensive_process_inventory(self):
        self.command('ps', "import os,pathlib,time;pathlib.Path(os.environ['SIM_FIXTURE'],'ps-started').touch();time.sleep(30)")
        result = self.lane(SIM_LAUNCH_RECEIPT_STALL='1', SIM_SAFARI_READY_TIMEOUT='2')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.root/'ps-started').exists())
        self.assertTrue((self.root/'safari-rendered').exists())

    def test_foreign_simulator_safari_cannot_unlock_our_launch(self):
        self.command('ps', '''print('100 1 /runtime/launchd_sim ''' + UDID + '''')
print('200 1 /runtime/launchd_sim foreign-device')
print('201 200 /runtime/Applications/MobileSafari.app/MobileSafari')
''')
        result = self.lane(SIM_LAUNCH_IPC_STALL='1', SIM_REQUIRES_LAUNCH='1', SIM_SAFARI_READY_TIMEOUT='2')
        self.assertEqual(result.returncode, 124, result.stderr)
        self.assert_not_handed_over()
        self.assertNotIn('readiness page reached two animation frames', result.stderr)

    def test_completed_url_does_not_wait_for_a_services_inherited_error_output(self):
        result = self.lane(SIM_HELD_NATIVE_OUTPUT='openurl')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.root / 'child-ran').exists())
        os.kill(int((self.root / 'output-holder').read_text()), 0)

    def test_inherited_url_output_cannot_substitute_for_a_frame_proof(self):
        result = self.lane(SIM_HELD_NATIVE_OUTPUT='openurl', SIM_OPEN_NO_FRAME='1', SIM_SAFARI_READY_TIMEOUT='.3')
        self.assertEqual(result.returncode, 124, result.stderr)
        self.assertFalse((self.root / 'safari-rendered').exists())
        self.assertNotIn('owned two-frame callback confirmed', result.stderr)
        self.assertNotIn('readiness page reached two animation frames', result.stderr)
        self.assert_not_handed_over()

    def test_probe_requires_two_frames_and_only_its_own_timely_callback(self):
        with READY['readiness_page'](time.monotonic() + 5) as (url, ready):
            with urlopen(url, timeout=1) as response:
                callback = response.headers['X-Safari-Ready']
                script = response.read().decode().split('<script>', 1)[1].split('</script>', 1)[0]
            program = ('const frames=[];let sent=null;'
                       'globalThis.requestAnimationFrame=fn=>frames.push(fn);'
                       'globalThis.fetch=(path,options)=>{sent={path,options};return Promise.resolve()};'
                       + script + ';if(sent!==null||frames.length!==1)throw Error("early readiness");'
                       'frames.shift()();if(sent!==null||frames.length!==1)throw Error("one-frame readiness");'
                       'frames.shift()();if(sent===null||frames.length!==0)throw Error("missing readiness");'
                       'console.log(JSON.stringify(sent));')
            result = subprocess.run(['node', '--input-type=module', '-e', program],
                                    capture_output=True, text=True, timeout=2, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), {'path': callback, 'options': {'cache': 'no-store'}})
            self.assertFalse(ready.is_set())
            with self.assertRaises(HTTPError):
                urlopen(urljoin(url, '/ready/foreign'), timeout=1)
            self.assertFalse(ready.is_set())
            with urlopen(urljoin(url, callback), timeout=1) as response:
                self.assertEqual(response.read(), b'ready')
            self.assertTrue(ready.wait(1))
        with READY['readiness_page'](time.monotonic() - 1) as (url, ready):
            with urlopen(url, timeout=1) as response:
                callback = response.headers['X-Safari-Ready']
            with urlopen(urljoin(url, callback), timeout=1) as response:
                self.assertEqual(response.read(), b'ready')
            self.assertFalse(ready.is_set())

    def test_probe_rejects_foreign_paths_methods_and_oversized_headers(self):
        with READY['readiness_page'](time.monotonic() + 5) as (url, ready):
            with urlopen(url, timeout=1) as response:
                callback = response.headers['X-Safari-Ready']
                response.read()
            requests = [(Request(urljoin(url, '/ready/foreign')), 404),
                        (Request(urljoin(url, callback), method='POST'), 501),
                        (Request(urljoin(url, callback), headers={'X-Probe': 'x' * 9000}), 431)]
            for request, code in requests:
                with self.assertRaises(HTTPError) as refused:
                    urlopen(request, timeout=1)
                self.assertEqual(refused.exception.code, code)
                refused.exception.close()
                self.assertFalse(ready.is_set())

    def test_url_failure_is_bounded_and_lease_is_not_published(self):
        self.immediate_url_failure_fixture()
        started = time.monotonic()
        result = self.lane('lease', SIM_OPEN_FAILURES='999', SIM_SAFARI_READY_TIMEOUT='0.15')
        self.assertEqual(result.returncode, 60, result.stderr)
        self.assertIn('Safari URL readiness timed out', result.stderr)
        self.assertLess(time.monotonic() - started, 5)
        self.assert_not_handed_over()
        self.assertFalse((self.root / 'booted').exists())

    def test_unresponsive_url_call_cannot_escape_deadline(self):
        started = time.monotonic()
        result = self.lane(SIM_OPEN_HANG='1', SIM_SAFARI_READY_TIMEOUT='0.15')
        self.assertEqual(result.returncode, 124, result.stderr)
        self.assertLess(time.monotonic() - started, 5)
        self.assert_not_handed_over()

    def test_already_booted_still_checks_status_without_shutting_foreign_device(self):
        (self.root / 'booted').touch()
        result = self.lane(SIM_STATUS_RC='23')
        self.assertEqual(result.returncode, 23, result.stderr)
        self.assert_not_handed_over()
        self.assertTrue((self.root / 'booted').exists())
        self.assertFalse(any(row[1] in ('boot', 'shutdown') for row in self.calls()))

    def test_lease_waits_then_renewal_preserves_current_page(self):
        result = self.lane('lease')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), UDID)
        result = self.lane('lease', SIM_OPEN_FAILURES='999')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / 'attempts').read_text(), '1')
        self.assertEqual(sum(row[1] == 'bootstatus' for row in self.calls()), 2)

    def test_readiness_imports_can_finish_before_bootstatus_without_launching(self):
        with subprocess.Popen([sys.executable, str(ROOT / 'scripts/sim-safari-ready.py'),
                               UDID, '--await-bootstatus'], env=self.env, text=True,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE) as child:
            try:
                self.assertTrue(select.select([child.stderr], [], [], 5)[0])
                first = child.stderr.readline()
                self.assertIn('Python imports finished', first)
                self.assertIsNone(child.poll())
                self.assertFalse((self.root / 'calls').exists())
                output, errors = child.communicate(input='0\n', timeout=5)
                self.assertEqual(child.returncode, 0, errors)
                self.assertEqual(output, '')
                self.assertIn('bootstatus prerequisite accepted', errors)
                self.assertTrue((self.root / 'safari-rendered').exists())
                self.assertEqual(sum(row[1] == 'launch' for row in self.calls()), 1)
            finally:
                if child.poll() is None:
                    child.kill()
                    child.wait()

    def test_failed_or_missing_bootstatus_never_launches_safari(self):
        for status, expected in [('23\n', 23), ('', 64), ('999\n', 64)]:
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/sim-safari-ready.py'),
                                     UDID, '--await-bootstatus'], env=self.env,
                                    text=True, input=status, capture_output=True, timeout=5)
            self.assertEqual(result.returncode, expected, result.stderr)
            self.assertFalse((self.root / 'calls').exists())
            self.assert_not_handed_over()

    def test_cold_safari_application_precedes_url_readiness(self):
        # Observe the real helper's request boundary, before the native child
        # can be scheduled. The fixture deliberately reverses child log order.
        (self.bin/'sitecustomize.py').write_text('''import json,os,pathlib,sys
def request(event,details):
    if event!='subprocess.Popen': return
    args=details[1]
    if isinstance(args,(list,tuple)) and list(args[:2])==['xcrun','simctl'] and args[2] in ('launch','openurl'):
        path=pathlib.Path(os.environ['SIM_FIXTURE'])/'parent-requests'
        with path.open('a') as output: output.write(json.dumps(list(args))+'\\n')
sys.addaudithook(request)
''')
        result = self.lane(SIM_REQUIRES_LAUNCH='1', SIM_REVERSE_CHILD_LOGS='1', PYTHONPATH=str(self.bin))
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = [row[1] for row in self.calls()]
        self.assertEqual(calls.count('launch'), 1)
        self.assertLess(calls.index('bootstatus'), calls.index('launch'))
        self.assertGreater(calls.index('launch'), calls.index('openurl'))
        requests = [json.loads(line) for line in (self.root/'parent-requests').read_text().splitlines()]
        names = [row[2] for row in requests]
        self.assertEqual(names.count('launch'), 1)
        self.assertLess(names.index('launch'), names.index('openurl'))
        self.assertEqual({row[3] for row in requests}, {UDID})
        self.assertTrue((self.root/'safari-launched').exists())
        self.assertTrue((self.root/'safari-rendered').exists())
        self.assertIn('owned launch and owned two-frame callback confirmed', result.stderr)
        self.assertEqual((self.root / 'child-ran').read_text(), '1')

    def test_failed_app_launch_cannot_publish_or_retry_a_lease(self):
        result = self.lane(SIM_LAUNCH_RC='61')
        self.assertEqual(result.returncode, 61, result.stderr)
        self.assertIn('Safari app launch failed', result.stderr)
        self.assert_not_handed_over()
        calls = [row[1] for row in self.calls()]
        self.assertEqual(calls.count('launch'), 1)
        self.assertNotIn('readiness page reached two animation frames', result.stderr)
        self.assertFalse((self.root / 'booted').exists())

    def test_safari_launch_consumes_the_same_readiness_deadline(self):
        started = time.monotonic()
        result = self.lane(SIM_LAUNCH_DELAY='30', SIM_SAFARI_READY_TIMEOUT='.3')
        self.assertEqual(result.returncode, 124, result.stderr)
        self.assertLess(time.monotonic() - started, 5)
        self.assertIn('Safari app launch timed out', result.stderr)
        self.assert_not_handed_over()
        self.assertNotIn('readiness page reached two animation frames', result.stderr)

    def test_launch_timeout_retains_native_partial_error_without_waiting_for_eof(self):
        started = time.monotonic()
        result = self.lane(SIM_LAUNCH_DELAY='30', SIM_SAFARI_READY_TIMEOUT='.3',
                           SIM_LAUNCH_PARTIAL_ERROR='1', SIM_HELD_NATIVE_OUTPUT='launch')
        self.assertEqual(result.returncode, 124, result.stderr)
        self.assertLess(time.monotonic() - started, 5)
        self.assertIn('observed wall', result.stderr)
        self.assertIn('timed-out launch stderr: native launch pending reply', result.stderr)
        self.assert_not_handed_over()
        self.assertNotIn('readiness page reached two animation frames', result.stderr)

    def test_full_lane_fails_and_does_not_boot_or_handover(self):
        started = time.monotonic()
        result = self.lane(SIM_LANES='0', SIM_LANE_WAIT_SECONDS='1')
        self.assertEqual(result.returncode, 75, result.stderr)
        self.assertIn('admission timed out after 1s', result.stderr)
        self.assertIn('simulators:', result.stderr)
        self.assertLess(time.monotonic() - started, 5)
        self.assert_not_handed_over()
        self.assertFalse(any(row[1] == 'boot' for row in self.calls()))

    def test_legacy_live_owner_wait_is_bounded_without_removing_lease(self):
        lane = self.root / 'lane'
        lane.mkdir()
        lease = lane / f'{UDID}.lease'
        original = f'{int(time.time()) + 100} {os.getpid()}\n'
        lease.write_text(original)
        result = self.lane(SIM_LANE_WAIT_SECONDS='1')
        self.assertEqual(result.returncode, 75, result.stderr)
        self.assertIn(str(os.getpid()), result.stderr)
        self.assertEqual(lease.read_text(), original)
        self.assertFalse((self.root / 'child-ran').exists())

    def test_lock_failure_names_holders_and_shares_five_minute_deadline(self):
        self.command('lockf', """import json,os,pathlib,sys
root=pathlib.Path(os.environ['SIM_FIXTURE']); path=root/'lock-calls'
with path.open('a') as output: output.write(json.dumps(sys.argv[1:])+'\\n')
# Resolve admission succeeds; device admission refuses after slow resolution.
sys.exit(75 if len(path.read_text().splitlines())==2 else 0)
""")
        result = self.lane(SIM_LIST_DELAY='1.05')
        self.assertEqual(result.returncode, 75, result.stderr)
        calls = [json.loads(line) for line in (self.root / 'lock-calls').read_text().splitlines()]
        self.assertEqual(len(calls), 2)
        self.assertEqual([row[:2] for row in calls], [['-s', '-t'], ['-s', '-t']])
        first, second = [int(row[2]) for row in calls]
        # Whole-second setup can consume part of the cap before the first lock;
        # a later lock must consume the same deadline, never reset its 300s.
        self.assertGreater(first, 0)
        self.assertLessEqual(first, 300)
        self.assertGreater(second, 0)
        self.assertLessEqual(second, first - 1)
        self.assertIn('admission timed out after 300s', result.stderr)
        self.assertIn('lock/lease holders:', result.stderr)
        self.assert_not_handed_over()

    def test_wait_limit_cannot_be_extended(self):
        result = self.lane(SIM_LANE_WAIT_SECONDS='301')
        self.assertEqual(result.returncode, 64, result.stderr)
        self.assert_not_handed_over()


class ParallelReadinessSuite(unittest.TestSuite):
    """Three independent fake-device cases share the unchanged whole-run cap."""

    def run(self, result, debug=False):
        if debug:
            return super().run(result, debug)

        def run_case(case):
            local = unittest.TestResult()
            case.run(local)
            return local

        # Every case owns its directory, fake commands and child environment;
        # none touches the real Simulator or process-global environment.
        # Merge completed results on this thread so failure traces and counts
        # remain ordinary unittest results without concurrent result mutation.
        with ThreadPoolExecutor(max_workers=3) as pool:
            for local in pool.map(run_case, self):
                result.testsRun += local.testsRun
                for name in ('errors', 'failures', 'skipped',
                             'expectedFailures', 'unexpectedSuccesses'):
                    getattr(result, name).extend(getattr(local, name))
        return result


class ReadinessLoader(unittest.TestLoader):
    def loadTestsFromTestCase(self, testCaseClass):
        return ParallelReadinessSuite(super().loadTestsFromTestCase(testCaseClass))


class ParallelResultTests(unittest.TestCase):
    def test_failure_error_and_skip_remain_visible(self):
        def refuse():
            raise AssertionError('retained assertion')

        def error():
            raise RuntimeError('retained error')

        def skip():
            raise unittest.SkipTest('retained skip')

        result = unittest.TestResult()
        ParallelReadinessSuite(unittest.FunctionTestCase(case)
            for case in (lambda: None, refuse, error, skip)).run(result)
        self.assertEqual(result.testsRun, 4)
        self.assertFalse(result.wasSuccessful())
        self.assertEqual(len(result.failures), 1)
        self.assertIn('retained assertion', result.failures[0][1])
        self.assertEqual(len(result.errors), 1)
        self.assertIn('retained error', result.errors[0][1])
        self.assertEqual(len(result.skipped), 1)


if __name__ == '__main__':
    unittest.main(testLoader=ReadinessLoader())
