"""C4 command ownership and failure reporting; no GitHub calls or app builds."""
import contextlib
import io
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

API=runpy.run_path(str(Path(__file__).with_name('ci-fail-fast.py')))


class FailFastTests(unittest.TestCase):
    def test_cancelled_and_pending_jobs_never_invent_a_failure(self):
        jobs=[dict(name='pending',conclusion=None),dict(name='cancelled',conclusion='cancelled'),
              dict(name='late',conclusion='failure',completed_at='2026-01-02'),
              dict(name='first',conclusion='failure',completed_at='2026-01-01')]
        self.assertEqual(API['failed_job'](jobs)['name'],'first')
        self.assertIsNone(API['failed_job'](jobs[:2]))

    def test_failures_name_actual_test_and_type_inputs(self):
        self.assertEqual(API['failure_files']('\x1b[31m FAIL test/real-case.test.ts > case\x1b[0m'),['test/real-case.test.ts'])
        self.assertEqual(API['failure_files']('src/format/row.ts(2,4): error TS2322: bad'),['src/format/row.ts'])
        self.assertEqual(API['failure_files']('unknown command failed'),[])

    def test_success_retains_output_and_exit_code_without_metadata(self):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(API['run']([sys.executable,'-c','print("real success")'],record=False),0)
        self.assertIn('real success',out.getvalue())
        self.assertNotIn('::error',out.getvalue())

    def test_nonzero_check_keeps_red_and_names_file(self):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(API['run']([sys.executable,'-c','print("FAIL test/real.test.ts > actual");raise SystemExit(7)'],record=False),7)
        self.assertIn('::error file=test/real.test.ts',out.getvalue())

    def test_peer_failure_stops_only_the_owned_process_group(self):
        with tempfile.TemporaryDirectory(dir='tmp') as directory, subprocess.Popen([sys.executable,'-c','import time;time.sleep(20)']) as foreign:
            try:
                late=Path(directory)/'late'
                child='import time,pathlib;time.sleep(10);pathlib.Path('+repr(str(late))+').touch()'
                peer=dict(name='behaviour (3)',html_url='https://github.example/jobs/3',conclusion='failure')
                started=time.monotonic()
                with contextlib.redirect_stdout(io.StringIO()) as out:
                    self.assertEqual(API['run']([sys.executable,'-c',child],reader=lambda:peer,record=False),1)
                self.assertLess(time.monotonic()-started,3)
                self.assertIsNone(foreign.poll())
                self.assertFalse(late.exists())
                self.assertIn('behaviour (3)',out.getvalue())
            finally:
                foreign.terminate();foreign.wait(timeout=3)

    def test_monitor_failure_is_named_once_without_retry_or_masking_check(self):
        calls=[]
        def failed():
            calls.append(1);raise RuntimeError('offline')
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(API['run']([sys.executable,'-c','import time;time.sleep(.3)'],reader=failed,interval=0,record=False),0)
        self.assertEqual(calls,[1]);self.assertIn('no retry',out.getvalue())

    def test_failure_record_contains_paths_not_log_text(self):
        function=API['diagnose']
        with tempfile.TemporaryDirectory(dir='tmp') as directory:
            root=Path(directory)
            with patch.dict(function.__globals__,{'Path':lambda value:root/value}),contextlib.redirect_stdout(io.StringIO()):
                function('FAIL test/actual.test.ts > private diagnostic',1)
            row=json.loads((root/'tmp/ci-failures/failure.json').read_text())
            self.assertEqual(row['files'],['test/actual.test.ts'])
            self.assertNotIn('private diagnostic',json.dumps(row))


if __name__=='__main__':
    unittest.main()
