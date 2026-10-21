import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real flock leases in an isolated owned fixture.
import { execFileSync, spawnSync } from 'node:child_process';

test('two checks waiting on a mirror leave build capacity for its preview', () => {
  const result = spawnSync('python3', ['scripts/test_lease_order.py'], { encoding: 'utf8', timeout: 25000 });
  expect(result.status, result.stderr).toBe(0);
}, 30000);

test('two builds share capacity with a priority gate, inherit leases and report one day', () => {
  const result = execFileSync('python3', ['-c', `
import json, os, pathlib, subprocess, sys, tempfile, time
repo = pathlib.Path.cwd()
wrapper = str(repo / 'scripts/heavy-lane.py')
guard = "import {assertHeavyLease as current} from './scripts/heavy-lane-lease.mjs';import {assertHeavyLease as legacy} from './test/fixtures/legacy-heavy-lane-lease.mjs';current('build');legacy('build')"
with tempfile.TemporaryDirectory(prefix='capacity-test-', dir=repo / 'tmp') as temporary:
 root = pathlib.Path(temporary)
 env = {k: v for k, v in os.environ.items() if k not in ('WS_HEAVY_TOKEN', 'WS_HEAVY_GATE', 'WS_HEAVY_SCHEDULER_ROOT')}
 env['WS_HEAVY_ROOT'] = str(root)
 worker = root / 'worker.py'
 worker.write_text("import pathlib, subprocess, sys, time\\nroot=pathlib.Path(sys.argv[1]); name=sys.argv[2]\\nsubprocess.run(['node','--input-type=module','-e',sys.argv[3]],check=True)\\n(root/(name+'.started')).write_text('yes')\\ndeadline=time.monotonic()+8\\nwhile not (root/(name+'.release')).exists():\\n if time.monotonic()>deadline: raise TimeoutError(name)\\n time.sleep(.01)\\n")
 processes = []
 def launch(kind, name):
  process = subprocess.Popen([sys.executable, wrapper, kind, '--', sys.executable, str(worker), str(root), name, guard], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
  processes.append(process)
  return process
 def wait_for(predicate):
  deadline = time.monotonic() + 6
  while not predicate():
   if time.monotonic() > deadline:
    raise TimeoutError('fixture synchronization')
   time.sleep(.01)
 def queue_size(n):
  try: return len(json.loads((root/'queue.json').read_text())['queue']) >= n
  except (OSError, ValueError): return False
 try:
  a = launch('build', 'a'); wait_for(lambda: (root/'a.started').exists())
  b = launch('build', 'b'); wait_for(lambda: (root/'b.started').exists())
  copied = dict(env, WS_HEAVY_TOKEN=json.loads((root/'build-2.active.json').read_text())['token'])
  assert subprocess.run(['node','--input-type=module','-e',guard], env=copied, capture_output=True).returncode != 0
  c = launch('build', 'c'); wait_for(lambda: queue_size(1))
  gate = launch('gate', 'gate'); wait_for(lambda: queue_size(2))
  assert not (root/'c.started').exists() and not (root/'gate.started').exists()
  (root/'a.release').touch(); wait_for(lambda: (root/'gate.started').exists())
  assert not (root/'c.started').exists()
  state = json.loads(subprocess.check_output([sys.executable,wrapper,'status'], env=env))
  assert len([entry for entry in state['active'] if entry['resource'] in ('build','build-2')]) == 2
  (root/'gate.release').touch(); wait_for(lambda: (root/'c.started').exists())
  (root/'b.release').touch(); (root/'c.release').touch()
  for process in processes:
   out, err = process.communicate(timeout=6)
   assert process.returncode == 0, (out, err)
  records = [json.loads(line) for line in (root/'build-day.log').read_text().splitlines()]
  assert records[0]['schema'] == 'build-day/1' and len(records) == 4
  assert all(row['buildSeconds'] > 0 and row['queueSeconds'] >= 0 and len(row['loadStart']) == 3 for row in records[1:])
  assert max(row['queueSeconds'] for row in records[1:]) > 0
  nested = subprocess.run([sys.executable,wrapper,'build','--',sys.executable,wrapper,'build','--','node','--input-type=module','-e',guard],env=env,capture_output=True,text=True)
  assert nested.returncode == 0, nested.stderr
  records = [json.loads(line) for line in (root/'build-day.log').read_text().splitlines()]
  assert any(row.get('inherited') for row in records[1:])
  records[0]['expiresAt'] = 0
  (root/'build-day.log').write_text(''.join(json.dumps(row)+'\\n' for row in records))
  before = (root/'build-day.log').read_text()
  final = subprocess.run([sys.executable,wrapper,'build','--','node','--input-type=module','-e',guard],env=env,capture_output=True,text=True)
  assert final.returncode == 0, final.stderr
  assert (root/'build-day.log').read_text() == before
  (root/'build-day.log').write_text('[]')
  report_only = subprocess.run([sys.executable,wrapper,'build','--','node','--input-type=module','-e',guard],env=env,capture_output=True,text=True)
  assert report_only.returncode == 0 and 'observation unavailable' in report_only.stderr
  assert not json.loads(subprocess.check_output([sys.executable,wrapper,'status'],env=env))['active']
 finally:
  for process in processes:
   if process.poll() is None: process.terminate()
  for process in processes: process.wait(timeout=6)
print(json.dumps(True))
`], { encoding: 'utf8', timeout: 20000 });
  expect(JSON.parse(result)).toBe(true);
}, 25000);

