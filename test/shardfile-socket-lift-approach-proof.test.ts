// oxlint-disable-next-line import/no-nodejs-modules -- Compile the pinned native admission fixture, never author JavaScript.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture admits the exact compiled WASM identity.
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { Scope } from '../src/engine/app/scope';
import { groups } from '../src/engine/physics/groups';
import { tagCollider } from '../src/engine/physics/surface';
import { installDeclaredPropColliders } from '../src/engine/physics/declaredProps';
import { MoverRuntime, createMoverHost } from '../src/game/shardfile/moverRuntime';
import { parseMovers } from '../src/game/shardfile/movers';
import { PropsSchema, propColliderDescriptors } from '../src/game/shardfile/props';
import { parseSocketLift, type SocketLiftEntry } from '../src/game/shardfile/socketLift';
import { proveSocketLift, proveShardfileEntries } from '../src/game/shardfile/socketLiftProof';
import { liftShard } from './fixtures/socket-lift/shard';
import { parseShardfile } from '../src/game/shardfile/schema';
import { createShardfileSim } from '../src/game/shardfile/simulation';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { HeadlessSimulation } from '../src/sdk/headless';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const source = readFileSync(new URL('fixtures/socket-lift/ride.as', import.meta.url), 'utf8');
let compiled: Uint8Array = new Uint8Array();
beforeAll(async () => { compiled = await compileScript(source, { maximumPages: 2 }); });
async function rig(narrow = false, bytes = compiled) {
  const hash = createHash('sha256').update(bytes).digest('hex'), rot = { x: 0, y: 0, z: 0, w: 1 };
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer())), scope = new Scope('static-lift-approach');
  const roadStop: [number, number, number] = narrow ? [2.4, 0, -231.6] : [0, 0, 228.05];
  const topStop: [number, number, number] = [roadStop[0], narrow ? 125 : 25, narrow ? -231.6 : 205];
  const gateZ = narrow ? -235 : 235;
  const entry: SocketLiftEntry = { edge: narrow ? 'south' : 'north', lift: parseSocketLift({ mover: 'entry.lift', gate: 'entry.gate', roadStop, topStop,
    route: [topStop, [topStop[0], topStop[1], narrow ? -215 : 195]], rideTicks: narrow ? 970 : 610,
    approach: { colliders: ['entry.landing'], route: narrow ? [[0, 0, -235], [2.4, 0, -235], [2.4, 0, -233.55]] : [[0, 0, 235], [0, 0, 233.85]] },
  }) };
  const data = parseMovers([{ id: 'entry.lift', entity: 1001, module: hash, kind: 'platform', at: { x: roadStop[0], y: 0, z: roadStop[2] },
    euler: { x: 0, y: 0, z: 0 }, enabled: true,
    boxes: [{ x: 0, y: -0.25, z: 0, hx: narrow ? 1.55 : 5.41, hy: 0.25, hz: narrow ? 1.55 : 5.41, rot }], input: [...roadStop, ...topStop, narrow ? 16 : 10, 0],
  }, { id: 'entry.gate', entity: 1002, module: hash, kind: 'static', at: { x: 0, y: 1, z: gateZ },
    euler: { x: 0, y: 0, z: 0 }, enabled: false,
    boxes: [{ x: 0, y: 0, z: 0, hx: 4, hy: 1, hz: 0.1, rot }], input: [0, 1, gateZ, 0, 1, gateZ, narrow ? 16 : 10, 1],
  }]);
  if (!narrow) {
    const deck = data[0]; if (deck === undefined) throw new Error('Missing fixture');
    // Sky Reach's actual six rotated strips over a twelve-sided deck, rather than a rectangular substitute.
    deck.boxes = Array.from({ length: 6 }, (_unused, i) => ({ x: 0, y: -1, z: 0,
      hx: 5.6 * Math.cos(Math.PI / 12), hy: 1, hz: 5.6 * 0.26,
      rot: { x: 0, y: Math.sin(-i * Math.PI / 12), z: 0, w: Math.cos(-i * Math.PI / 12) } }));
  }
  const props = v.parse(PropsSchema, { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [], colliders: [
    { id: 'entry.landing', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: -0.25, z: narrow ? -234.35 : 234.25, hx: 4.5, hy: 0.25, hz: narrow ? 1.15 : 0.75 }] },
  ] });
  const colliders = installDeclaredPropColliders(propColliderDescriptors(props), physics, scope);
  const host = await createMoverHost(data, new Map([[hash, bytes]]), () => []), runtime = new MoverRuntime(data, { host, physics, scope });
  physics.world.createCollider(physics.R.ColliderDesc.cuboid(4, 0.25, 7.5).setTranslation(0, -0.25, narrow ? -242.5 : 242.5).setCollisionGroups(groups('WORLD')));
  physics.world.createCollider(physics.R.ColliderDesc.cuboid(5, 0.25, narrow ? 15.025 : 7.5).setTranslation(topStop[0], topStop[1] - 0.25, narrow ? -215.025 : 192.5).setCollisionGroups(groups('WORLD')));
  let tick = 0;
  return { entry, physics, scope, runtime, props, colliders, approachSource: { props, targets: { panels: [] } }, fixedStep: () => {
    host.beginTick(++tick); runtime.step(tick); physics.step();
    // The counter covers failed and disabled calls without copying both WASM memories on every physics tick.
    if (host.failureCount !== 0) throw new Error('Lift script failed');
  }, dispose: () => { scope.dispose(); physics.dispose(); } };
}
describe('static approach actual WASM/capsule admission', () => {
  it.each([false, true])('walks static approach both ways, rides and calls (offset cage=%s)', async narrow => {
    const r = await rig(narrow), count = r.physics.world.colliders.len();
    try { expect(proveSocketLift(r.entry, r)).toMatchObject({ rides: 2, calls: 2 }); expect(r.physics.world.colliders.len()).toBe(count); }
    finally { r.dispose(); }
  });
  it('refuses missing admitted approach ground even when unowned hidden ground fills the hole', async () => {
    const r = await rig(), landing = r.colliders.get('entry.landing'); if (landing === undefined) throw new Error('Missing fixture');
    landing.setActive(false);
    r.physics.world.createCollider(r.physics.R.ColliderDesc.cuboid(4.5, 0.25, 0.75).setTranslation(0, -0.25, 234.25).setCollisionGroups(groups('WORLD')));
    try { expect(() => proveSocketLift(r.entry, r)).toThrow('not supported by its declared colliders'); } finally { r.dispose(); }
  });
  it('refuses a real low lintel despite correct floor triangles', async () => {
    const r = await rig();
    const obstacle = r.physics.world.createCollider(r.physics.R.ColliderDesc.cuboid(4.5, 0.2, 0.1).setTranslation(0, 1.5, 234.5).setCollisionGroups(groups('WORLD')));
    tagCollider(obstacle, 'stone', 'entry.lintel');
    try { expect(() => proveSocketLift(r.entry, r)).toThrow('Blocked socket lift route'); } finally { r.dispose(); }
  });
  it('refuses a submerged approach', async () => {
    const r = await rig();
    try { expect(() => proveSocketLift(r.entry, { ...r, waterAt: (_x, z) => z < 235 && z > 233.5 ? 0.5 : null })).toThrow('Submerged socket lift route'); }
    finally { r.dispose(); }
  });
  it('refuses a stationary gate that reopens before the deck returns', async () => {
    const bytes = await compileScript(source.replace('param(7) === 0 ? 1 : progress > 0 || direction !== 0 ? 1 : 0', 'param(7) === 0 ? 1 : progress > 0 && progress < 0.2 ? 1 : 0'), { maximumPages: 2 });
    const r = await rig(false, bytes);
    try { expect(() => proveSocketLift(r.entry, r)).toThrow('road gate opened while its deck was away'); } finally { r.dispose(); }
  });
  it('refuses a declared static road gate whose script changes its actual pose', async () => {
    const bytes = await compileScript(source.replace('param(2) + (param(5) - param(2)) * progress', 'param(2) + (param(5) - param(2)) * progress + (param(7) === 1 ? progress : 0)'), { maximumPages: 2 });
    const r = await rig(false, bytes);
    try { expect(() => proveSocketLift(r.entry, r)).toThrow('road gate moved away'); } finally { r.dispose(); }
  });
});

