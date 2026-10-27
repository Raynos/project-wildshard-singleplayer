// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this isolated cache fixture.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the existing authored public input root.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { halfFloatBeforeControl } from './fixtures/half-float-before-control';
import { build } from 'vite';
import { DataUtils, Float32BufferAttribute } from 'three';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { parseGlb } from '../src/sdk/assets';
import { compressGlb } from '../src/sdk/bake/glbCompression';
import { compactPhoneGlb } from '../src/sdk/bake/compactGlb';
import { Ctx } from '../src/shards/nine-dragon-stack/generators/ctx';
import { SignRecorder } from '../src/shards/nine-dragon-stack/generators/layout';
import { buildEntryDecks } from '../src/shards/nine-dragon-stack/generators/entries';
import { packGeometry } from '../src/shards/nine-dragon-stack/generators/casts';
import { nineCastsProgram } from '../src/shards/nine-dragon-stack/generators/castsProgram';
import before from './fixtures/nine-cast-files.json' with { type: 'json' };
import admitted from './fixtures/nine-binary-outputs.json' with { type: 'json' };

async function coldCastsFixture() {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-casts-cache-'));
  try {
    const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'c'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    let captured: ReadonlyMap<string, Uint8Array> | undefined;
    const ctx = context(), cold = await nineCastsProgram({ ...ctx, cached: (step, generate) => ctx.cached(step, async inputs => {
      captured = await generate(inputs); return captured;
    }) });
    if (captured === undefined) throw new Error('Missing cold casts receipt');
    return { cold, captured, context, dispose: () => { rmSync(cache, { recursive: true, force: true }); } };
  } catch (error) { rmSync(cache, { recursive: true, force: true }); throw error; }
}
const fixture = await coldCastsFixture();
const beforeControl = await halfFloatBeforeControl(coldCastsFixture);
afterAll(() => { fixture.dispose(); beforeControl.dispose(); });
const keyFor = (path: string): string => {
  const file = path.split('/').at(-1); if (file === undefined) throw new Error('Missing cast filename');
  if (path.startsWith('public/')) return `raw/${file}`;
  if (file.startsWith('cast-')) return `packed/${file.slice(5).replace('.generated', '')}`;
  const keys = new Map([['castHook.generated.glb', 'hook.glb'], ['castHook.generated.json', 'hook.json'],
    ['deckFloors.generated.json', 'floors.json'], ['fixedKits.generated.json', 'fixed.json']]);
  const key = keys.get(file); if (key === undefined) throw new Error(`Unexpected old cast ${file}`); return key;
};

test('cold casts retain all 78 pre-correction file pins and admitted costs', () => {
  expect(beforeControl.captured.size).toBe(before.length); expect(before).toHaveLength(78);
  expect([...fixture.captured.keys()]).toEqual([...beforeControl.captured.keys()]);
  for (const name of ['hook.glb', 'hook.json', 'fixed.json', 'floors.json']) {
    const current = fixture.captured.get(name), previous = beforeControl.captured.get(name);
    if (current === undefined || previous === undefined) throw new Error(`Missing cast metadata ${name}`);
    expect(hashImmutableBytes(current), name).toBe(hashImmutableBytes(previous));
  }
  for (const row of before) {
    const bytes = beforeControl.captured.get(keyFor(row.path)); if (bytes === undefined) throw new Error(`Missing cast ${row.path}`);
    expect(bytes.byteLength, row.path).toBe(row.bytes); expect(hashImmutableBytes(bytes), row.path).toBe(row.hash);
  }
  expect(beforeControl.cold.blobs.map(row => row.file)).toStrictEqual(admitted.castFiles.filter(row => row.kind === 'glb'));
});

