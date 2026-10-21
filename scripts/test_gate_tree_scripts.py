"""Real immutable gate dispatch, plus inner selection with only heavy work stubbed."""
import contextlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1]
GATE = SOURCE / 'scripts/local-gate.py'
REAL_RUN = subprocess.run


class GateTreeScripts(unittest.TestCase):
    def setUp(self):
        (SOURCE / 'tmp').mkdir(exist_ok=True)
        self.temporary = TemporaryDirectory(dir=SOURCE / 'tmp', prefix='gate-scripts-')
        self.addCleanup(self.temporary.cleanup)
        self.owned = Path(self.temporary.name).resolve()
        self.repo = self.owned / 'repo'
        (self.repo / 'scripts').mkdir(parents=True)
        (self.repo / 'node_modules').mkdir()
        self.env = {key: value for key, value in os.environ.items()
                    if not key.startswith(('GIT_', 'WS_HEAVY_', 'WS_GATE_'))}
        self.env['WILDSHARD_BUILD_MIRROR'] = str(self.owned / 'mirror')
        self.put('.gitignore', 'node_modules/\ntmp/\n')
        self.git('init', '-q')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('config', 'user.name', 'fixture')
        self.git('config', 'core.hooksPath', '/dev/null')

    def put(self, name, contents):
        target = self.repo / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(contents)

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.repo,
                                       env=self.env, text=True).strip()

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')
        return self.git('rev-parse', 'HEAD')

    @contextlib.contextmanager
    def inner(self, tree, sha):
        previous = Path.cwd()
        try:
            os.chdir(tree)
            with patch.dict(os.environ, dict(self.env, WS_GATE_REPO=str(self.repo)), clear=True), \
                    patch.object(sys, 'argv', ['local-gate.py', sha]):
                yield runpy.run_path(str(GATE))['main']
        finally:
            os.chdir(previous)

    def test_outer_dispatch_executes_older_carrier_runner(self):
        # Use the real mirror implementation; only its tiny fixture CLI is local.
        mirror_url = (SOURCE / 'scripts/build-mirror.mjs').as_uri()
        self.put('scripts/build-mirror.mjs', f"""
import {{openMirror}} from {json.dumps(mirror_url)};
import {{spawnSync}} from 'node:child_process';
const split=process.argv.indexOf('--');
const mirror=openMirror(process.argv[3],{{repo:process.cwd(),slot:'gate'}});
try{{const result=spawnSync(process.argv[split+1],process.argv.slice(split+2),{{cwd:mirror.dir,env:process.env,stdio:'inherit'}});process.exitCode=result.status??1;}}
finally{{mirror.release();}}
""")
        self.put('scripts/local-gate.py', """
import os
from pathlib import Path
from gate_policy import identity
Path(os.environ['GATE_FIXTURE_RECEIPT']).write_text(identity + ':' + str(Path.cwd()))
""")
        self.put('scripts/gate_policy.py', "identity = 'older carrier'\n")
        sha = self.commit()
        self.git('update-ref', 'refs/remotes/origin/main', sha)
        self.put('scripts/local-gate.py', "raise RuntimeError('working runner executed')\n")
        self.put('scripts/gate_policy.py', "raise RuntimeError('working policy executed')\n")
        receipt = self.owned / 'receipt'
        result = REAL_RUN([sys.executable, str(GATE), sha], cwd=self.repo,
                          env=dict(self.env, GATE_FIXTURE_RECEIPT=str(receipt)),
                          capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(receipt.read_text(), 'older carrier:' + str(self.owned / 'mirror/gate/tree'))

    def selection_case(self, *, missing_registry=False, refusing_selector=False):
        scenario = str(Path('test') / 'scripts' / 'carrier.test.ts')
        self.put('scripts/gate-related-tests.mjs', "throw Error('working selector executed');\n")
        self.put('scripts/gate-test-products.json', json.dumps({scenario: ['wrong-checkout-product']}))
        base = self.commit()
        self.git('update-ref', 'refs/remotes/origin/main', base)
        self.put(Path('test') / 'unit.test.ts', '// changed\n')
        sha = self.commit()
        tree = self.owned / 'tree'
        (tree / 'scripts').mkdir(parents=True)
        (tree / '.oxlintrc.json').write_text('{"ignorePatterns": []}')
        (tree / 'package.json').write_text('{"scripts":{"build":"fixture"}}')
        selector = "throw Error('carrier selection refused');" if refusing_selector else 'console.log(' + json.dumps(json.dumps([scenario])) + ');'
        (tree / 'scripts/gate-related-tests.mjs').write_text(selector)
        if not missing_registry:
            (tree / 'scripts/gate-test-products.json').write_text(json.dumps({scenario: ['carrier-product']}))
        commands = []

        def run(command, **options):
            commands.append(command)
            if command[0] == 'git' or (command[0] == 'node' and command[1].endswith('gate-related-tests.mjs')):
                return REAL_RUN(command, **options)
            return subprocess.CompletedProcess(command, 0)

        with self.inner(tree, sha) as main, patch('subprocess.run', side_effect=run):
            if missing_registry:
                with self.assertRaises(FileNotFoundError):
                    main()
            else:
                self.assertEqual(main(), 1 if refusing_selector else 0)
        stamp = self.repo / '.git/build-gate-g518' / (sha + '-' + base)
        self.assertEqual(stamp.exists(), not (missing_registry or refusing_selector))
        if not missing_registry and not refusing_selector:
            self.assertIn(['node', 'scripts/build-shardfiles.mjs', '--reuse', '--shard=carrier-product'], commands)
            self.assertIn(['pnpm', 'exec', 'vitest', 'run', scenario], commands)

    def test_carrier_selector_and_product_registry_stay_together(self):
        self.selection_case()

    def test_missing_carrier_registry_never_reads_checkout_registry(self):
        self.selection_case(missing_registry=True)

    def test_carrier_selector_failure_cannot_stamp_a_pass(self):
        self.selection_case(refusing_selector=True)


if __name__ == '__main__':
    unittest.main()
