// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the real persistent author cache.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Explicit roots bind only the committed original terrain input.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare current cold and cache-hit bytes without deep typed-array traversal.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nalatiRenderTileProgram } from '../src/shards/nalati-grasslands/generators/renderTileProgram';
import { FilesSchema, TilesSchema } from '../src/format/shardSections';
import { EXACT_RENDER_METADATA, i3Predecessor } from './fixtures/nalati-render-i3';

const exact = v.parse(v.object({ files: FilesSchema, tiles: TilesSchema }), JSON.parse(new TextDecoder().decode(EXACT_RENDER_METADATA)));
const currentPaths = (renamed: ReadonlyMap<string, string> = new Map()): Set<string> => new Set([
  'data/renderTiles.json',
  ...exact.files.map(file => `assets/${renamed.get(file.hash) ?? file.hash}`),
  ...exact.tiles.filter(tile => tile.lod === 1).map(tile => `assets/world-terrain/ground-l1-${Math.floor(tile.x / 2)}-${tile.z}.generated.glb`),
]);

test('the owned render cache preserves current cold bytes and isolated persistent hits', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-render-owned-'));
  let constructions = 0;
  const context = (declared = true) => {
    const ctx = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'a'.repeat(64), new Map(), cache,
      declared ? [{ prefix: '/assets/baked/nalati-grasslands/', directory: resolve('public/assets/baked/nalati-grasslands') }] : []);
    return { cached: (step: Parameters<typeof ctx.cached>[0], make: Parameters<typeof ctx.cached>[1]) => {
      expect(step.id).toBe('render-tiles'); expect(step.native).toBe(true);
      expect(step.inputs).toEqual(['/assets/baked/nalati-grasslands/terrain.bin']);
      return ctx.cached(step, inputs => { constructions++; return make(inputs); });
    } };
  };
  // I3 is compared with the current exact native construction, never a historical digest.
  // Only compacted L0 hashes/costs may change; all other metadata and file references stay exact.
  const check = (files: ReadonlyMap<string, Uint8Array>) => {
    const metadata = files.get('data/renderTiles.json');
    if (metadata === undefined) throw new Error('Missing render metadata');
    const { renamed } = i3Predecessor(EXACT_RENDER_METADATA, metadata);
    expect(new Set(files.keys())).toEqual(currentPaths(renamed));
    for (const [name, bytes] of files) if (/^assets\/[a-f0-9]{64}$/u.test(name)) {
      expect(hashImmutableBytes(bytes), name).toBe(name.slice('assets/'.length));
    }
  };
  try {
    const cold = await nalatiRenderTileProgram(context()); check(cold);
    const expected = new Map([...cold].map(([name, bytes]) => [name, bytes.slice()]));
    for (const bytes of cold.values()) bytes.fill(0);
    const hit = await nalatiRenderTileProgram(context()); check(hit);
    expect(new Set(hit.keys())).toEqual(new Set(expected.keys()));
    for (const [name, bytes] of hit) {
      expect(bytes === cold.get(name)).toBe(false);
      const saved = expected.get(name);
      if (saved === undefined) throw new Error('Missing current cold render file');
      expect(Buffer.compare(bytes, saved), name).toBe(0);
    }
    expect(constructions).toBe(1);
    const asset = [...hit.keys()].find(name => /^assets\/[a-f0-9]{64}$/u.test(name));
    if (asset === undefined) throw new Error('Missing original render tile asset');
    const corrupted = new Map(hit); corrupted.set(asset, new Uint8Array([0]));
    await expect(nalatiRenderTileProgram({ cached: () => Promise.resolve(corrupted) }))
      .rejects.toThrow('Owned render tile inventory differs');
    await expect(nalatiRenderTileProgram(context(false))).rejects.toThrow('exactly one declared root');
    expect(constructions).toBe(1);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing native input and incomplete cached render publications refuse', async () => {
  await expect(nalatiRenderTileProgram({ cached: (_step, make) => Promise.resolve(make(new Map())) }))
    .rejects.toThrow('Missing native render terrain');
  for (const files of [new Map<string, Uint8Array>(), new Map([['data/renderTiles.json', new Uint8Array([1])]])]) {
    await expect(nalatiRenderTileProgram({ cached: () => Promise.resolve(files) }))
      .rejects.toThrow('Owned render tile inventory differs');
  }
});

test('the scheduler and every original render handoff remain retired', () => {
  for (const path of currentPaths()) expect(existsSync(resolve('src/shards/nalati-grasslands', path)), path).toBe(false);
});
