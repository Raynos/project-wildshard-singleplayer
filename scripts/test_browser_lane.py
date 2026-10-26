"""Admission deadlines against isolated process/device fixtures; no browsers."""
import os
import fcntl
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parent.parent


class BrowserAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='browser-admission-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.env = {**os.environ, 'HOME': str(self.root),
                    'PATH': f'{self.bin}:{os.environ["PATH"]}',
                    'SIM_LANE_DIR': str(self.root / 'sim'),
                    'BROWSER_LANES': '1', 'BROWSER_LANE_WAIT_SECONDS': '1'}
        self.command('ps', "print('100 00:01 bash scripts/browser-lane.sh _slot 0 marker 60 fixture')\nprint('101 00:01 bash scripts/browser-lane.sh _slot 1 marker 60 fixture')\n")
        self.command('pgrep', 'import sys\nsys.exit(1)\n')
        self.command('xcrun', "print('{\"devices\":{}}')\n")
        self.command('osascript', "raise RuntimeError('No app should be touched')\n")

    def command(self, name, code):
        path = self.bin / name
        path.write_text(f'#!{sys.executable}\n' + code)
        path.chmod(0o755)

    def lane(self, *args, **extra):
        return subprocess.run(['/bin/bash', str(ROOT / 'scripts/browser-lane.sh'), *args],
                              env={**self.env, **extra}, capture_output=True,
                              text=True, timeout=6, check=False)

    def test_wait_and_command_fail_without_running_child_when_full(self):
        for args in [('wait',), ('touch', str(self.root / 'child-ran'))]:
            started = time.monotonic()
            result = self.lane(*args)
            self.assertEqual(result.returncode, 75, result.stderr)
            self.assertIn('admission timed out after 1s', result.stderr)
            self.assertIn('holder 100', result.stderr)
            self.assertIn('holder 101', result.stderr)
            self.assertLess(time.monotonic() - started, 5)
            self.assertFalse((self.root / 'child-ran').exists())

    def test_immediate_capacity_succeeds_and_wait_limit_cannot_be_extended(self):
        self.command('ps', 'pass\n')
        self.assertEqual(self.lane('wait').returncode, 0)
        self.assertEqual(self.lane('wait', BROWSER_LANE_WAIT_SECONDS='301').returncode, 64)

    def test_reaper_preserves_build_output_during_registry_handoff(self):
        builds = ROOT / 'tmp/serve'
        builds.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=builds, prefix='reaper-fixture-') as fixture:
            output = Path(fixture) / '20261025-120000-45001'
            output.mkdir()
            log = output / 'build.log'
            log.write_text('active build')
            registry = self.root / 'registry'
            registry.mkdir()
            with (registry / '.port-45001.lock').open('a+') as lease:
                fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
                result = self.lane('reap', SERVE_BUILD_DIR=fixture, SERVE_REG_DIR=str(registry))
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(log.exists(), 'active port lease must protect an output without its registry row')
            result = self.lane('reap', SERVE_BUILD_DIR=fixture, SERVE_REG_DIR=str(registry))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(output.exists(), 'an unleased orphan must still be cleaned')


if __name__ == '__main__':
    unittest.main()
