"""Explicit controller units and real-wrapper controls without touching live hooks."""
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
controller = runpy.run_path(str(ROOT / 'scripts/commit-checker-snapshot.py'))
snapshot = controller['snapshot_checkers']
handoff_message = controller['gate_handoff_message']


class CheckerSnapshotTest(unittest.TestCase):
    def setUp(self):
        (ROOT / 'tmp').mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='checker-pin-')
        self.root = Path(self.temporary.name)
        self.env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
        self.git('init', '-q')
        self.git('config', 'user.name', 'checker fixture')
        self.git('config', 'user.email', 'checker@example.invalid')
        self.git('config', 'core.hooksPath', '/dev/null')
        self.put('package.json', '{"type":"module"}')
        self.put('scripts/precommit-inputs.mjs', "export {value} from './precommit-related.mjs';")
        self.put('scripts/precommit-related.mjs', "export const value='committed';")
        self.put('src/user.mjs', "export const value='original';")
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')
        self.parent = self.git('rev-parse', 'HEAD').stdout.strip()

    def tearDown(self):
        self.temporary.cleanup()

    def put(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.root, env=self.env,
                              text=True, capture_output=True, check=True)

    def test_both_entry_modules_read_parent_even_with_staged_and_loose_poison(self):
        before = (self.root / '.git/index').read_bytes()
        self.put('scripts/precommit-inputs.mjs', "throw Error('loose input checker');")
        self.put('scripts/precommit-related.mjs', "throw Error('loose related checker');")
        self.put('src/user.mjs', "export const value='current user source';")
        self.git('add', 'scripts/precommit-related.mjs')
        staged = (self.root / '.git/index').read_bytes()
        self.assertNotEqual(staged, before)
        read_set = self.root / 'read-set'
        env = snapshot(self.root, self.parent, self.root / 'owned-pin', self.env, read_set)
        result = subprocess.run(['node', '--input-type=module', '-e',
            "import{value}from'./scripts/precommit-inputs.mjs';import{value as user}from'./src/user.mjs';console.log(value+'|'+user);"],
            cwd=self.root, env=env, text=True, capture_output=True, check=True)
        self.assertEqual(result.stdout.strip(), 'committed|current user source')
        self.assertEqual((self.root / '.git/index').read_bytes(), staged)
        self.assertIn('loose input checker', (self.root / 'scripts/precommit-inputs.mjs').read_text())
        self.assertIn('scripts/precommit-related.mjs', read_set.read_text())

    def test_missing_committed_parent_and_partial_installation_refuse(self):
        with self.assertRaisesRegex(RuntimeError, 'parent'):
            snapshot(self.root, 'invalid-parent', self.root / 'owned-pin', self.env)
        self.git('rm', 'scripts/precommit-related.mjs')
        self.git('commit', '-qm', 'partial')
        with self.assertRaisesRegex(RuntimeError, 'Incomplete'):
            snapshot(self.root, 'HEAD', self.root / 'owned-pin', self.env)

    def test_bootstrap_without_installed_checker_preserves_environment(self):
        self.git('rm', 'scripts/precommit-inputs.mjs', 'scripts/precommit-related.mjs')
        self.git('commit', '-qm', 'bootstrap')
        self.assertEqual(snapshot(self.root, 'HEAD', self.root / 'owned-pin', self.env), self.env)
        self.assertFalse((self.root / 'owned-pin').exists())

    def real_wrapper(self, reject=False, handoff=False):
        self.put('scripts/commit-checker-snapshot.py',
                 (ROOT / 'scripts/commit-checker-snapshot.py').read_text())
        self.put('scripts/precommit-inputs.mjs', "throw Error('committed checker refusal');" if reject
                 else "import{value}from'./precommit-related.mjs';if(value!=='committed')throw Error('wrong checker');")
        if handoff:
            self.put('scripts/precommit-inputs.mjs', """import{writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';
const file=process.env.WS_COMMIT_HANDOFF_FILE;if(!file)throw Error('missing invocation handoff file');
writeFileSync(file,JSON.stringify({root:process.cwd(),tree:execFileSync('git',['write-tree'],{encoding:'utf8'}).trim(),step:'candidate types'})+'\\n');""")
        live_handoff = (self.root / 'scripts/precommit-inputs.mjs').read_text()
        self.put('.githooks/pre-commit', '#!/bin/sh\nexec node scripts/precommit-inputs.mjs\n')
        hook = self.root / '.githooks/pre-commit'
        hook.chmod(0o755)
        self.git('add', '.')
        self.git('commit', '-qm', 'install checker')
        self.git('config', 'core.hooksPath', '.githooks')
        parent = self.git('rev-parse', 'HEAD').stdout.strip()
        self.put('scripts/commit-checker-snapshot.py', "raise RuntimeError('loose controller poison')\n")
        self.put('scripts/precommit-inputs.mjs', live_handoff if handoff else
                 "export const rescue='loose';" if reject else "throw Error('loose checker poison');")
        self.put('scripts/precommit-related.mjs', "throw Error('loose related poison');")
        self.put('src/user.mjs', "export const value='changed';")
        result = subprocess.run(['bash', str(ROOT / 'scripts/commit.sh'),
            'test(commit): pin checker policy', '--', 'src/user.mjs'], cwd=self.root,
            env=self.env, text=True, capture_output=True, check=False, timeout=15)
        return parent, result

    def test_real_wrapper_refuses_live_hook_poison_without_snapshotting_it(self):
        parent, result = self.real_wrapper()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('loose checker poison', result.stdout + result.stderr)
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout.strip(), parent)
        self.assertIn('original', self.git('show', 'HEAD:src/user.mjs').stdout)
        self.assertIn('changed', (self.root / 'src/user.mjs').read_text())
        self.assertIn('loose checker poison', (self.root / 'scripts/precommit-inputs.mjs').read_text())
        self.assertIn('loose controller poison', (self.root / 'scripts/commit-checker-snapshot.py').read_text())

    def test_real_wrapper_uses_live_rescue_and_keeps_committed_checker_bytes(self):
        parent, result = self.real_wrapper(reject=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotEqual(self.git('rev-parse', 'HEAD').stdout.strip(), parent)
        self.assertIn('changed', self.git('show', 'HEAD:src/user.mjs').stdout)
        self.assertIn('committed checker refusal', self.git('show', 'HEAD:scripts/precommit-inputs.mjs').stdout)
        self.assertIn('rescue', (self.root / 'scripts/precommit-inputs.mjs').read_text())


    def test_gate_handoff_tags_the_exact_tree_and_ignores_nested_fixtures(self):
        import json
        file = self.root / 'handoffs'
        tree = self.git('write-tree').stdout.strip()
        rows = [{'root': str(self.root), 'tree': tree, 'step': 'candidate types'},
                {'root': str(self.root), 'tree': tree, 'step': 'candidate types'},
                {'root': 'nested fixture', 'tree': 'foreign', 'step': 'unrelated'}]
        file.write_text('\n'.join(json.dumps(row) for row in rows))
        message = 'test(commit): keep cap tags\n\nAssisted-by: Codex:gpt-6.1-sol'
        tagged, steps = handoff_message(file, self.root, tree, message)
        self.assertEqual(steps, ['candidate types'])
        self.assertEqual(tagged.count('Gate-deferred: candidate types'), 1)
        self.assertTrue(tagged.endswith('\n\nAssisted-by: Codex:gpt-6.1-sol'))

    def test_gate_handoff_rejects_stale_trees_and_unbounded_names(self):
        import json
        file = self.root / 'handoffs'
        tree = self.git('write-tree').stdout.strip()
        for row in [{'root': str(self.root), 'tree': 'stale', 'step': 'candidate types'},
                    {'root': str(self.root), 'tree': tree, 'step': 'forged\ntrailer'},
                    {'root': str(self.root), 'tree': tree, 'step': 'x' * 56}, {}]:
            file.write_text(json.dumps(row))
            with self.assertRaisesRegex(RuntimeError, 'gate handoff record'):
                handoff_message(file, self.root, tree, 'test(commit): refuse malformed cap')

    def test_real_wrapper_does_not_publish_retired_handoff_trailers(self):
        parent, result = self.real_wrapper(handoff=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotEqual(self.git('rev-parse', 'HEAD').stdout.strip(), parent)
        self.assertNotIn('Gate-deferred:', self.git('log', '-1', '--format=%B').stdout)

    def test_real_wrapper_aligns_own_new_intent_entry_and_keeps_foreign_stage(self):
        _, installed = self.real_wrapper(reject=True)
        self.assertEqual(installed.returncode, 0, installed.stdout + installed.stderr)
        self.put('src/new.mjs', 'export const value=2;')
        self.put('src/peer.mjs', 'export const peer=3;')
        self.git('add', '-N', 'src/new.mjs')
        self.git('add', 'src/peer.mjs')
        result = subprocess.run(['bash', str(ROOT / 'scripts/commit.sh'),
            'test(commit): align added source', '--', 'src/new.mjs'], cwd=self.root,
            env=self.env, text=True, capture_output=True, check=False, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.git('diff', '--cached', '--name-only').stdout.strip(), 'src/peer.mjs')
        self.assertEqual(self.git('show', ':src/peer.mjs').stdout, 'export const peer=3;')



    def test_racy_index_metadata_cannot_hide_a_same_length_candidate_change(self):
        self.git('config', 'core.trustctime', 'false')
        self.git('config', 'core.checkstat', 'minimal')
        name = 'src/racy.mjs'
        self.put(name, 'export const value=1;')
        stamp = 1_700_000_000_000_000_000
        os.utime(self.root / name, ns=(stamp, stamp))
        self.git('add', name)
        self.git('commit', '-qm', 'racy baseline')
        os.utime(self.root / '.git/index', ns=(stamp, stamp))
        self.put(name, 'export const value=2;')
        os.utime(self.root / name, ns=(stamp, stamp))
        result = subprocess.run(['bash', str(ROOT / 'scripts/commit.sh'),
            'test(commit): stage racy source', '--', name], cwd=self.root,
            env=self.env, text=True, capture_output=True, check=False, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.git('show', 'HEAD:' + name).stdout, 'export const value=2;')

if __name__ == '__main__':
    unittest.main()
