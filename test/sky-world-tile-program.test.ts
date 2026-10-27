import { withPortableMath } from '../src/commons/bake/portableMath';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original tile assets and own isolated cache fixtures.
import { mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine cache fixtures to repository scratch and bind the real source bundle.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete native buffers without per-element assertion expansion.
import { Buffer } from 'node:buffer';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { skyIsleProps } from '../src/shards/far-reach/generators/isleProps';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyWorldTileFiles, skyWorldTileSource } from '../src/shards/far-reach/generators/worldTileBytes';
import { skyWorldTileProgram } from '../src/shards/far-reach/generators/worldTileProgram';

const wire = withPortableMath(skyWorldTileSource).get('data/props.json');
if (wire === undefined) throw new Error('Missing native tile metadata');
const metadata = Buffer.from(wire);
const original = v.parse(v.object({ files: v.array(v.object({ hash: v.string() })) }), JSON.parse(metadata.toString()));
const check = (files: ReadonlyMap<string, Uint8Array>): void => {
  expect([...files.keys()].sort()).toEqual(['data/props.json', ...original.files.map(file => `assets/${file.hash}`)].sort());
  // T8 names the original binary channels; metadata and asset hashes pin the new transport boundary.
  for (const [name, bytes] of files) {
    if (name === 'data/props.json') expect(hashImmutableBytes(bytes)).toBe('15cca111b5583251f8a967828065f83ece474d23ac0fa2932ad2be86aa825d0a');
    else expect(`assets/${hashImmutableBytes(bytes)}`, name).toBe(name);
  }
};

test('all original island tile bytes, file order, lattice rows and costs survive cold source and cache hits', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-world-tiles-'));
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), scratch);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'world-tiles', native: true, inputs: [] });
      return ctx.cached(step, inputs => { expect(inputs.size).toBe(0); builds++; return withPortableMath(() => generate(inputs)); });
    } };
  };
  try {
    const cold = await skyWorldTileProgram(context()); check(cold);
    const order = [...cold.keys()];
    for (const bytes of cold.values()) bytes.fill(0);
    const hit = await skyWorldTileProgram(context()); check(hit);
    expect([...hit.keys()]).toEqual(order); expect(builds).toBe(1);
    check(await skyWorldTileProgram(context('b'))); expect(builds).toBe(2);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('the serializer detaches native asset buffers and preserves the complete original metadata', () => {
  const baked = withPortableMath(skyIsleProps), files = skyWorldTileFiles(baked); check(files);
  expect([...files.keys()]).toEqual([...baked.assets.keys()].map(hash => `assets/${hash}`).concat('data/props.json'));
  for (const bytes of baked.assets.values()) bytes.fill(0);
  baked.files.reverse(); baked.tiles.reverse();
  check(files);
});

test('missing, empty, foreign, corrupted and mispriced cache entries refuse without a source-file fallback', async () => {
  const source = withPortableMath(skyWorldTileSource), first = source.keys().next().value;
  if (first === undefined) throw new Error('Missing original island tile');
  const missing = new Map(source), empty = new Map(source), corrupt = new Map(source), absent = new Map(source), priced = new Map(source);
  missing.delete(first); empty.set(first, new Uint8Array()); corrupt.set(first, new Uint8Array([1])); absent.delete('data/props.json');
  priced.set('data/props.json', new TextEncoder().encode(metadata.toString().replace(/"compressed":(\d+)/u, (_match, value: string) => `"compressed":${Number(value) + 1}`)));
  expect(Buffer.compare(priced.get('data/props.json') ?? new Uint8Array(), metadata)).not.toBe(0);
  for (const files of [missing, empty, corrupt, absent, priced, new Map([...source, ['extra', new Uint8Array([1])]])]) {
    await expect(skyWorldTileProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow(/Sky world tile/u);
  }
});

test.each(['worldTileBytes', 'worldTileProgram'])('%s bundles without generated imports or file/compiler services', async entry => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`src/shards/far-reach/generators/${entry}.ts`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing world tile source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});
