"""Real Git prefix uploads, bounded children and live-check refusal paths."""
import json
import fcntl
import hashlib
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import contextmanager
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PUSH = runpy.run_path(str(ROOT / 'scripts/push-loop.py'))
LIVE = PUSH['LIVE']
CACHE = runpy.run_path(str(ROOT / 'scripts/push_input_cache.py'))
TOOLS = runpy.run_path(str(ROOT / 'scripts/sp-tools.py'))


class PushLoop(unittest.TestCase):
    def setUp(self):
        (ROOT / 'tmp').mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='push-loop-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.git('init', '-q', '-b', 'main')
        self.git('config', 'user.name', 'fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('config', 'core.hooksPath', '/dev/null')
        self.put('.oxlintrc.json', '{"ignorePatterns":[]}')
        self.put('.gitignore', 'tmp/\n')
        self.put('scripts/push-inputs.mjs', 'console.log(JSON.stringify(process.argv.slice(2)));')
        self.base = self.commit('src/base.ts')
        self.git('update-ref', 'refs/remotes/origin/main', self.base)

    def git(self, *args):
        env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
        return subprocess.check_output(['git', *args], cwd=self.root, env=env, text=True, stderr=subprocess.DEVNULL).strip()

    def put(self, file, value):
        path = self.root / file
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value)

    def commit(self, file):
        self.put(file, 'export const value = 1;\n')
        self.git('add', '--', '.')
        self.git('commit', '-qm', 'fixture')
        return self.git('rev-parse', 'HEAD')

    def test_pane_environment_drops_ephemeral_codex_path_and_keeps_session(self):
        context = {'HERDR_ENV': '1', 'HERDR_SESSION': 'fixture',
                   'HERDR_SOCKET_PATH': '/fixture/herdr.sock', 'HERDR_PANE_ID': 'w1:p1',
                   'PATH': '/Users/me/.codex/packages/standalone/releases/old/codex-path:/bin:/Users/me/.codex/tmp/arg0/tool:/usr/local/bin:/bin'}
        cleaned = TOOLS['environment'](context)
        self.assertEqual(cleaned['PATH'], '/bin:/usr/local/bin')
        self.assertEqual(cleaned['HERDR_SESSION'], 'fixture')
        self.assertEqual(cleaned['HERDR_SOCKET_PATH'], '/fixture/herdr.sock')
        self.assertEqual(context['PATH'].split(':')[0], '/Users/me/.codex/packages/standalone/releases/old/codex-path')

    def test_cli_defers_overlap_and_observes_quiet_after_the_activity_lock(self):
        self.put('.git/quiet', '{"owner":"fixture-sample"}')
        env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
        command = [sys.executable, str(ROOT / 'scripts/push-loop.py')]
        with (self.root / '.git/push-loop.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            busy = subprocess.run(command, cwd=self.root, env=env, capture_output=True, text=True, timeout=3)
            self.assertEqual(busy.returncode, 0, busy.stderr)
            self.assertEqual(json.loads(busy.stdout)['status'], 'busy')
        resumed = subprocess.run(command, cwd=self.root, env=env, capture_output=True, text=True, timeout=3)
        self.assertEqual(resumed.returncode, 0, resumed.stderr)
        self.assertEqual(json.loads(resumed.stdout)['status'], 'quiet')
        self.assertEqual(self.git('rev-parse', 'origin/main'), self.base)

    def test_quiet_sample_defers_checks_and_upload_then_resumes(self):
        tip = self.commit('src/good.ts')
        self.put('.git/quiet', '{"owner":"fixture-sample"}')
        checks, uploads = [], []
        def checker(*args):
            checks.append(args)
            return {'ok': True, 'output': ''}
        def upload(*args):
            uploads.append(args)
            return 0
        result = PUSH['tick'](self.root, checker=checker, uploader=upload)
        self.assertEqual(result, {'status': 'quiet', 'tip': tip})
        self.assertEqual(checks, [])
        self.assertEqual(uploads, [])
        (self.root / '.git/quiet').unlink()
        self.assertEqual(PUSH['tick'](self.root, checker=checker, uploader=upload)['status'], 'pushed')
        self.assertEqual(len(checks), 1)
        self.assertEqual(len(uploads), 1)

    def test_quiet_ends_at_ten_minutes_or_owner_death(self):
        path = self.root / '.git/quiet'
        self.put('.git/quiet', json.dumps({'owner': 'fixture-sample', 'pid': os.getpid()}))
        started = path.stat().st_mtime
        self.assertTrue(PUSH['quiet_active'](path, started + 599.9))
        self.assertFalse(PUSH['quiet_active'](path, started + 600))
        with subprocess.Popen([sys.executable, '-c', 'pass']) as owner:
            owner.wait(timeout=3)
        self.put('.git/quiet', json.dumps({'owner': 'fixture-sample', 'pid': owner.pid}))
        self.assertFalse(PUSH['quiet_active'](path))
        tip = self.commit('src/after-dead-owner.ts')
        result = PUSH['tick'](self.root, checker=lambda *_: {'ok': True, 'output': ''}, uploader=lambda *_: 0)
        self.assertEqual(result['status'], 'pushed')
        self.assertEqual(result['tip'], tip)
        # Never remove or rewrite a marker owned by another process.
        self.assertEqual(json.loads(path.read_text())['pid'], owner.pid)

    def test_stale_legacy_quiet_no_longer_stops_pushes(self):
        self.commit('src/after-stale-owner.ts')
        self.put('.git/quiet', '{"owner":"fixture-sample"}')
        path = self.root / '.git/quiet'
        os.utime(path, (time.time() - 601, time.time() - 601))
        result = PUSH['tick'](self.root, checker=lambda *_: {'ok': True, 'output': ''}, uploader=lambda *_: 0)
        self.assertEqual(result['status'], 'pushed')

    def test_pre_push_runs_only_related_tests(self):
        tip = self.commit('src/good.ts')
        commands = []
        def runner(command, *_):
            commands.append(command)
            return 0, '["test/unit.test.ts"]' if '--live' in command else ''
        result = LIVE['check'](self.root, self.base, tip, time.monotonic() + 45, runner)
        self.assertTrue(result['ok'])
        self.assertEqual([command[0] for command in commands], ['node', 'pnpm'])
        self.assertIn('vitest', commands[1])
        self.assertFalse(any('oxlint' in command or 'types' in command for command in commands))
        self.assertEqual(result['types'], 'pre-commit')

    def test_edit_during_tests_cannot_earn_a_pass(self):
        tip = self.commit('src/good.ts')
        def runner(command, *_):
            self.put('src/good.ts', 'half written')
            return 0, '[]'
        self.assertFalse(LIVE['check'](self.root, self.base, tip, time.monotonic() + 45, runner)['ok'])

    def test_deadline_reaps_owned_process(self):
        start = time.monotonic()
        rc, _ = LIVE['run']([sys.executable, '-c', 'import signal; signal.pause()'], self.root, start + .15)
        self.assertEqual(rc, 124)
        self.assertLess(time.monotonic() - start, 2)

    def test_committed_source_ignores_working_and_index_edits(self):
        for name in [*PUSH['SOURCE']['TOOLS'], 'link-node-modules.mjs']:
            self.put('scripts/' + name, '// committed tool\n')
        self.put('src/data.json', '{"state":"committed"}')
        self.put('src/other.ts', 'export const original = true;')
        tip = self.commit('src/entry.ts')
        self.put('src/other.ts', 'half written foreign WIP')
        self.put('src/data.json', '{"state":"staged WIP"}')
        self.git('add', '--', 'src/data.json')
        index = (self.root / '.git/index').read_bytes()
        with PUSH['SOURCE']['committed_source'](self.root, tip, tip, time.monotonic() + 10) as (tree, tools):
            self.assertEqual((tree / 'src/other.ts').read_text(), 'export const original = true;')
            self.assertEqual((tree / 'src/data.json').read_text(), '{"state":"committed"}')
            self.assertEqual((tools / 'push-inputs.mjs').read_text(), '// committed tool\n')
        self.assertEqual((self.root / 'src/other.ts').read_text(), 'half written foreign WIP')
        self.assertEqual((self.root / '.git/index').read_bytes(), index)

    def test_timed_out_tests_defer_but_observed_failures_stay_red(self):
        tip = self.commit('src/good.ts')
        for output, expected in [('still running', True), ('FAIL test/unit.test.ts > broken', False)]:
            def runner(command, *_):
                if '--live' in command:
                    return 0, '["test/unit.test.ts"]'
                return (124, output) if 'vitest' in command else (0, '')
            self.assertEqual(LIVE['check'](self.root, self.base, tip, time.monotonic() + 45, runner)['ok'], expected)

    def test_prefix_upload_keeps_red_suffix_main_and_index(self):
        good = self.commit('src/good.ts')
        bad = self.commit('src/bad.ts')
        tip = self.commit('src/later.ts')
        index = (self.root / '.git/index').read_bytes()
        remote = self.root / 'tmp/remote.git'
        subprocess.run(['git', 'init', '--bare', '-q', str(remote)], check=True)
        self.git('remote', 'add', 'origin', str(remote))
        self.git('push', '-q', 'origin', self.base + ':refs/heads/main')
        notices = []

        def checker(root, base, candidate, deadline):
            return {'ok': candidate == good, 'phase': 'lint', 'files': ['src/bad.ts'], 'output': 'bad'}

        def notify(*args):
            self.assertEqual(self.git('rev-parse', 'origin/main'), good)
            log = (self.root / 'tmp/push-loop/current.log').read_text()
            self.assertEqual(log.splitlines()[0], 'bad')
            detail = json.loads(log.splitlines()[-1])
            self.assertEqual(detail['bad'], bad)
            self.assertEqual(detail['tip'], good)
            notices.append(args)
            return True

        result = PUSH['tick'](self.root, checker=checker, notify=notify)
        self.assertEqual(result['status'], 'pushed')
        self.assertEqual(result['tip'], good)
        self.assertEqual(result['bad'], bad)
        self.assertEqual(self.git('rev-parse', 'origin/main'), good)
        self.assertEqual(self.git('rev-parse', 'main'), tip)
        self.assertEqual((self.root / '.git/index').read_bytes(), index)
        self.assertEqual(len(notices), 1)

    def test_unknown_live_refusal_pings_only_on_third_repeat(self):
        self.commit('src/good.ts')
        notices = []
        checker = lambda *_: {'ok': False, 'phase': 'working-tree', 'files': [], 'output': 'live edit'}
        notify = lambda *args: notices.append(args) or True
        for _ in range(4):
            self.assertEqual(PUSH['tick'](self.root, checker=checker, notify=notify)['status'], 'red')
        self.assertEqual(len(notices), 1)

    def test_snapshot_names_do_not_reset_the_same_refusal(self):
        first = '/repo/tmp/push-source-abcd_01/src/entry.ts: refusal in 8.2s'
        second = '/repo/tmp/push-source-other-02/src/entry.ts: refusal in 9.3s'
        self.assertEqual(PUSH['refusal_signature'](first), PUSH['refusal_signature'](second))
        self.assertNotEqual(PUSH['refusal_signature'](first), PUSH['refusal_signature'](first.replace('entry.ts', 'other.ts')))
        self.assertEqual(LIVE['failure_paths']('file:///repo/tmp/push-source-abcd/src/entry.ts:2:1'), ['src/entry.ts'])

    def test_source_type_cache_binds_contents_and_inventory(self):
        records = [b'100644 blob aaa\tsrc/author.ts', b'100644 blob bbb\tsrc/data.json']
        key = CACHE['source_key'](records, ['src'])
        self.assertEqual(key, CACHE['source_key']([*records, b'100644 blob ccc\tdocs/note.md'], ['src']))
        self.assertNotEqual(key, CACHE['source_key']([b'100644 blob ddd\tsrc/author.ts', records[1]], ['src']))
        self.assertNotEqual(key, CACHE['source_key']([*records, b'100644 blob eee\tsrc/new.ts'], ['src']))

    def test_deferred_types_bind_exact_commit_blobs_not_working_edits(self):
        tip = self.commit('src/good.ts')
        blob = self.git('rev-parse', tip + ':src/good.ts')
        self.put('.git/push-deferred-types.json', json.dumps({'src/good.ts': [blob]}))
        self.put('src/good.ts', 'foreign WIP')
        self.assertEqual(PUSH['deferred_types'](self.root, self.base, tip), ['src/good.ts'])
        self.put('.git/push-deferred-types.json', json.dumps({'src/good.ts': ['wrong blob']}))
        self.assertEqual(PUSH['deferred_types'](self.root, self.base, tip), [])

    def test_deferred_type_refusal_blocks_the_push_before_related_tests(self):
        tip = self.commit('src/good.ts')
        blob = self.git('rev-parse', tip + ':src/good.ts')
        self.put('.git/push-deferred-types.json', json.dumps({'src/good.ts': [blob]}))
        self.put('.push-types.json', '{"available":true}')
        @contextmanager
        def prepared(*_):
            yield self.root, self.root / 'scripts'
        calls = []
        def runner(command, *_):
            calls.append(command)
            if command[0] == 'node':
                return 0, ''
            return 1, 'src/good.ts:1:1 error typescript(TS2322)'
        with patch.dict(PUSH['SOURCE'], committed_source=prepared), patch.dict(LIVE, run=runner):
            result = PUSH['check_committed'](self.root, self.base, tip, time.monotonic() + 45)
        self.assertFalse(result['ok'])
        self.assertEqual(result['phase'], 'typed-check')
        self.assertEqual(calls, [['node', str(self.root / 'scripts/gen-shard-words.mjs')],
                                ['pnpm', 'exec', 'oxlint', '--type-check', '--type-aware',
                                 '-c', '.oxlintrc.json', 'src/good.ts']])

    def test_deferred_types_with_missing_generated_inputs_stay_with_ci(self):
        tip = self.commit('src/good.ts')
        blob = self.git('rev-parse', tip + ':src/good.ts')
        self.put('.git/push-deferred-types.json', json.dumps({'src/good.ts': [blob]}))
        self.put('.push-types.json', '{"available":false}')
        @contextmanager
        def prepared(*_):
            yield self.root, self.root / 'scripts'
        calls = []
        with patch.dict(PUSH['SOURCE'], committed_source=prepared), \
             patch.dict(LIVE, run=lambda *args: calls.append(args) or (0, '')):
            result = PUSH['check_committed'](self.root, self.base, tip, time.monotonic() + 45)
        self.assertTrue(result['ok'])
        self.assertEqual(result['types'], 'ci-cache-miss')
        self.assertIn('full CI owns: src/good.ts', result['output'])
        self.assertEqual(calls, [])

    def test_missing_discovery_prevents_a_partial_cache_from_enabling_types(self):
        self.put('src/shards/fixture/world/build.ts', "import manifest from '../discovery.generated';\nexport const seed = manifest.seed;\n")
        missing = PUSH['SOURCE']['missing_generated'](self.root)
        self.assertEqual(missing, ['src/shards/fixture/discovery.generated'])
        self.put('src/shards/fixture/discovery.generated.ts', 'export default {seed: 42};\n')
        self.assertEqual(PUSH['SOURCE']['missing_generated'](self.root), [])

    def test_generation_phase_cache_rejects_changed_inputs_and_corrupt_outputs(self):
        tip = self.git('rev-parse', 'HEAD')
        records = [row for row in subprocess.check_output(['git', 'ls-tree', '-rz', tip], cwd=self.root).split(b'\0') if row]
        generated = self.root / 'completed/tree'
        generated.mkdir(parents=True)
        (generated.parent / 'HEAD').write_text(tip)
        source = self.git('show', tip + ':src/base.ts') + '\n'
        output = b'{"value":1}'
        digest = hashlib.sha256(output).hexdigest()
        saved = {'schema': 'generation-phase/1', 'root': str(generated), 'identity': '0' * 64,
                 'inputs': {'src/base.ts': hashlib.sha256(source.encode()).hexdigest()},
                 'trees': {'src': ['src/base.ts']}, 'outputs': {'src/value.generated.json': digest}}
        discovery = b'export default {seed:42};\n'
        saved['inputs']['src/shards/fixture/discovery.generated.ts'] = hashlib.sha256(discovery).hexdigest()
        phase = generated / '.cache/generation-phase.json'
        phase.parent.mkdir()
        encoded = json.dumps(saved, ensure_ascii=False, separators=(',', ':'))
        phase.write_text(json.dumps({**saved, 'seal': hashlib.sha256(encoded.encode()).hexdigest()}))
        (generated / 'src').mkdir()
        (generated / 'src/value.generated.json').write_bytes(output)
        discovery_path = generated / 'src/shards/fixture/discovery.generated.ts'
        discovery_path.parent.mkdir(parents=True)
        discovery_path.write_bytes(discovery)
        self.assertEqual(CACHE['publish'](self.root, tip, generated), 2)
        target = self.root / 'checked'
        target.mkdir()
        self.assertTrue(CACHE['restore'](self.root, target, records, time.monotonic() + 5))
        self.assertEqual((target / 'src/value.generated.json').read_bytes(), output)
        self.assertEqual((target / 'src/shards/fixture/discovery.generated.ts').read_bytes(), discovery)
        self.assertFalse(CACHE['restore'](self.root, target, [*records, b'100644 blob new\tsrc/new.ts'], time.monotonic() + 5))
        (self.root / 'tmp/push-input-cache/blobs' / digest).write_text('corrupt')
        clean = self.root / 'another-check'
        clean.mkdir()
        self.assertFalse(CACHE['restore'](self.root, clean, records, time.monotonic() + 5))
        saved['inputs']['src/base.ts'] = 'f' * 64
        encoded = json.dumps(saved, ensure_ascii=False, separators=(',', ':'))
        phase.write_text(json.dumps({**saved, 'seal': hashlib.sha256(encoded.encode()).hexdigest()}))
        with self.assertRaisesRegex(ValueError, 'source differs'):
            CACHE['publish'](self.root, tip, generated)

    def test_missing_generated_test_inputs_defer_without_repeating_lint(self):
        tip = self.commit('src/good.ts')
        commands = []
        result = LIVE['check'](self.root, self.base, tip, time.monotonic() + 45,
                               lambda *args: commands.append(args) or (0, ''), types_available=False)
        self.assertTrue(result['ok'])
        self.assertEqual(result['types'], 'pre-commit')
        self.assertIn('related tests defer', result['output'])
        self.assertEqual(commands, [])


if __name__ == '__main__':
    unittest.main()
