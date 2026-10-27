import { expect, test, vi } from 'vitest';
import { runCommittedCheck, type CommittedCheckPorts } from '../scripts/push-committed-check.mjs';

function fixture() {
  const release = vi.fn<() => void>(() => { /* The spy records release; this fixture holds no native lease. */ }), open = vi.fn<CommittedCheckPorts['open']>(() => ({ dir: '/clean/tree', sha: 'exact-tip', release }));
  const run = vi.fn<CommittedCheckPorts['run']>(() => ({ status: 0, stdout: 'exact lint passed', stderr: '' }));
  const ports: CommittedCheckPorts = { open, run, gitDirectory: () => '/shared/.git' };
  return { release, open, run, ports };
}

test('native checks use the exact committed mirror and its own index', () => {
  const f = fixture();
  expect(runCommittedCheck('/dirty', 'base', 'tip', 'fast-lint', ['src/main.ts'], f.ports).status).toBe(0);
  expect(f.open).toHaveBeenCalledWith('tip', { repo: '/dirty' });
  const call = f.run.mock.calls[0];
  if (call === undefined) throw new Error('No native checker executed');
  expect(call[1]).toEqual(['/clean/tree/scripts/committed-fast-checks.mjs', '/clean/tree', 'base', 'exact-tip', 'fast-lint', '["src/main.ts"]']);
  expect(call[2].cwd).toBe('/clean/tree');
  expect(call[2].env.GIT_DIR).toBe('/shared/.git');
  expect(call[2].env.GIT_WORK_TREE).toBe('/clean/tree');
  expect(call[2].env.GIT_INDEX_FILE).toBe('/clean/index');
  expect(f.release).toHaveBeenCalledOnce();
});

test('native refusal stays a refusal and releases only its mirror lease', () => {
  const f = fixture(); f.run.mockReturnValue({ status: 2, stdout: '', stderr: 'original refusal' });
  expect(runCommittedCheck('/dirty', 'base', 'tip', 'fast-lint', [], f.ports)).toEqual({ status: 2, stdout: '', stderr: 'original refusal' });
  expect(f.release).toHaveBeenCalledOnce();
});

test('native startup failure cannot pass and still releases the lease', () => {
  const f = fixture(), refused = new Error('native runner unavailable');
  f.run.mockReturnValue({ status: null, stdout: null, stderr: null, error: refused });
  expect(() => runCommittedCheck('/dirty', 'base', 'tip', 'fast-lint', [], f.ports)).toThrow(refused);
  expect(f.release).toHaveBeenCalledOnce();
});