function compiledApproach() {
  const hash = createHash('sha256').update(compiled).digest('hex'), shard = liftShard(compiled, hash);
  const deck = shard.movers[0], gate = shard.movers[1], north = shard.entryways[0];
  if (deck === undefined || gate === undefined || north?.lift === undefined || shard.props === null) throw new Error('Missing compiled fixture');
  deck.at.z = 228.05; deck.input[2] = 228.05;
  const box = deck.boxes[0]; if (box === undefined) throw new Error('Missing deck box');
  box.hx = 5.41; box.hz = 5.41; gate.kind = 'static';
  north.lift.roadStop = [0, 0, 228.05];
  north.lift.approach = { colliders: ['entry.landing'], route: [[0, 0, 235], [0, 0, 233.85]] };
  shard.props.colliders.push({ id: 'entry.landing', panel: null, initialActive: true, shapes: [
    { kind: 'box', x: 0, y: -0.25, z: 234.25, hx: 4.5, hy: 0.25, hz: 0.75 },
  ] });
  return { shard: parseShardfile(shard), hash, assets: new Map([[hash, compiled]]) };
}
describe('compiled static approach uses the normal admission pipeline', () => {
  it('validates actual assets and walks the declared landing in the authoritative factory', async () => {
    const r = compiledApproach(), shard = validateShardfileAssets(r.shard, r.assets, bytes => createHash('sha256').update(bytes).digest('hex'));
    const rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), sim = createShardfileSim(shard, r.assets, { rapier });
    try {
      const count = sim.host.physics.world.colliders.len();
      expect(proveShardfileEntries(shard, sim, r.assets, { rapier })).toMatchObject({ lanes: 92, liftRides: 2, liftCalls: 2 });
      expect(sim.host.physics.world.colliders.len()).toBe(count);
      expect(sim.lane?.host.checkpoint().modules).toHaveLength(1);
    } finally { sim.dispose(); }
  });
  it('proves the same approach/ride/return in the bounded SDK worker', async () => {
    const r = compiledApproach(), sim = await HeadlessSimulation.create(r.shard, r.assets, undefined, { deadline: 'advisory' });
    try { await sim.step(); expect(await sim.finish()).toMatchObject({ lanes: 92, ticks: 1, liftRides: 2, liftCalls: 2 }); }
    finally { await sim.dispose(); }
  });
});
