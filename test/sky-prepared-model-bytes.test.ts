// oxlint-disable-next-line import/no-nodejs-modules -- Compare every original registered GLB byte and supply actual authored models explicitly.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare full binary buffers without expanding 10 MB into assertion objects.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the real source entry for its config-safe bundle proof.
import { resolve } from 'node:path';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { prepareAssetDecoders } from '../src/format/product';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { bakePreparedModels, prepareModelFrame } from '../src/shards/far-reach/generators/preparedModelBytes';
import { bakePreparedModels as retainedPreparedModels } from '../src/shards/far-reach/generators/preparedModels';
import { bakeSkyIsleFrames } from '../src/shards/far-reach/generators/skyIsleFrames';
import { CARVED, MODEL_FITS } from '../src/shards/far-reach/generators/modelFrames';

const read = (url: string): Uint8Array => new Uint8Array(readFileSync(`public${url}`));
await prepareAssetDecoders();
// Actual cold source intake precedes timed assertions; all cases retain 30 s.
const frames = await bakeSkyIsleFrames(read), inputs = { frames, fits: MODEL_FITS, daisHeight: CARVED.daisH };
const actual = await bakePreparedModels(read, inputs);
const original = new Uint8Array(readFileSync('public/assets/far-reach/baked/prepared-models.glb'));

test('explicit frame inputs retain every byte of the original largest Far Reach producer', async () => {
  expect(actual.byteLength).toBe(10_134_100);
  expect(hashImmutableBytes(actual)).toBe('bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580');
  expect(Buffer.compare(actual, original)).toBe(0);
  const retained = await retainedPreparedModels(read);
  expect(Buffer.compare(retained, original)).toBe(0);
  actual.fill(0); expect(hashImmutableBytes(retained)).toBe('bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580');
});

test('supplied island frames precede static fits and retain their original transform order', () => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([1, 2, 3, 3, 6, 9], 3));
  const supplied = { frames: [{ model: 'post-hd', tx: 2, deck: 3, tz: 4, k: 2 }], fits: MODEL_FITS, daisHeight: .42 };
  try {
    expect(prepareModelFrame('post-hd', geometry, supplied)).toBe(geometry);
    expect(Array.from(geometry.getAttribute('position').array)).toEqual([-2, -2, -2, 2, 6, 10]);
    expect(geometry.boundingBox?.min.toArray()).toEqual([-2, -2, -2]);
    expect(supplied.frames).toEqual([{ model: 'post-hd', tx: 2, deck: 3, tz: 4, k: 2 }]);
  } finally { geometry.dispose(); }
});

test('static fallback fits and carved height use only the supplied fitting rows', () => {
  const geometry = new BoxGeometry(2, 4, 6), dais = new BoxGeometry(2, 4, 6);
  const supplied = { frames: [], fits: { 'post-hd': { size: 2, by: 'height' as const, floor: 1 } }, daisHeight: .7 };
  try {
    prepareModelFrame('post-hd', geometry, supplied);
    expect(geometry.boundingBox?.min.toArray()).toEqual([-.5, 1, -1.5]);
    expect(geometry.boundingBox?.max.toArray()).toEqual([.5, 3, 1.5]);
    prepareModelFrame('crown-dais', dais, supplied);
    expect(dais.boundingBox?.max.y).toBeCloseTo(.7, 6);
  } finally { geometry.dispose(); dais.dispose(); }
});

test('missing source reads refuse without a retained-file fallback', async () => {
  await expect(bakePreparedModels(() => { throw new Error('Missing explicit source'); }, inputs)).rejects.toThrow('Missing explicit source');
});

test.each(['preparedModelBytes', 'preparedModels'])('%s bundles without generated fitting imports or filesystem services', async entry => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`src/shards/far-reach/generators/${entry}.ts`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing prepared-model byte bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => (entry === 'preparedModelBytes' && path.endsWith('/modelFrames.ts')) || path.endsWith('/skyIsleFrames.json') || path.includes('.generated.'))).toBe(false);
  }
});
