import { expect, test, vi } from 'vitest';
import { runCommittedSubset, type PushSubsetMirrorPorts } from '../scripts/push-subset-mirror.mjs';

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
