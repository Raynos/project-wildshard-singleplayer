"""Real Node imports prove checker-only Git pinning without touching live hooks."""
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
snapshot = runpy.run_path(str(ROOT / 'scripts/commit-checker-snapshot.py'))['snapshot_checkers']


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

    def real_wrapper(self, reject=False):
        self.put('scripts/commit-checker-snapshot.py',
                 (ROOT / 'scripts/commit-checker-snapshot.py').read_text())
        self.put('scripts/precommit-inputs.mjs', "throw Error('committed checker refusal');" if reject
                 else "import{value}from'./precommit-related.mjs';if(value!=='committed')throw Error('wrong checker');")
        self.put('.githooks/pre-commit', '#!/bin/sh\nexec node scripts/precommit-inputs.mjs\n')
        hook = self.root / '.githooks/pre-commit'
        hook.chmod(0o755)
        self.git('add', '.')
        self.git('commit', '-qm', 'install checker')
        self.git('config', 'core.hooksPath', '.githooks')
        parent = self.git('rev-parse', 'HEAD').stdout.strip()
        self.put('scripts/commit-checker-snapshot.py', "raise RuntimeError('loose controller poison')\n")
        self.put('scripts/precommit-inputs.mjs', "export const rescue='loose';" if reject
                 else "throw Error('loose checker poison');")
        self.put('scripts/precommit-related.mjs', "throw Error('loose related poison');")
        self.put('src/user.mjs', "export const value='changed';")
        result = subprocess.run(['bash', str(ROOT / 'scripts/commit.sh'),
            'test(commit): pin checker policy', '--', 'src/user.mjs'], cwd=self.root,
            env=self.env, text=True, capture_output=True, check=False, timeout=15)
        return parent, result

    def test_real_wrapper_pins_parent_and_preserves_uncommitted_checker_poison(self):
        parent, result = self.real_wrapper()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotEqual(self.git('rev-parse', 'HEAD').stdout.strip(), parent)
        self.assertIn('changed', self.git('show', 'HEAD:src/user.mjs').stdout)
        self.assertIn('loose checker poison', (self.root / 'scripts/precommit-inputs.mjs').read_text())
        self.assertIn('loose controller poison', (self.root / 'scripts/commit-checker-snapshot.py').read_text())

    def test_real_wrapper_keeps_committed_refusal_against_loose_rescue(self):
        parent, result = self.real_wrapper(reject=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('committed checker refusal', result.stdout + result.stderr)
        self.assertEqual(self.git('rev-parse', 'HEAD').stdout.strip(), parent)


if __name__ == '__main__':
    unittest.main()
