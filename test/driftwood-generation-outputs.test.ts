import { expect, test } from 'vitest';
import * as v from 'valibot';
import { driftwoodFixedBank } from './fixtures/driftwood-fixed-bank';
// oxlint-disable-next-line import/no-nodejs-modules -- Admit the defining producer's committed native input bytes.
import { readFileSync } from 'node:fs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import type { ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { DRIFTWOOD_FIXED_INPUTS, driftwoodFixedFiles, driftwoodMapFixedFiles } from '../src/shards/driftwood-isle/generators/fixedProgram';
import { driftwoodMap, DRIFTWOOD_MAP_INPUTS } from '../src/shards/driftwood-isle/generators/mapProgram';


test('the defining Driftwood fixed bank owns every tile, template and named model blob', async () => {
  const files = await driftwoodFixedBank();
  const read = (name: string): unknown => {
    const bytes = files.get(name); if (bytes === undefined) throw new Error(`Missing fixed bank row: ${name}`);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  };
  const tiles = v.parse(v.object({ files: v.array(v.object({ hash: v.string() })) }), read('data/fixedTiles.generated.json'));
  const models = v.parse(v.object({ blobs: v.array(v.object({ source: v.string() })) }), read('data/fixedBlobs.generated.json'));
  for (const file of tiles.files) expect(files.has(`assets/${file.hash}`) || files.has(`owned/coarse/${file.hash}.glb`), file.hash).toBe(true);
  for (const file of models.blobs) expect(files.has(file.source.startsWith('../../..') ? `baked/fixed-models/${file.source.split('/').at(-1)}` : file.source), file.source).toBe(true);
});

function fixedInputBank(): Map<string, Uint8Array> {
  return new Map(DRIFTWOOD_FIXED_INPUTS.map(name => [name, new Uint8Array(readFileSync(`public${name}`))]));
}

test('map reuse retains the complete admitted fixed bank and detached byte ownership', async () => {
  const inputs = fixedInputBank(); let stored: ReadonlyMap<string, Uint8Array> | undefined, builds = 0;
  const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: async (step, generate) => {
    expect(step.native).toBe(true); expect(step.inputs).toEqual(DRIFTWOOD_FIXED_INPUTS);
    if (stored === undefined) { builds++; stored = await generate(inputs); }
    return new Map([...stored].map(([name, bytes]) => [name, new Uint8Array(bytes)]));
  } };
  const fixed = await driftwoodFixedFiles(ctx), reused = await driftwoodMapFixedFiles(ctx, inputs), original = await driftwoodFixedBank();
  expect(builds).toBe(1); expect([...reused.keys()]).toEqual([...fixed.keys()]);
  expect(reused.has('cache/fixed-native-inputs.json')).toBe(false);
  expect([...fixed.keys()]).toEqual([...original.keys()]);
  for (const [name, bytes] of original) {
    const fromFixed = fixed.get(name), fromMap = reused.get(name);
    if (fromFixed === undefined || fromMap === undefined) throw new Error(`Missing original fixed file ${name}`);
    expect(hashImmutableBytes(fromFixed)).toBe(hashImmutableBytes(bytes));
    expect(hashImmutableBytes(fromMap)).toBe(hashImmutableBytes(bytes));
    fromMap.fill(0); expect(hashImmutableBytes(fromFixed)).toBe(hashImmutableBytes(bytes));
  }
  const changed = new Map(inputs), first = DRIFTWOOD_FIXED_INPUTS[0];
  if (first === undefined) throw new Error('Missing native input declaration');
  const body = inputs.get(first); if (body === undefined) throw new Error('Missing native input');
  const different = new Uint8Array(body); different[0] = (different[0] ?? 0) ^ 1; changed.set(first, different);
  await expect(driftwoodMapFixedFiles(ctx, changed)).rejects.toThrow('Driftwood map fixed inputs changed');
  await expect(driftwoodMapFixedFiles(ctx, new Map())).rejects.toThrow('Missing Driftwood fixed input');
  const changing = fixedInputBank();
  await expect(driftwoodMapFixedFiles({ cached: (step, generate) => {
    const bytes = changing.get(first); if (bytes === undefined) throw new Error('Missing changing source');
    bytes.fill(0); return ctx.cached(step, generate);
  } }, changing)).rejects.toThrow('Driftwood map fixed inputs changed');
});

test('incomplete or foreign fixed-bank receipts refuse before reuse', async () => {
  const original = await driftwoodFixedBank(), inputs = fixedInputBank();
  const absent: Pick<ProjectGenerationContext, 'cached'> = { cached: () => Promise.resolve(original) };
  await expect(driftwoodFixedFiles(absent)).rejects.toThrow('Driftwood fixed cache inventory differs');
  const foreign = new Map(original); foreign.set('cache/fixed-native-inputs.json', new TextEncoder().encode('foreign'));
  await expect(driftwoodMapFixedFiles({ cached: () => Promise.resolve(foreign) }, inputs)).rejects.toThrow('Driftwood map fixed inputs changed');
  const incomplete = new Map(foreign); incomplete.delete('data/fixedTiles.generated.json');
  await expect(driftwoodMapFixedFiles({ cached: () => Promise.resolve(incomplete) }, inputs)).rejects.toThrow('Driftwood fixed cache inventory differs');
});

test('a complete map cache hit does not load or reconstruct the fixed bank', async () => {
  const pixels = new Uint8Array(4_000_000); let lookups = 0;
  const result = await driftwoodMap({ cached: step => {
    lookups++; expect(step.id).toBe('world-map'); expect(step.inputs).toEqual(DRIFTWOOD_MAP_INPUTS);
    return Promise.resolve(new Map([['map.rgba', pixels]]));
  } });
  expect(lookups).toBe(1); expect(result).toBe(pixels);
});
