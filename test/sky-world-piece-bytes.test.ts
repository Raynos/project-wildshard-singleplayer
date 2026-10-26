// oxlint-disable-next-line import/no-nodejs-modules -- Compare full original files and own the isolated real producer cache.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the actual source entry and confine sealed generation scratch.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete GLBs without expanding their assertion output.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { SKY_PIECES } from '../src/shards/far-reach/generators/scene';
import { skyWorldPieceFiles, skyWorldPieceSource, skyWorldPieceValues } from '../src/shards/far-reach/generators/worldPieceBytes';

function checkValues(values: ReturnType<typeof skyWorldPieceValues>): void {
  expect([...values.keys()]).toEqual(SKY_PIECES.map(piece => piece.glb));
  for (const piece of SKY_PIECES) {
    const value = values.get(piece.glb);
    if (value === undefined) throw new Error('Missing owned world piece metadata');
    expect(`${JSON.stringify(value, null, 2)}\n`, piece.glb).toBe(readFileSync(`src/shards/far-reach/data/${piece.rows}.json`, 'utf8'));
  }
}

test('typed piece values retain all ten complete original metadata files in authored order', () => {
  checkValues(skyWorldPieceValues());
});

test('independent typed piece compiles own their mutable kind and collider banks', () => {
  const first = skyWorldPieceValues(), second = skyWorldPieceValues();
  for (const value of first.values()) {
    for (const kind of value.kinds) kind.count += 1;
    value.colliders.length = 0;
  }
  checkValues(second); checkValues(skyWorldPieceValues());
});

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

test('the owned piece entry bundles without generated imports or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/worldPieceBytes.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing owned world-piece bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

test.each(['sky-world', 'sky-look-maps'])('the real cold sealed %s writer preserves its entire original output inventory', async id => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === id);
  if (job === undefined) throw new Error(`Missing retained producer ${id}`);
  const expected = Object.fromEntries(job.outputs.map(path => [path, hashImmutableBytes(readFileSync(path))]));
  const cacheDir = mkdtempSync(resolve('tmp/sky-world-piece-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual(expected); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
