from pathlib import Path
import json
import os
import runpy
import subprocess
import sys
import tempfile
import unittest

if '--candidate-stdin' in sys.argv:
    sys.argv.remove('--candidate-stdin')
    SOURCE = sys.stdin.read()
    POLICY = {'__name__': 'push_handoff_fixture'}
    exec(compile(SOURCE, 'scripts/push_handoff.py', 'exec'), POLICY)
else:
    source = Path(__file__).resolve().parents[1] / 'scripts/push_handoff.py'
    SOURCE = source.read_text()
    POLICY = runpy.run_path(str(source))


class PushHandoff(unittest.TestCase):
    def test_publish_before_upload_preserves_older_exact_batch_records(self):
        older = {'base': 'a' * 40, 'tip': 'b' * 40, 'steps': ['types']}
        calls = []
        def runner(command, **options):
            calls.append((command, options))
            if len(calls) == 1:
                return subprocess.CompletedProcess(command, 0, json.dumps({'value': json.dumps({'schema': 1, 'batches': [older]})}), '')
            return subprocess.CompletedProcess(command, 0, '', '')
        row = POLICY['publish_handoff']('.', 'b' * 40, 'c' * 40, ['Gate-deferred: products'], runner)
        self.assertEqual(row, {'base': 'b' * 40, 'tip': 'c' * 40, 'steps': ['products']})
        self.assertIn('PATCH', calls[1][0])
        value = json.loads(json.loads(calls[1][1]['input'])['value'])
        self.assertEqual(value['batches'], [older, row])
        self.assertLessEqual(calls[1][1]['timeout'], calls[0][1]['timeout'])

    def test_first_publication_creates_only_the_named_nonsecret_variable(self):
        calls = []
        def runner(command, **options):
            calls.append((command, options))
            return subprocess.CompletedProcess(command, 1 if len(calls) == 1 else 0, '', 'HTTP 404' if len(calls) == 1 else '')
        POLICY['publish_handoff']('.', 'a' * 40, 'b' * 40, ['Gate-deferred: types'], runner)
        self.assertIn('POST', calls[1][0])
        self.assertEqual(json.loads(calls[1][1]['input'])['name'], 'WS_GATE_DEFERRED')

    def test_unknown_remote_state_or_write_failure_refuses_publication(self):
        for message in ['HTTP 403', 'network refused']:
            with self.subTest(message=message), self.assertRaises(ValueError):
                POLICY['publish_handoff']('.', 'a' * 40, 'b' * 40, ['Gate-deferred: types'],
                    lambda command, **_: subprocess.CompletedProcess(command, 1, '', message))
        calls = []
        def refused(command, **_):
            calls.append(command)
            return subprocess.CompletedProcess(command, 1 if len(calls) == 2 else 0, '{"value":""}', 'HTTP 403')
        with self.assertRaises(ValueError):
            POLICY['publish_handoff']('.', 'a' * 40, 'b' * 40, ['Gate-deferred: types'], refused)

    def test_ci_uses_only_its_exact_tip_and_refuses_ambiguous_metadata(self):
        row = {'base': 'a' * 40, 'tip': 'b' * 40, 'steps': ['products', 'tests-products']}
        encoded = json.dumps({'schema': 1, 'batches': [row]})
        self.assertEqual(POLICY['selected_handoff'](encoded, 'b' * 40), row)
        self.assertIsNone(POLICY['selected_handoff'](encoded, 'c' * 40))
        for text in ['bad', json.dumps({'schema': 1, 'batches': [row, row]}), json.dumps({'schema': 1, 'batches': [{**row, 'steps': ['all checks']}]})]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                POLICY['selected_handoff'](text, 'b' * 40)

    def test_same_tip_republication_preserves_previously_named_work(self):
        prior = {'base': 'a' * 40, 'tip': 'b' * 40, 'steps': ['products']}
        def runner(command, **options):
            if '--method' not in command:
                return subprocess.CompletedProcess(command, 0, json.dumps({'value': json.dumps({'schema': 1, 'batches': [prior]})}), '')
            value = json.loads(json.loads(options['input'])['value'])
            self.assertEqual(value['batches'][0]['steps'], ['products', 'types'])
            return subprocess.CompletedProcess(command, 0, '', '')
        POLICY['publish_handoff']('.', 'a' * 40, 'b' * 40, ['Gate-deferred: types'], runner)

    def test_actual_ci_output_selects_only_the_current_sha_without_network(self):
        root = Path(__file__).resolve().parents[1]
        (root / 'tmp').mkdir(exist_ok=True)
        row = {'base': 'a' * 40, 'tip': 'b' * 40, 'steps': ['types']}
        with tempfile.TemporaryDirectory(dir=root / 'tmp', prefix='handoff-output-') as owned:
            output = Path(owned) / 'output'
            environment = dict(os.environ, GITHUB_SHA='b' * 40, GITHUB_OUTPUT=str(output),
                               WS_GATE_DEFERRED=json.dumps({'schema': 1, 'batches': [row]}))
            subprocess.run([sys.executable, '-c', SOURCE, '--select'], env=environment, check=True, timeout=5)
            self.assertEqual(output.read_text(), 'active=true\nbase=' + 'a' * 40 + '\nsteps=["types"]\n')
            output.unlink()
            environment['GITHUB_SHA'] = 'c' * 40
            subprocess.run([sys.executable, '-c', SOURCE, '--select'], env=environment, check=True, timeout=5)
            self.assertEqual(output.read_text(), 'active=false\n')


if __name__ == '__main__':
    unittest.main()
