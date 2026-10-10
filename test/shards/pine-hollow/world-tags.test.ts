// oxlint-disable-next-line import/no-nodejs-modules -- Loads the committed native physics binary for actual query/restore identity.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimLevel } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../../src/engine/sim/snapshot';
import { castRay } from '../../../src/engine/physics/query';
import { groups } from '../../../src/engine/physics/groups';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { addPineWorld } from '../../../src/shards/pine-hollow/runtime/headless';
import { parsePineSolid, PINE_GROUND_RES, type PineBake } from '../../../src/shards/pine-hollow/runtime/baked';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level: SimLevel = { ...SIM_LEVEL, entities: [], quests: [], ground: { size: 500, height: -20 } };
const plain = { shape: 1, groups: groups('WORLD'), friction: 0.5, body: null, rot: [0, 0, 0, 1], half: [1, 1, 1] };
const bake: PineBake = { ground: { heights: new Float32Array(PINE_GROUND_RES ** 2), at: { x: 0, y: -20, z: 0 }, scale: { x: 500, y: 1, z: 500 }, groups: groups('WORLD'), friction: 0.5 },
  kingHit: { head: [0, 0, 0], body: [[0, 0, 0], [0, 0, 0]], fore: [[0, 0, 0], [0, 0, 0]], ribs: [0, 0, 0], radius: 1 }, actors: [], parked: [], herds: [], shelterTrees: [],
  solids: [parsePineSolid({ ...plain, at: [10, 2, 10], ownerId: 'piece:door', material: 'stone' }),
    parsePineSolid({ ...plain, at: [15, 2, 10], ownerId: 'piece:door', material: 'metal' }),
    parsePineSolid({ ...plain, at: [20, 2, 10], ownerId: 'declared:door', material: 'rock' }),
    parsePineSolid({ ...plain, at: [25, 2, 10] })] };

it('queries captured materials and shared owner identities on fresh and exactly restored native worlds', () => {
  const original = createSimHost(level, { rapier }), owners = addPineWorld(original, bake);
  let restored: ReturnType<typeof createSimHost> | undefined;
  let restoredOwners: ReturnType<typeof addPineWorld> | undefined;
  const check = (host: ReturnType<typeof createSimHost>, identities: ReturnType<typeof addPineWorld>): void => {
    const hits = [10, 15, 20, 25].map(x => castRay(host.physics, { x, y: 8, z: 10 }, { x: 0, y: -1, z: 0 }, 10));
    expect(hits.map(hit => hit?.material)).toEqual(['stone', 'metal', 'rock', 'wood']);
    expect(hits.map(hit => hit?.point.y)).toEqual([3, 3, 3, 3]);
    expect(hits[0]?.owner).toBe(identities.get('piece:door'));
    expect(hits[1]?.owner).toBe(hits[0]?.owner);
    expect(hits[2]?.owner).toBe('door');
    expect(hits[2]?.owner).not.toBe(hits[0]?.owner);
    expect(hits[3]?.owner).toBeNull();
  };
  try {
    original.step(); check(original, owners);
    const saved = snapshotSimHost(original);
    restored = restoreSimHost(level, { rapier }, saved, host => { restoredOwners = addPineWorld(host, bake); });
    if (restoredOwners === undefined) throw new Error('Missing restored owner identities');
    check(restored, restoredOwners);
    expect(restoredOwners.get('piece:door')).not.toBe(owners.get('piece:door'));
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
  } finally { restored?.dispose(); original.dispose(); }
  expect(owners.size).toBe(0); expect(restoredOwners.size).toBe(0);
});
