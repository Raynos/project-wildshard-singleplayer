// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { GridAssembly } from '../src/game/grid/assembly';
import { gridRecovery } from '../src/game/grid/recovery';
import { clearGridRecovery, consumeGridRecovery, pageGridRecovery, safeGridRecovery } from '../src/game/grid/recoveryBoot';
import { bootPageMode, gridCells } from '../src/game/grid/boot';
import { preparePageResidency } from '../src/game/grid/pageBoot';
import { DRIFTWOOD_RUNTIME_COST } from '../src/shards/driftwood-isle/data/runtimeCost';
import { MemoryStorage } from './setup';

const assembly = new GridAssembly({ developer: false, devserver: false });
afterEach(() => { clearGridRecovery(); gridCells.leave(); });
it('selects recovery before ordinary admission and consumes it even when the measured home refuses', () => {
  const local = new MemoryStorage(), session = new MemoryStorage(), store = new SaveStore({ local, session });
  const home = assembly.cell('driftwood-isle'), road = { x: 281.1, z: 12, yaw: 0.5 };
  gridRecovery(store, () => 100).write(assembly, home, road, 'background');
  expect(consumeGridRecovery({ assembly, saves: store, now: () => 110 })).toMatchObject({ instance: home.instance, road });
  expect(pageGridRecovery()?.reason).toBe('background');
  expect(() => preparePageResidency({ slug: 'driftwood-isle', runtimeCost: { ...DRIFTWOOD_RUNTIME_COST, webContentMB: 2000 } })).toThrow();
  expect(gridRecovery(new SaveStore({ local, session }), () => 120).consume(assembly)).toEqual({ kind: 'none' });
  clearGridRecovery(); expect(pageGridRecovery()).toBeNull();
});
it('uses the same measured owner for a successful resume and leaves ordinary boot unchanged after clearing', () => {
  const store = new SaveStore({ local: new MemoryStorage(), session: new MemoryStorage() });
  const safe = safeGridRecovery(assembly, 100);
  gridRecovery(store, () => 100).write(assembly, assembly.cell(safe.instance), safe.road, 'gpu');
  consumeGridRecovery({ assembly, saves: store, now: () => 110 });
  const page = preparePageResidency({ slug: 'driftwood-isle', runtimeCost: DRIFTWOOD_RUNTIME_COST });
  try { expect(page.mode).toBe('grid'); expect(page.residency?.home().bytes).toBe(341_781_982); }
  finally { page.residency?.dispose(); }
  clearGridRecovery(); gridCells.leave(); expect(bootPageMode('driftwood-isle')).toBe('shard');
});
