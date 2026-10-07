import { expect, it } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { GridAssembly } from '../src/game/grid/assembly';
import { gridRecovery, type GridRecoveryReason } from '../src/game/grid/recovery';
import { RoadRecovery } from '../src/game/grid/roadRecovery';
import { MemoryStorage } from './setup';

const assembly = new GridAssembly({ developer: false, devserver: false });
const home = assembly.cell('driftwood-isle');
const road = { x: 281.1, z: 40, yaw: 1.2 };

it.each<GridRecoveryReason>(['gpu', 'background', 'new-game'])('consumes a %s road recovery once through a new SaveStore after session loss', reason => {
  const local = new MemoryStorage(), session = new MemoryStorage();
  const first = gridRecovery(new SaveStore({ local, session }), () => 100);
  expect(first.write(assembly, home, road, reason)).toBe(true);
  const next = gridRecovery(new SaveStore({ local, session: new MemoryStorage() }), () => 110);
  expect(next.consume(assembly)).toMatchObject({ kind: 'resume', record: { instance: home.instance, slug: home.slug, road, reason } });
  expect(next.consume(assembly)).toEqual({ kind: 'none' });
});

it('consumes unsafe current records and preserves refused future bytes without booting them', () => {
  for (const failure of ['expired', 'catalogue', 'wire', 'future']) {
    const local = new MemoryStorage(), session = new MemoryStorage();
    const store = new SaveStore({ local, session });
    const record = gridRecovery(store, () => 100);
    record.write(assembly, home, road, 'gpu');
    if (failure === 'wire' || failure === 'future') {
      for (const storage of [local, session]) {
        const key = storage.key(0); if (key === null) throw new Error('Missing fixture document');
        storage.setItem(key, JSON.stringify({ keys: { 'grid.recovery.once': failure === 'wire' ? { v: 1, data: { unexpected: 'wire' } } : { v: 2, data: null } } }));
      }
    }
    const next = gridRecovery(new SaveStore({ local, session }), () => failure === 'expired' ? 60_101 : 110);
    const target = failure === 'catalogue' ? new GridAssembly({ developer: true, devserver: false }) : assembly;
    const before = [local, session].map(storage => { const key = storage.key(0); return key === null ? null : storage.getItem(key); });
    expect(next.consume(target)).toEqual({ kind: failure === 'future' ? 'refused' : 'fallback' });
    expect(next.consume(target)).toEqual({ kind: failure === 'future' ? 'refused' : 'none' });
    if (failure === 'future') expect([local, session].map(storage => { const key = storage.key(0); return key === null ? null : storage.getItem(key); })).toEqual(before);
  }
});

it('refuses unsafe writes and retains a detached last road pose after shard respawn ownership changes', () => {
  const record = gridRecovery(new SaveStore({ local: new MemoryStorage(), session: new MemoryStorage() }));
  expect(() => record.write(assembly, home, { x: 0, z: 0, yaw: 0 }, 'gpu')).toThrow('safe road');
  expect(() => record.write(assembly, { ...home, instance: 'unknown' }, road, 'gpu')).toThrow('safe road');
  const recovery = new RoadRecovery(assembly);
  recovery.observe({ ...road, y: 0 }, road.yaw, true);
  const saved = recovery.lastRoad(); expect(saved).toEqual(road);
  for (let tick = 0; tick < 300; tick++) recovery.observe({ x: 0, y: 5, z: 0 }, 0, true, { instance: home.instance, origin: home.origin, entryways: [] });
  expect(recovery.target()).toBeNull(); expect(recovery.lastRoad()).toEqual(road);
  if (saved === null) throw new Error('Missing road');
  Reflect.set(saved, 'x', 0); expect(recovery.lastRoad()).toEqual(road);
});

it('never grants a recovery boot when a present backup cannot be durably consumed', () => {
  class QuotaStorage extends MemoryStorage {
    quota = false;
    override setItem(key: string, value: string): void { if (this.quota) throw new Error('Quota'); super.setItem(key, value); }
  }
  const local = new QuotaStorage(), session = new MemoryStorage();
  gridRecovery(new SaveStore({ local, session }), () => 100).write(assembly, home, road, 'gpu');
  local.quota = true;
  expect(gridRecovery(new SaveStore({ local, session }), () => 110).consume(assembly)).toEqual({ kind: 'refused' });
  local.quota = false;
  const next = gridRecovery(new SaveStore({ local, session }), () => 120);
  expect(next.consume(assembly).kind).toBe('resume');
  expect(next.consume(assembly)).toEqual({ kind: 'none' });
});
