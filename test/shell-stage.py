import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
from types import SimpleNamespace
import unittest

HELPER = Path(os.environ.get('STAGE_HELPER', Path(__file__).resolve().parents[1] / 'scripts/staged-deployment.py')).resolve()
spec = importlib.util.spec_from_file_location('staged_deployment_controls', HELPER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
SHA = 'a' * 40
URL = 'https://wildshard-singleplayer-abc123-raynos-projects.vercel.app'


@contextlib.contextmanager
def environment(values):
    old = {key: os.environ.get(key) for key in values}
    try:
        for key, value in values.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        yield
    finally:
        for key, value in old.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


class ProtectedStage(unittest.TestCase):
    def setUp(self):
        self.original = Path.cwd()
        self.root = Path(tempfile.mkdtemp(prefix='stage-control-', dir=self.original / 'tmp')).resolve()
        self.addCleanup(shutil.rmtree, self.root)
        os.chdir(self.root)
        self.addCleanup(os.chdir, self.original)
        for folder in ('dist/.vite', '.vercel/output/static', 'prebuilt-output'):
            Path(folder).mkdir(parents=True)
        self.build = SHA[:7] + '-immutable'
        version = json.dumps({'build': self.build, 'time': 'original'})
        Path('dist/version.json').write_text(version)
        Path('.vercel/output/static/version.json').write_text(version)
        Path('dist/.vite/chunk-modules.json').write_text('{"original":true}')
        Path('dist/core.js.map').write_text('{"sources":["original.ts"]}')
        Path('prebuilt-output/proof.json').write_text(json.dumps({'sha': SHA, 'run': '123', 'archiveHash': 'b' * 64}))
        self.args = SimpleNamespace(sha=SHA, run='123', attempt='1', project='prj_OWNED', team='team_OWNED',
                                    token='fixture-only', proof='prebuilt-output/proof.json')
        self.inventory = module.map_inventory()
        self.receipt = {'version': 1, 'sha': SHA, 'run': '123', 'attempt': '1',
                        'deployment': 'dpl_EXACT',
                        'url': URL, 'build': self.build, 'archiveHash': 'b' * 64,
                        'privateMapPath': '/core.js.map',
                        'probes': [{'path': '/', 'status': 302, 'challenge': 'vercel-sso'},
                                   {'path': '/core.js.map', 'status': 401, 'challenge': 'http-auth'}],
                        'maps': dict(self.inventory, artifactId='987', artifactDigest='sha256:' + 'c' * 64)}
        self.record = {'id': 'dpl_EXACT', 'url': URL.removeprefix('https://'), 'projectId': 'prj_OWNED', 'ownerId': 'team_OWNED',
                       'target': 'production', 'readyState': 'READY', 'meta': {
                           'ciStageSha': SHA, 'ciStageRun': '123', 'ciStageAttempt': '1',
                           'ciStageBuild': self.build, 'ciStageArchive': 'b' * 64,
                           'ciStageMaps': self.inventory['manifestHash']}}
        self.artifact = {'id': 987, 'name': 'production-source-maps-' + SHA, 'expired': False,
                         'size_in_bytes': 456, 'digest': 'sha256:' + 'c' * 64,
                         'workflow_run': {'id': 123, 'head_sha': SHA, 'head_branch': 'main'}}
        self.stage_jobs = {'total_count': 1, 'jobs': [{'name': 'stage-prebuilt', 'run_id': 123, 'run_attempt': 1,
                                                     'head_sha': SHA, 'status': 'completed', 'conclusion': 'success'}]}

    def test_only_exact_auth_challenges_are_allowed(self):
        for code, location in [(401, None), (403, None), (302, 'https://vercel.com/sso-api?nonce=owned')]:
            self.assertTrue(module.protected_status(code, location))
        for code, location in [(200, None), (404, None), (301, 'https://vercel.com/sso-api'), (307, 'https://vercel.com/sso-api'),
                               (302, None), (302, '/sso-api'), (302, 'http://vercel.com/sso-api'),
                               (302, 'https://vercel.com.evil.test/sso-api'), (302, 'https://evil@vercel.com/sso-api'),
                               (302, 'https://vercel.com:443/sso-api'), (302, 'https://vercel.com/other'),
                               (302, 'https://[broken')]:
            with self.subTest(code=code, location=location):
                self.assertFalse(module.protected_status(code, location))

    def test_url_never_accepts_arbitrary_hosts_paths_or_credentials(self):
        self.assertEqual(module.unique_url(URL), URL)
        for value in ['http://example.vercel.app', 'https://vercel.app', 'https://example.vercel.app.evil.test',
                      'https://user@example.vercel.app', 'https://example.vercel.app:443', URL + '?x=1', URL + '/path']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                module.unique_url(value)

    def test_staged_build_keeps_original_variable_length_sha_abbreviations(self):
        for size in [7, 8, 12, 40]:
            self.assertTrue(module.build_matches(SHA[:size] + '-original', SHA))
        for value in ['aaaaaa-short', SHA[:39] + 'b-original', 'aaaaaaa-', 'wrong-original', None]:
            self.assertFalse(module.build_matches(value, SHA))

    def test_final_receipt_rejects_missing_foreign_or_unbounded_identities(self):
        self.assertEqual(module.receipt_value(json.dumps(self.receipt), SHA, '123', '1', 'prj_OWNED', 'team_OWNED'), self.receipt)
        for key, value in [('sha', 'd' * 40), ('run', '124'), ('attempt', '2'), ('project', 'prj_FOREIGN'),
                           ('team', 'team_FOREIGN'), ('deployment', URL), ('url', 'https://evil.test'),
                           ('archiveHash', 'short'), ('build', 'bbbbbbb-other'), ('probes', []),
                           ('probes', [0, None]), ('version', True)]:
            candidate = dict(self.receipt, **{key: value})
            with self.subTest(key=key), self.assertRaises((ValueError, TypeError, KeyError)):
                module.receipt_value(json.dumps(candidate), SHA, '123', '1', 'prj_OWNED', 'team_OWNED')
        for key in self.receipt['maps']:
            candidate = copy.deepcopy(self.receipt)
            candidate['maps'].pop(key)
            with self.subTest(missing=key), self.assertRaises(ValueError):
                module.receipt_value(json.dumps(candidate), SHA, '123', '1', 'prj_OWNED', 'team_OWNED')

    def test_exact_project_target_ready_source_and_map_digest_are_mandatory(self):
        module.admitted(self.record, self.receipt, self.args.project, self.args.team)
        for key, value in [('id', 'dpl_OTHER'), ('projectId', 'prj_OTHER'), ('ownerId', 'team_OTHER'), ('target', 'preview'),
                           ('readyState', 'BUILDING'), ('url', 'foreign.vercel.app')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                module.admitted(dict(self.record, **{key: value}), self.receipt, self.args.project, self.args.team)
        for key in self.record['meta']:
            record = copy.deepcopy(self.record)
            record['meta'][key] = 'foreign'
            with self.subTest(metadata=key), self.assertRaises(ValueError):
                module.admitted(record, self.receipt, self.args.project, self.args.team)

    def test_map_artifact_must_remain_finalized_existing_and_exact(self):
        module.admitted_artifact(self.artifact, self.receipt)
        for key, value in [('id', 988), ('name', 'foreign'), ('expired', True), ('size_in_bytes', 0),
                           ('digest', 'sha256:' + 'd' * 64), ('digest', None)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                module.admitted_artifact(dict(self.artifact, **{key: value}), self.receipt)
        for key, value in [('id', 124), ('head_sha', 'f' * 40), ('head_branch', 'other')]:
            record = copy.deepcopy(self.artifact)
            record['workflow_run'][key] = value
            with self.subTest(run=key), self.assertRaises(ValueError):
                module.admitted_artifact(record, self.receipt)

    def test_stage_is_prebuilt_skip_domain_and_never_promotes(self):
        calls = []
        def run(args):
            calls.append(args)
            if args[:2] == ['vercel', 'deploy']:
                return URL
            if args[:2] == ['vercel', 'inspect']:
                return json.dumps({'id': 'dpl_EXACT'})
            self.assertEqual(args, ['node', 'scripts/deploy-source-maps.mjs', '.vercel/output/static'])
            return ''
        output = self.root / 'output'
        with environment({'GITHUB_OUTPUT': str(output)}), contextlib.redirect_stdout(io.StringIO()):
            module.stage(self.args, run=run, read=lambda *_: self.record,
                         check=lambda _url, path: {'path': path, 'status': 401, 'challenge': 'http-auth'})
        self.assertEqual(calls[0][0], 'node')
        self.assertIn('--prebuilt', calls[1])
        self.assertIn('--target=production', calls[1])
        self.assertIn('--skip-domain', calls[1])
        self.assertFalse(any('promote' in call for call in calls))
        partial = json.loads(output.read_text().split('=', 1)[1])
        self.assertNotIn('project', partial)
        self.assertNotIn('team', partial)
        self.assertNotIn(self.args.project, output.read_text())
        self.assertNotIn(self.args.team, output.read_text())
        self.assertNotIn('artifactId', partial['maps'])
        with self.assertRaises(ValueError):
            module.receipt_value(json.dumps(partial), SHA, '123', '1', 'prj_OWNED', 'team_OWNED')
        output.unlink()
        with environment({'GITHUB_OUTPUT': str(output), 'STAGED_RECEIPT': json.dumps(partial),
                          'MAP_ARTIFACT_ID': '987', 'MAP_ARTIFACT_DIGEST': 'c' * 64}):
            module.complete(self.args, read_artifact=lambda _: self.artifact)
        finalized = module.receipt_value(output.read_text().split('=', 1)[1], SHA, '123', '1', 'prj_OWNED', 'team_OWNED')
        self.assertEqual(finalized['maps']['artifactId'], '987')

    def test_selection_rechecks_both_protected_paths_and_final_map_artifact(self):
        probes = []
        def check(url, path):
            self.assertEqual(url, URL)
            probes.append(path)
            return {'path': path, 'status': 302}
        with environment({'STAGED_RECEIPT': json.dumps(self.receipt), 'STAGE_RESULT': 'success'}):
            self.assertEqual(module.select(self.args, read=lambda *_: self.record, check=check,
                                           read_artifact=lambda _: self.artifact, read_stage=lambda _: self.stage_jobs), self.receipt)
            self.assertEqual(probes, ['/', '/core.js.map'])
            with self.assertRaises(ValueError):
                module.select(self.args, read=lambda *_: self.record, check=check,
                              read_artifact=lambda _: dict(self.artifact, expired=True), read_stage=lambda _: self.stage_jobs)

    def test_partial_map_mutation_cannot_complete_a_stage(self):
        partial = copy.deepcopy(self.receipt)
        partial['maps'] = self.inventory
        Path('dist/core.js.map').write_text('changed')
        with environment({'STAGED_RECEIPT': json.dumps(partial)}), self.assertRaises(ValueError):
            module.complete(self.args, read_artifact=lambda _: self.artifact)


if __name__ == '__main__':
    unittest.main()
