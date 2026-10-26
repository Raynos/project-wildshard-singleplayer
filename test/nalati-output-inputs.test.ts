// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated immutable input cache and compare shipping files.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep cache fixtures inside the repository tmp directory.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { nameBlob, readNamedBlob } from '../src/sdk/blobs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import type { ProjectOutput } from '../src/sdk/projectOutput';
import * as v from 'valibot';
import { output } from './fixtures/nalati-output-original';
import { nalatiOutputInputs } from '../src/shards/nalati-grasslands/generators/outputInputs';
import { originalSpeciesBlob } from './fixtures/nalati-original-species-blob';

test('ordered owned floors and all declared raw inputs preserve exact normal SDK intake on cold and hit', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-output-inputs-'));
  const project = resolve('src/shards/nalati-grasslands'), requested: string[] = [];
  const context = () => {
    const ctx = createProjectGeneration(project, 'b'.repeat(64), new Map(), cache);
    return { cached: (step: Parameters<typeof ctx.cached>[0], generate: Parameters<typeof ctx.cached>[1]) => {
      requested.push(...(step.inputs ?? [])); return ctx.cached(step, generate);
    } };
  };
  try {
    const declarations: NonNullable<ProjectOutput['blobs']>[number][] = [];
    for (const row of output.blobs) declarations.push({ ...row, kind: v.parse(v.picklist(['audio', 'bin', 'glb', 'image', 'json', 'ktx2', 'tile', 'wasm']), row.kind) });
    const floors = [0, 1].map(index => nameBlob(`world/floors/${String(index)}.bin`, 'bin',
      readFileSync(`test/fixtures/nalati-floor-original-${String(index)}.bin`)));
    const originals = await Promise.all(declarations.map(async row => {
      const blob = originalSpeciesBlob(row) ?? await readNamedBlob(project, row.name, row.source, row.kind, row.options);
      return blob;
    }));
    originals.splice(1, 0, ...floors);
    const sources: Parameters<typeof nalatiOutputInputs>[1][number][] = declarations.map(row => originalSpeciesBlob(row) ?? row);
    sources.splice(1, 0, ...floors);
    for (const run of ['cold', 'hit']) {
      const blobs = await nalatiOutputInputs(context(), sources);
      expect(blobs.map(blob => blob.file.name), run).toEqual(originals.map(blob => blob.file.name));
      expect(blobs.length, run).toBe(originals.length);
      for (const [index, blob] of blobs.entries()) {
        const before = originals[index]; if (before === undefined) throw new Error('Missing predecessor input');
        expect(blob.file, before.file.name).toEqual(before.file);
        expect(hashImmutableBytes(blob.bytes), before.file.name).toBe(before.file.hash);
        expect(Buffer.compare(blob.bytes, before.bytes), before.file.name).toBe(0);
        blob.bytes.fill(0);
      }
    }
    expect(requested).not.toContain('data/place-floor-0.generated.bin');
    expect(requested).not.toContain('data/place-floor-1.generated.bin');
    for (const blob of originals) expect(hashImmutableBytes(blob.bytes)).toBe(blob.file.hash);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing, extra, oversized, changed and unsupported source inputs refuse', async () => {
  const row = { name: 'original.bin', kind: 'bin' as const, source: 'data/original.bin' };
  await expect(nalatiOutputInputs({ cached: (_step, generate) => Promise.resolve(generate(new Map())) }, [row])).rejects.toThrow('Missing or oversized');
  await expect(nalatiOutputInputs({ cached: () => Promise.resolve(new Map([['extra.bin', new Uint8Array(1)]])) }, [row])).rejects.toThrow('inventory differs');
  await expect(nalatiOutputInputs({ cached: () => Promise.resolve(new Map([[row.source, new Uint8Array(25_000_001)]])) }, [row])).rejects.toThrow('Missing or oversized');
  const noRead = { cached: () => { throw new Error('Must refuse before file intake'); } };
  for (const source of ['../escape.bin', '/escape.bin', 'data/%2e%2e/escape.bin']) await expect(nalatiOutputInputs(noRead, [{ ...row, source }])).rejects.toThrow('project-contained');
  await expect(nalatiOutputInputs(noRead, [{ ...row, source: 'model.gltf' }])).rejects.toThrow('original raw source');
  await expect(nalatiOutputInputs(noRead, [{ ...row, kind: 'glb', options: { meshopt: true } }])).rejects.toThrow('original raw source');
  await expect(nalatiOutputInputs(noRead, [row, row])).rejects.toThrow('Duplicate or absent');
  const owned = nameBlob('owned.bin', 'bin', new Uint8Array([1, 2, 3]));
  owned.bytes[0] = 9;
  await expect(nalatiOutputInputs({ cached: () => Promise.resolve(new Map()) }, [owned])).rejects.toThrow('Named blob changed');
});

test('the raw input author module is one config-safe chunk without file services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/outputInputs.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing input author bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
