"""Real Bash startup/handover against an isolated simctl fixture."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parent.parent
UDID = '00000000-0000-0000-0000-000000000016'


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
with (root/'calls').open('a') as output: output.write(json.dumps(args)+'\\n')
booted=root/'booted'
if args[:3]==['simctl','list','devices']:
    rows=[{'udid':''' + repr(UDID) + ''','name':'wildshard-iphone'}]
    print(json.dumps({'devices':{'iOS':rows if 'booted' not in args or booted.exists() else []}}))
elif args[1]=='boot':
    code=int(os.environ.get('SIM_BOOT_RC','0'))
    if code==0: booted.touch()
    sys.exit(code)
elif args[1]=='bootstatus': sys.exit(int(os.environ.get('SIM_STATUS_RC','0')))
elif args[1]=='openurl':
    count=root/'attempts';n=int(count.read_text())+1 if count.exists() else 1;count.write_text(str(n))
    if os.environ.get('SIM_OPEN_HANG'): time.sleep(30)
    if n<=int(os.environ.get('SIM_OPEN_FAILURES','0')):
        print('URL service unavailable (60)',file=sys.stderr);sys.exit(60)
elif args[1]=='shutdown': booted.unlink(missing_ok=True)
else: raise RuntimeError('Unexpected fixture command '+repr(args))
''')
        # No test touches real devices, Simulator.app or machine admission locks.
        self.command('lockf', 'pass\n')
        self.command('pgrep', 'import sys\nsys.exit(1)\n')
        self.command('osascript', "raise RuntimeError('No app should be touched')\n")
        self.child = self.root / 'child.py'
        self.child.write_text("import os,pathlib\nr=pathlib.Path(os.environ['SIM_FIXTURE']);(r/'child-ran').write_text((r/'attempts').read_text())\n")
        self.assertIsNotNone(shutil.which('jq'))

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
        self.assert_not_handed_over()
        self.assertFalse((self.root / 'booted').exists())
        self.assertFalse(any(row[1] == 'openurl' for row in self.calls()))

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
        self.assertTrue(all(row[-1] == 'http://127.0.0.1:9/' for row in self.calls() if row[1] == 'openurl'))

    def test_url_failure_is_bounded_and_lease_is_not_published(self):
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

    def test_lock_failure_names_holders_and_uses_five_minute_cap(self):
        self.command('lockf', "import sys\nprint('lock-args '+repr(sys.argv[1:]),file=sys.stderr)\nsys.exit(75)\n")
        result = self.lane()
        self.assertEqual(result.returncode, 75, result.stderr)
        self.assertIn("'-t', '300'", result.stderr)
        self.assertIn('lock/lease holders:', result.stderr)
        self.assert_not_handed_over()

    def test_wait_limit_cannot_be_extended(self):
        result = self.lane(SIM_LANE_WAIT_SECONDS='301')
        self.assertEqual(result.returncode, 64, result.stderr)
        self.assert_not_handed_over()


if __name__ == '__main__':
    unittest.main()
