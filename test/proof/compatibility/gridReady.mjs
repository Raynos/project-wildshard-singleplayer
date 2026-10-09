// Plain Node grid admission of a native shard through its declared trusted headless entry (SF72 gridReady): the same
// GridAssembly / GridSimulation / ResidencyAllocator path the template's proof runs, with the cell's `load` composing the
// shard's trusted runtime exactly as the headless worker does (`createTrustedHeadlessResident`, @wildshard/sdk/headlessRuntime).
// oxlint-disable-next-line import/no-nodejs-modules -- Native witness assertions must fail the process.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read immutable authored payloads, never a renderer.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete serialized region continuations.
import { createHash } from 'node:crypto';
import template from '../../../src/shards/_template/shard.config.ts';
import catalogue from '../../../src/game/grid/singleplayer.json' with { type: 'json' };
import { createShardfileSim } from '../../../src/game/shardfile/simulation.ts';
import { loadRapier } from '../../../src/engine/physics/rapier.ts';
import { snapshotSimHost } from '../../../src/engine/sim/snapshot.ts';
import { installAppIdentity } from '../../../src/engine/app/identity.ts';
import { WILDSHARD_IDENTITY } from '../../../src/game/identity.ts';
import { GridAssembly } from '../../../src/game/grid/assembly.ts';
import { GridSimulation } from '../../../src/game/grid/simulation.ts';
import { ResidencyAllocator } from '../../../src/game/grid/allocator.ts';
import { createTrustedHeadlessResident } from '../../../src/sdk/headlessRuntime.ts';

/** The Developer grid, where the catalogue places the native shards' cells. */
const DEVELOPER = Object.freeze({ developer: true, devserver: false });
const ROOT = new URL('../../../', import.meta.url);
const bytes = (slug, hash) => new Uint8Array(readFileSync(new URL(`src/shards/${slug}/assets/${hash}`, ROOT)));
/** The active region's own continuation: its clock, bodies and every runtime controller (the traveller's body is the page's, not the region's). */
const regionDigest = (host) => {
  const { tick, entities, adapters } = snapshotSimHost(host);
  return createHash('sha256').update(JSON.stringify({ tick, entities, adapters: adapters.filter(row => !row.id.startsWith('runtime.actor.')) })).digest('hex');
};
/** A frozen region cannot snapshot (its motor is the traveller's); its clock and every body must still stand still. */
const bodies = (host) => JSON.stringify([host.state.tick, ...[...host.entities].map(([id, actor]) => [id, actor.alive, actor.hp, actor.position.x, actor.position.y, actor.position.z])]);

/**
 * Admit `source` (a native shard whose shardfile declares `runtime.entry`) into its catalogue grid cell and walk the
 * template's readiness contract: one sim lease reserved before native physics, readiness false until the runtime fence
 * admits, `checkpoint` refused until durable, a frozen region while away, and the durable continuation restored on re-entry
 * through the same trusted entry. The template's door/script step (natives declare no script door) becomes play on the
 * region's own clock: a hurt creature, or a lent weapon swing where the region has no fauna (Nine Dragon Stack).
 */
