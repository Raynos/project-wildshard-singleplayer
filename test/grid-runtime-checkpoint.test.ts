import { expect, it } from 'vitest';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { SaveStore } from '../src/engine/saves/store';
import { regionalRuntimeCheckpoint } from '../src/game/grid/runtimeCheckpoint';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

function animal(id = 'boar:1'): AnimalSim {
  const row = SIM_LEVEL.entities[0]; if (row === undefined) throw new Error('Missing fixture creature');
  return new AnimalSim(row.spec, row.seed, row.scale, id, { heightAt: () => 0, random: () => 0.5 });
}

it('rebuilds fresh creatures with durable stable HP/pose while copies stay isolated', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: new MemoryStorage() }), a = animal();
  const save = regionalRuntimeCheckpoint(store, { id: 'pine-hollow', shard: 'pine-hollow' }, 1);
  a.hp = 55; a.position.set(12, 1.5, 34); a.yaw = 0.7;
  expect(save.checkpoint({ animals: [a] })).toBe(true);
  const b = animal(); save.restore({ animals: [b] });
  expect([b.hp, ...b.position, b.yaw]).toEqual([55, 12, 1.5, 34, 0.7]);
  const separate = animal(); regionalRuntimeCheckpoint(store, { id: 'pine-copy', shard: 'pine-hollow' }, 1).restore({ animals: [separate] });
  expect(separate.hp).toBe(separate.maxHp);
  expect(local.getItem(local.key(0) ?? '')?.length).toBeLessThan(512 * 1024);
});

it('validates every restored identity before mutation and refuses invalid health/pose or quota', () => {
  class Quota extends MemoryStorage { fail = false; override setItem(key: string, value: string): void { if (this.fail) throw new Error('Quota'); super.setItem(key, value); } }
  const local = new Quota(), store = new SaveStore({ local, session: new MemoryStorage() });
  const save = regionalRuntimeCheckpoint(store, { id: 'pine-hollow', shard: 'pine-hollow' }, 1), a = animal();
  a.hp = 55; expect(save.checkpoint({ animals: [a] })).toBe(true);
  const other = animal('changed'); expect(() => save.restore({ animals: [other] })).toThrow('Missing stable');
  expect(other.hp).toBe(other.maxHp);
  a.position.x = 251; expect(() => save.checkpoint({ animals: [a] })).toThrow(); a.position.x = 0;
  a.hp = a.maxHp + 1; expect(() => save.checkpoint({ animals: [a] })).toThrow(); a.hp = 42;
  local.fail = true; expect(save.checkpoint({ animals: [a] })).toBe(false); local.fail = false;
  const fresh = animal(); regionalRuntimeCheckpoint(new SaveStore({ local, session: null }), { id: 'pine-hollow', shard: 'pine-hollow' }, 1).restore({ animals: [fresh] }); expect(fresh.hp).toBe(55);
  expect(save.checkpoint({ animals: [a] })).toBe(true);
  const retry = animal(); regionalRuntimeCheckpoint(new SaveStore({ local, session: null }), { id: 'pine-hollow', shard: 'pine-hollow' }, 1).restore({ animals: [retry] }); expect(retry.hp).toBe(42);
});

it('checkpoints the native WORLD fall below the chunk without clamping its durable height', () => {
  const local = new MemoryStorage(), a = animal();
  a.place(12, 34, 0.7, 0); a.groundHeight = () => -1000;
  for (let tick = 0; tick < 480; tick++) a.step(1 / 60);
  expect(a.position.y).toBeLessThan(-250);
  expect(a.position.y).toBeGreaterThan(-1000);
  const pose = a.position.toArray();
  const save = regionalRuntimeCheckpoint(new SaveStore({ local, session: null }), { id: 'sky-copy', shard: 'far-reach' }, 1);
  expect(save.checkpoint({ animals: [a] })).toBe(true);
  const rebuilt = animal();
  regionalRuntimeCheckpoint(new SaveStore({ local, session: null }), { id: 'sky-copy', shard: 'far-reach' }, 1).restore({ animals: [rebuilt] });
  expect(rebuilt.position.toArray()).toEqual(pose);
  for (const height of [Number.NaN, Infinity, -Infinity]) {
    a.position.y = height; expect(() => save.checkpoint({ animals: [a] })).toThrow();
  }
  const afterRefusal = animal(); save.restore({ animals: [afterRefusal] });
  expect(afterRefusal.position.toArray()).toEqual(pose);
});

it('refuses corrupt or future stored continuations without repairing their bytes', () => {
  for (const future of [false, true]) {
    const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
    const save = regionalRuntimeCheckpoint(store, { id: 'pine-copy', shard: 'pine-hollow' }, 1);
    expect(save.checkpoint({ animals: [animal()] })).toBe(true);
    const key = Array.from({ length: local.length }, (_, i) => local.key(i)).find(name => name !== null && local.getItem(name)?.includes('platform.runtime-logical'));
    if (key === undefined || key === null) throw new Error('Missing stored checkpoint');
    const text = local.getItem(key); if (text === null) throw new Error('Missing checkpoint bytes');
    const damaged = future ? text.replace('"v":1', '"v":99') : '{invalid';
    expect(damaged).not.toBe(text); local.setItem(key, damaged);
    expect(() => regionalRuntimeCheckpoint(new SaveStore({ local, session: null }), { id: 'pine-copy', shard: 'pine-hollow' }, 1)).toThrow();
    expect(local.getItem(key)).toBe(damaged);
  }
});
