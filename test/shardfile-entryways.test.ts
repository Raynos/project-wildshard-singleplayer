import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the shipped critical terrain bytes, not an analytic proxy.
import { readFileSync } from 'node:fs';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '../src/game/shardfile/schema';
import { validateEntrywayTerrain } from '../src/game/shardfile/entryways';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { contentHash } from '@wildshard/sdk/project';
import { decodeTerrainTile, encodeTerrainTile } from '../src/engine/world/terrainTileData';
import template from '../src/shards/_template/shard.config';

const empty = () => emptyShardfile({ slug: 'entry-test', name: 'Entry test', author: 'Test', seed: 1, revision: 1 });
it('authors four 6 m openings at the grid midpoints and road height', () => {
  expect(template.entryways).toEqual(empty().entryways);
  expect(template.entryways.map((row) => [row.edge, row.at])).toEqual([['north', [0, 0, 250]], ['east', [250, 0, 0]], ['south', [0, 0, -250]], ['west', [-250, 0, 0]]]);
});
it('refuses missing, duplicate, extra or non-midpoint openings as an illegal shard', () => {
  const { entryways: _entries, ...missing } = empty(); expect(() => parseShardfile(missing)).toThrow('illegal shard');
  const s = empty(), first = s.entryways[0]; if (!first) throw new Error('Missing entryway');
  s.entryways.pop(); expect(() => parseShardfile(s)).toThrow('illegal shard'); s.entryways.push(first); expect(() => parseShardfile(s)).toThrow('illegal shard');
  const corner = empty(), entry = corner.entryways[0]; if (!entry) throw new Error('Missing entryway'); entry.at[0] = 250; expect(() => parseShardfile(corner)).toThrow('illegal shard');
  const extra = empty(); extra.entryways.push(first); expect(() => parseShardfile(extra)).toThrow('illegal shard');
});
it.each(['north', 'east', 'south', 'west'] as const)('refuses %s road height plus epsilon', (edge) => {
  const s = empty(), entry = s.entryways.find((row) => row.edge === edge); if (!entry) throw new Error('Missing entryway');
  entry.at[1] = Number.EPSILON; expect(() => parseShardfile(s)).toThrow('illegal shard');
});
it('requires the entire opening to reach y0, rather than only its center sample', () => {
  const s = empty(); s.edge.north.heights = Array.from({ length: 129 }, () => 0); s.edge.north.colours = Array.from({ length: 129 }, () => [0.5, 0.5, 0.5]);
  s.edge.north.heights[65] = 1; expect(() => parseShardfile(s)).toThrow('illegal shard');
});
it('validates the template bytes and refuses a valid-hash collider with a forged zero edge row', () => {
  const assets = new Map<string, Uint8Array>(template.files.map((file) => [file.hash, new Uint8Array(readFileSync(`src/shards/_template/assets/${file.hash}`))]));
  expect(validateShardfileAssets(template, assets, contentHash).entryways).toEqual(template.entryways);
  const s = structuredClone(template); if (s.terrain === null) throw new Error('Missing terrain');
  const original = s.terrain.collider, bytes = assets.get(original); if (!bytes) throw new Error('Missing collider');
  const terrain = decodeTerrainTile(bytes); terrain.heights[256 * 257 + 129] = 0.001;
  const forged = encodeTerrainTile(terrain), hash = contentHash(forged), file = s.files.find((row) => row.hash === original); if (!file) throw new Error('Missing collider file');
  file.hash = hash; s.terrain.collider = hash; s.critical = s.critical.map((ref) => ref === original ? hash : ref); assets.delete(original); assets.set(hash, forged);
  expect(() => parseShardfile(s)).not.toThrow();
  expect(() => validateEntrywayTerrain(s, assets)).toThrow('illegal shard');
  expect(() => validateShardfileAssets(s, assets, contentHash)).toThrow('illegal shard');
});
