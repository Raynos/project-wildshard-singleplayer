"""C4 command ownership and failure reporting; no GitHub calls or app builds."""
import contextlib
import io
import json
import os
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

    def test_annotation_properties_are_not_part_of_the_file(self):
        output='::error file=test/script-v2-strip.test.ts,title=test/script-v2-strip.test.ts::Error: missing input'
        self.assertEqual(API['failure_files'](output),['test/script-v2-strip.test.ts'])
        encoded='::error file=test/space%2C%20%5Bcase%5D.test.ts,title=ignored.ts::Error: actual input'
        self.assertEqual(API['failure_files'](encoded),['test/space, [case].test.ts'])
        self.assertEqual(API['failure_files']('Error: missing "test/space, [case].test.ts"'),['test/space, [case].test.ts'])

    def test_culprit_paths_are_one_json_argument_without_shell_interpretation(self):
        report=API['print_culprits'];files=['test/space, [case].test.ts']
        row={'base':'a'*40,'candidates':[],'missingImports':[]}
        with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess([],0,json.dumps(row),'')) as command, \
                contextlib.redirect_stdout(io.StringIO()):
            report(files)
        args=command.call_args.args[0]
        self.assertEqual(json.loads(next(arg[8:] for arg in args if arg.startswith('--files='))),files)
        self.assertNotIn('shell',command.call_args.kwargs)

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

    def test_behaviour_finishes_its_own_failure_while_other_jobs_keep_peer_stop(self):
        main=API['main'];run=API['run']
        command=[sys.executable,'-c','import time;time.sleep(.2);print("FAIL test/own.test.ts > actual");raise SystemExit(7)']
        for job, expected in [('behaviour',7),('behaviour-products',7),('products',1)]:
            with self.subTest(job=job):
                observations=[]
                def peer():
                    observations.append(1)
                    return dict(name='behaviour (3)',html_url='https://github.example/jobs/3',conclusion='failure')
                with patch.dict(os.environ,{'GITHUB_EVENT_NAME':'push','GITHUB_JOB':job}), \
                        patch.object(sys,'argv',['ci-fail-fast.py','--',*command]), \
                        patch.dict(main.__globals__,{'peer_failure':peer,'run':lambda args,reader:run(args,reader,record=False)}), \
                        contextlib.redirect_stdout(io.StringIO()) as out, \
                        self.assertRaises(SystemExit) as stopped:
                    main()
                self.assertEqual(stopped.exception.code,expected)
                if job in ('behaviour','behaviour-products'):
                    self.assertEqual(observations,[])
                    self.assertIn('::error file=test/own.test.ts',out.getvalue())
                    self.assertNotIn('Peer job',out.getvalue())
                else:
                    self.assertEqual(observations,[1])
                    self.assertIn('Peer job behaviour (3)',out.getvalue())
                    self.assertNotIn('FAIL test/own.test.ts',out.getvalue())

    def test_behaviour_matrix_keeps_independent_jobs_and_per_shard_bail(self):
        source=Path('.github/workflows/deploy.yml').read_text()
        for job, count in [('behaviour',16),('behaviour-products',4)]:
            behaviour=source.split(f'\n  {job}:\n',1)[1].split('\n  dispatch-boot-smoke:\n',1)[0].split('\n  behaviour-products:\n',1)[0]
            self.assertIn('fail-fast: false',behaviour)
            self.assertNotIn('fail-fast: true',behaviour)
            self.assertIn('python3 scripts/ci-fail-fast.py -- python3 scripts/heavy-lane.py check -- pnpm exec vitest run --shard=${{ matrix.shard }}/'+str(count)+' --bail=1',behaviour)

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
            with patch.dict(function.__globals__,{'Path':lambda value:root/value,'print_culprits':lambda files:None}),contextlib.redirect_stdout(io.StringIO()):
                function('FAIL test/actual.test.ts > private diagnostic',1)
            row=json.loads((root/'tmp/ci-failures/failure.json').read_text())
            self.assertEqual(row['files'],['test/actual.test.ts'])
            self.assertNotIn('private diagnostic',json.dumps(row))

    def test_culprit_output_is_bounded_and_observation_failure_does_not_hide_red(self):
        report=API['print_culprits']
        row={'base':'a'*40,'candidates':[{'sha':'b'*40,'match':'literal import','subject':'fix fixture',
            'assistedBy':'fixture:recorded'}],'missingImports':[]}
        with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess([],0,json.dumps(row),'')), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            report(['test/actual.test.ts'])
        self.assertIn('Last green main push: '+'a'*40,out.getvalue())
        self.assertIn('Candidate '+'b'*40,out.getvalue())
        self.assertIn('Assisted-by: fixture%3Arecorded',out.getvalue())
        with patch.object(subprocess,'run',side_effect=subprocess.TimeoutExpired('node',35)), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            report(['test/actual.test.ts'])
        self.assertIn('original check remains red; no retry',out.getvalue())

    def test_only_own_push_failure_reports_its_culprits(self):
        function=API['diagnose'];calls=[]
        with tempfile.TemporaryDirectory(dir='tmp') as directory:
            root=Path(directory)
            with patch.dict(function.__globals__,{'Path':lambda value:root/value,'print_culprits':lambda files:calls.append(files)}), \
                    patch.dict(os.environ,{'GITHUB_EVENT_NAME':'push','GITHUB_RUN_ID':'42'}), \
                    contextlib.redirect_stdout(io.StringIO()):
                function('FAIL test/actual.test.ts > failure',7)
                function('FAIL test/other.test.ts > peer',1,{'name':'peer','html_url':'https://example.invalid'})
            self.assertEqual(calls,[['test/actual.test.ts']])


if __name__=='__main__':
    unittest.main()
