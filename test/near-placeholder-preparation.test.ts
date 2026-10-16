import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group } from 'three';
import type { FarProxyView } from '../src/game/grid/farView';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { NearPlaceholders, type NearPlaceholderHost } from '../src/game/grid/nearPlaceholderView';

function fixture() {
  const root = new Group(), geometry = new BoxGeometry(), allocator = new ResidencyAllocator();
  const disposed = vi.fn(); geometry.addEventListener('dispose', () => { disposed(); });
  const cover = vi.fn(), undo = vi.fn();
  let finish: () => void = () => undefined, fail: (error: Error) => void = () => undefined;
  const pending = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  let current: () => boolean = () => false;
  const prepare: NonNullable<NearPlaceholderHost['prepare']> = vi.fn((view: FarProxyView, live: () => boolean) => {
    expect(view.mesh.visible).toBe(false); current = live; return pending;
  });
  const near = new NearPlaceholders({ allocator, root: () => root, pitch: 555,
    cells: [{ instance: 'cell', slug: 'content', cell: [0, 0], origin: { x: 0, y: 0, z: 0 } }],
    load: () => Promise.resolve({ prepared: { geometry, look: { family: 'toon', haze: { colour: [1, 1, 1], near: 10, far: 100, max: 1 } } }, bytes: 100, owns: true }),
    mask: () => new Set<number>(), cover: (instance, covered) => { cover(instance, covered); }, adopt: () => () => { undo(); }, prepare });
  return { near, root, allocator, cover, undo, disposed, finish, fail, current: () => current() };
}

test('near views retain their far fallback until preparation completes', async () => {
  const f = fixture(); f.near.update({ x: 0, z: 0 }, null);
  await Promise.resolve();
  expect(f.current()).toBe(true); expect(f.near.shows('cell')).toBe(false); expect(f.near.owns('cell')).toBe(false);
  expect(f.near.state().cells[0]?.shows).toBe('loading'); expect(f.cover).not.toHaveBeenCalled();
  f.near.remask('cell'); expect(f.root.children[0]?.visible).toBe(false);
  f.finish(); await Promise.resolve();
  expect(f.near.visible('cell')).toBe(true); expect(f.near.owns('cell')).toBe(true);
  expect(f.cover).toHaveBeenCalledExactlyOnceWith('cell', true);
  f.near.dispose(); expect(f.disposed).toHaveBeenCalledOnce(); expect(f.undo).toHaveBeenCalledOnce();
  expect(f.allocator.entries()).toHaveLength(0);
});

test.each(['replan', 'dispose', 'failure'] as const)('near preparation cannot publish after %s', async reason => {
  const f = fixture(), warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    f.near.update({ x: 0, z: 0 }, null); await Promise.resolve();
    if (reason === 'replan') f.near.update({ x: 2000, z: 2000 }, null);
    else if (reason === 'dispose') f.near.dispose();
    if (reason === 'failure') f.fail(new Error('Driver failed')); else f.finish();
    await Promise.resolve();
    expect(f.current()).toBe(false); expect(f.near.visible('cell')).toBe(false);
    expect(f.cover).not.toHaveBeenCalled(); expect(f.root.children).toHaveLength(0);
    expect(f.disposed).toHaveBeenCalledOnce(); expect(f.undo).toHaveBeenCalledOnce();
    expect(f.allocator.entries()).toHaveLength(0);
  } finally { f.near.dispose(); warning.mockRestore(); }
});
