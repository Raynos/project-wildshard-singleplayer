import { expect, it, vi } from 'vitest';
import { GridCrossing, installGridCrossing, type PreparedGridCrossing } from '../src/game/grid/crossing';
import { GridAssembly } from '../src/game/grid/assembly';
import { Scope } from '../src/engine/app/scope';
import { crossingSaveStatus } from '../src/game/grid/borderShimmer';

function deferred() {
  let finish: ((value: PreparedGridCrossing) => void) | undefined;
  let fail: ((value: Error) => void) | undefined;
  const promise = new Promise<PreparedGridCrossing>((resolve, reject) => { finish = resolve; fail = reject; });
  return { promise, finish: (value: PreparedGridCrossing) => finish?.(value), fail: (value: Error) => fail?.(value) };
}
function fixture() {
  const loading = new Map<string | null, ReturnType<typeof deferred>>();
  let frame: string | null = 'driftwood-isle', admitted = false, durable = true;
  const checkpoint = vi.fn<(instance: string) => boolean>(() => durable), stow = vi.fn<(instance: string) => void>();
  const interior = vi.fn<(instance: string) => void>(), changed = vi.fn<(from: string | null, to: string | null) => void>();
  const crossing = new GridCrossing(frame, { prepare: (_from, to) => { const pending = deferred(); loading.set(to, pending); return pending.promise; },
    ready: () => admitted, checkpoint, stow, interior, changed });
  const prepare = (target: string | null) => {
    const transaction = { commit: vi.fn(() => { frame = target; }), cancel: vi.fn<() => void>() };
    loading.get(target)?.finish(transaction); return transaction;
  };
  return { crossing, loading, prepare, checkpoint, stow, interior, changed, frame: () => frame,
    ready: () => { admitted = true; }, quota: (blocked: boolean) => { durable = !blocked; } };
}
it('stows at the interior edge before a strip reframe and never switches on asynchronous completion', async () => {
  const f = fixture(); f.crossing.step(true); expect(f.interior).toHaveBeenCalledWith('driftwood-isle');
  f.crossing.step(false); expect(f.stow).toHaveBeenCalledWith('driftwood-isle');
  f.crossing.request(null); const staged = f.prepare(null); await Promise.resolve();
  expect(f.crossing.state().phase).toBe('ready'); expect(staged.commit).not.toHaveBeenCalled();
  expect(f.crossing.step(false)).toBe(false); expect(f.frame()).toBe('driftwood-isle');
  f.ready(); expect(f.crossing.step(false)).toBe(true); expect(f.frame()).toBeNull();
  expect(f.changed).toHaveBeenCalledExactlyOnceWith('driftwood-isle', null);
  expect(f.crossing.step(false)).toBe(false); expect(staged.commit).toHaveBeenCalledOnce();
});
it('holds the source through a quota failure, then retries once without reloading the destination', async () => {
  const f = fixture(); f.crossing.request('pine-hollow'); const staged = f.prepare('pine-hollow'); await Promise.resolve(); f.ready(); f.quota(true);
  for (let tick = 0; tick < 10; tick++) expect(f.crossing.step(false)).toBe(false);
  expect(f.frame()).toBe('driftwood-isle'); expect(staged.commit).not.toHaveBeenCalled(); expect(staged.cancel).not.toHaveBeenCalled();
  expect(f.checkpoint).toHaveBeenCalledOnce();
  f.quota(false); expect(f.crossing.step(false)).toBe(false); f.crossing.retrySave();
  expect(f.crossing.step(false)).toBe(true); expect(f.frame()).toBe('pine-hollow');
  f.crossing.step(true); expect(f.interior).toHaveBeenLastCalledWith('pine-hollow');
});
it('cancels stale admission when direction reverses, including a late result after disposal', async () => {
  const f = fixture(); f.crossing.request('pine-hollow'); f.crossing.request('driftwood-isle');
  const stale = f.prepare('pine-hollow'); await Promise.resolve(); expect(stale.cancel).toHaveBeenCalledOnce(); expect(stale.commit).not.toHaveBeenCalled();
  expect(f.crossing.state().phase).toBe('settled');
  f.crossing.request('nalati-grasslands'); f.crossing.dispose(); const late = f.prepare('nalati-grasslands'); await Promise.resolve();
  expect(late.cancel).toHaveBeenCalledOnce(); expect(late.commit).not.toHaveBeenCalled(); expect(f.crossing.step(false)).toBe(false);
});
it('retains the source on failed admission or rollback-safe commit and can explicitly retry', async () => {
  const f = fixture(); f.crossing.request('pine-hollow'); f.loading.get('pine-hollow')?.fail(new Error('critical missing'));
  await Promise.resolve(); await Promise.resolve(); expect(f.crossing.state()).toMatchObject({ phase: 'blocked', current: 'driftwood-isle', issue: 'critical missing' });
  f.crossing.request('pine-hollow'); const bad = f.prepare('pine-hollow'); bad.commit.mockImplementation(() => { throw new Error('motor refused'); });
  await Promise.resolve(); f.ready(); expect(f.crossing.step(false)).toBe(false); expect(f.frame()).toBe('driftwood-isle'); expect(bad.cancel).toHaveBeenCalledOnce();
  f.crossing.request('pine-hollow'); const good = f.prepare('pine-hollow'); await Promise.resolve();
  expect(f.crossing.step(false)).toBe(true); expect(good.commit).toHaveBeenCalledOnce(); expect(f.changed).toHaveBeenCalledOnce();
});
it('does not retry a failed admission on every fixed tick; an explicit retry remains available', async () => {
  const scope = new Scope('crossing.failed.admission');
  const prepare = vi.fn<() => Promise<PreparedGridCrossing>>(() => Promise.reject(new Error('Unavailable critical bundle')));
  const session = installGridCrossing({ current: () => null, target: () => 'driftwood-isle', prepare, ready: () => false, checkpoint: () => true },
    new GridAssembly({ developer: false, devserver: false }), () => undefined, scope);
  try {
    for (let tick = 0; tick < 100; tick++) { session.step({ x: 256, y: 0, z: 0 }); await Promise.resolve(); }
    expect(prepare).toHaveBeenCalledOnce(); expect(session.crossing.state().phase).toBe('blocked');
    session.crossing.request('driftwood-isle'); await Promise.resolve();
    expect(prepare).toHaveBeenCalledTimes(2);
  } finally { scope.dispose(); }
});

