// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this isolated cache fixture.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the existing authored public input root.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
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
import { readFixedSlots, packGeometry } from '../src/shards/nine-dragon-stack/generators/casts';
import { nineCastsProgram } from '../src/shards/nine-dragon-stack/generators/castsProgram';

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
afterAll(fixture.dispose);

test.each([false, true])('entry casts preserve declared codec transformations (caps=%s)', async caps => {
  const ctx = new Ctx(new SignRecorder()), kit = ctx.kit('entries');
  kit.compact = false;
  buildEntryDecks(ctx, caps);
  const geometry = kit.build(), name = caps ? 'entries-capped' : 'entries-open';
  try {
    const original = packGeometry(name, geometry);
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

test('slot loans key every ordered consumed value and detach before cache admission', async () => {
  const ctx = fixture.context();
  const slots = () => readFixedSlots({ rows: { slots: {
    early: [{ at: [-0, 2, 3], normal: [1, 0, 0], size: 0.7, color: 0x123456, blade: false }],
    late: [{ at: [4, 5, 6], normal: [0, 0, 1], size: 1.1, color: 0x654321, blade: true }],
  } } });
  const identity = async (prepared?: ReturnType<typeof readFixedSlots>) => {
    let id: string | undefined, inputs: readonly string[] | undefined;
    await nineCastsProgram({ ...ctx, cached: step => { id = step.id; inputs = step.inputs; return Promise.resolve(fixture.captured); } }, prepared);
    return { id, inputs };
  };
  const original = await identity(), first = await identity(slots());
  expect(original.id).toBe('casts'); expect(first.id).toMatch(/^casts-slots-[a-f0-9]{64}$/u);
  expect(first.inputs).toStrictEqual(original.inputs);
  expect(await identity(slots())).toStrictEqual(first);
  const changes: ((value: ReturnType<typeof readFixedSlots>) => void)[] = [
    value => { const row = value.early[0]; if (row === undefined) throw new Error('Missing slot'); row.at[0] = 0; },
    value => { const row = value.early[0]; if (row === undefined) throw new Error('Missing slot'); row.normal[2] = 1; },
    value => { const row = value.early[0]; if (row === undefined) throw new Error('Missing slot'); row.size = Infinity; },
    value => { const row = value.early[0]; if (row === undefined) throw new Error('Missing slot'); row.size = -Infinity; },
    value => { const row = value.early[0]; if (row === undefined) throw new Error('Missing slot'); row.color++; },
    value => { const row = value.early[0]; if (row === undefined) throw new Error('Missing slot'); row.blade = true; },
    value => { const early = value.early; value.early = value.late; value.late = early; },
  ];
  for (const change of changes) { const value = slots(); change(value); expect((await identity(value)).id).not.toBe(first.id); }
  const supplied = slots(); let admitted: string | undefined;
  await nineCastsProgram({ ...ctx, cached: step => {
    admitted = step.id; supplied.early.splice(0); supplied.late.splice(0); return Promise.resolve(fixture.captured);
  } }, supplied);
  expect(admitted).toBe(first.id);
  expect((await identity(supplied)).id).not.toBe(first.id);
  const invalid = slots(), row = invalid.early[0]; if (row === undefined) throw new Error('Missing slot');
  Reflect.set(row, 'size', 'not a number');
  await expect(identity(invalid)).rejects.toThrow();
  const nan = slots(), nanRow = nan.early[0]; if (nanRow === undefined) throw new Error('Missing slot');
  Reflect.set(nanRow, 'size', Number.NaN);
  await expect(identity(nan)).rejects.toThrow();
  const extra = slots(), extraRow = extra.late[0]; if (extraRow === undefined) throw new Error('Missing slot');
  Reflect.set(extraRow, 'unknown', 1);
  await expect(identity(extra)).rejects.toThrow();
});
