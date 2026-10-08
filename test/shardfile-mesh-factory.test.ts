import { beforeAll, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Load the same committed native physics bytes as the shipped client.
import { readFile } from 'node:fs/promises';
import { emptyShardfile } from '../src/sdk/author';
import { bakeWorldCollision } from '../src/sdk/bake/worldCollision';
import type { WorldPrimitive } from '../src/sdk/bake/world';
import { hashImmutableBytes as hash } from '../src/sdk/immutable';
import { assetCost } from '../src/game/shardfile/assets';
import { createShardfileSim, bindShardfileSim, numericScriptEntityId, type ShardfileSimulation } from '../src/game/shardfile/simulation';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { createSimHost } from '../src/engine/sim';
import { floorBelow } from '../src/engine/physics/query';
import { loadRapier } from '../src/engine/physics/rapier';
import { TEMPLATE_ROWS } from '../src/shards/_template/data/rows';
import { compileScript } from '../scripts/compile-script.mjs';
import { scriptSource } from './script/fixture';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
function rectangle(x0: number, x1: number, z0: number, z1: number, y = 0): WorldPrimitive {
  return { node: 'ground', objectId: null, material: 0, terrain: false, positions: Float64Array.of(x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z1),
    indices: Uint32Array.of(0, 2, 1, 1, 2, 3), normals: null, colours: null, uv: null, tangents: null };
}
function fixture(actors = false) {
  const source = emptyShardfile({ slug: 'mesh-runtime', name: 'Mesh runtime', author: 'Fixture', revision: 1, seed: 435 });
  const bake = bakeWorldCollision({ collision: [rectangle(-250, 10, -250, 250), rectangle(30, 250, -250, 250),
    rectangle(10, 30, -250, -10), rectangle(10, 30, 10, 250), rectangle(10, 30, -10, 10, -2), rectangle(10, 30, -10, 10, 4)],
  panels: [{ id: 'door', colliderId: 'door.collider', node: 'Door', transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], primitives: [rectangle(40, 42, 5, 7, 2)] }] });
  source.meshCollision = { version: 1, tiles: bake.tiles.map(({ x, z, file }) => ({ x, z, file })),
    panels: bake.panels.map(row => ({ id: row.colliderId, panel: row.id, file: row.file, initialActive: false })) };
  for (const [file, bytes] of bake.assets) { source.files.push({ hash: file, kind: 'binary', compressed: bytes.length, ...assetCost('binary', bytes), dependencies: [], critical: true }); source.critical.push(file); }
  // Render identity is independent of the native panel chunk; this factory fixture never installs a view.
  source.props = { version: 1, family: 'pbr', tiles: [], panels: [{ id: 'door', file: 'a'.repeat(64), visible: true }], models: [], far: null, textures: [],
    colliders: [{ id: 'crate', panel: null, initialActive: true, shapes: [{ kind: 'box', x: -20, y: 1, z: -20, hx: 1, hy: 1, hz: 1 }] }] };
  if (actors) {
    source.rows.species = TEMPLATE_ROWS.species;
    source.creatures.spawns = [-2, 4].map((y, index) => ({ id: `blob.${index}`, species: 'grey-blob', variant: 'grey', brain: null, strike: null, seed: index, scale: 1, at: [20, y, 0], yaw: 0 }));
  }
  return { source, assets: bake.assets };
}
it('installs real stacked ground without an analytic floor, and creatures remain on their own authored layer', () => {
  const { source, assets } = fixture(true), sim = createShardfileSim(source, assets, { rapier });
  try {
    expect(sim.host.physics.world.colliders.len()).toBe(sim.colliders.size + 3); // one player and two creature capsules
    expect(floorBelow(sim.host.physics, 20, 0, 1, 20)).toBeCloseTo(-2);
    expect(floorBelow(sim.host.physics, 20, 0, 6, 20)).toBeCloseTo(4);
    for (let tick = 0; tick < 120; tick++) sim.host.step();
    expect(sim.host.entities.get('blob.0')?.position.y).toBeCloseTo(-2);
    expect(sim.host.entities.get('blob.1')?.position.y).toBeCloseTo(4);
    expect(sim.colliders.get('door.collider')?.active()).toBe(false);
    sim.colliders.get('door.collider')?.setActive(true); sim.host.physics.step();
    expect(floorBelow(sim.host.physics, 41, 6, 3, 10)).toBeCloseTo(2);
  } finally { sim.dispose(); }
});
it('restores one combined prop/mesh collider map without duplicate allocation and replays a 1000-tick suffix exactly', () => {
  const { source, assets } = fixture(true), sim = createShardfileSim(source, assets, { rapier });
  let rebound: ShardfileSimulation | undefined;
  let fresh: ReturnType<typeof restoreSimHost> | undefined;
  try {
    sim.colliders.get('door.collider')?.setActive(true); sim.colliders.get('crate')?.setActive(false);
    for (let tick = 0; tick < 100; tick++) sim.host.step();
    const saved = snapshotSimHost(sim.host);
    fresh = restoreSimHost(sim.host.level, { rapier }, saved, host => { rebound = bindShardfileSim(host, source, assets, { rapier, restoring: true }); });
    expect(fresh.physics.world.colliders.len()).toBe(sim.host.physics.world.colliders.len());
    expect(rebound?.colliders.get('door.collider')?.active()).toBe(true); expect(rebound?.colliders.get('crate')?.active()).toBe(false);
    expect(snapshotSimHost(fresh)).toEqual(saved);
    for (let tick = 0; tick < 1000; tick++) { sim.host.step(); fresh.step(); }
    expect(snapshotSimHost(fresh)).toEqual(snapshotSimHost(sim.host));
  } finally { sim.dispose(); fresh?.dispose(); }
});
it('borrows the normal client physics/player, installs only scoped mesh content, and steps once per existing driver tick', () => {
  const { source, assets } = fixture(), owner = createSimHost({ version: 1, id: 'owner', seed: 1, ground: { size: 500, height: 0 }, player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 3 }, entities: [],
    weapon: { id: 'none', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.1, cooldown: 1, range: 1, damage: 0, tags: [] }, quests: [] }, { rapier, ground: false });
  let run: (() => void) | undefined;
  const sim = createShardfileSim(source, assets, { rapier, physics: owner.physics, player: owner.player, clock: owner.clock, events: owner.events, combat: owner.combat, scope: owner.scope,
    fixedStep: next => { run = next; return () => { run = undefined; }; } });
  try {
    expect(sim.host.player).toBe(owner.player); expect(sim.host.physics).toBe(owner.physics);
    const time = owner.clock.now; run?.(); expect(sim.host.state.tick).toBe(1); expect(owner.clock.now).toBe(time);
    expect(owner.physics.world.colliders.len()).toBe(sim.colliders.size + 1);
    sim.dispose(); expect(run).toBeUndefined(); expect(owner.physics.world.colliders.len()).toBe(1); expect(owner.player.motor.collider.isValid()).toBe(true);
    owner.step(); expect(owner.state.tick).toBe(1);
  } finally { sim.dispose(); owner.dispose(); }
});
it('the existing single script lane publishes door state and toggles its mesh collider after the same tick', async () => {
  const { source, assets } = fixture();
  const bytes = await compileScript(scriptSource('store<f64>(24576,5);store<f64>(24584,101);store<f64>(24592,1);', '', '1'), { maximumPages: 2 });
  const module = hash(bytes); assets.set(module, bytes); source.sim.scripts = [module]; source.sim.scriptTickDivisor = 1;
  source.sim.bindings = [{ module, entity: numericScriptEntityId('actor.player'), actorId: 'actor.player', kind: 'server' }];
  source.state.shared = [{ id: 101, name: 'door.open', type: 'bool', privacy: 'public', default: false }];
  source.targets.panels = [{ panel: 'door', scope: 'shared', fieldId: 101, equals: 1, visibleWhenMatched: false, colliders: ['door.collider'], activeWhenMatched: false }];
  const sim = createShardfileSim(source, assets, { rapier });
  try {
    expect(sim.colliders.get('door.collider')?.active()).toBe(true);
    sim.host.step(); expect(sim.lane?.world.view('actor.player').shared['door.open']).toBe(1);
    expect(sim.colliders.get('door.collider')?.active()).toBe(false); expect(sim.lane?.host.checkpoint().modules).toHaveLength(1);
  } finally { sim.dispose(); }
});
it('refuses a malformed late chunk before native allocation in an existing borrowed world', () => {
  const { source, assets } = fixture(), file = source.meshCollision?.panels[0]?.file;
  if (file === undefined) throw new Error('Missing panel fixture'); assets.set(file, new Uint8Array(24));
  const owner = createShardfileSim(emptyShardfile({ slug: 'borrow-owner', name: 'Owner', author: 'Fixture', revision: 1, seed: 1 }), new Map(), { rapier });
  try {
    const count = owner.host.physics.world.colliders.len();
    expect(() => createShardfileSim(source, assets, { rapier, physics: owner.host.physics, player: owner.host.player, clock: owner.host.clock, events: owner.host.events, combat: owner.host.combat, scope: owner.host.scope })).toThrow('Mesh collision');
    expect(owner.host.physics.world.colliders.len()).toBe(count); expect(owner.host.player.motor.collider.isValid()).toBe(true);
  } finally { owner.dispose(); }
});
