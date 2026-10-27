// oxlint-disable-next-line import/no-nodejs-modules -- Compare full original files and own the isolated real producer cache.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the actual source entry and confine sealed generation scratch.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete GLBs without expanding their assertion output.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { skyWorldPieceProgram } from '../src/shards/far-reach/generators/worldPieceProgram';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { SKY_PIECES } from '../src/shards/far-reach/generators/scene';
import { skyWorldPieceFiles, skyWorldPieceSource } from '../src/shards/far-reach/generators/worldPieceBytes';


test('all ten source pieces retain complete original GLB and JSON bytes in authored order', () => {
  const files = skyWorldPieceSource();
  expect([...files.keys()]).toEqual(SKY_PIECES.flatMap(piece => [`baked/${piece.glb}.glb`, `data/${piece.rows}.json`]));
  for (const [name, bytes] of files) {
    const path = name.startsWith('baked/') ? `public/assets/far-reach/${name}` : `src/shards/far-reach/${name}`;
    expect(Buffer.compare(bytes, readFileSync(path)), name).toBe(0);
  }
});

test('independent compiles own their mutable buffers and missing pieces refuse', () => {
  const first = skyWorldPieceSource(), expected = new Map([...first].map(([name, bytes]) => [name, hashImmutableBytes(bytes)]));
  for (const bytes of first.values()) bytes.fill(0);
  first.clear();
  expect(new Map([...skyWorldPieceSource()].map(([name, bytes]) => [name, hashImmutableBytes(bytes)]))).toEqual(expected);
  expect(() => skyWorldPieceFiles([])).toThrow('Sky world piece inventory differs');
});

test.each(['worldPieceBytes', 'worldPieceProgram'])('%s bundles without generated imports or file/compiler services', async entry => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`src/shards/far-reach/generators/${entry}.ts`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing owned world-piece bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});


test('the world piece cache preserves every original byte, detaches storage and rekeys the author program', async () => {
  const cache = mkdtempSync(resolve('tmp/sky-piece-cache-'));
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), cache);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'world-pieces', native: true, inputs: [] });
      return ctx.cached(step, inputs => { expect(inputs.size).toBe(0); builds++; return generate(inputs); });
    } };
  };
  const check = (files: ReadonlyMap<string, Uint8Array>): void => {
    expect([...files.keys()]).toEqual(SKY_PIECES.flatMap(piece => [`baked/${piece.glb}.glb`, `data/${piece.rows}.json`]));
    for (const [name, bytes] of files) {
      const path = name.startsWith('baked/') ? `public/assets/far-reach/${name}` : `src/shards/far-reach/${name}`;
      expect(Buffer.compare(bytes, readFileSync(path)), name).toBe(0);
    }
  };
  try {
    const cold = await skyWorldPieceProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    check(await skyWorldPieceProgram(context())); expect(builds).toBe(1);
    check(await skyWorldPieceProgram(context('b'))); expect(builds).toBe(2);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing, empty, foreign and mismatched world piece cache banks refuse without physical-file fallback', async () => {
  const source = skyWorldPieceSource(), first = SKY_PIECES[0];
  if (first === undefined) throw new Error('Missing original world piece');
  const missing = new Map(source), empty = new Map(source), corrupt = new Map(source), metadata = new Map(source);
  missing.delete(`baked/${first.glb}.glb`); empty.set(`data/${first.rows}.json`, new Uint8Array());
  corrupt.set(`baked/${first.glb}.glb`, new Uint8Array([1]));
  metadata.set(`data/${first.rows}.json`, new TextEncoder().encode('{"glb":"foreign"}'));
  for (const files of [missing, empty, corrupt, metadata, new Map([...source, ['foreign', new Uint8Array([1])]])]) {
    await expect(skyWorldPieceProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow(/Sky world piece cache/u);
  }
});
