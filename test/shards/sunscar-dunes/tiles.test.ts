import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the product ships.
import { readdirSync, readFileSync } from 'node:fs';
import { Scope } from '../../../src/engine/app/scope';
import { ClientAssets } from '../../../src/game/shardfile/clientAssets';
import { runtimeBoundWorldFiles, withoutRuntimeRows } from "../../../src/game/plugin/headless";
import { bindRuntimeTerrain } from '../../../src/game/shardfile/runtimeWorld';
import { signalDunesTiles } from '../../../src/shards/sunscar-dunes/generators/tiles';
import tiles from '../../../src/shards/sunscar-dunes/data/tiles.json' with { type: 'json' };
import source from '../../../src/shards/sunscar-dunes/shard.config';

const folder = new URL('../../../src/shards/sunscar-dunes/assets/', import.meta.url);
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const committed = new Map(source.files.map((file) => [file.hash, new Uint8Array(readFileSync(new URL(file.hash, folder)))]));
const options = { base: 'https://shards.test/sunscar-dunes/shard.json', offline: false, firstParty: true,
  fetch: (url: string): Promise<Response> => { const bytes = committed.get(url.split('/').at(-1) ?? ''); return Promise.resolve(bytes === undefined ? new Response(null, { status: 404 }) : new Response(bytes.slice())); },
  hash: (bytes: Uint8Array): Promise<string> => Promise.resolve(sha(bytes)) };

describe('Signal Dunes compiles its dune field into shardfile terrain tiles (SHARD-PLATFORM M3, G227)', () => {
  it('the committed tiles are byte-exact against the generator (the stale gate: rerun scripts/bake-hybrid-tiles.mjs sunscar-dunes)', () => {
    const baked = signalDunesTiles(), { assets, ...metadata } = baked;
    expect(metadata).toEqual(tiles);
    for (const [hash, bytes] of assets) {
      expect(sha(bytes)).toBe(hash);
      expect(sha(committed.get(hash) ?? new Uint8Array())).toBe(hash);
    }
    // the folder holds exactly this bake: no orphan file from an older bake ships in the product
    expect(readdirSync(folder).filter((name) => /^[a-f0-9]{64}$/u.test(name)).sort()).toEqual(source.files.map(file=>file.hash).sort());
    expect([tiles.tiles.length, assets.size, tiles.critical]).toEqual([80, 81, [tiles.terrain.collider]]);
  });

  it('declares the tiles unbound (G345): the data client draws them presentation-only, and the edge rows are the bake\'s', () => {
    expect(source.runtime?.binds).not.toContain('terrain');
    expect(source.terrain?.tiles).toHaveLength(80);
    expect([source.terrain?.shadow, source.terrain?.follow, source.terrain?.order]).toEqual([{ cast: false, receive: false }, 8, -1]);
    expect(source.edge).toEqual(tiles.edge);
    expect(runtimeBoundWorldFiles(source).size).toBe(0);
    expect(withoutRuntimeRows(source).terrain).toBe(source.terrain);
  });

  it('refuses the runtime-bound tile path now the terrain is the data client\'s', async () => {
    const scope = new Scope('unbound');
    try {
      await expect(bindRuntimeTerrain({ scope }, source, { assets: new ClientAssets(source, committed, options), terrain: () => ({ mask: () => undefined, shadow: () => undefined }), x: 0, z: 0 })).rejects.toThrow('not bound by its runtime');
    } finally { scope.dispose(); }
  });
});
