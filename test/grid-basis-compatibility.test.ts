// oxlint-disable-next-line import/no-nodejs-modules -- Exercise admitted native template assets and socket geometry.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { fnv1a32 } from '../src/engine/core/rng';
import { SaveStore } from '../src/engine/saves/store';
import { loadRapier } from '../src/engine/physics/rapier';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { installEntrySockets } from '../src/engine/physics/entrySockets';
import { installStripCollider } from '../src/engine/physics/stripColliders';
import { snapshotSimHost, SnapshotBasisMismatchError } from '../src/engine/sim/snapshot';
import { generatePlatform } from '../src/engine/sim/strips';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridRegionDurability } from '../src/game/grid/durability';
import { createShardfileSim } from '../src/game/shardfile/simulation';
import { ClientCheckpointSchema } from '../src/game/shardfile/clientState';
import source from '../src/shards/_template/shard.config';
import { MemoryStorage } from './setup';

const documentSchema = v.looseObject({ keys: v.record(v.string(), v.looseObject({ v: v.number(), data: v.unknown() })) });
const regionSchema = v.strictObject({ revision: v.number(), snapshot: v.string(), logical: v.unknown(), mode: v.literal('exact'), integrity: v.optional(v.number()) });
type Region = v.InferOutput<typeof regionSchema>;
function seal(region: Region): void {
  region.integrity = fnv1a32(JSON.stringify({ revision: region.revision, snapshot: region.snapshot, logical: region.logical, mode: region.mode }));
}

