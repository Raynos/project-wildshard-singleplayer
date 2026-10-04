import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Admission must inspect the immutable template collider, without allocating platform floors.
import { readFileSync } from 'node:fs';
import { emptyShardfile } from '../src/sdk/author';
import { decodeTerrainTile, encodeTerrainTile } from '../src/engine/world/terrainTileData';
import { validateEntrywayTerrain } from '../src/game/shardfile/entryways';
import { contentHash } from '../src/sdk/project';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import template from '../src/shards/_template/shard.config';

const empty = () => emptyShardfile({ slug: 'footprint-test', name: 'Footprint', author: 'Test', seed: 1, revision: 1 });
function collider(heights = new Float32Array(257 ** 2), x = -250, z = -250, size = 500) {
  const bytes = encodeTerrainTile({ resolution: 257, x, z, size, heights }), hash = contentHash(bytes);
  return { source: { entryways: empty().entryways, terrain: { collider: hash } }, assets: new Map([[hash, bytes]]) };
}
it('admits empty implicit ground and the complete flat native heightfield without socket allocation', () => {
  expect(() => validateEntrywayTerrain(empty(), new Map())).not.toThrow();
  const { source, assets } = collider(); expect(() => validateEntrywayTerrain(source, assets)).not.toThrow();
});
it.each([['north', 128, 251], ['east', 251, 128], ['south', 128, 5], ['west', 5, 128]] as const)('refuses a %s interior trench behind a perfectly flat boundary row', (_edge, x, z) => {
  const heights = new Float32Array(257 ** 2); heights[z * 257 + x] = -0.001;
  const { source, assets } = collider(heights); expect(() => validateEntrywayTerrain(source, assets)).toThrow('footprint must be flat');
});
it('checks the full width and fractional 15 m inner edge, including tiny raised triangles', () => {
  for (const [x, z] of [[130, 249], [128, 248]]) {
    if (x === undefined || z === undefined) throw new Error('Missing test coordinate');
    const heights = new Float32Array(257 ** 2); heights[z * 257 + x] = 0.000001;
    const { source, assets } = collider(heights); expect(() => validateEntrywayTerrain(source, assets)).toThrow('footprint must be flat');
  }
});
it('admits an 8 m flat canyon and does not include triangles beyond the inner edge', () => {
  const heights = new Float32Array(257 ** 2);
  for (let z = 0; z < 257; z++) for (let x = 0; x < 257; x++) {
    const px = -250 + x * 500 / 256, pz = -250 + z * 500 / 256;
    if (Math.abs(px) > 6 && Math.abs(pz) > 6) heights[z * 257 + x] = 5;
  }
  // The opposite native triangle lies beyond z=235, so it must not poison the clipped approach.
  heights[247 * 257 + 128] = 2;
  const { source, assets } = collider(heights); expect(() => validateEntrywayTerrain(source, assets)).not.toThrow();
});
it('refuses absent and partial authored ground instead of allowing a socket to bridge it', () => {
  const { source } = collider(); expect(() => validateEntrywayTerrain(source, new Map())).toThrow('Missing entryway terrain');
  const partial = collider(new Float32Array(257 ** 2), -249, -249, 498);
  expect(() => validateEntrywayTerrain(partial.source, partial.assets)).toThrow('missing entryway ground footprint');
});
it('admits actual template bytes and rejects a valid-hash trench before any physics world exists', () => {
  const assets = new Map<string, Uint8Array>(template.files.map((file) => [file.hash, new Uint8Array(readFileSync(`src/shards/_template/assets/${file.hash}`))]));
  expect(() => validateShardfileAssets(template, assets, contentHash)).not.toThrow();
  const source = structuredClone(template); if (source.terrain === null) throw new Error('Missing template terrain');
  const original = source.terrain.collider, bytes = assets.get(original); if (bytes === undefined) throw new Error('Missing template collider');
  const terrain = decodeTerrainTile(bytes); terrain.heights[251 * 257 + 128] = -1;
  const forged = encodeTerrainTile(terrain), hash = contentHash(forged), file = source.files.find((row) => row.hash === original);
  if (file === undefined) throw new Error('Missing template file');
  file.hash = hash; source.terrain.collider = hash; source.critical = source.critical.map((ref) => ref === original ? hash : ref);
  assets.delete(original); assets.set(hash, forged);
  expect(() => validateShardfileAssets(source, assets, contentHash)).toThrow('footprint must be flat');
});
