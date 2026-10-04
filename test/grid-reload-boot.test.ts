import { expect, it } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { consumeGridReloadBoot, installPlannedGridReload, plannedGridReload } from '../src/game/grid/reloadBoot';
import { gridReloadSlot, type GridReloadHandoff } from '../src/game/grid/reloadHandoff';
import { GridAssembly } from '../src/game/grid/assembly';
import { MemoryStorage } from './setup';
import { bootPageMode, pageGridInstance, gridCells } from '../src/game/grid/boot';
import { gridEntryShown } from '../src/game/grid/menu';

const layout = { developer: true, devserver: false, nineDragon: false }, cell = new GridAssembly(layout).cell('template-1');
const value: GridReloadHandoff = { v: 1, mode: 'grid', layout, instance: cell.instance, revision: 1, cell: [...cell.cell],
  roadPose: { x: 277.5, y: 0, z: 0 }, heading: 0, mount: null, loadout: { selected: null, tools: [] },
  clock: { version: 1, elapsed: 100, wall: 110, frames: 6000, captureFps: null, paused: false, scale: 1 },
  recovery: { lastSafeRoadPoint: { x: 277.5, z: 0, yaw: 0 }, state: 'on-road' }, at: 1000 };
it('routes a planned transfer to the catalogue home before crash rescue and consumes before the first boot can fail', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  expect(gridReloadSlot(store).write(value)).toBe(true);
  const boot = consumeGridReloadBoot(new SaveStore({ local, session: null }), 1100);
  expect(boot.kind).toBe('resume');
  if (boot.kind !== 'resume') throw new Error('No planned boot');
  expect(boot.home.cell).toEqual([0, 0]); expect(boot.value.instance).toBe(cell.instance);
  installPlannedGridReload(boot); expect(plannedGridReload()?.value).toEqual(value);
  const repeated = consumeGridReloadBoot(new SaveStore({ local, session: null }), 1101);
  expect(repeated.kind).toBe('none'); installPlannedGridReload(repeated); expect(plannedGridReload()).toBeNull();
});
it('invalid planned records return the menu instead of falling through to the old chunk URL', () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  gridReloadSlot(store).write({ ...value, roadPose: { x: 0, y: 0, z: 0 } });
  expect(consumeGridReloadBoot(new SaveStore({ local, session: null }), 1100).kind).toBe('invalid');
  expect(consumeGridReloadBoot(new SaveStore({ local, session: null }), 1101).kind).toBe('none');
});
it.each([
  { v: 1, data: { ...value, unknown: true } },
  { v: 2, data: value },
  { v: 1, data: { ...value, roadPose: { x: 'bad', y: 0, z: 0 } } },
])('present malformed or future transfers refuse boot before repair can resemble an absent record', (entry) => {
  const local = new MemoryStorage();
  local.setItem('wildshard.save.v2.global', '{"keys":{}}');
  local.setItem('wildshard.save.v2.device', JSON.stringify({ keys: { 'grid.reload.once': entry } }));
  const store = new SaveStore({ local, session: null });
  expect(gridReloadSlot(store).status?.()).toBe(entry.v === 2 ? 'future' : 'invalid');
  expect(consumeGridReloadBoot(store, 1100).kind).toBe('invalid');
});
it.each([false, true])('planned road boots bypass the public grid gate %s and never emit a home-cell enter', (gates) => {
  expect(gridEntryShown({ developer: false, devserver: false }, gates)).toBe(gates);
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null }); gridReloadSlot(store).write(value);
  const boot = consumeGridReloadBoot(store, 1100);
  if (boot.kind !== 'resume') throw new Error('No planned boot');
  installPlannedGridReload(boot);
  try {
    expect(bootPageMode(boot.home.slug)).toBe('grid');
    expect(pageGridInstance()).toBe(boot.home.instance); expect(gridCells.cell).toBeNull();
  } finally { installPlannedGridReload({ kind: 'none' }); }
});
