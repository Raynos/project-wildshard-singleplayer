import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify actual CLI exit codes and log files in a subprocess.
import { execFileSync } from 'node:child_process';

test('quiet commands retain complete output and preserve failures', () => {
  const result = execFileSync('python3', ['-c', `
import json, os, pathlib, subprocess, sys, tempfile
with tempfile.TemporaryDirectory(prefix='quiet-test-', dir='tmp') as scratch:
 env = dict(os.environ, WS_LOG_DIR=scratch)
 def run(code):
  return subprocess.run([sys.executable, 'scripts/quiet_logs.py', '--label', 'fixture', '--', sys.executable, '-c', code], env=env, capture_output=True, text=True)
 good = run("print('hidden-success')")
 assert good.returncode == 0 and good.stdout.startswith('fixture: PASS (') and good.stderr == ''
 assert 'hidden-success' not in good.stdout
 bad = run("import sys; print('first-secret-line'); [print('line-' + str(i)) for i in range(70)]; sys.exit(23)")
 assert bad.returncode == 23 and bad.stdout == ''
 assert 'full log: ' in bad.stderr and 'line-69' in bad.stderr
 assert 'first-secret-line' not in bad.stderr and len(bad.stderr.splitlines()) == 41
 logs = [p.read_text() for p in pathlib.Path(scratch).glob('*.log')]
 assert len(logs) == 2 and any('hidden-success' in log for log in logs)
 assert any('first-secret-line' in log and 'line-69' in log for log in logs)
 missing = subprocess.run([sys.executable, 'scripts/quiet_logs.py', '--label', 'fixture', '--', scratch + '/absent'], env=env, capture_output=True, text=True)
 assert missing.returncode == 127 and 'full log:' in missing.stderr
 signalled = run('import os, signal; os.kill(os.getpid(), signal.SIGTERM)')
 assert signalled.returncode == 143
 nested = subprocess.run([sys.executable, 'scripts/heavy-lane.py', 'status', '--quiet'], env=dict(env, WS_QUIET_ACTIVE='1'), capture_output=True, text=True)
 assert nested.returncode == 0 and 'active' in json.loads(nested.stdout)
print(json.dumps(True))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toBe(true);
});

test('batch boot failure closes its preview and never starts another shard', () => {
  const result = execFileSync('python3', ['-c', `
import json, pathlib, runpy, subprocess
module = runpy.run_path('scripts/batch_check.py')
boot = module['boot']
calls = []
def run(command, **options):
 calls.append(command)
 if 'browser-lane.sh' in command[1]:
  raise subprocess.CalledProcessError(9, command)
 return subprocess.CompletedProcess(command, 0, stdout='http://127.0.0.1:4400/\\n')
boot.__globals__['run'] = run
try:
 boot(pathlib.Path('/repo'), 'abc123', ['_template', 'pine-hollow'], '/scratch')
 raise AssertionError('must preserve boot failure')
except subprocess.CalledProcessError as error:
 assert error.returncode == 9
assert len(calls) == 3
assert calls[0][-5:] == ['_template,pine-hollow', '--hours', '1', '--name', 'batch-check']
assert calls[2][-2:] == ['stop', '4400']
assert '--max' in calls[1] and '--shard=_template' in calls[1]
print(json.dumps(True))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toBe(true);
});

test('one batch preview keeps a distinct first-frame check for every requested shard', () => {
  const result = execFileSync('python3', ['-c', `
import json, os, pathlib, runpy, subprocess
boot = runpy.run_path('scripts/batch_check.py')['boot']
calls = []
def run(command, **options):
 assert options['env']['WILDSHARD_MIRROR_SLOT'] == 'check4'
 calls.append(command)
 return subprocess.CompletedProcess(command, 0, stdout='http://127.0.0.1:4402/\\n')
boot.__globals__['run'] = run
os.environ['WILDSHARD_MIRROR_SLOT'] = 'check4'
boot(pathlib.Path('/repo'), 'abc123', ['_template', 'pine-hollow'], '/scratch')
assert len(calls) == 4
assert calls[0][-5:] == ['_template,pine-hollow', '--hours', '1', '--name', 'batch-check']
assert '--shard=_template' in calls[1] and '--shard=pine-hollow' in calls[2]
assert '--url=http://127.0.0.1:4402' in calls[1] and '--url=http://127.0.0.1:4402' in calls[2]
assert calls[3][-2:] == ['stop', '4402']
print(json.dumps(True))
`], { encoding: 'utf8' });
  expect(JSON.parse(result)).toBe(true);
});
