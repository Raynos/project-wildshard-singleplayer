import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the serialized input driver against explicit browser globals without a game browser.
import { runInNewContext } from 'node:vm';
import { InputService } from '../src/engine/input/InputService';
import { gridSeamRoute, gridDriveFailures, driveGridSeam, type GridDriveResult } from '../scripts/physics-grid.mjs';

const cells = [{ instance: 'home', slug: 'driftwood-isle', cell: [0, 0] as const }, { instance: 'peer', slug: '_template', cell: [-1, 0] as const }];
const route = gridSeamRoute({ home: 'home', cells }, 30);
const valid: GridDriveResult = { ...route, trace: [{ time: 0, x: -230, y: 1, z: 0, current: 'home', enabled: true, gameplayReady: true },
  { time: 1, x: -260, y: 1, z: 0, current: 'home', enabled: true, gameplayReady: true }],
  stuck: [], complete: true, timedOut: false, crossingDelta: 4, issues: {},
  transitions: [{ from: 'home', to: null }, { from: null, to: 'peer' }, { from: 'peer', to: null }, { from: null, to: 'home' }] };

it('refuses apparent successful motion without the expected real frame commits, or with falls and seam jumps', () => {
  expect(gridDriveFailures(valid)).toEqual([]);
  expect(gridDriveFailures({ ...valid, crossingDelta: 0, transitions: [] })).toContain('Expected home/deck/neighbour/deck/home crossings were not observed');
  expect(gridDriveFailures({ ...valid, trace: [{ ...valid.trace[0], time: 1, x: -230, y: -1, z: 0, current: 'home', enabled: true, gameplayReady: true }] })).toContain('Grid route fell or lost its traveller controller');
  const jump = { time: 0.01, x: -325, y: 1, z: 0, current: 'peer', enabled: true, gameplayReady: true };
  expect(gridDriveFailures({ ...valid, trace: [...valid.trace, jump] })).toContain('Grid route jumped across a seam');
  expect(gridDriveFailures({ ...valid, complete: false, timedOut: true })).toContain('Grid route did not finish');
});

it('derives a stable adjacent-template seam and refuses an unassembled readout', () => {
  const home = cells[0]; if (home === undefined) throw new Error('Missing home fixture');
  expect(route.start).toEqual({ x: -230, z: 0 }); expect(route.waypoints).toEqual([{ x: -325, z: 0 }, { x: -230, z: 0 }]);
  expect(() => gridSeamRoute({ home: 'home', cells: [home] }, 15)).toThrow('neighbouring template');
  expect(gridSeamRoute({ home: 'home', cells: [...cells, { instance: 'corner', slug: '_template', cell: [-1, -1] }] }, 30).waypoints[0]).toEqual({ x: -325, z: -325 });
});

it('drives both directions through InputService across changing local frames with exactly one initial positioning', async () => {
  let now = 0, spawns = 0, stopped = false, current: string | null = 'home', origin = 0;
  const position = { x: -230, y: 1, z: 0 }, input = new InputService(() => now), transitions: { from: string | null; to: string | null }[] = [];
  const limit = () => 30;
  const player = { position, yaw: 0, hover: false, hoverSpeedLimit: limit,
    velocity: { set: () => undefined }, motor: { collider: { isEnabled: () => true } },
    spawn: (x: number, z: number, yaw: number) => { spawns++; Object.assign(position, { x, z }); player.yaw = yaw; },
    setHover: (value: boolean) => { player.hover = value; },
  };
  const state = () => ({ current, worldFeet: { x: position.x + origin, y: position.y, z: position.z },
    crossings: transitions.length, transitions: transitions.map((row) => ({ ...row })), residents: now > 0 ? ['peer'] : [], issues: { 'proxy.only': 'Expected far proxy; no descriptor' }, gameplayReady: true });
  const watchFrames = (tick: (dt: number) => void) => {
    queueMicrotask(() => {
      for (let frame = 0; frame < 2000; frame++) {
        if (stopped) break;
        now += 1000 / 60; const move = input.axis2('move');
        position.x -= Math.sin(player.yaw) * move.y * player.hoverSpeedLimit() / 60;
        position.z -= Math.cos(player.yaw) * move.y * player.hoverSpeedLimit() / 60;
        const worldX = position.x + origin;
        let next = current;
        if (current === 'home' && worldX < -260) next = null;
        else if (current === null && worldX < -299) next = 'peer';
        else if (current === 'peer' && worldX > -295) next = null;
        else if (current === null && worldX > -256) next = 'home';
        if (next !== current) { transitions.push({ from: current, to: next }); current = next; origin = next === 'peer' ? -555 : 0; position.x = worldX - origin; }
        tick(1 / 60); input.endFrame();
      }
    });
    return () => { stopped = true; };
  };
  const raw: unknown = await runInNewContext(`(${driveGridSeam.toString()})(route)`, {
    route, window: { __wildshard: { shard: { grid: { state: () => ({ live: { live: state() } }) } }, world: { player, game: { app: { input }, watchFrames } } } },
    performance: { now: () => now }, setTimeout: (fn: () => void) => { now += 100; fn(); },
  });
  if (raw === null || typeof raw !== 'object' || !('trace' in raw) || !('transitions' in raw)) throw new Error('Missing serialized drive result');
  const result = raw as GridDriveResult;
  expect(result.backgroundIssues).toEqual({ 'proxy.only': 'Expected far proxy; no descriptor' });
  expect(gridDriveFailures({ ...result, issues: { peer: 'Collider admission failed' } })).toContain('Grid admission/disposal issues: {"peer":"Collider admission failed"}');
  expect(gridDriveFailures(result)).toEqual([]); expect(spawns).toBe(1); expect(stopped).toBe(true);
  expect(input.held('move.forward')).toBe(false); expect(player.hoverSpeedLimit).toBe(limit); expect(player.hover).toBe(false);
});
