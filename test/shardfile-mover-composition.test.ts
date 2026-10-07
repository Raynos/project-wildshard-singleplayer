// oxlint-disable-next-line import/no-nodejs-modules -- Native fixture compiles its admitted AS mover source.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Content-address the fixture's immutable module bytes.
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { createShardfileComposedLane } from '../src/game/shardfile/scriptComposition';
import { MoverScriptDriver } from '../src/game/shardfile/moverDriver';
import { parseMovers } from '../src/game/shardfile/movers';
import { MoverRuntime } from '../src/game/shardfile/moverRuntime';
import { Scope } from '../src/engine/app/scope';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let moverBytes: Uint8Array = new Uint8Array(), numericBytes: Uint8Array = new Uint8Array();
beforeAll(async () => {
  moverBytes = await compileScript(readFileSync(new URL('fixtures/socket-lift/ride.as', import.meta.url), 'utf8'), { maximumPages: 2 });
  numericBytes = await compileScript(`
export function abi_version():i32{return 0;} export function init(lo:i32,hi:i32):void{}
export function in_ptr():i32{return 16384;} export function in_cap():i32{return 4096;}
export function out_ptr():i32{return 24576;} export function out_cap():i32{return 1;} export function out_count():i32{return 1;}
export function on_tick():void{store<f64>(24576,5);store<f64>(24584,101);store<f64>(24592,load<f64>(16448)+1);store<f64>(24600,0);store<f64>(24608,0);}`, { maximumPages: 2 });
});
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function rig(effects = 128, entityId = 2001) {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer())), scope = new Scope('composed-mover');
  const module = hash(moverBytes), numeric = hash(numericBytes);
  const data = parseMovers(['deck', 'gate'].map((id, index) => ({ id, entity: 1001 + index, module, kind: 'platform', at: { x: 0, y: index, z: 0 },
    euler: { x: 0, y: 0, z: 0 }, enabled: index === 0, boxes: [{ x: 0, y: -0.25, z: 0, hx: 4, hy: 0.25, hz: 5, rot: { x: 0, y: 0, z: 0, w: 1 } }],
    input: index === 0 ? [0, 0, 0, 0, 5, 0, 10, 0] : [0, 1, 0, 0, 1, 0, 10, 1],
  })));
  const driver = new MoverScriptDriver(data, () => []);
  let runtime: MoverRuntime | undefined;
  try {
    const lane = createShardfileComposedLane({ identity: { seed: 1 }, sim: { scripts: [module, numeric], scriptTickDivisor: 1,
      bindings: [{ module: numeric, entity: entityId, actorId: 'player', kind: 'server' }] },
    state: { shared: [{ id: 101, name: 'count', type: 'i32', privacy: 'public', default: 0 }], player: [] } }, new Map([[module, moverBytes], [numeric, numericBytes]]), {
      rules: { fields: {}, archetypes: [], events: [], maxEntities: 3 },
      entities: [{ id: entityId, name: 'player', position: [0, 0, 0], fields: {}, frozen: false, interactive: true }], actors: new Map([[entityId, 'player']]),
      query: () => [], limits: { effects },
    }, undefined, { roles: [driver.role()], schedules: [driver.schedule(() => { if (runtime === undefined) throw new Error('Missing composed runtime'); return runtime; })] });
    runtime = new MoverRuntime(data, { host: lane.host, physics, scope });
    return { lane, runtime, driver, physics, scope, dispose: () => { scope.dispose(); physics.dispose(); } };
  } catch (error) { scope.dispose(); physics.dispose(); throw error; }
}
describe('one authoritative host with numeric state and movers', () => {
  it('executes both mover calls and numeric state with one global fixed tick and one module union', async () => {
    const r = await rig();
    try {
      r.runtime.command('deck', 1); r.runtime.command('gate', 1);
      const calls = r.lane.step(1); r.physics.step();
      expect(calls).toHaveLength(3); expect(calls.every(call => call.ok)).toBe(true);
      expect(r.lane.host.currentTick).toBe(1); expect(r.lane.host.checkpoint().modules).toHaveLength(2);
      expect(r.runtime.pose('deck').position.y).toBeGreaterThan(0);
      expect(r.lane.world.view('player').shared['count']).toBe(1);
      expect(() => r.lane.step(1)).toThrow('Invalid composed script tick');
      expect(r.driver.world.entity(1001)?.fields[101]).toBeUndefined();
      expect(r.physics.world.bodies.len()).toBe(2);
    } finally { r.dispose(); }
  });
  it('uses one aggregate effect ceiling across numeric and both mover roles', async () => {
    const r = await rig(8);
    try {
      r.runtime.command('deck', 1); r.runtime.command('gate', 1);
      const calls = r.lane.step(1);
      expect(calls.filter(call => call.ok)).toHaveLength(2); expect(calls.filter(call => !call.ok)).toHaveLength(1);
      expect(calls.some(call => call.reason?.includes('allowance') === true)).toBe(true);
      expect(r.lane.host.currentTick).toBe(1);
    } finally { r.dispose(); }
  });
  it('refuses a mover alias overlapping numeric state before any body is allocated', async () => {
    await expect(rig(128, 1001)).rejects.toThrow('Overlapping script roles');
  });
});
