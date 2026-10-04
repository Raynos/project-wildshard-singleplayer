// oxlint-disable-next-line import/no-nodejs-modules -- Native acceptance witness refuses browser globals.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read committed immutable source payloads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the canonical local state, not global placement.
import { createHash } from 'node:crypto';
import source from '../../../src/shards/_template/shard.config.ts';
import { createShardfileSim, bindShardfileSim } from '../../../src/game/shardfile/simulation.ts';
import { loadRapier } from '../../../src/engine/physics/rapier.ts';
import { createSimHost } from '../../../src/engine/sim.ts';
import { restoreSimHost } from '../../../src/engine/sim/snapshot.ts';
import { generateStrip } from '../../../src/engine/sim/strips.ts';
import { installStripCollider } from '../../../src/engine/physics/stripColliders.ts';
import { GridAssembly } from '../../../src/game/grid/assembly.ts';
import { GridSimulation } from '../../../src/game/grid/simulation.ts';
import { regionalState } from '../../../src/game/grid/state.ts';

assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const assets = new Map(source.files.map((file) => [file.hash, readFileSync(new URL(`../../../src/shards/_template/assets/${file.hash}`, import.meta.url))]));
const assembly = new GridAssembly({ developer: false, devserver: false });
const quest = { fact: () => { throw new Error('A frozen quest emitted a fact'); }, coins: () => { throw new Error('A frozen quest granted coins'); } };
const template = () => createShardfileSim(source, assets, { rapier, quest });
const a = template(), b = template();
const seam = generateStrip({ id: 'east', axis: 'x', origin: { x: 277.5, z: 0 }, profiles: [source.edge.east, assembly.emptyNeighbour.edge], adjacent: [{ instance: 'zero', origin: { x: 0, z: 0 } }, { instance: 'one', origin: { x: 555, z: 0 } }] });
let hash;
try {
  installStripCollider(a.host.physics, seam.duplicates[0].mesh, a.host.scope); installStripCollider(b.host.physics, seam.duplicates[1].mesh, b.host.scope);
  assert.equal(regionalState(a.host), regionalState(b.host)); hash = createHash('sha256').update(regionalState(a.host)).digest('hex');
} finally { a.dispose(); b.dispose(); }
const highway = createSimHost({ version: 1, id: 'platform', seed: 1, ground: { size: 2000, height: 0 }, player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [], weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } }, { rapier });
const saved = new Map(), residents = new Map();
const sim = new GridSimulation(assembly, { highway: { host: highway, dispose: () => highway.dispose() }, save: (id, snapshot) => { saved.set(id, structuredClone(snapshot)); return true; }, load: async (cell, snapshot) => {
  let value = template();
  if (snapshot !== undefined) {
    const level = value.host.level; value.dispose();
    const restored = restoreSimHost(level, { rapier }, snapshot, (host) => { value = bindShardfileSim(host, source, assets, { rapier, quest, restoring: true }); });
    assert.equal(value.host, restored);
  }
  residents.set(cell.instance, value); return value;
} });
try {
  const id = assembly.cells[0].instance;
  const enter = await sim.prepare(null, id); enter.commit();
  const value = residents.get(id), actor = value.host.entities.get('grey-blob:1');
  actor.applyFinalDamage(5, value.host.player.position, value.host.player.position);
  value.colliders.get('template.door').setActive(false);
  value.host.flags.set('grid.visited');
  assert.equal(sim.checkpoint(id), true); const hp = actor.hp;
  const leave = await sim.prepare(id, null); leave.commit();
  const frozenTick = value.host.state.tick; for (let i = 0; i < 600; i++) sim.step();
  assert.equal(value.host.state.tick, frozenTick); assert.equal(sim.unload(id), true);
  const again = await sim.prepare(null, id); again.commit();
  assert.equal(residents.get(id).host.entities.get('grey-blob:1').hp, hp);
  assert.equal(residents.get(id).colliders.get('template.door').active(), false);
  assert.equal(residents.get(id).host.flags.has('grid.visited'), true);
  console.info(JSON.stringify({ native: true, templatePlacementHash: hash, frozenTicks: 600, openedDoor: true, hurtCreature: hp, restored: true }));
} finally { sim.dispose(); }
