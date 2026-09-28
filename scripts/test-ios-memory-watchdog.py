#!/usr/bin/env python3
"""Safe regression checks: actual native memory only in subprocesses this test owns."""
import importlib.util
import pathlib
import subprocess
import sys
import unittest

spec = importlib.util.spec_from_file_location('watchdog', pathlib.Path(__file__).with_name('ios-memory-watchdog.py'))
watchdog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)


class WatchdogTests(unittest.TestCase):
    def test_restarts_and_disappearance_cannot_pass(self):
        for replacement in ([], [{'pid': 12, 'startAbstime': 2, 'physicalFootprintBytes': 1, 'residentBytes': 1}]):
            run = watchdog.BudgetRun(100)
            self.assertIsNone(run.observe([{'pid': 12, 'startAbstime': 1, 'physicalFootprintBytes': 10, 'residentBytes': 20}]))
            self.assertIn('disappeared or restarted', run.observe(replacement))

    def test_processes_are_summed_and_peak_is_retained(self):
        run = watchdog.BudgetRun(100)
        rows = [{'pid': pid, 'startAbstime': 1, 'physicalFootprintBytes': 60, 'residentBytes': 80} for pid in (1, 2)]
        self.assertIn('exceeds', run.observe(rows))
        self.assertEqual(run.peak_footprint, 120)
        self.assertEqual(run.peak_resident, 160)

    @unittest.skipUnless(sys.platform == 'darwin', 'native libproc requires macOS')
    def test_native_allocation_pass_breach_and_exit(self):
        # 64 MiB, touched page-by-page: test enforcement without allocating gigabytes.
        child = subprocess.Popen([sys.executable, '-u', '-c',
            'import sys,time; print("ready",flush=True); sys.stdin.readline(); '
            'memory=bytearray(64*1024*1024); '
            'print("allocated",flush=True); time.sleep(60)'],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        try:
            self.assertEqual(child.stdout.readline().strip(), 'ready')
            native = watchdog.NativeMemory()
            before = native.sample(child.pid)
            run = watchdog.BudgetRun(before['physicalFootprintBytes'] + 32 * 1024 ** 2)
            self.assertIsNone(run.observe([before]))
            child.stdin.write('allocate\n')
            child.stdin.flush()
            self.assertEqual(child.stdout.readline().strip(), 'allocated')
            after = native.sample(child.pid)
            self.assertGreater(after['physicalFootprintBytes'] - before['physicalFootprintBytes'], 48 * 1024 ** 2)
            self.assertGreater(after['residentBytes'], before['residentBytes'])
            self.assertIn('exceeds', run.observe([after]))
            child.terminate()
            child.wait(timeout=5)
            with self.assertRaises(RuntimeError):
                native.sample(child.pid)
        finally:
            if child.poll() is None:
                child.kill()
                child.wait(timeout=5)
            child.stdin.close()
            child.stdout.close()


if __name__ == '__main__':
    unittest.main()