it('recovers a sealed pre-socket checkpoint into fresh socket physics and refuses damaged or unsealed deltas', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
  const placement = { id: 'template-2', shard: source.identity.slug }, local = new MemoryStorage();
  const owner = new GridRegionDurability(new SaveStore({ local, session: null }), placement, source, []);
  const assembly = new GridAssembly({ developer: false, devserver: false });
  const duplicates = generatePlatform(assembly.cells.map((cell) => ({ ...cell, edges: source.edge })), assembly.emptyNeighbour.edge)
    .flatMap((strip) => strip.duplicates.filter((duplicate) => duplicate.instance === placement.id));
  expect(duplicates).toHaveLength(8);
  const make = (durability: GridRegionDurability, sockets: boolean) => {
    const sim = createShardfileSim(source, assets, { rapier, quest: durability.quest, playerBody: false, groundResolution: 257 });
    if (sockets) expect(installEntrySockets(sim.host.physics, sim.host.scope, [{ x: 0, z: 0 }])).toHaveLength(4);
    for (const duplicate of duplicates) installStripCollider(sim.host.physics, duplicate.mesh, sim.host.scope);
    return sim;
  };
  const before = make(owner, false);
  let after: ReturnType<typeof make> | undefined;
  try {
    const oldBasis = before.host.physics.snapshot(), oldColliderCount = before.host.physics.world.colliders.len();
    owner.setPhysicsBasis(oldBasis); owner.bind(before.host, before.colliders);
    before.host.attachPlayerMotor(new CharacterMotor(before.host.physics, { radius: 0.35, height: 1.8, step: 0.3,
      maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD', 'PLAYER', 'CREATURE'], owner: before.host.player.id }));
    before.host.step(); before.host.player.position.set(0, 0, -9); before.host.step();
    const blob = before.host.entities.get('grey-blob:1'); if (blob === undefined) throw new Error('Missing real template blob');
    before.host.combat.hit({ source: before.host.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: blob.combatActor(),
      amount: 1000, point: blob.position, dir: new Vector3(0, 0, 1) }); before.host.step();
    const lane = before.lane, actor = before.actors.get(before.host.player.id);
    if (lane === undefined || actor === undefined) throw new Error('Missing admitted door script owner');
    lane.enqueue({ type: 201, target: actor, value: 1 }); before.host.step();
    expect(before.colliders.get('template.door')?.active()).toBe(false);
    const snapshot = snapshotSimHost(before.host);
    expect(owner.checkpoint(snapshot)).toBe(true); expect(owner.state()?.mode).toBe('exact');
    const key = `wildshard.save.v2.${placement.id}`, original = local.getItem(key); if (original === null) throw new Error('Missing regional save');
    expect(original.length).toBeLessThan(512 * 1024);
    const reopened = new GridRegionDurability(new SaveStore({ local, session: null }), placement, source, []);
    reopened.setPhysicsBasis(oldBasis); expect(reopened.read()).toEqual(snapshot);
    after = make(reopened, true); expect(after.host.physics.world.colliders.len()).toBe(oldColliderCount + 4);
    const newBasis = after.host.physics.snapshot(); expect(newBasis).not.toEqual(oldBasis);
    reopened.setPhysicsBasis(newBasis); reopened.bind(after.host, after.colliders);
    expect(() => reopened.read()).toThrow(SnapshotBasisMismatchError);
    expect(reopened.read(true)).toBeUndefined(); expect(local.getItem(key)).toBe(original);
    expect(reopened.restoreLogical(after)).toBe(true);
    after.host.attachPlayerMotor(new CharacterMotor(after.host.physics, { radius: 0.35, height: 1.8, step: 0.3,
      maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD', 'PLAYER', 'CREATURE'], owner: after.host.player.id }));
    expect(after.host.flags.has('template.complete')).toBe(true); expect(after.host.entities.get('grey-blob:1')?.alive).toBe(false);
    expect(after.colliders.get('template.door')?.active()).toBe(false);
    for (let tick = 0; tick < 120; tick++) after.host.step();
    expect(after.host.flags.has('template.complete')).toBe(true); expect(after.host.entities.get('grey-blob:1')?.alive).toBe(false);
    expect(after.colliders.get('template.door')?.active()).toBe(false);
    expect(reopened.wallet.coins()).toBe(5); expect(Object.values(reopened.ledger.state().facts)).toHaveLength(1);
    expect(Object.values(reopened.ledger.state().achievements)[0]?.count).toBe(1); expect(local.getItem(key)).toBe(original);

    const mutate = (change: (region: Region) => void, reseal: boolean) => {
      const document = v.parse(documentSchema, JSON.parse(original)), slot = document.keys['platform.region'];
      if (slot === undefined) throw new Error('Missing continuation slot');
      const region = v.parse(regionSchema, slot.data); change(region); if (reseal) seal(region);
      slot.data = region; local.setItem(key, JSON.stringify(document));
      return new GridRegionDurability(new SaveStore({ local, session: null }), placement, source, []);
    };
    let invalid = mutate((region) => { delete region.integrity; }, false);
    invalid.setPhysicsBasis(oldBasis); expect(invalid.read()).toEqual(snapshot);
    invalid.setPhysicsBasis(newBasis); expect(() => invalid.read(true)).toThrow(SnapshotBasisMismatchError);
    invalid = mutate((region) => { region.snapshot += ' '; }, false);
    invalid.setPhysicsBasis(newBasis); expect(() => invalid.read(true)).toThrow('integrity mismatch');
    invalid = mutate((region) => { region.snapshot = region.snapshot.replace('"apiVersion":', '"unknownVersion":'); }, true);
    invalid.setPhysicsBasis(newBasis); expect(() => invalid.read(true)).toThrow();
    invalid = mutate((region) => { region.snapshot = region.snapshot.replace(/"apiVersion":\d+/u, '"apiVersion":999'); }, true);
    invalid.setPhysicsBasis(newBasis); expect(() => invalid.read(true)).toThrow('Incompatible simulation engine');
    invalid = mutate((region) => { const logical = v.parse(ClientCheckpointSchema, region.logical); region.logical = { ...logical, tick: logical.tick + 1 }; }, true);
    invalid.setPhysicsBasis(newBasis); expect(() => invalid.read(true)).toThrow(SnapshotBasisMismatchError);
    invalid = mutate((region) => { region.logical = null; }, true);
    invalid.setPhysicsBasis(newBasis); expect(() => invalid.read(true)).toThrow(SnapshotBasisMismatchError);
    invalid = mutate((region) => { region.snapshot = region.snapshot.replace(/"chunks":\["[^"]+"/u, '"chunks":["%%%%"'); }, true);
    invalid.setPhysicsBasis(newBasis); expect(() => invalid.read(true)).toThrow('base64');
    invalid = mutate((region) => { region.snapshot = region.snapshot.replace(/"checksum":\d+/u, '"checksum":0'); }, true);
    invalid.setPhysicsBasis(oldBasis); expect(() => invalid.read(true)).toThrow('checksum mismatch');
    local.setItem(key, original);
    invalid = new GridRegionDurability(new SaveStore({ local, session: null }), placement, source, []);
    expect(() => invalid.read(true)).toThrow('basis mismatch');
    const sibling = new GridRegionDurability(new SaveStore({ local, session: null }), { id: 'template-3', shard: source.identity.slug }, source, []);
    expect(sibling.read(true)).toBeUndefined(); expect(sibling.wallet.coins()).toBe(0);
  } finally { after?.dispose(); before.dispose(); }
}, 60_000); // One shared eight-strip template build, two native bases and 120 logical ticks; preserve all corruption checks under shared CI contention.
