import { expect, it, vi } from 'vitest';
import { GridCrossing, type PreparedGridCrossing } from '../src/game/grid/crossing';

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
  f.quota(false); expect(f.crossing.step(false)).toBe(true); expect(f.frame()).toBe('pine-hollow');
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