test('a running legacy gate reserves one build slot until its lock releases', () => {
  const result = execFileSync('python3', ['-c', `
import fcntl, json, os, pathlib, runpy, tempfile
module = runpy.run_path('scripts/heavy-lane.py')
with tempfile.TemporaryDirectory(prefix='legacy-capacity-', dir='tmp') as temporary:
 root = pathlib.Path(temporary)
 gate = (root/'push-gate.lock').open('a+')
 build = (root/'build.lock').open('a+')
 fcntl.flock(gate,fcntl.LOCK_EX); fcntl.flock(build,fcntl.LOCK_EX)
 (root/'push-gate.active.json').write_text(json.dumps({'resources':['push-gate']}))
 entry = {'token':'one','priority':1,'ticket':0,'resources':['build'],'pid':os.getpid()}
 (root/'queue.json').write_text(json.dumps({'next':1,'queue':[entry]}))
 assert module['acquire'](root,entry) is None
 build.close()
 first = module['acquire'](root,entry)
 assert first and entry['leases'] == ['build']
 second_entry = {**entry,'token':'two','ticket':1}
 (root/'queue.json').write_text(json.dumps({'next':2,'queue':[second_entry]}))
 try:
  assert module['acquire'](root,second_entry) is None
  gate.close()
  second = module['acquire'](root,second_entry)
  assert second and second_entry['leases'] == ['build-2']
  for lock in second: lock.close()
 finally:
  gate.close()
  for lock in first: lock.close()
print(json.dumps(True))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toBe(true);
});


test('build and gate children retain the normal caller priority', () => {
  const result = execFileSync('python3', ['-c', `
import json, os, pathlib, subprocess, sys, tempfile
repo = pathlib.Path.cwd()
with tempfile.TemporaryDirectory(prefix='priority-test-', dir=repo / 'tmp') as temporary:
 env = {k:v for k,v in os.environ.items() if not k.startswith('WS_HEAVY_')}
 env['WS_HEAVY_ROOT'] = temporary
 parent = os.getpriority(os.PRIO_PROCESS, 0)
 for kind in ('build','gate'):
  child = subprocess.run([sys.executable,str(repo/'scripts/heavy-lane.py'),kind,'--',sys.executable,'-c','import os; print(os.getpriority(os.PRIO_PROCESS, 0))'],env=env,capture_output=True,text=True,check=True)
  assert int(child.stdout) == parent, (kind, parent, child.stdout, child.stderr)
print(json.dumps(True))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toBe(true);
});
