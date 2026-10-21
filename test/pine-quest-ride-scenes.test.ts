// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the retained source bake to emitted scene bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The authored code-part packet is deflated.
import { inflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact channel equality without comparing every vertex through matchers.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the original Node bake without Vite asset URL rewriting.
import { URL as FileURL } from 'node:url';
import { expect, test } from 'vitest';
import { MeshStandardMaterial, type BufferGeometry } from 'three';
import { GeometryPack, packedRows } from '../src/sdk/kit/geometryPack';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { createWorldScene } from '../src/game/plugin/ui';
import { parseWorldScene } from '../src/format/clientChannels';
import { QUEST_RIDE_BLOBS, QUEST_RIDE_LIBRARY, QUEST_RIDE_MATERIAL, QUEST_RIDE_STEP } from '../src/shards/pine-hollow/generators/questRideScenes';
import packed from '../src/shards/pine-hollow/data/codeParts.json';
import { FIGURE_CATALOGUE } from '../src/shards/pine-hollow/generators/figureCatalogue';

const bytes = (array: ArrayBufferView): Uint8Array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
function sameGeometry(actual: BufferGeometry, expected: BufferGeometry): void {
  expect(Object.keys(actual.attributes).sort()).toEqual(Object.keys(expected.attributes).sort());
  for (const name of Object.keys(expected.attributes)) {
    const a = actual.getAttribute(name), b = expected.getAttribute(name);
    expect([a.itemSize, a.normalized, a.array.constructor.name], name).toEqual([b.itemSize, b.normalized, b.array.constructor.name]);
    expect(Buffer.compare(bytes(a.array), bytes(b.array)), name).toBe(0);
  }
  const a = actual.index, b = expected.index;
  expect(a?.array.constructor.name).toBe(b?.array.constructor.name);
  if (a !== null && b !== null) expect(Buffer.compare(bytes(a.array), bytes(b.array))).toBe(0);
}

test('scene-owned trolley and canoe keep every original vertex, index and draw setting', async () => {
  const pack = new GeometryPack(Uint8Array.from(inflateSync(readFileSync(new FileURL(`../public${packed.url}`, import.meta.url)))), packedRows(packed.rows), 'original quest rides');
  if (QUEST_RIDE_LIBRARY.kind !== 'owned' || QUEST_RIDE_MATERIAL.kind !== 'standard') throw new Error('Quest rides need owned scene rows');
  const surface = FIGURE_CATALOGUE.material;
  if (surface === undefined) throw new Error('Missing original material');
  const geometries = new Map<string, BufferGeometry>(), material = new MeshStandardMaterial(QUEST_RIDE_MATERIAL.properties);
  try {
    for (const row of QUEST_RIDE_LIBRARY.models) {
      const file = row.file;
      if (typeof file !== 'string') throw new Error('Quest ride shape must be identical on both tiers');
      const blob = QUEST_RIDE_BLOBS.find(candidate => candidate.file.name === file);
      if (blob === undefined) throw new Error('Missing emitted quest ride');
      const loaded = createOwnedGeometry(file);
      await loaded.load(blob.bytes);
      const actual = loaded.take(), expected = pack.geometry(row.id === 'trolley' ? packed.parts['zip-trolley'] : packed.parts.canoe);
      geometries.set(row.id, actual);
      try { sameGeometry(actual, expected); } finally { expected.dispose(); }
    }
    expect(material.vertexColors).toBe(true); expect(material.roughness).toBe(surface.roughness);
    expect(material.metalness).toBe(surface.metalness); expect(QUEST_RIDE_MATERIAL.sky).toBe(true);
    const blob = QUEST_RIDE_BLOBS.find(candidate => candidate.file.name === QUEST_RIDE_STEP.scene);
    if (blob === undefined) throw new Error('Missing scene recipe');
    const made = createWorldScene(parseWorldScene(JSON.parse(new TextDecoder().decode(blob.bytes))), { geometry: geometries, materials: new Map([['body', material]]),
      model: () => { throw new Error('Quest rides borrow no model constructors'); }, baked: () => { throw new Error('Quest rides borrow no baked constructors'); } });
    try {
      const trolley = made.mesh('trolley'), canoe = made.mesh('canoe');
      expect(trolley?.name).toBe('zip-trolley'); expect(trolley?.castShadow).toBe(true); expect(trolley?.visible).toBe(true);
      expect(canoe?.name).toBe('canoe-ride'); expect(canoe?.castShadow).toBe(true); expect(canoe?.visible).toBe(false);
    } finally { made.dispose(); }
  } finally { material.dispose(); for (const geometry of geometries.values()) geometry.dispose(); }
});
