"""Real mirror locks plus real two-slot heavy scheduling; no application builds."""
import json
import os
from pathlib import Path
import runpy
import signal
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parent.parent
HEAVY = str(ROOT / 'scripts/heavy-lane.py')


class LeaseOrderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='lease-order-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.processes = []
        self.addCleanup(self.stop)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        subprocess.run(['git', 'init', '-q', str(self.repo)], check=True)
        (self.repo / 'input').write_text('tiny committed fixture')
        subprocess.run(['git', '-C', str(self.repo), 'add', 'input'], check=True)
        subprocess.run(['git', '-C', str(self.repo), '-c', 'user.name=fixture',
            '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'], check=True)
        self.sha = subprocess.check_output(['git', '-C', str(self.repo), 'rev-parse', 'HEAD'], text=True).strip()
        self.env = {key: value for key, value in os.environ.items() if not key.startswith('WS_HEAVY_')}
        self.env.update(WS_HEAVY_ROOT=str(self.root / 'lanes'),
            WILDSHARD_BUILD_MIRROR=str(self.root / 'mirrors'), FIXTURE_ROOT=str(self.root))
        self.worker = self.root / 'worker.py'
        self.worker.write_text("import json,os,pathlib,sys\nroot=pathlib.Path(os.environ['FIXTURE_ROOT'])\nassert os.environ['WS_HEAVY_TOKEN']\nmarker=json.loads((pathlib.Path(os.environ['WS_HEAVY_ROOT'])/'build.active.json').read_text())\nassert marker['token']==os.environ['WS_HEAVY_TOKEN']\n(root/(sys.argv[1]+'.built')).touch()\n")
        self.mirror = self.root / 'build-mirror.mjs'
        self.mirror.write_text("import {openMirror} from " + json.dumps((ROOT / 'scripts/build-mirror.mjs').as_uri()) + ";\n"
            "import {existsSync,writeFileSync} from 'node:fs';import{join}from'node:path';import{spawnSync}from'node:child_process';\n"
            "const args=process.argv.slice(2),root=process.env.FIXTURE_ROOT;\n"
            "const mirror=openMirror(args[1],{repo:join(root,'repo'),linkModules:false});\n"
            "try{if(process.env.ROLE==='preview'){writeFileSync(join(root,'preview.locked'),'');const until=Date.now()+12000;while(!existsSync(join(root,'preview.go'))){if(Date.now()>until)throw Error('preview timed out');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}}\n"
            "const split=args.indexOf('--'),cmd=args.slice(split+1);const child=spawnSync(cmd[0],cmd.slice(1),{cwd:mirror.dir,env:process.env,stdio:'inherit'});process.exitCode=child.status??1;}finally{mirror.release();}\n")

    def stop(self):
        for process in self.processes:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
        for process in self.processes:
            process.communicate(timeout=5)

    def start(self, command, **extra):
        process = subprocess.Popen(command, env={**self.env, **extra}, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, start_new_session=True)
        self.processes.append(process)
        return process

    def wait_for(self, predicate):
        until = time.monotonic() + 10
        while not predicate():
            if time.monotonic() > until:
                self.fail('fixture synchronization timed out')
            time.sleep(0.01)

    def mirror_command(self, child):
        return ['node', str(self.mirror), 'run', self.sha, '--slot', 'check', '--', *child]

    def test_two_checks_wait_on_mirror_without_starving_its_preview(self):
        preview = self.start(self.mirror_command([sys.executable, HEAVY, 'build', '--',
            sys.executable, str(self.worker), 'preview']), ROLE='preview')
        self.wait_for(lambda: (self.root / 'preview.locked').exists())
        checks = [self.start([sys.executable, HEAVY, 'build', '--',
            *self.mirror_command([sys.executable, str(self.worker), name])]) for name in ('check-a', 'check-b')]
        queue = self.root / 'mirrors/check.queue'
        self.wait_for(lambda: queue.exists() and len(list(queue.iterdir())) == 2)
        state = json.loads(subprocess.check_output([sys.executable, HEAVY, 'status'], env=self.env))
        self.assertEqual(state['active'], [])
        (self.root / 'preview.go').touch()
        for process in [preview, *checks]:
            out, err = process.communicate(timeout=15)
            self.assertEqual(process.returncode, 0, out + err)
        self.assertTrue(all((self.root / (name + '.built')).exists() for name in ('preview', 'check-a', 'check-b')))
        self.assertEqual(list(queue.iterdir()), [])
        self.assertFalse((self.root / 'mirrors/check.lock').exists())

    def test_unknown_shell_wrapper_refuses_before_waiting_with_a_lease(self):
        preview = self.start(self.mirror_command([sys.executable, HEAVY, 'build', '--',
            sys.executable, str(self.worker), 'preview']), ROLE='preview')
        self.wait_for(lambda: (self.root / 'preview.locked').exists())
        blocked = self.start([sys.executable, HEAVY, 'build', '--', '/bin/bash', '-c',
            'exec "$@"', 'fixture', *self.mirror_command([sys.executable, str(self.worker), 'bad'])])
        out, err = blocked.communicate(timeout=5)
        self.assertNotEqual(blocked.returncode, 0, out + err)
        self.assertIn('acquire the mirror slot before the heavy lease', err)
        self.assertFalse((self.root / 'bad.built').exists())
        (self.root / 'preview.go').touch()
        out, err = preview.communicate(timeout=10)
        self.assertEqual(preview.returncode, 0, out + err)

    def test_self_managed_checks_delegate_without_an_outer_lease(self):
        order = runpy.run_path(HEAVY)['mirror_first']
        wrapper = [sys.executable, HEAVY, 'build', '--']
        for script in ('batch-check.sh', 'serve-build.sh', 'batch_check.py'):
            command = ['python3' if script.endswith('.py') else 'bash', 'scripts/' + script, '--rev', 'HEAD']
            self.assertEqual(order(command, wrapper), command)
            self.assertEqual(order(command[1:], wrapper), command[1:])
        explicit = ['node', 'scripts/build-mirror.mjs', 'run', 'abc', '--slot', 'check4', '--', 'producer', '--literal']
        self.assertEqual(order(explicit, wrapper), ['node', 'scripts/build-mirror.mjs', 'run', 'abc', '--slot', 'check4', '--', *wrapper, 'producer', '--literal'])
        self.assertIsNone(order(['python3', 'scripts/batch_check.py', '--inside'], wrapper))


if __name__ == '__main__':
    unittest.main()
