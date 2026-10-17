import { expect, test } from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the retained native terrain input of the offline baker.
import { readFileSync } from 'node:fs';
import { bakeNalatiWorldRows } from '../src/shards/nalati-grasslands/generators/nalatiWorldRows';
import { hashImmutableBytes } from '../src/sdk/immutable';

const Geometry = v.object({ meshes: v.array(v.object({ primitives: v.array(v.object({ attributes: v.record(v.string(), v.number()) })) })) });

test('bakes repeatable native ground tiles with every painter channel and the unchanged collision witness', () => {
  const native = new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
  const first = bakeNalatiWorldRows(native, [], 'nalati.ground');
  const second = bakeNalatiWorldRows(native, [], 'nalati.ground');
  expect(second.files).toEqual(first.files);
  expect(second.tiles).toEqual(first.tiles);
  const collision = first.assets.get(first.nativeGround.file);
  if (collision === undefined) throw new Error('Missing native collision witness');
  expect(hashImmutableBytes(collision)).toBe(hashImmutableBytes(native));
  expect(first.critical).toContain(first.nativeGround.file);
  expect(new Set(first.tiles.map(tile => `${tile.lod}/${tile.x}/${tile.z}`)).size).toBe(first.tiles.length);
  expect(first.tiles.some(tile => tile.lod === 0)).toBe(true);
  expect(first.tiles.some(tile => tile.lod === 1)).toBe(true);
  for (const row of first.files) {
    const bytes = first.assets.get(row.hash);
    if (bytes === undefined) throw new Error('Missing baked tile payload');
    expect(hashImmutableBytes(bytes)).toBe(row.hash);
    const repeated = second.assets.get(row.hash);
    if (repeated === undefined) throw new Error('Missing repeated tile payload');
    expect(hashImmutableBytes(repeated)).toBe(row.hash);
    if (row.kind !== 'glb') continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const json = new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true)));
    const gltf = v.parse(Geometry, JSON.parse(json));
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
      expect(Object.keys(primitive.attributes)).toEqual(expect.arrayContaining(['POSITION', 'NORMAL', 'COLOR_0', '_SURF', '_RDIR', '_ZONE']));
    }
  }
}, 30_000);