// Frozen pre-I3 source pins from 39a144d732. Keep them beside the current
// 78-file before-control so a codec cannot replace its own evidence.
test.each([
  { caps: false, raw: '48ebcc3989092f33810625c0c5c7c1f6d9bf02332258cb398f6b84da5ce2aaa3',
    packed: '1788e0f33010bdb850c192d08772de280d8a1e65bfba0823d785b5d449bf8a0a' },
  { caps: true, raw: '636cacf412781c2339f373b72da3ee55a194c49ebb4e9ea75da20e959f6cacc9',
    packed: '4bcc21ba31192aee3e64586cd7482f61ed4c6bf0830865dc3be80b5e5a7d1b54' },
])('entry casts differ from their original pins only by the declared I3 codecs (caps=$caps)', async row => {
  const ctx = new Ctx(new SignRecorder()), kit = ctx.kit('entries');
  kit.compact = false;
  buildEntryDecks(ctx, row.caps);
  const geometry = kit.build(), name = row.caps ? 'entries-capped' : 'entries-open';
  try {
    const original = packGeometry(name, geometry);
    expect(hashImmutableBytes(original)).toBe(row.raw);
    expect(hashImmutableBytes(compressGlb(original))).toBe(row.packed);
    // d5f31bea93 changes exactly these source values to half precision. The
    // native GLB writer still stores their decoded values as Float32.
    for (const channel of ['aFace', 'aPat']) {
      const attribute = geometry.getAttribute(channel);
      const rounded = new Float32Array(attribute.count * attribute.itemSize);
      for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) {
        rounded[i * attribute.itemSize + c] = DataUtils.fromHalfFloat(DataUtils.toHalfFloat(attribute.getComponent(i, c)));
      }
      geometry.setAttribute(channel, new Float32BufferAttribute(rounded, attribute.itemSize));
    }
    const raw = packGeometry(name, geometry), actual = fixture.cold.raw.get(name);
    if (actual === undefined) throw new Error(`Missing original entry cast ${name}`);
    expect(hashImmutableBytes(actual)).toBe(hashImmutableBytes(raw));
    // c877add154 changes only the shipped packed file through the shared phone
    // codec; all remaining bytes, bounds, materials and custom channels above
    // are covered by the complete raw comparison, with no new hash pins.
    const packed = await compactPhoneGlb(compressGlb(raw));
    const emitted = fixture.captured.get(`packed/${name}.glb`);
    if (emitted === undefined) throw new Error(`Missing packed entry cast ${name}`);
    expect(hashImmutableBytes(emitted)).toBe(hashImmutableBytes(packed));
    const sourceCost = parseGlb(original), phoneCost = parseGlb(packed);
    expect(phoneCost.triangles).toBe(sourceCost.triangles);
    expect(phoneCost.draws).toBe(sourceCost.draws);
    expect(phoneCost.gpu).toBeLessThanOrEqual(sourceCost.gpu);
    expect(phoneCost.decoded).toBeLessThanOrEqual(sourceCost.decoded);
  } finally { geometry.dispose(); }
});

test('a hit never rebuilds and owns every original cast byte independently', async () => {
  const ctx = fixture.context(), hit = await nineCastsProgram({ ...ctx, cached: step => ctx.cached(step, () => { throw new Error('A hit must not rebuild'); }) });
  expect(hit.material).toStrictEqual(fixture.cold.material);
  expect(hit.blobs.map(row => row.file)).toStrictEqual(fixture.cold.blobs.map(row => row.file));
  for (const [name, bytes] of hit.raw) {
    const cold = fixture.cold.raw.get(name); if (cold === undefined) throw new Error(`Missing original cast ${name}`);
    expect(hashImmutableBytes(bytes)).toBe(hashImmutableBytes(cold)); expect(bytes === cold).toBe(false);
  }
});

test('missing, extra, invalid and wrongly published casts refuse', async () => {
  const ctx = fixture.context(), missing = new Map(fixture.captured); missing.delete('hook.glb');
  await expect(nineCastsProgram({ ...ctx, cached: () => Promise.resolve(missing) })).rejects.toThrow('inventory differs');
  const extra = new Map(fixture.captured); extra.set('unexpected.bin', new Uint8Array());
  await expect(nineCastsProgram({ ...ctx, cached: () => Promise.resolve(extra) })).rejects.toThrow('inventory differs');
  const corrupt = new Map(fixture.captured); corrupt.set('packed/lion.glb', new Uint8Array(16));
  await expect(nineCastsProgram({ ...ctx, cached: () => Promise.resolve(corrupt) })).rejects.toThrow();
  await expect(nineCastsProgram({ ...ctx, cached: () => Promise.resolve(fixture.captured), asset: () => '0'.repeat(64) })).rejects.toThrow('publication differs');
});

test('casts cache bundles without filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/castsProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing cast program bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});
