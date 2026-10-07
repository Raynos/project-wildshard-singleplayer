// oxlint-disable-next-line import/no-nodejs-modules -- Native admission fixture compiles its own declared AssemblyScript source.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Assert the immutable admitted module identity in the native proof.
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { Scope } from '../src/engine/app/scope';
import { groups } from '../src/engine/physics/groups';
import { MoverRuntime, createMoverHost } from '../src/game/shardfile/moverRuntime';
import { parseMovers } from '../src/game/shardfile/movers';
import { parseSocketLift, type SocketLiftEntry } from '../src/game/shardfile/socketLift';
import { proveSocketLift } from '../src/game/shardfile/socketLiftProof';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const source = readFileSync(new URL('fixtures/socket-lift/ride.as', import.meta.url), 'utf8');
let compiled: Uint8Array = new Uint8Array();
beforeAll(async () => { compiled = await compileScript(source, { maximumPages: 2 }); });
const entry = (): SocketLiftEntry => ({ edge: 'north', lift: parseSocketLift({ mover: 'entry.lift', gate: 'entry.gate', roadStop: [0, 0, 230], topStop: [0, 25, 205], route: [[0, 25, 205], [0, 25, 195]], rideTicks: 610 }) });
async function rig(bytes = compiled, gateWidth = 4) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer())), scope = new Scope('lift-admission');
  const data = parseMovers([{ id: 'entry.lift', entity: 1001, module: hash, kind: 'platform', at: { x: 0, y: 0, z: 230 }, euler: { x: 0, y: 0, z: 0 }, enabled: true,
    boxes: [{ x: 0, y: -0.25, z: 0, hx: 4, hy: 0.25, hz: 5, rot: { x: 0, y: 0, z: 0, w: 1 } }], input: [0, 0, 230, 0, 25, 205, 10, 0],
  }, { id: 'entry.gate', entity: 1002, module: hash, kind: 'platform', at: { x: 0, y: 1, z: 235 }, euler: { x: 0, y: 0, z: 0 }, enabled: false,
    boxes: [{ x: 0, y: 0, z: 0, hx: gateWidth, hy: 1, hz: 0.1, rot: { x: 0, y: 0, z: 0, w: 1 } }], input: [0, 1, 235, 0, 1, 235, 10, 1],
  }]);
  const host = await createMoverHost(data, new Map([[hash, bytes]]), () => []), runtime = new MoverRuntime(data, { host, physics, scope });
  const R = physics.R;
  // The real socket ends at z235; the top island begins at z200. There is no hidden ground below the journey.
  physics.world.createCollider(R.ColliderDesc.cuboid(4, 0.25, 7.5).setTranslation(0, -0.25, 242.5).setCollisionGroups(groups('WORLD')));
  physics.world.createCollider(R.ColliderDesc.cuboid(5, 0.25, 7.5).setTranslation(0, 24.75, 192.5).setCollisionGroups(groups('WORLD')));
  let tick = 0;
  const fixedStep = () => {
    host.beginTick(++tick); runtime.step(tick); physics.step();
    if (host.checkpoint().modules.some(module => module.failures > 0 || module.disabled)) throw new Error('Lift script failed');
  };
  return { physics, scope, host, runtime, fixedStep, dispose: () => { scope.dispose(); physics.dispose(); } };
}
describe('headless socket lift real capsule admission', () => {
  it('boards, rides actual WASM/mover collision to playable ground, returns and calls at both ends', async () => {
    const r = await rig();
    try {
      const result = proveSocketLift(entry(), r);
      expect(result).toMatchObject({ rides: 2, calls: 2 }); expect(result.steps).toBeGreaterThan(3000); expect(result.maximumDeckStep).toBeLessThan(0.06);
      // Both temporary admission capsules release their colliders; only the two mover boxes and two static floors remain.
      expect(r.physics.world.colliders.len()).toBe(4);
    } finally { r.dispose(); }
  });
  it('refuses a blocked top landing through collision rather than declaration booleans', async () => {
    const r = await rig();
    r.physics.world.createCollider(r.physics.R.ColliderDesc.cuboid(4, 2, 0.25).setTranslation(0, 27, 199).setCollisionGroups(groups('WORLD')));
    try { expect(() => proveSocketLift(entry(), r)).toThrow('Blocked socket lift route'); } finally { r.dispose(); }
  });
  it('refuses a disabled gate even with otherwise working lift motion', async () => {
    const bytes = await compileScript(source.replace('param(7) === 0 ? 1 : progress > 0 || direction !== 0 ? 1 : 0', 'param(7) === 0 ? 1 : 0'), { maximumPages: 2 });
    const r = await rig(bytes);
    try { expect(() => proveSocketLift(entry(), r)).toThrow('Missing active platform gate'); } finally { r.dispose(); }
  });
  it('refuses a narrow physical gate even when its published enabled state is true', async () => {
    const narrow = await rig(compiled, 1);
    try {
      expect(() => proveSocketLift(entry(), narrow)).toThrow('road gate did not block');
    } finally { narrow.dispose(); }
  });
  it('refuses teleport motion even when the deck reaches both declared stops', async () => {
    const bytes = await compileScript(source.replace('input(1) / param(6)', '1'), { maximumPages: 2 });
    const r = await rig(bytes);
    try { expect(() => proveSocketLift(entry(), r)).toThrow('teleported'); } finally { r.dispose(); }
  });
  it('refuses a lift that never returns to its road stop when idle', async () => {
    const bytes = await compileScript(source.replace('tick - topSince >= 300', 'tick - topSince >= 100000'), { maximumPages: 2 });
    const r = await rig(bytes);
    try { expect(() => proveSocketLift(entry(), r)).toThrow('did not reach its stop'); } finally { r.dispose(); }
  });
  it('refuses a mover already in travel and a fresh reload returns to its road stop', async () => {
    const r = await rig(); r.runtime.command('entry.lift', 1); for (let tick = 0; tick < 100; tick++) r.fixedStep();
    try { expect(() => proveSocketLift(entry(), r)).toThrow('must load at the road stop'); } finally { r.dispose(); }
    const fresh = await rig();
    try { expect(fresh.runtime.pose('entry.lift').position).toEqual({ x: 0, y: 0, z: 230 }); expect(proveSocketLift(entry(), fresh).rides).toBe(2); } finally { fresh.dispose(); }
  });
});
