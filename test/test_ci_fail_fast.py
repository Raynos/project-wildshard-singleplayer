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
import unittest
from unittest.mock import patch

API=runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts' / 'ci-fail-fast.py'))


class FailFastTests(unittest.TestCase):
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

    def test_absolute_runner_annotations_resolve_only_inside_exact_checkout(self):
        workspace='/home/runner/work/project/project'
        output='::error file='+workspace+'/test/elite-entry-producer.test.ts::Error: actual input\nFAIL test/elite-entry-producer.test.ts > actual'
        with patch.dict(os.environ,{'GITHUB_WORKSPACE':workspace}):
            self.assertEqual(API['failure_files'](output),['test/elite-entry-producer.test.ts'])
            self.assertEqual(API['failure_files']('::error file=/other/test/foreign.test.ts::Error: unrelated'),[])
            self.assertEqual(API['failure_files']('::error file='+workspace+'/../test/escape.test.ts::Error: unrelated'),[])
        with patch.dict(os.environ,{'GITHUB_WORKSPACE':''}):
            self.assertEqual(API['failure_files']('::error file='+str(Path.cwd()/'test/local.test.ts')+'::Error: local'),['test/local.test.ts'])

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

    def test_every_ci_job_finishes_its_own_verdict_without_peer_io(self):
        main=API['main'];run=API['run']
        jobs=('behaviour','behaviour-products','products','typecheck-lint',
              'build-and-deploy','derived-docs','generated-inputs','dispatch-boot-smoke')
        payload=json.dumps({'total_count':1,'jobs':[dict(name='foreign red',
            conclusion='failure',completed_at='2026-01-01',html_url='https://example.invalid/peer')]})
        for event in ('push','pull_request'):
            for job in jobs:
                for code in (0,7):
                    with self.subTest(event=event,job=job,code=code):
                        command=[sys.executable,'-c',
                            'import time;time.sleep(.05);print("own command completed");'
                            'print("FAIL test/own.test.ts > actual" if '+str(code)+' else "success");'
                            'raise SystemExit('+str(code)+')']
                        with patch.dict(os.environ,{'GITHUB_EVENT_NAME':event,'GITHUB_JOB':job,
                                'GITHUB_REPOSITORY':'fixture/project','GITHUB_RUN_ID':'42','GITHUB_RUN_ATTEMPT':'1'}), \
                                patch.object(sys,'argv',['ci-fail-fast.py','--',*command]), \
                                patch.dict(main.__globals__,{'run':lambda args,*rest:run(args,*rest,record=False)}), \
                                patch.object(subprocess,'run',return_value=subprocess.CompletedProcess([],0,payload,'')) as observer, \
                                contextlib.redirect_stdout(io.StringIO()) as out, \
                                self.assertRaises(SystemExit) as stopped:
                            main()
                        self.assertEqual(stopped.exception.code,code)
                        observer.assert_not_called()
                        self.assertIn('own command completed',out.getvalue())
                        self.assertNotIn('Peer job',out.getvalue())
                        if code:
                            self.assertIn('::error file=test/own.test.ts',out.getvalue())
                        else:
                            self.assertNotIn('::error',out.getvalue())

    def test_interrupt_stops_owned_descendants_and_preserves_foreign_process(self):
        with tempfile.TemporaryDirectory(dir='tmp') as directory:
            marker=Path(directory).resolve()/'stopped'
            descendant='import signal,pathlib,sys;signal.signal(signal.SIGTERM,lambda *_:(pathlib.Path('+repr(str(marker))+').touch(),sys.exit(0)));print("owned ready",flush=True);signal.pause()'
            child='import subprocess,sys,signal;subprocess.Popen([sys.executable,"-c",'+repr(descendant)+']);signal.pause()'
            with subprocess.Popen([sys.executable,'-c','import signal;print("foreign ready",flush=True);signal.pause()'],
                    stdout=subprocess.PIPE,text=True) as foreign:
                wrapper=None
                try:
                    self.assertEqual(foreign.stdout.readline().strip(),'foreign ready')
                    wrapper=subprocess.Popen([sys.executable,'scripts/ci-fail-fast.py','--',sys.executable,'-c',child],
                        stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
                    self.assertEqual(wrapper.stdout.readline().strip(),'owned ready')
                    wrapper.terminate()
                    output=wrapper.communicate(timeout=3)[0]
                    self.assertEqual(wrapper.returncode,143,output)
                    self.assertTrue(marker.exists())
                    self.assertIsNone(foreign.poll())
                finally:
                    if wrapper is not None and wrapper.poll() is None:
                        wrapper.kill();wrapper.communicate(timeout=3)
                    foreign.terminate();foreign.wait(timeout=3)

    def test_typecheck_matrix_keeps_independent_shards_and_original_commands(self):
        source=Path('.github/workflows/deploy.yml').read_text()
        types=source.split('\n  typecheck-lint:\n',1)[1].split('\n  derived-docs:\n',1)[0]
        self.assertIn('fail-fast: false',types)
        self.assertNotIn('fail-fast: true',types)
        self.assertIn('pnpm exec tsc -b tsconfig.layers.json',types)
        self.assertIn('pnpm run lint:typed --shard=${{ matrix.shard }}/5',types)

    def test_behaviour_matrix_keeps_independent_jobs_and_per_shard_bail(self):
        source=Path('.github/workflows/deploy.yml').read_text()
        for job, count in [('behaviour',32),('behaviour-products',8)]:
            behaviour=source.split(f'\n  {job}:\n',1)[1].split('\n  dispatch-boot-smoke:\n',1)[0].split('\n  behaviour-products:\n',1)[0]
            self.assertIn('fail-fast: false',behaviour)
            self.assertNotIn('fail-fast: true',behaviour)
            self.assertIn('python3 scripts/ci-fail-fast.py -- python3 scripts/heavy-lane.py check -- pnpm exec vitest run --shard=${{ matrix.shard }}/'+str(count)+' --bail=1',behaviour)

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

    def test_helper_refusal_keeps_one_bounded_escaped_reason_not_arbitrary_stderr(self):
        report=API['print_culprits']
        detail='missing base, literal: '+('x'*300)
        failure='untrusted child output\nCI culprit report unavailable: '+detail+'\n::error::injected\n'
        with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess([],1,'',failure)), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            report(['test/actual.test.ts'])
        message=out.getvalue()
        self.assertIn('helper exited 1; missing base%2C literal%3A ',message)
        self.assertIn('original check remains red; no retry',message)
        self.assertNotIn('untrusted child output',message)
        self.assertNotIn('injected',message)
        self.assertNotIn('Candidate ',message)
        self.assertEqual(len(message.splitlines()),1)
        self.assertLess(len(message),400)
        with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess([],2,'','other failure')), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            report(['test/actual.test.ts'])
        self.assertIn('helper exited 2; original check remains red; no retry',out.getvalue())

    def test_only_own_push_failure_reports_its_culprits(self):
        function=API['diagnose'];calls=[]
        with tempfile.TemporaryDirectory(dir='tmp') as directory:
            root=Path(directory)
            with patch.dict(function.__globals__,{'Path':lambda value:root/value,'print_culprits':lambda files:calls.append(files)}), \
                    patch.dict(os.environ,{'GITHUB_EVENT_NAME':'push','GITHUB_RUN_ID':'42'}), \
                    contextlib.redirect_stdout(io.StringIO()):
                function('FAIL test/actual.test.ts > failure',7)
                with patch.dict(os.environ,{'GITHUB_EVENT_NAME':'pull_request'}):
                    function('FAIL test/other.test.ts > actual',7)
            self.assertEqual(calls,[['test/actual.test.ts']])


if __name__=='__main__':
    unittest.main()
