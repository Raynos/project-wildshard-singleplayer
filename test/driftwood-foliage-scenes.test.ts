import { fixtureBytes } from './fixtures/nativeBytes';
import { expect, test } from 'vitest';
import { BufferAttribute, type BufferGeometry } from 'three';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { placeCollider, poseOf } from '../src/engine/models/colliders';
import { decodePalmWorld, decodeHibiscusWorld, decodeReefWorld } from '../src/shards/driftwood-isle/generators/foliageGeometry';
import { palmColliders } from '../src/shards/driftwood-isle/generators/foliageModels';
import { withPortableMath } from '../src/commons/bake/portableMath';
import data from '../src/shards/driftwood-isle/data/foliageScenes.generated.json' with { type: 'json' };
import foliage from '../src/shards/driftwood-isle/data/foliagePlacements.generated.json' with { type: 'json' };
import reef from '../src/shards/driftwood-isle/data/reefLayout.generated.json' with { type: 'json' };
import dressingBlobs from '../src/shards/driftwood-isle/data/dressingBlobs.generated.json' with { type: 'json' };
import reefBlobs from '../src/shards/driftwood-isle/data/reefBlobs.generated.json' with { type: 'json' };
import { DRIFTWOOD_ASSET_NAMES, DRIFTWOOD_OUTPUT } from '../src/shards/driftwood-isle/generators/assets';

const project = new URL('../src/shards/driftwood-isle/', import.meta.url);
test('runtime foliage uses the finished GLBs without dangling retired transport aliases', () => {
  const names = new Set(DRIFTWOOD_OUTPUT.blobs.map(row => row.name));
  expect([...names].filter(name => /^world\/(?:palms\/|hibiscus\/|reef\.bin$)/u.test(name))).toEqual([]);
  for (const name of Object.values(DRIFTWOOD_ASSET_NAMES)) expect(names.has(name), name).toBe(true);
  for (const model of data.libraries.flatMap(library => library.models)) {
    const files = typeof model.file === 'string' ? [model.file] : Object.values(model.file);
    for (const file of files) expect(names.has(file) || data.blobs.some(blob => blob.name === file), file).toBe(true);
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

test('finished foliage scene GLBs preserve every native channel, full copy box and bent trunk contact', async () => {
  for (const tier of ['phone', 'desktop'] as const) {
    for (const kind of ['palms', 'hibiscus', 'reef'] as const) {
      if (kind === 'reef' && tier === 'desktop') continue;
      const name = kind === 'reef' ? 'world/reef.bin' : `world/${kind}/${tier}.bin`;
      const source = [...dressingBlobs.blobs, ...reefBlobs.blobs].find(row => row.name === name);
      const blob = data.blobs.find(row => row.name === `models/foliage/${kind}-${tier}.glb`);
      if (source === undefined || blob === undefined) throw new Error('Missing native foliage source');
      const rows = kind === 'reef' ? undefined : kind === 'palms' ? foliage.tiers[tier].palms : foliage.tiers[tier].bushes;
      const decode = kind === 'palms' ? decodePalmWorld : kind === 'hibiscus' ? decodeHibiscusWorld : decodeReefWorld;
      const expected = decode(fixtureBytes(new URL(source.source, project)), rows?.specs.length ?? reef.items.length);
      const intake = createOwnedGeometry(blob.name); await intake.load(fixtureBytes(new URL(blob.source, project)));
      const actual = intake.take();
      try {
        sameGeometry(actual, expected.geometry);
        if (kind !== 'reef') expect(data.placements[tier][kind].drawnInto.boxes).toEqual([...expected.boxes]);
        if (kind === 'palms') {
          const contacts = withPortableMath(() => foliage.tiers[tier].palms.placements.flatMap(pose => palmColliders(pose.params).map(shape => placeCollider(shape, poseOf(pose)))));
          expect(JSON.stringify(data.placements[tier].palms.colliders)).toBe(JSON.stringify(contacts));
        }
      } finally { actual.dispose(); expected.geometry.dispose(); }
    }
  }
});
