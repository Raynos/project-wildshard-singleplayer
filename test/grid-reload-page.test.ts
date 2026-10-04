// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { SaveStore } from '../src/engine/saves/store';
import { GridAssembly } from '../src/game/grid/assembly';
import { installGridReload, type GridReloadHost } from '../src/game/grid/reload';
import { gridReloadSlot } from '../src/game/grid/reloadHandoff';
import * as revision from '../src/game/grid/reloadRevision';
import * as travel from '../src/game/travel/travel';
import { MemoryStorage } from './setup';

it.each([false, true])('the installed page exit retries real storage and validates the junction recovery point (island=%s)', async (island) => {
  vi.useFakeTimers();
  const assembly = new GridAssembly({ developer: false, devserver: false }), scope = new Scope('reload.page');
  const store = new SaveStore({ local: new MemoryStorage(), session: null });
  const navigate = vi.spyOn(travel, 'replaceTravelDocument').mockImplementation(() => undefined);
  const metadata = vi.spyOn(revision, 'gridReloadRevision').mockResolvedValue(1);
  let instance: string | null = 'driftwood-isle', feet = { x: 0, y: 0, z: 0 }, held = false, durable = false;
  const checkpoint = vi.fn(() => durable);
  let readStatus: (() => 'saving' | 'failed' | null) | undefined;
  const steps: (() => void)[] = [], refusals: unknown[] = [];
  const host: GridReloadHost = { scope, assembly, store, homeSlug: 'driftwood-isle', grounded: () => true,
    live: { frame: () => instance, worldFeet: () => feet, roadPoint: () => ({ x: 277.5, z: island ? 277.5 : 0, yaw: 1 }),
      checkpointInstance: checkpoint, bindReloadStatus: (read) => { readStatus = read; }, live: { ready: () => true } },
    hold: (value) => { held = value; }, onFixed: (run) => { steps.push(run); }, report: (error) => { refusals.push(error); },
    capture: () => ({ heading: 1, mount: null, loadout: { selected: null, tools: [] },
      clock: { version: 1, elapsed: 10, wall: 10, frames: 600, paused: false, captureFps: null, scale: 1 } }) };
  try {
    installGridReload(host);
    for (const run of steps) run();
    instance = null; feet = { x: 277.5, y: 0, z: 0 };
    for (const run of steps) run();
    expect(held).toBe(true); expect(readStatus?.()).toBe('saving');
    await vi.advanceTimersByTimeAsync(0);
    expect(readStatus?.()).toBe('failed'); expect(navigate).not.toHaveBeenCalled();
    expect(refusals).toEqual([new Error('Source checkpoint is not durable')]);
    expect(gridReloadSlot(store).read()).toBeNull();
    durable = true;
    for (let tick = 0; tick < 60; tick++) for (const run of steps) run();
    await vi.advanceTimersByTimeAsync(0);
    expect(checkpoint).toHaveBeenCalledTimes(2); expect(metadata).toHaveBeenCalledTimes(2);
    expect(gridReloadSlot(store).read()).toMatchObject({ instance: 'driftwood-isle', roadPose: feet,
      recovery: { lastSafeRoadPoint: { x: feet.x, z: feet.z, yaw: 1 }, state: 'on-road' } });
    expect(document.querySelector('.ws-grid-reload')?.classList.contains('opaque')).toBe(true);
    await vi.advanceTimersByTimeAsync(249); expect(navigate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain('chunk=driftwood-isle');
  } finally { scope.dispose(); vi.useRealTimers(); }
  expect(held).toBe(false); expect(scope.census.nodes).toBe(0);
  expect(document.querySelector('.ws-grid-reload')).toBeNull();
});
