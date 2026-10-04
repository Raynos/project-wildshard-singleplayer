import { expect, it } from 'vitest';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridReloadExit, gridReloadSlot, type GridReloadHandoff } from '../src/game/grid/reloadHandoff';
import { RoadReload, type RoadReloadObservation } from '../src/game/grid/roadReload';
import { SaveStore } from '../src/engine/saves/store';
import { MemoryStorage } from './setup';

const grid = new GridAssembly({ developer: true, devserver: false });
const base: RoadReloadObservation = { instance: null, inside: null, feet: { x: 277.5, y: 0, z: 0 }, grounded: true, ready: true };
function fixture() {
  let navigations = 0, checkpoints = 0, held = false, durable = true;
  const value: GridReloadHandoff = { v: 1, mode: 'grid', layout: { developer: true, devserver: false, nineDragon: false },
    instance: 'template-1', revision: 1, cell: [1, 0], roadPose: { ...base.feet }, heading: 0, mount: null,
    loadout: { selected: null, tools: [] }, clock: { version: 1, elapsed: 0, wall: 0, frames: 0, captureFps: null, paused: false, scale: 1 },
    recovery: { lastSafeRoadPoint: { x: 277.5, z: 0, yaw: 0 }, state: 'on-road' }, at: 1 };
  const reload = new RoadReload({ grid, capture: () => value, report: (error) => { throw error; }, transaction: () => new GridReloadExit({
    checkpoint: () => { checkpoints++; return durable; }, slot: gridReloadSlot(new SaveStore({ local: new MemoryStorage(), session: null })),
    hold: (next) => { held = next; }, fade: () => Promise.resolve(), navigate: () => { navigations++; } }) });
  return { reload, state: () => ({ navigations, checkpoints, held }), refuse: () => { durable = false; }, allow: () => { durable = true; } };
}
const enter = { ...base, instance: 'template-1', inside: 'template-1', feet: { x: 555, y: 0, z: 0 } };
it('does not reload at road boot, a proxy visit, a strip transfer, in the air or before critical readiness', async () => {
  const f = fixture(); f.reload.step(base);
  f.reload.step({ ...enter, instance: null }); f.reload.step(base); expect(f.state().checkpoints).toBe(0);
  f.reload.step(enter);
  for (const observation of [{ ...base, instance: 'template-1' }, { ...base, feet: { x: 260, y: 0, z: 0 } },
    { ...base, grounded: false }, { ...base, ready: false }, { ...base, feet: { ...base.feet, y: 3 } }]) f.reload.step(observation);
  expect(f.state().checkpoints).toBe(0);
  f.reload.step(base); await Promise.resolve(); expect(f.state()).toEqual({ navigations: 1, checkpoints: 1, held: true });
  for (let n = 0; n < 100; n++) f.reload.step(base);
  expect(f.state().navigations).toBe(1);
});
it('a U-turn into the cell supersedes the prior exit and a failed checkpoint retries while held', async () => {
  const f = fixture(); f.reload.step(enter); f.reload.step({ ...base, feet: { x: 260, y: 0, z: 0 } });
  f.reload.step(enter); expect(f.state().checkpoints).toBe(0);
  f.refuse(); f.reload.step(base); expect(f.reload.state()).toBe('failed'); expect(f.state().held).toBe(true);
  f.allow(); for (let n = 0; n < 60; n++) f.reload.step(base);
  await Promise.resolve(); expect(f.state()).toEqual({ navigations: 1, checkpoints: 2, held: true });
});
