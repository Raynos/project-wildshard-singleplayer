// oxlint-disable-next-line import/no-nodejs-modules -- Compare authored and generated GLB bytes without a browser fetch.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify static shape bytes against their map-input hashes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete geometry byte ranges without per-byte matcher overhead.
import { Buffer } from 'node:buffer';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { Matrix4, type BufferGeometry } from 'three';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { placedGeometryCollider } from '../src/engine/models/colliders';
import { bakeCragSceneSources, caveShellRows } from '../src/shards/pine-hollow/generators/bake-crag-scenes.mjs';
import layout from '../src/shards/pine-hollow/data/layout.generated.json';

const root = new URL('../', import.meta.url);
const bytes = (array: ArrayBufferView): Uint8Array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
function sameGeometry(actual: BufferGeometry, expected: BufferGeometry): void {
  expect(Object.keys(actual.attributes).sort()).toEqual(Object.keys(expected.attributes).sort());
  for (const name of Object.keys(expected.attributes)) {
    const a = actual.getAttribute(name), b = expected.getAttribute(name);
    expect([a.itemSize, a.normalized, a.array.constructor.name], name).toEqual([b.itemSize, b.normalized, b.array.constructor.name]);
    expect(Buffer.compare(bytes(a.array), bytes(b.array)), name).toBe(0);
  }
  const a = actual.getIndex(), b = expected.getIndex();
  expect(a === null).toBe(b === null);
  expect(a?.array.constructor.name).toBe(b?.array.constructor.name);
  if (a !== null && b !== null) expect(Buffer.compare(bytes(a.array), bytes(b.array))).toBe(0);
}

test('all generated kit and both skin tiers round-trip without channel or index changes', async () => {
  const sources = await bakeCragSceneSources();
  try {
    expect(sources.size).toBeGreaterThan(100);
    for (const [id, geometry] of sources) {
      const file = new URL(`src/shards/pine-hollow/assets/crag-scenes/${id}.glb`, root), intake = createOwnedGeometry(file.href);
      await intake.load(readFileSync(file));
      const restored = intake.take();
      try { sameGeometry(restored, geometry); } finally { restored.dispose(); }
    }
    const cave = sources.get('cave-col') ?? sources.get('cave'); if (cave === undefined) throw new Error('Missing cave');
    const frame = new Matrix4().makeRotationY(layout.BEAR_CAVE.rot).setPosition(layout.BEAR_CAVE.x, 0, layout.BEAR_CAVE.z);
    const native = placedGeometryCollider({ kind: 'trimesh', geometry: cave }, frame, 'rock');
    expect(native.kind).toBe('trimesh');
    if (native.kind !== 'trimesh') throw new Error('Expected cave triangles');
    expect(caveShellRows(sources)).toEqual({ ...native, vertices: Array.from(native.vertices), indices: Array.from(native.indices) });
  } finally { for (const geometry of sources.values()) geometry.dispose(); }
});

const shapeManifest = v.object({ blobs: v.array(v.object({ source: v.string() })),
  geometryHashes: v.record(v.string(), v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u))) });
test('every emitted static scene shape participates in its map-input facts', () => {
  for (const id of ['cragScenes', 'heroScenes', 'propScenes']) {
    const data = v.parse(shapeManifest, JSON.parse(readFileSync(new URL(`src/shards/pine-hollow/data/${id}.generated.json`, root), 'utf8')));
    expect(Object.keys(data.geometryHashes)).toHaveLength(data.blobs.length);
    for (const blob of data.blobs) {
      const file = new URL(`src/shards/pine-hollow/${blob.source}`, root);
      expect(data.geometryHashes[blob.source], blob.source).toBe(createHash('sha256').update(readFileSync(file)).digest('hex'));
    }
  }
});
