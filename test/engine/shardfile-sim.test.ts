// oxlint-disable-next-line import/no-nodejs-modules -- Read the generated in-tree binary; no bundler import outside a clean export.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier } from '../../src/engine/physics/rapier';
import { walkEdgeEntries } from '../../src/engine/physics/edgeEntries';
import { createSimHost } from '../../src/engine/sim';
import { createShardfileSim, numericScriptEntityId, bindShardfileSim } from '../../src/game/shardfile/simulation';
import { emptyShardfile } from '../../src/sdk/author';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { groups } from '../../src/engine/physics/groups';
import { compileScript } from '../../scripts/compile-script.mjs';
import { scriptSource } from '../script/fixture';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import { parseItems } from '../../src/game/shardfile/items';
import { ITEMS } from '../../src/shards/_template/data/items';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

it('borrows the client world/player and executes exactly one systems tick per existing driver tick', () => {
  const owner = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  let run: (() => void) | undefined, removed = 0;
  const borrowed = createSimHost(SIM_LEVEL, { rapier, physics: owner.physics, player: owner.player, events: owner.events, clock: owner.clock, combat: owner.combat, scope: owner.scope,
    fixedStep: (system) => { run = system; return () => { removed++; run = undefined; }; },
  });
  try {
    expect(borrowed.physics).toBe(owner.physics); expect(borrowed.player).toBe(owner.player);
    expect(() => snapshotSimHost(borrowed)).toThrow('world owner');
    expect(() => borrowed.step()).toThrow('driver');
    expect(owner.clock.now).toBe(0); run?.(); expect(borrowed.state.tick).toBe(1); expect(owner.clock.now).toBe(0);
    owner.step(); run?.(); expect(borrowed.state.tick).toBe(2); expect(owner.clock.now).toBeCloseTo(1 / 60);
    const colliders = owner.physics.world.colliders.len(); borrowed.dispose();
    expect(removed).toBe(1); expect(owner.physics.world.colliders.len()).toBeLessThan(colliders);
    expect(owner.player.motor.collider.isValid()).toBe(true); owner.step(); expect(owner.state.tick).toBe(2);
  } finally { borrowed.dispose(); owner.dispose(); }
});

it('walks all actual edge collider entries and rejects a wall hidden under valid flat edge metadata', () => {
  const shard = emptyShardfile({ slug: 'walk-fixture', name: 'Walk', author: 'Fixture', revision: 1, seed: 1 });
  const sim = createShardfileSim(shard, new Map(), { rapier });
  try {
    const walk = walkEdgeEntries(sim.host.physics); expect(walk.lanes).toBe(92); expect(walk.steps).toBeGreaterThanOrEqual(46000); expect(walk.steps).toBeLessThan(55200);
    sim.host.physics.world.createCollider(rapier.ColliderDesc.cuboid(8, 2, 0.5).setTranslation(0, 2, 240).setCollisionGroups(groups('WORLD')));
    sim.host.physics.step(); expect(() => walkEdgeEntries(sim.host.physics)).toThrow('Blocked edge entry north');
  } finally { sim.dispose(); }
});

it('uses stable numeric actor identity and releases borrowed actors when its parent scope closes', () => {
  expect(numericScriptEntityId('boar:1')).toBe(numericScriptEntityId('boar:1'));
  expect(numericScriptEntityId('boar:2')).not.toBe(numericScriptEntityId('boar:1'));
  const owner = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  const borrowed = createSimHost(SIM_LEVEL, { rapier, physics: owner.physics, player: owner.player, events: owner.events, clock: owner.clock, combat: owner.combat, scope: owner.scope });
  borrowed.scope.dispose(); expect(() => borrowed.stepEmbedded()).toThrow('Invalid borrowed');
  expect(owner.player.motor.collider.isValid()).toBe(true); owner.dispose();
});