it('distinguishes preparation, five seconds of pending durability and failure, saving the current boundary only on retry', async () => {
  let waiting = true, quota = false, tick = 0, captured = -1;
  const commit = vi.fn<() => void>(), cancel = vi.fn<() => void>(), changed = vi.fn<() => void>();
  const write = vi.fn(() => { if (waiting) return 'pending' as const; if (quota) return false; captured = tick; return true; });
  const crossing = new GridCrossing('home', { prepare: () => Promise.resolve({ commit, cancel }), ready: () => true,
    checkpoint: write, changed, stow: () => undefined, interior: () => undefined });
  crossing.request(null); expect(crossing.state().phase).toBe('preparing'); expect(crossingSaveStatus(crossing.state())).toBeNull();
  await Promise.resolve();
  for (; tick < 300; tick++) {
    expect(crossing.step(false)).toBe(false); expect(crossing.state().phase).toBe('save-pending');
    expect(crossingSaveStatus(crossing.state())).toBe('saving');
  }
  expect(commit).not.toHaveBeenCalled(); expect(captured).toBe(-1);
  waiting = false; quota = true; expect(crossing.step(false)).toBe(false);
  expect(crossing.state().phase).toBe('save-failed'); expect(crossingSaveStatus(crossing.state())).toBe('failed');
  const attempts = write.mock.calls.length;
  for (; tick < 600; tick++) crossing.step(false);
  expect(write).toHaveBeenCalledTimes(attempts);
  quota = false; crossing.retrySave(); expect(crossing.step(false)).toBe(true);
  expect(captured).toBe(600); expect(commit).toHaveBeenCalledOnce(); expect(changed).toHaveBeenCalledOnce();
  expect(crossingSaveStatus(crossing.state())).toBeNull();
  crossing.dispose();
});

it('cancels a pending save on retreat and never commits a later readiness completion', async () => {
  let waiting = true;
  const commit = vi.fn<() => void>(), cancel = vi.fn<() => void>();
  const crossing = new GridCrossing('home', { prepare: () => Promise.resolve({ commit, cancel }), ready: () => true,
    checkpoint: () => waiting ? 'pending' : true, changed: () => undefined, stow: () => undefined, interior: () => undefined });
  crossing.request(null); await Promise.resolve(); crossing.step(false);
  expect(crossing.state().phase).toBe('save-pending');
  crossing.request('home'); waiting = false; crossing.step(true);
  expect(crossing.state().phase).toBe('settled'); expect(cancel).toHaveBeenCalledOnce(); expect(commit).not.toHaveBeenCalled();
  crossing.dispose();
});