export async function proveTrustedGridReady(source, mode = DEVELOPER) {
  assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
  installAppIdentity(WILDSHARD_IDENTITY);
  const slug = source.identity.slug, declared = source.runtime?.entry;
  // The declared trusted entry is the shardfile's `runtime.entry`; its renderer-free sibling is the one the worker and witness load.
  assert.equal(declared, 'runtime/index.ts', 'A native grid cell needs a declared trusted runtime');
  const module = new URL('headless.ts', new URL(`src/shards/${slug}/${declared}`, ROOT)).href;
  const rapier = await loadRapier(readFileSync(new URL('public/assets/physics/rapier.wasm', ROOT)));
  const assets = new Map(source.files.map(file => [file.hash, bytes(slug, file.hash)]));
  const templateAssets = new Map(template.files.map(file => [file.hash, bytes('_template', file.hash)]));
  const assembly = new GridAssembly(mode, catalogue.grid), instance = assembly.cells.find(cell => cell.slug === slug)?.instance;
  assert.equal(typeof instance, 'string', `${slug} has no catalogue grid cell in this mode`);
  const allocator = new ResidencyAllocator();
  const quest = { fact: () => { assert.fail('Readiness proof must not complete a quest'); }, coins: () => { assert.fail('Readiness proof must not grant coins'); } };
  const highway = createShardfileSim(template, templateAssets, { rapier, quest });
  let resident, durable = false, admitted = false, loads = 0, restored = 0, releaseAdmission;
  const admission = new Promise(resolve => { releaseAdmission = resolve; });
  const saved = new Map(); let tape = [];
  const grid = new GridSimulation(assembly, { highway, allocator, residentBytes: () => source.budgets.sim.resident,
    admitted: () => admitted, read: id => saved.get(id), save: (id, snapshot) => { if (!durable) return false; saved.set(id, structuredClone(snapshot)); return true; },
    beforeMove: (current) => { if (current === instance) resident.lend(tape); },
    load: async (cell, snapshot) => {
      await admission;
      assert.equal(cell.slug, slug);
      assert.equal(allocator.has(`sim:${instance}`), true, 'Reserve before creating native physics'); loads++;
      if (snapshot !== undefined) restored++;
      resident = await createTrustedHeadlessResident({ shard: source, assets, rapier }, { module }, snapshot);
      assert.equal(resident.effects.length, 0, 'Admission emits no gameplay');
      return resident;
    },
  });
  try {
    assert.equal(grid.ready(instance), false);
    const pending = grid.prefetch([instance]); assert.equal(grid.ready(instance), false);
    releaseAdmission(); await pending;
    assert.equal(grid.ready(instance), false, 'Collider admission alone cannot satisfy runtime readiness');
    admitted = true; assert.equal(grid.ready(instance), true); assert.equal(loads, 1);
    const enter = await grid.prepare(null, instance); enter.commit();
    assert.equal(grid.host(), resident.host);
    const [actorId, actor] = [...resident.host.entities].find(([, entity]) => entity.alive && entity.hp > 2) ?? [], admittedDigest = regionDigest(resident.host);
    // A region with fauna takes a hurt creature; one without (Nine) takes a lent weapon swing on its runtime's own controller.
    if (actor === undefined) tape = [{ kind: 'player', moveX: 0, moveZ: 0, yaw: resident.host.player.yaw, attack: { targetId: 'grid-ready.swing' } }];
    else actor.applyFinalDamage(1, actor.position, actor.position);
    for (let i = 0; i < 4; i++) grid.step();
    tape = [];
    const hurt = actor?.hp; if (actor !== undefined) assert.ok(hurt < actor.maxHp);
    assert.notEqual(regionDigest(resident.host), admittedDigest, 'The region played');
    assert.equal(grid.checkpoint(instance), false); assert.equal(saved.size, 0);
    durable = true; assert.equal(grid.checkpoint(instance), true);
    const tick = resident.host.state.tick, digest = regionDigest(resident.host), effects = resident.effects.length;
    const leave = await grid.prepare(instance, null); leave.commit();
    const still = bodies(resident.host);
    for (let i = 0; i < 5; i++) grid.step();
    assert.equal(resident.host.state.tick, tick); assert.equal(bodies(resident.host), still, 'A region away from the traveller is frozen');
    assert.equal(grid.unload(instance), true);
    assert.equal(grid.ready(instance), false); assert.equal(allocator.has(`sim:${instance}`), false);
    const again = await grid.prepare(null, instance); again.commit();
    if (actor !== undefined) assert.equal(resident.host.entities.get(actorId)?.hp, hurt);
    assert.equal(resident.host.state.tick, tick); assert.equal(regionDigest(resident.host), digest, 'Re-entry restores the durable continuation');
    assert.equal(loads, 2); assert.equal(restored, 1);
    return { slug, instance, entry: module.slice(ROOT.href.length), native: true, gridReady: true, reserveBeforePhysics: true, runtimeFence: true, refusedSave: true,
      restoredContinuation: true, played: actor === undefined ? 'swing' : 'hurt', ...(actor === undefined ? {} : { restoredHp: hurt }), frozenTicks: 5, loads, effects };
  } finally {
    grid.dispose();
    assert.equal(allocator.entries().length, 0);
  }
}
