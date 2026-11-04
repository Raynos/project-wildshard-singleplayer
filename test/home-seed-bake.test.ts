import { afterEach, expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Matrix4, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { initializeTier, TIER } from '../src/engine/core/tier';
import { staticGlb } from '../src/sdk/bake/glb';
import { emptyShardfile } from '../src/sdk/author';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { restoreHomeGeometry } from '../src/game/shardfile/homeGeometrySnapshot';
import { homeSeedKey } from '../src/game/shardfile/homeSeed';
import { worldSceneTemplateKey } from '../src/game/shardfile/worldSceneGeometry';
import { bakeOwnedEntry, bakeWholeEntry, ownedSeedIndex } from '../scripts/app-build/homeSeed';

const originalTier = TIER;
afterEach(() => { initializeTier(originalTier); });

function ownedFixture(): { bytes: Uint8Array; positions: Float32Array } {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const source = new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3));
  source.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  source.setAttribute('uv', new BufferAttribute(new Float32Array(6), 2));
  const material = new MeshStandardMaterial(), bytes = staticGlb([{ geometry: source, material, nativeAttributes: true }]);
  source.dispose(); material.dispose();
  return { bytes, positions };
}

test('a recorded owned key finds its row and reuse policy across origins, only at its tier', () => {
  initializeTier('phone');
  const rows = [{ file: 'a.glb' }, { file: 'b.glb', attributes: { _sway: 'aSway' } }];
  const seed = { url: (name: string) => `http://seed.invalid/shardfiles/fx/${name}` }, page = { url: (name: string) => `http://127.0.0.1:4401/shardfiles/fx/${name}` };
  const index = ownedSeedIndex(seed, rows);
  expect(index.size).toBe(4);
  for (const [at, row] of rows.entries()) for (const revisit of [true, false]) {
    const match = index.get(homeSeedKey(`owned:${worldSceneTemplateKey(page, row, revisit)}`));
    expect(match?.row).toBe(rows[at]); expect(match?.revisit).toBe(revisit);
  }
  initializeTier('desktop');
  expect(index.has(homeSeedKey(`owned:${worldSceneTemplateKey(page, { file: 'a.glb' }, true)}`))).toBe(false);
});

test('the owned bake is the runtime read of that file, as one model view', async () => {
  initializeTier('phone');
  const { bytes, positions } = ownedFixture();
  const product = { url: (name: string) => `http://seed.invalid/shardfiles/fx/${name}`, file: () => Promise.resolve(Uint8Array.from(bytes)) };
  const snapshot = await bakeOwnedEntry(product, { file: 'a.glb' }, true);
  if (snapshot === null) throw new Error('Expected an owned snapshot');
  const view = restoreHomeGeometry(snapshot).get('model'); if (view === undefined) throw new Error('Missing model view');
  expect(view.geometry.getAttribute('position').array).toEqual(positions);
  expect(view.matrix.equals(new Matrix4())).toBe(true);
  view.geometry.dispose();
});

test('the whole bake reads exactly the key refs from the built bytes', async () => {
  initializeTier('phone');
  const geometry = new BufferGeometry(), count = 6, positions = Float32Array.from({ length: count * 3 }, (_, i) => i * 0.5 - 3);
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new MeshBasicMaterial(), matrix = new Matrix4().makeTranslation(3.25, -2.5, 8.125);
  const bytes = staticGlb([{ geometry, material, nativeAttributes: true, compactIndex: true, transform: matrix,
    extras: { wholePartition: { id: 'draw', vertices: { runs: [0, count] }, triangles: { runs: [0, count / 3] }, vertexCount: count, indexCount: 0, index: 'none' } } }]);
  const ref = hashImmutableBytes(bytes), source = emptyShardfile({ slug: 'seed-whole', name: 'Seed whole', author: 'Test', revision: 1, seed: 1 });
  source.files.push({ hash: ref, kind: 'glb', compressed: bytes.length, decoded: bytes.length, gpu: positions.byteLength, triangles: count / 3, draws: 1, dependencies: [], critical: false });
  const snapshot = await bakeWholeEntry(source, new Map([[ref, bytes]]), 'http://seed.invalid/shardfiles/seed-whole/', [ref]);
  if (snapshot === null) throw new Error('Expected a whole snapshot');
  const view = restoreHomeGeometry(snapshot).get('draw'); if (view === undefined) throw new Error('Missing whole draw');
  expect(view.geometry.getAttribute('position').array).toEqual(positions);
  expect(view.matrix.elements).toEqual(matrix.elements);
  view.geometry.dispose(); geometry.dispose(); material.dispose();
});
