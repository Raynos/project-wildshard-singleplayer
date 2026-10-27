import * as v from 'valibot';
import { expect, test } from 'vitest';
import { completeL0Tiles, completeEmptyL1Tiles } from '@wildshard/sdk/bake/tileGrid';
import { FilesSchema, TilesSchema } from '@wildshard/format/shardSections';
import { PropsSchema } from '@wildshard/format/props';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the retained producer's actual metadata without importing a generated module.
import { readFileSync } from 'node:fs';
import { skyIsleProps } from '../src/shards/far-reach/generators/isleProps';
import { tileBakeCensus } from '../scripts/tile-bakes.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseGlb } from '../src/sdk/assets';

const documentSchema = v.looseObject({
  materials: v.array(v.looseObject({ name: v.string() })),
  nodes: v.array(v.looseObject({ extras: v.looseObject({ receiveShadow: v.exactOptional(v.boolean()) }) })),
});
/** Undo only the T8 named-material/receiver JSON additions. The complete old
 * GLB hash below still pins every other JSON field and every binary byte. */
function predecessorBytes(bytes: Uint8Array, lod: number): Uint8Array {
  const jsonLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(12, true);
  const doc: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  v.assert(documentSchema, doc);
  for (const material of doc.materials) {
    expect(lod === 0 ? ['isle-paint', 'isle-paint-cut', 'isle-paint-cut-mill'] : ['isle-coarse']).toContain(material.name);
    material.name = '';
  }
  for (const node of doc.nodes) {
    expect(node.extras.receiveShadow).toBe(lod === 0 ? false : undefined);
    delete node.extras.receiveShadow;
  }
  const json = new TextEncoder().encode(JSON.stringify(doc)), padded = Math.ceil(json.length / 4) * 4;
  const restored = new Uint8Array(bytes.length - jsonLength + padded), header = new DataView(restored.buffer);
  restored.set(bytes.subarray(0, 20)); header.setUint32(8, restored.length, true); header.setUint32(12, padded, true);
  restored.fill(32, 20, 20 + padded); restored.set(json, 20);
  // Copy the complete unchanged BIN chunk, including its header and padding.
  restored.set(bytes.subarray(20 + jsonLength), 20 + padded);
  expect(hashImmutableBytes(restored.subarray(28 + padded))).toBe(hashImmutableBytes(bytes.subarray(28 + jsonLength)));
  return restored;
}

test('Sky keeps the complete predecessor lattice and binary payload under explicit surface/receiver metadata', () => {
  // This frozen declaration predates T8 named tile ownership. It remains the
  // independent whole-wire oracle; the product now emits contextual rows.
  const original = v.parse(v.object({ tiles: TilesSchema, props: PropsSchema, files: FilesSchema }),
    JSON.parse(readFileSync('src/shards/far-reach/data/props.json', 'utf8')));
  const baked = skyIsleProps(), tiles = v.parse(TilesSchema, original.tiles);
  const priorFiles = new Map(baked.files.map(file => {
    const bytes = baked.assets.get(file.hash), tile = baked.tiles.find(row => row.files.includes(file.hash));
    if (bytes === undefined || tile === undefined) throw new Error('Missing current tile bytes');
    expect(hashImmutableBytes(bytes)).toBe(file.hash);
    expect({ compressed: bytes.length, ...parseGlb(bytes) }).toEqual({ compressed: file.compressed,
      decoded: file.decoded, gpu: file.gpu, triangles: file.triangles, draws: file.draws });
    const before = predecessorBytes(bytes, tile.lod), cost = parseGlb(before);
    expect([cost.gpu, cost.triangles, cost.draws]).toEqual([file.gpu, file.triangles, file.draws]);
    // Only JSON transport length changes; geometry residency is unchanged.
    expect(file.decoded - cost.decoded).toBe(bytes.length - before.length);
    return [file.hash, { ...file, ...cost, hash: hashImmutableBytes(before), compressed: before.length }] as const;
  }));
  const prior = (hash: string) => {
    const file = priorFiles.get(hash); if (file === undefined) throw new Error('Missing predecessor tile'); return file;
  };
  const occupied = baked.tiles.map(tile => ({ ...tile, files: tile.files.map(hash => prior(hash).hash),
    compressed: tile.files.reduce((sum, hash) => sum + prior(hash).compressed, 0),
    decoded: tile.files.reduce((sum, hash) => sum + prior(hash).decoded, 0) }))
    .sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z);
  expect(tiles).toEqual(completeEmptyL1Tiles(completeL0Tiles(occupied)));
  expect(tiles.filter(row => row.lod === 0)).toHaveLength(64);
  expect(tiles.filter(row => row.files.length > 0)).toEqual(occupied);
  expect(tiles.filter(row => row.lod === 0 && row.files.length === 0)).toHaveLength(42);
  expect(tiles.filter(row => row.lod === 1)).toHaveLength(16);
  const priorProps = structuredClone(baked.props);
  for (const tile of priorProps.tiles) tile.file = prior(tile.file).hash;
  expect(original.props).toEqual(priorProps);
  expect(original.files).toEqual([...priorFiles.values()].sort((a, b) => a.hash.localeCompare(b.hash)));
  for (const tile of tiles.filter(row => row.files.length === 0)) {
    expect([tile.compressed, tile.decoded, tile.gpu, tile.triangles, tile.draws]).toEqual([0, 0, 0, 0, 0]);
  }
  const census = tileBakeCensus(tiles, original.files);
  expect(Object.keys(census.debt).filter(key => key.startsWith('missing/0/'))).toEqual([]);
  expect(census.l1).toBe(16);
  // G748 / U2: every occupied parent draws the isles' coarse copy
  expect(Object.keys(census.debt).filter(key => key.startsWith('missing/1/'))).toHaveLength(0);
});
