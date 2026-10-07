import { expect, it } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { GridAssembly } from '../src/game/grid/assembly';
import { gridRecovery } from '../src/game/grid/recovery';
import { resetNewGame } from '../src/game/newGame';
import { MemoryStorage } from './setup';

const assembly = new GridAssembly({ developer: false, devserver: false });
const home = assembly.cell('driftwood-isle'), copy = assembly.cell('template-2');
const road = { x: 281.1, z: 40, yaw: 1.2 };
const location = { kind: 'cell' as const, x: 25, y: 3, z: -42, yaw: 0.7 };

it('resumes the last successful instance checkpoint once after WebContent loses session storage', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: new MemoryStorage() });
  const record = gridRecovery(store, () => 100);
  expect(record.save(assembly, copy, road, location)).toBe(true);
  expect(record.write(assembly, home, road, 'gpu')).toBe(true);
  const next = gridRecovery(new SaveStore({ local, session: null }), () => 110);
  expect(next.consume(assembly)).toMatchObject({ kind: 'resume', record: { instance: copy.instance, slug: copy.slug, saved: { location } } });
  expect(next.consume(assembly)).toEqual({ kind: 'none' });
});

it('consumes a second recovery within ten minutes into the loop guard, including unexpected ends', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  let at = 100;
  const record = gridRecovery(store, () => at);
  record.write(assembly, home, road, 'gpu');
  expect(record.consume(assembly).kind).toBe('resume');
  at = 599_999;
  expect(record.consume(assembly, true)).toEqual({ kind: 'loop' });
  record.write(assembly, home, road, 'background');
  expect(record.consume(assembly)).toEqual({ kind: 'loop' });
  expect(record.consume(assembly)).toEqual({ kind: 'none' });
  at = 600_100;
  record.write(assembly, home, road, 'gpu');
  expect(record.consume(assembly).kind).toBe('resume');
  expect(record.clearLoop()).toBe(true);
  record.write(assembly, home, road, 'gpu');
  expect(record.consume(assembly).kind).toBe('resume');
});

it('a reset generation invalidates an earlier durable pose, while resetting a neighbour leaves it intact', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  const record = gridRecovery(store, () => 100);
  record.save(assembly, copy, road, location); record.write(assembly, home, road, 'gpu');
  expect(resetNewGame(store, { id: home.instance, shard: home.slug }).applied).toBe(true);
  expect(record.consume(assembly).kind).toBe('resume'); record.clearLoop();
  record.write(assembly, home, road, 'gpu');
  expect(resetNewGame(store, { id: copy.instance, shard: copy.slug }).applied).toBe(true);
  // The intent cannot pull a pre-reset continuation or position into the fresh instance.
  expect(record.consume(assembly)).toEqual({ kind: 'fallback' });
  expect(record.save(assembly, copy, road, { kind: 'road' })).toBe(true);
  expect(record.write(assembly, copy, road, 'new-game')).toBe(true);
  expect(gridRecovery(new SaveStore({ local, session: null }), () => 110).consume(assembly)).toMatchObject({ kind: 'resume', record: { reason: 'new-game', saved: { location: { kind: 'road' } } } });
});

it('requires durable location and loop-marker writes and refuses cross-instance coordinates', () => {
  class Quota extends MemoryStorage {
    reject = '';
    override setItem(key: string, value: string): void {
      if (this.reject !== '' && value.includes(this.reject)) throw new Error('Quota');
      super.setItem(key, value);
    }
  }
  const local = new Quota(), store = new SaveStore({ local, session: null }), record = gridRecovery(store, () => 100);
  expect(() => record.save(assembly, copy, road, { ...location, x: 260 })).toThrow('outside');
  local.reject = 'platform.grid-position';
  expect(record.save(assembly, copy, road, location)).toBe(false);
  local.reject = '';
  expect(record.write(assembly, home, road, 'gpu')).toBe(true);
  local.reject = 'grid.recovery.guard';
  expect(record.consume(assembly)).toEqual({ kind: 'refused' });
  // Intent was consumed before allocation even though the mandatory marker failed.
  local.reject = '';
  expect(gridRecovery(new SaveStore({ local, session: null }), () => 110).consume(assembly)).toEqual({ kind: 'none' });
});
