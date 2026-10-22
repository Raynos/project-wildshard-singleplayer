"""Bash 3 preview reservation and post-build port conflict regressions."""
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT / 'scripts/serve-port-lease.py'


class PortLeaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='serve-port-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.processes = []
        self.addCleanup(self.stop_processes)

    def stop_processes(self):
        for process in self.processes:
            if process.poll() is None:
                process.terminate()
            process.wait(timeout=5)

    def lease(self):
        channel = self.root / f'channel-{len(self.processes)}'
        channel.mkdir()
        for name in ('commands', 'replies'):
            os.mkfifo(channel / name)
        process = subprocess.Popen([sys.executable, str(HELPER), 'hold', str(self.root), str(channel), str(os.getpid())])
        self.processes.append(process)
        return channel, process

    def request(self, channel, *command):
        return subprocess.check_output([sys.executable, str(HELPER), 'request', str(channel), *command], text=True).strip()

    def test_lock_survives_registry_reaping_and_moves(self):
        first, process = self.lease()
        second, _ = self.lease()
        self.assertEqual(self.request(first, 'take', '4501'), 'ok')
        row = self.root / '4501'
        row.write_text('temporary registry row')
        row.unlink()
        self.assertEqual(self.request(second, 'take', '4501'), 'busy')
        self.assertEqual(self.request(first, 'take', '4502'), 'ok')
        self.assertEqual(self.request(second, 'take', '4501'), 'ok')
        self.assertEqual(self.request(first, 'close'), 'ok')
        process.wait(timeout=5)
        self.assertEqual(self.request(second, 'take', '4502'), 'ok')
        self.assertEqual(self.request(second, 'close'), 'ok')

    def test_owner_death_releases_lock(self):
        channel = self.root / 'orphan'
        channel.mkdir()
        for name in ('commands', 'replies'):
            os.mkfifo(channel / name)
        owner = subprocess.Popen([sys.executable, '-c',
            'import os,subprocess,sys,time; subprocess.Popen([sys.executable,sys.argv[1],"hold",sys.argv[2],sys.argv[3],str(os.getpid())]); time.sleep(30)',
            str(HELPER), str(self.root), str(channel)])
        self.processes.append(owner)
        self.assertEqual(self.request(channel, 'take', '4503'), 'ok')
        owner.terminate()
        owner.wait(timeout=5)
        deadline = time.monotonic() + 5
        while channel.exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertFalse(channel.exists())
        next_channel, _ = self.lease()
        self.assertEqual(self.request(next_channel, 'take', '4503'), 'ok')
        self.assertEqual(self.request(next_channel, 'close'), 'ok')


class PreviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='serve-preview-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.groups = set()
        self.launches = []
        self.addCleanup(self.stop_previews)
        (self.root / 'scripts').mkdir()
        (self.root / 'public').mkdir()
        (self.root / 'vite').mkdir()
        (self.root / 'vite/preview.ts').touch()
        source = Path(os.environ.get('X15_TEST_SCRIPT', ROOT / 'scripts/serve-build.sh'))
        shutil.copyfile(source, self.root / 'scripts/serve-build.sh')
        shutil.copyfile(HELPER, self.root / 'scripts/serve-port-lease.py')
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        # Only generator/build work is stubbed. Bash, Node's detached spawn,
        # listener ownership, registry publication and HTTP readiness are real.
        self.command('python3', f'''#!{sys.executable}
import os,sys
if sys.argv[1].endswith('/heavy-lane.py'):
    os.execvp(sys.argv[4], sys.argv[4:])
os.execv({sys.executable!r}, [{sys.executable!r}, *sys.argv[1:]])
''')
        node = shutil.which('node')
        if node is None:
            self.fail('Node is required for the detached preview regression')
        self.command('node', f'''#!{sys.executable}
import os,sys
if sys.argv[1] in ('scripts/gen.mjs','scripts/build-shardfiles.mjs'):
    sys.exit(0)
if sys.argv[1].endswith('/build-mirror.mjs'):
    import pathlib
    root=pathlib.Path(os.environ['FIXTURE_ROOT'])
    rows=list((root/'registry').glob('[0-9]*'))
    assert len(rows)==1 and rows[0].read_text().split()[0]==str(os.getppid()), rows
    assert '--slot' not in sys.argv
    (root/'mirror-entered').touch()
    if os.environ.get('FIXTURE_MIRROR_FAIL'): sys.exit(124)
    command=sys.argv[sys.argv.index('--')+1:]
    os.execvp(command[0],command)
os.execv({node!r}, [{node!r}, *sys.argv[1:]])
''')
        self.command('pnpm', f'''#!{sys.executable}
import http.server,os,pathlib,re,sys,time
args=sys.argv[1:]
root=pathlib.Path(os.environ['FIXTURE_ROOT'])
if args[:3] == ['exec','vite','build']:
    config=pathlib.Path(args[args.index('--config')+1]).read_text()
    out=pathlib.Path(re.search(r"outDir: '([^']+)'",config)[1])
    out.mkdir(parents=True)
    (out/'index.html').write_text('finished dist')
    with (root/'build-count').open('a') as f: f.write('build\\n')
    (root/'building').touch()
    while (root/'hold-build').exists(): time.sleep(0.02)
else:
    port=int(args[args.index('--port')+1])
    out=args[args.index('--outDir')+1]
    with (root/'preview-pids').open('a') as f: f.write(str(os.getpid())+'\\n')
    os.chdir(out)
    try: server=http.server.HTTPServer(('127.0.0.1',port),http.server.SimpleHTTPRequestHandler)
    except OSError:
        print('EADDRINUSE: Port already in use',flush=True); sys.exit(1)
    server.serve_forever()
''')
        self.env = {**os.environ, 'PATH': f'{self.bin}:{os.environ["PATH"]}',
            'FIXTURE_ROOT': str(self.root), 'SERVE_REG_DIR': str(self.root / 'registry'),
            'SERVE_BUILD_DIR': str(self.root / 'builds'), 'SERVE_OWNER': 'serve-port-test'}

    def command(self, name, content):
        path = self.bin / name
        path.write_text(content)
        path.chmod(0o755)

    def stop_previews(self):
        for launch in self.launches:
            if launch.poll() is None:
                launch.terminate()
            launch.wait(timeout=5)
        pids = self.root / 'preview-pids'
        if pids.exists():
            self.groups.update(int(pid) for pid in pids.read_text().split())
        for group in self.groups:
            try:
                os.killpg(group, signal.SIGTERM)
            except ProcessLookupError:
                pass

    def port(self):
        # Reserve adjacent candidates away from the machine's game previews.
        for port in range(19000, 29000, 5):
            sockets = []
            try:
                for candidate in range(port, port + 3):
                    connection = socket.socket()
                    sockets.append(connection)
                    connection.bind(('127.0.0.1', candidate))
                return port
            except OSError:
                continue
            finally:
                for connection in sockets:
                    connection.close()
        self.fail('No adjacent test ports')

    def launch(self, port, *extra):
        process = subprocess.Popen(['/bin/bash', str(self.root / 'scripts/serve-build.sh'), '--port', str(port), *extra],
            env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.launches.append(process)
        return process

    def finish(self, process):
        stdout, stderr = process.communicate(timeout=20)
        self.assertEqual(process.returncode, 0, stderr)
        match = re.search(r'http://127.0.0.1:(\d+)/', stdout)
        self.assertIsNotNone(match, stdout)
        port = int(match[1])
        row = (self.root / f'registry/{port}').read_text().split()
        self.groups.add(int(row[0]))
        self.assertNotEqual(int(row[0]), process.pid)
        self.assertEqual((Path(row[2]) / 'dist/index.html').read_text(), 'finished dist')
        return port, row, stderr

    def test_mac_bash_syntax(self):
        subprocess.run(['/bin/bash', '-n', str(self.root / 'scripts/serve-build.sh')], check=True)

    def shorten_admission_clock(self):
        script = self.root / 'scripts/serve-build.sh'
        source = script.read_text()
        self.assertIn('ROOM_WAIT_SECONDS=300', source)
        script.write_text(source.replace('ROOM_WAIT_SECONDS=300', 'ROOM_WAIT_SECONDS=1'))

    def test_full_preview_registry_times_out_before_mirror_admission(self):
        self.shorten_admission_clock()
        registry = self.root / 'registry'
        registry.mkdir()
        row = registry / '4400'
        foreign = f'{os.getpid()} {int(time.time()) + 3600} /fixture foreign-owner young-preview\n'
        row.write_text(foreign)
        self.env.update(SERVE_MAX_LIVE='1', SERVE_RECYCLE_MIN='999999')
        process = self.launch(self.port(), '--head')
        _, stderr = process.communicate(timeout=5)
        self.assertEqual(process.returncode, 124, stderr)
        self.assertIn('timed out after 5 min waiting for preview room', stderr)
        self.assertIn('slot=preview:4400 pid=' + str(os.getpid()), stderr)
        self.assertFalse((self.root / 'mirror-entered').exists())
        self.assertFalse((self.root / 'build-count').exists())
        self.assertEqual(row.read_text(), foreign)
        self.assertEqual(list(registry.glob('.port-lease-*')), [])

    def test_registry_lock_timeout_preserves_foreign_lock_before_mirror(self):
        self.shorten_admission_clock()
        lock = self.root / 'registry/.lock'
        lock.mkdir(parents=True)
        owner = f'pid={os.getpid()} command=fixture start=now slot=preview-registry\n'
        (lock / 'owner').write_text(owner)
        process = self.launch(self.port(), '--head')
        _, stderr = process.communicate(timeout=5)
        self.assertEqual(process.returncode, 124, stderr)
        self.assertIn('waiting for preview registry lock', stderr)
        self.assertIn(owner.strip(), stderr)
        self.assertEqual((lock / 'owner').read_text(), owner)
        self.assertFalse((self.root / 'mirror-entered').exists())

    def test_head_reserves_once_before_mirror_and_releases_parent_lease(self):
        _, row, _ = self.finish(self.launch(self.port(), '--head'))
        self.assertTrue((self.root / 'mirror-entered').exists())
        self.assertEqual(len(list((self.root / 'registry').glob('[0-9]*'))), 1)
        self.assertEqual(list((self.root / 'registry').glob('.port-lease-*')), [])
        self.assertNotIn('(building)', row[-1])

    def test_mirror_timeout_fails_once_and_releases_preview_reservation(self):
        self.env['FIXTURE_MIRROR_FAIL'] = '1'
        process = self.launch(self.port(), '--head')
        _, stderr = process.communicate(timeout=5)
        self.assertEqual(process.returncode, 124, stderr)
        self.assertTrue((self.root / 'mirror-entered').exists())
        self.assertEqual(list((self.root / 'registry').glob('[0-9]*')), [])
        self.assertEqual(list((self.root / 'registry').glob('.port-lease-*')), [])

    def test_concurrent_starts_use_distinct_ports(self):
        port = self.port()
        first = self.launch(port)
        second = self.launch(port)
        first_port, _, _ = self.finish(first)
        second_port, _, _ = self.finish(second)
        self.assertNotEqual(first_port, second_port)
        self.assertEqual(len((self.root / 'build-count').read_text().splitlines()), 2)

    def test_initial_busy_port_keeps_foreign_listener(self):
        port = self.port()
        with socket.socket() as occupier:
            occupier.bind(('127.0.0.1', port))
            occupier.listen()
            actual, _, _ = self.finish(self.launch(port))
            self.assertEqual(actual, port + 1)
            self.assertEqual(occupier.getsockname()[1], port)
        self.assertEqual((self.root / 'build-count').read_text(), 'build\n')

    def test_build_failure_releases_reservation(self):
        port = self.port()
        self.command('pnpm', '#!/bin/sh\nexit 1\n')
        process = self.launch(port)
        _, stderr = process.communicate(timeout=10)
        self.assertNotEqual(process.returncode, 0, stderr)
        self.assertEqual(list((self.root / 'registry').glob('[0-9]*')), [])
        self.assertEqual(list((self.root / 'registry').glob('.port-lease-*')), [])

    def test_post_build_conflict_reuses_finished_dist(self):
        port = self.port()
        hold = self.root / 'hold-build'
        hold.touch()
        process = self.launch(port)
        deadline = time.monotonic() + 10
        while not (self.root / 'building').exists() and time.monotonic() < deadline:
            time.sleep(0.02)
        self.assertTrue((self.root / 'building').exists())
        placeholder = (self.root / f'registry/{port}').read_text().split()
        with socket.socket() as occupier:
            occupier.bind(('127.0.0.1', port))
            occupier.listen()
            hold.unlink()
            actual, row, stderr = self.finish(process)
            self.assertEqual(actual, port + 1)
            self.assertEqual(row[2], placeholder[2])
            self.assertIn('reusing finished dist', stderr)
            self.assertFalse((self.root / f'registry/{port}').exists())
            self.assertEqual(occupier.getsockname()[1], port)
        self.assertEqual((self.root / 'build-count').read_text(), 'build\n')


if __name__ == '__main__':
    unittest.main()
