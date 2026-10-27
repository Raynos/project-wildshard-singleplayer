import { expect, test, vi } from 'vitest';
import { runCommittedSubset, writeCommittedSubset, type PushSubsetMirrorPorts } from '../scripts/push-subset-mirror.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Reproduce the carrier's actual merged stdout/stderr pipe with owned bounded bytes.
import { execFileSync } from 'node:child_process';

function fixture() {
  const release = vi.fn<() => void>(() => { /* Records the only owned lease. */ });
  const open = vi.fn<PushSubsetMirrorPorts['open']>(() => ({ dir: '/mirror/tree', sha: 'exact', release }));
  const run = vi.fn<PushSubsetMirrorPorts['run']>(() => ({ status: 0, stdout: 'original result', stderr: '' }));
  const ports: PushSubsetMirrorPorts = { open, run, gitDirectory: () => '/repo/.git' };
  return { open, run, release, ports };
}

test('the complete CI subset shares the exact committed slot, own index and original deadline', () => {
  const f = fixture(), deadline = Date.now() + 5000;
  expect(runCommittedSubset('/dirty/repo', 'tip', ['src/changed.ts'], deadline, f.ports).status).toBe(0);
  expect(f.open).toHaveBeenCalledWith('tip', { repo: '/dirty/repo', deadline });
  const call = f.run.mock.calls[0];
  expect(call?.[1]).toEqual(['/mirror/tree/scripts/push-ci-subset.mjs', '["src/changed.ts"]']);
  expect(call?.[2]).toMatchObject({ cwd: '/mirror/tree', env: { GIT_DIR: '/repo/.git',
    GIT_WORK_TREE: '/mirror/tree', GIT_INDEX_FILE: '/mirror/index', WS_GIT_CHECK_DEADLINE: String(deadline) } });
  expect(f.release).toHaveBeenCalledOnce();
});

test('refusal, unfinished and startup errors all retain their original outcome and release ownership', () => {
  for (const status of [1, 2, 124]) {
    const f = fixture(); f.run.mockReturnValue({ status, stdout: 'original partial', stderr: 'diagnostic' });
    expect(runCommittedSubset('/repo', 'tip', [], Date.now() + 5000, f.ports)).toEqual({ status, stdout: 'original partial', stderr: 'diagnostic' });
    expect(f.release).toHaveBeenCalledOnce();
  }
  const f = fixture(), error = new Error('runner unavailable');
  f.run.mockReturnValue({ status: null, stdout: null, stderr: null, error });
  expect(() => runCommittedSubset('/repo', 'tip', [], Date.now() + 5000, f.ports)).toThrow(error);
  expect(f.release).toHaveBeenCalledOnce();
});

test('invalid deadlines refuse before taking a slot or starting a child', () => {
  const f = fixture();
  for (const deadline of [Number.NaN, Infinity, Date.now() - 1])
    expect(() => runCommittedSubset('/repo', 'tip', [], deadline, f.ports)).toThrow('deadline');
  expect(f.open).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
});

test('the machine record finishes before large diagnostics can enter the merged pipe', async () => {
  let finish: (() => void) | undefined;
  const control = `PUSH_SUBSET_RESULT ${JSON.stringify({ output: 'quoted '.repeat(20_000) })}\n`;
  const diagnostics = 'diagnostic line\n'.repeat(100_000);
  const chunks: string[] = [];
  const stderr = vi.fn<(text: string) => Promise<void>>(text => { chunks.push(text); return Promise.resolve(); });
  const writing = writeCommittedSubset({ stdout: control, stderr: diagnostics }, {
    stdout: text => new Promise(_resolve => { chunks.push(text); finish = _resolve; }), stderr,
  });
  expect(stderr).not.toHaveBeenCalled();
  if (finish === undefined) throw new Error('No pending stdout flush');
  finish(); await writing;
  expect(chunks).toEqual([control, diagnostics]);
  expect(JSON.parse(chunks[0]?.slice('PUSH_SUBSET_RESULT '.length) ?? '')).toEqual({ output: 'quoted '.repeat(20_000) });
});

test('a failed control write cannot print diagnostics as though the record succeeded', async () => {
  const stderr = vi.fn<(text: string) => Promise<void>>();
  await expect(writeCommittedSubset({ stdout: 'record', stderr: 'diagnostic' }, {
    stdout: () => Promise.reject(new Error('closed control pipe')), stderr,
  })).rejects.toThrow('closed control pipe');
  expect(stderr).not.toHaveBeenCalled();
});

test('a real merged native pipe retains complete JSON beside megabyte diagnostics', () => {
  const payload = { output: 'quoted '.repeat(20_000), steps: [{ name: 'types', code: 124, timedOut: true }] };
  const control = `PUSH_SUBSET_RESULT ${JSON.stringify(payload)}\n`;
  const diagnostics = 'diagnostic line\n'.repeat(100_000);
  const program = `import {writeCommittedSubset} from ${JSON.stringify(new URL('../scripts/push-subset-mirror.mjs', import.meta.url).href)};
    const payload={output:'quoted '.repeat(20000),steps:[{name:'types',code:124,timedOut:true}]};
    await writeCommittedSubset({stdout:'PUSH_SUBSET_RESULT '+JSON.stringify(payload)+'\\n',stderr:'diagnostic line\\n'.repeat(100000)});`;
  const output = execFileSync('bash', ['-c', 'exec "$1" --input-type=module --eval "$2" 2>&1', 'fixture', process.execPath, program],
    { encoding: 'utf8', timeout: 10_000, maxBuffer: 4 * 1024 * 1024 });
  expect(output).toBe(control + diagnostics);
  expect(JSON.parse(output.split('\n')[0]?.slice('PUSH_SUBSET_RESULT '.length) ?? '')).toEqual(payload);
});