it('runs item-owned actor fields in the same admitted lane and refuses a forged item owner', async () => {
  const shard = emptyShardfile({ slug: 'script-fixture', name: 'Script', author: 'Fixture', revision: 1, seed: 1 });
  const bytes = await compileScript(scriptSource('store<f64>(24576,6);store<f64>(24584,202);store<f64>(24592,load<f64>(16384+64)+1);', '', '1'));
  const module = 'a'.repeat(64); shard.sim.scripts = [module]; shard.sim.scriptTickDivisor = 1;
  shard.sim.bindings = [{ module, entity: 1002, actorId: 'actor.player', kind: 'entity' }];
  shard.state.player = [{ id: 202, name: 'count', type: 'i32', privacy: 'owner', default: 0, min: 0, max: 100 }];
  const entities = [{ id: 1002, name: 'lantern', position: [0, 0, 0] as const, fields: {}, frozen: false, interactive: true }];
  const ports = { rapier, scriptEntities: { entities, actors: new Map([[1002, 'actor.player']]) } };
  const sim = createShardfileSim(shard, new Map([[module, bytes]]), ports);
  try {
    sim.host.step(); sim.host.step(); expect(sim.lane?.world.view('actor.player').player['count']).toBe(2);
    expect(sim.lane?.host.checkpoint().modules).toHaveLength(1);
    expect(sim.lane?.world.actor(1002)).toBe('actor.player');
    const saved = snapshotSimHost(sim.host);
    const restored = restoreSimHost(sim.host.level, { rapier }, saved, (host) => { bindShardfileSim(host, shard, new Map([[module, bytes]]), { ...ports, restoring: true }); });
    try { sim.host.step(); restored.step(); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host)); } finally { restored.dispose(); }
  } finally { sim.dispose(); }
  expect(() => createShardfileSim(shard, new Map([[module, bytes]]), { rapier, scriptEntities: { entities, actors: new Map([[1002, 'forged.player']]) } })).toThrow('owned-entity actor');
});


it('reconnects declared collider activation after whole-world restore without allocating duplicates', () => {
  const shard = emptyShardfile({ slug: 'props-fixture', name: 'Props', author: 'Fixture', revision: 1, seed: 1 });
  shard.props = { version: 1, family: 'fixture', tiles: [], models: [], panels: [], textures: [], far: null,
    colliders: [{ id: 'door', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 20, y: 2, z: 20, hx: 2, hy: 2, hz: 0.5 }] }] };
  const sim = createShardfileSim(shard, new Map(), { rapier });
  try {
    const port = sim.colliders.get('door'); expect(port).toBeDefined(); port?.setActive(false);
    const saved = snapshotSimHost(sim.host); let rebound: ReturnType<typeof bindShardfileSim> | undefined;
    const restored = restoreSimHost(sim.host.level, { rapier }, saved, (host) => { rebound = bindShardfileSim(host, shard, new Map(), { rapier, restoring: true }); });
    try {
      expect(restored.physics.world.colliders.len()).toBe(sim.host.physics.world.colliders.len());
      expect(rebound?.colliders.get('door')?.active()).toBe(false);
      rebound?.colliders.get('door')?.setActive(true); port?.setActive(true);
      sim.host.step(); restored.step(); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
    } finally { restored.dispose(); }
  } finally { sim.dispose(); }
});

it('admits item hook events independently of the named quest scene table', async () => {
  const shard = emptyShardfile({ slug: 'item-events', name: 'Items', author: 'Fixture', revision: 1, seed: 1 });
  const module = 'a'.repeat(64), bytes = await compileScript(scriptSource('store<f64>(24576,3);store<f64>(24584,101);store<f64>(24592,1001);store<f64>(24600,1);', '', '1'));
  shard.items = parseItems(structuredClone(ITEMS));
  for (const row of shard.items.rows) if (row.hook !== null) row.hook.module = module;
  shard.sim.scripts = [module]; shard.sim.scriptTickDivisor = 1;
  shard.sim.bindings = [{ module, entity: 1001, actorId: 'actor.player', kind: 'entity' }];
  const sim = createShardfileSim(shard, new Map([[module, bytes]]), { rapier });
  try {
    sim.host.step(); const result = sim.lane?.host.call(module, 1001, [sim.host.state.tick]);
    expect(result?.ok).toBe(true); expect(result?.events).toEqual([{ type: 101, target: 1001, value: 1 }]);
  } finally { sim.dispose(); }
});
