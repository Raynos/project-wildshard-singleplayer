// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the real persistent author cache.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Explicit roots bind only the committed original terrain input.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nalatiRenderTileProgram } from '../src/shards/nalati-grasslands/generators/renderTileProgram';
import originals from './fixtures/nalati-render-source-files.json' with { type: 'json' };
import { EXACT_RENDER_METADATA, i3Predecessor } from './fixtures/nalati-render-i3';

test('the owned render cache preserves all original cold bytes and isolated persistent hits', async () => {
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
  // iPhone downloads I3: the program publishes the I3 render tiles; through the predecessor layer (nalati-render-i3.ts, whose
  // geometry nalati-render-source.test.ts qualifies) every original pin maps to its file: a compacted L0 tile under its
  // own hash, the pre-I3 metadata for the shipped one, every other file byte for byte
  const check = (files: ReadonlyMap<string, Uint8Array>) => {
    const metadata = files.get('data/renderTiles.json');
    if (metadata === undefined) throw new Error('Missing render metadata');
    const { renamed } = i3Predecessor(EXACT_RENDER_METADATA, metadata), path = (pin: string): string => {
      const next = renamed.get(pin.slice('assets/'.length)); return next === undefined ? pin : `assets/${next}`;
    };
    expect([...files.keys()].sort((a, b) => a.localeCompare(b)))
      .toEqual(originals.map(row => path(row.path)).sort((a, b) => a.localeCompare(b)));
    for (const pin of originals) {
      const bytes = files.get(path(pin.path));
      if (bytes === undefined) throw new Error(`Missing original render source ${pin.path}`);
      if (pin.path === 'data/renderTiles.json') { expect(hashImmutableBytes(EXACT_RENDER_METADATA)).toBe(pin.sha256); continue; }
      if (path(pin.path) !== pin.path) { expect(hashImmutableBytes(bytes), pin.path).toBe(path(pin.path).slice('assets/'.length)); continue; }
      expect(bytes.byteLength, pin.path).toBe(pin.bytes);
      expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
    }
  };
  try {
    const cold = await nalatiRenderTileProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    const hit = await nalatiRenderTileProgram(context()); check(hit);
    for (const [name, bytes] of hit) expect(bytes === cold.get(name)).toBe(false);
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
  for (const file of originals) expect(existsSync(resolve('src/shards/nalati-grasslands', file.path)), file.path).toBe(false);
});
