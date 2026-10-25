import { expect, test, vi } from 'vitest';
import { Scope } from '@wildshard/engine/app/scope';
import { SceneHandles } from './sceneHandles';
import { TileDriver, followResidentTiles, residentTiles } from './tileDriver';
import type { TileContent } from './tileContent';

function content(id: string): TileContent & { render: Map<number, Scope>; colliders: Map<number, Scope> } {
  const render = new Map<number, Scope>(), colliders = new Map<number, Scope>();
  const attach = (entries: Map<number, Scope>, key: number, owner: Scope): Promise<void> => {
    entries.set(key, owner); owner.onDispose(() => { entries.delete(key); }); return Promise.resolve();
  };
  return { id, render, colliders, tiles: () => new Set(Array.from({ length: 64 }, (_, key) => key)),
    attach: (key, owner) => attach(render, key, owner), attachColliders: (key, owner) => attach(colliders, key, owner) };
}
const spawn = { x: 0, z: 0 };

test('a later scene stage attaches its rank-0 content without rebuilding earlier content', async () => {
  const owner = new Scope('staged-scenes'), scenes = new SceneHandles(), initial = content('initial'), later = content('later');
  const firstCoarse = vi.fn(() => Promise.resolve()), laterCoarse = vi.fn(() => Promise.resolve());
  scenes.addTiled({ ...initial, coarse: firstCoarse });
  try {
    await residentTiles(owner, scenes.tiled(), spawn, []);
    const original = new Map(initial.render);
    scenes.addTiled({ ...later, coarse: laterCoarse });
    await residentTiles(owner, scenes.tiled(), spawn, []);
    expect(later.render.size).toBe(9); expect(later.colliders.size).toBe(9);
    expect(initial.render).toEqual(original);
    expect(firstCoarse).toHaveBeenCalledTimes(1); expect(laterCoarse).toHaveBeenCalledTimes(1);
  } finally { owner.dispose(); }
  expect(initial.render.size + later.render.size + initial.colliders.size + later.colliders.size).toBe(0);
});

test('re-entry restores required tiles evicted by the previous entry', async () => {
  const owner = new Scope('returning-world'), source = content('world');
  let at = spawn;
  try {
    await residentTiles(owner, [source], spawn, []);
    const follow = followResidentTiles(owner, () => at);
    if (follow === null) throw new Error('Missing resident driver');
    at = { x: -240, z: -240 }; follow(); await Promise.resolve(); await Promise.resolve();
    expect(source.render.has(36)).toBe(false); expect(source.colliders.has(36)).toBe(false);
    await residentTiles(owner, [source], spawn, []);
    expect(source.render.has(36)).toBe(true); expect(source.colliders.has(36)).toBe(true);
  } finally { owner.dispose(); }
});

test('late content also fills already attached background tiles once, under their existing scopes', async () => {
  const owner = new Scope('late-background'), initial = content('initial'), later = content('later'), sources: TileContent[] = [initial];
  const driver = new TileDriver(owner, sources, () => 1, () => Promise.resolve());
  const settle = async (): Promise<void> => {
    for (let frame = 0; frame < 90; frame++) { driver.step(0, 0); await Promise.resolve(); await Promise.resolve(); }
  };
  try {
    await settle(); expect(initial.render.size).toBe(9);
    const original = new Map(initial.render); sources.push(later);
    await settle();
    expect(later.render.size).toBe(9); expect(later.colliders.size).toBe(9);
    expect(initial.render).toEqual(original);
  } finally { owner.dispose(); }
});

test('required attachment awaits an in-flight background failure and refuses it', async () => {
  const owner = new Scope('shared-background'), failure = new Error('background collider failed');
  let refuse = (_error: Error): void => { throw new Error('Missing background preparation'); };
  let started = (): void => { throw new Error('Missing start witness'); };
  const waiting = new Promise<void>(resolve => { started = resolve; });
  const source: TileContent = { id: 'world', tiles: () => new Set([36]),
    attach: () => { started(); return new Promise<void>((_resolve, reject) => { refuse = reject; }); } };
  const driver = new TileDriver(owner, [source], () => 1, () => Promise.resolve());
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    for (let frame = 0; frame < 80; frame++) { driver.step(0, 0); await Promise.resolve(); await Promise.resolve(); }
    await waiting;
    const required = driver.require([36]); refuse(failure);
    await expect(required).rejects.toBe(failure);
    expect(warning).toHaveBeenCalledTimes(1);
  } finally { warning.mockRestore(); owner.dispose(); }
});

test('a failing tile cleanup rejects required callers without stranding their shared promise', async () => {
  const owner = new Scope('failed-cleanup');
  const source: TileContent = { id: 'cleanup', tiles: () => new Set([36]), attach: (_key, tile) => {
    tile.onDispose(() => { throw new Error('cleanup failed'); });
    return Promise.reject(new Error('attachment failed'));
  } };
  const driver = new TileDriver(owner, [source], () => 1, () => Promise.resolve());
  try { await expect(driver.require([36])).rejects.toThrow('cleanup failed'); }
  finally { owner.dispose(); }
});
