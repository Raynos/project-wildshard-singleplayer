import { FIXED_MODEL_NAMES } from '../src/shards/driftwood-isle/generators/modelFiles';
import * as v from 'valibot';
import { WorldScenePlacementSchema } from '../src/format/worldScenePlacement';
import { expect, test } from 'vitest';
import { BufferAttribute, type BufferGeometry } from 'three';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { placeCollider, poseOf } from '../src/engine/models/colliders';
import { driftwoodFoliageScenes, foliageSceneGlbs, FOLIAGE_SCENE_FILES, PHONE_ERROR } from '../src/shards/driftwood-isle/generators/foliageScenesBank';
import { decodePalmWorld, decodeHibiscusWorld, decodeReefWorld } from '../src/shards/driftwood-isle/generators/foliageGeometry';
import { palm, palmColliders } from '../src/shards/driftwood-isle/generators/foliageModels';
import { compactChannels } from '../src/shards/driftwood-isle/generators/compactChannels';
import { decimateFlatBatch } from '../src/shards/driftwood-isle/generators/phoneDecimate';

import { withPortableMath } from '../src/commons/bake/portableMath';
import { islandFoliageBatches, islandFoliagePlacements } from '../src/shards/driftwood-isle/generators/islandDressing';
import { driftwoodReefBank } from '../src/shards/driftwood-isle/generators/reefBank';
import { DRIFTWOOD_ASSET_NAMES, DRIFTWOOD_BANK_BLOBS, DRIFTWOOD_OUTPUT } from '../src/shards/driftwood-isle/generators/assets';

const foliage = islandFoliagePlacements();

const reefBank = driftwoodReefBank(), reef = reefBank.layout;

const finite=v.pipe(v.number(),v.finite());
const placement=v.strictObject({...WorldScenePlacementSchema.entries,
  drawnInto:v.object({part:v.string(),boxes:v.array(finite)}),colliders:v.array(v.unknown())});
const foliageTier=v.object({palms:placement,hibiscus:placement});
const data=(()=>{
  const value:unknown=driftwoodFoliageScenes();
  v.assert(v.object({libraries:v.array(v.object({models:v.array(v.object({file:v.union([v.string(),v.record(v.string(),v.string())])}))})),
    placements:v.object({phone:foliageTier,desktop:foliageTier})}),value);return value;
})();

test('runtime foliage uses the finished GLBs without dangling retired transport aliases', () => {
  // the cover bank's transports and cells ship from the scene banks' output (sceneBanks.ts), not DRIFTWOOD_OUTPUT
  const cover = ['phone', 'desktop'].flatMap(tier => [`world/cover/${tier}.bin`, `world/cover/cells/${tier}.bin`]);
  const names = new Set([...DRIFTWOOD_OUTPUT.blobs.map(row => row.name), ...DRIFTWOOD_BANK_BLOBS.map(row => row.name), ...Object.values(FIXED_MODEL_NAMES), ...cover]);
  expect([...names].filter(name => /^world\/(?:palms\/|hibiscus\/|reef\.bin$)/u.test(name))).toEqual([]);
  for (const name of Object.values(DRIFTWOOD_ASSET_NAMES)) expect(names.has(name), name).toBe(true);
  for (const model of data.libraries.flatMap(library => library.models)) {
    const files = typeof model.file === 'string' ? [model.file] : Object.values(model.file);
    for (const file of files) expect(names.has(file) || FOLIAGE_SCENE_FILES.includes(file), file).toBe(true);
  }
});
function sameGeometry(actual: BufferGeometry, expected: BufferGeometry): void {
  expect(Object.keys(actual.attributes).sort()).toEqual(Object.keys(expected.attributes).sort());
  for (const name of Object.keys(expected.attributes)) {
    const a = actual.getAttribute(name), b = expected.getAttribute(name);
    if (!(a instanceof BufferAttribute) || !(b instanceof BufferAttribute)) throw new Error('Expected native foliage channel');
    expect([a.itemSize, a.normalized, a.array.constructor.name]).toEqual([b.itemSize, b.normalized, b.array.constructor.name]);
    const left = new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength), right = new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength);
    expect(left.length === right.length && left.every((value, i) => value === right[i]), name).toBe(true);
    expect(a.array.buffer).not.toBe(b.array.buffer);
  }
  expect(actual.index).toEqual(expected.index);
}

test('finished foliage scene GLBs preserve every (compact) native channel, full copy box and bent trunk contact', async () => {
  const glbs = foliageSceneGlbs();
  for (const tier of ['phone', 'desktop'] as const) {
    for (const kind of ['palms', 'hibiscus', 'reef'] as const) {
      if (kind === 'reef' && tier === 'desktop') continue;
      const name = kind === 'reef' ? 'world/reef.bin' : `world/${kind}/${tier}.bin`;
      const banked = reefBank.blobs.get(name) ?? islandFoliageBatches().blobs.get(name);
      const file = `models/foliage/${kind}-${tier}.glb`, glb = glbs.get(file);
      if (banked === undefined || glb === undefined) throw new Error('Missing native foliage source');
      const rows = kind === 'reef' ? undefined : kind === 'palms' ? foliage.tiers[tier].palms : foliage.tiers[tier].bushes;
      const decode = kind === 'palms' ? decodePalmWorld : kind === 'hibiscus' ? decodeHibiscusWorld : decodeReefWorld;
      const expected = decode(banked.bytes, rows?.specs.length ?? reef.items.length);
      const intake = createOwnedGeometry(file); await intake.load(glb);
      // L18.3c: the bank ships the decode in compact storage (Int8 normals, Uint16 colours); every channel is that exactly
      // L18.3e: the phone's batch is simplified first (phoneDecimate.ts, the bake's own errors); desktop ships the decode
      const actual = intake.take(), compact = compactChannels(tier === 'phone' ? decimateFlatBatch(expected.geometry, PHONE_ERROR[kind]) : expected.geometry.clone());
      try {
        sameGeometry(actual, compact);
        if (kind !== 'reef') expect(data.placements[tier][kind].drawnInto.boxes).toEqual([...expected.boxes]);
        if (kind === 'palms') {
          const contacts = withPortableMath(() => foliage.tiers[tier].palms.placements.flatMap(pose => palmColliders({ ...palm.defaults, ...pose.params }).map(shape => placeCollider(shape, poseOf(pose)))));
          expect(JSON.stringify(data.placements[tier].palms.colliders)).toBe(JSON.stringify(contacts));
        }
      } finally { actual.dispose(); compact.dispose(); expected.geometry.dispose(); }
    }
  }
});
