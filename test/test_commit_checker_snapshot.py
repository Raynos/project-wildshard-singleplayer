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


if __name__ == '__main__':
    unittest.main()
