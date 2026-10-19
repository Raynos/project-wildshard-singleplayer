// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Color, DataTexture, Group, Matrix4, MeshStandardMaterial, PointLight, Vector3, Vector4 } from 'three';
import { LightEmitters } from '../src/engine/fx/lightEmitters';
import { Scope } from '../src/engine/app/scope';
import { applyGround, updateGround } from '../src/engine/render/families/ground';
import { parseGroundLayer } from '../src/format/materialFamilies';
import { parseLightEmitters } from '../src/format/lightEmitters';
import { lightPoolRows, lightVolumeBlobs, volumeSources } from '../src/shards/nine-dragon-stack/generators/lightVolumes';
import { unzlibSync } from 'fflate';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { bakeVolume } from '../src/shards/nine-dragon-stack-legacy/look/light/lightvol';
import { loadLut, gradeUniforms } from '../src/shards/nine-dragon-stack/look/light/grade';
import { loadLut as sealedLut, gradeUniforms as sealedGrade } from '../src/shards/nine-dragon-stack-legacy/look/light/grade';
import { gatherPools } from '../src/shards/nine-dragon-stack-legacy/look/light/pools';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { EmitterPresentation } from '../src/game/shardfile/lightEmitters';
import { sceneVectors } from '../src/game/shardfile/sceneInputs';
import { SIGNAL_EMITTERS } from '../src/shards/sunscar-dunes/generators/lightEmitters';
import POOL from '../src/shards/nine-dragon-stack/data/lightPools.json' with { type: 'json' };
import { restoreWeave } from '../src/shards/nine-dragon-stack/look/style';
import { Shared as SealedShared } from '../src/shards/nine-dragon-stack-legacy/look/style';
import { plainWeaveBytes, silkWeaveBytes } from '../src/shards/nine-dragon-stack/generators/silkWeave';
import { weaveTexture as sealedPlainWeave } from '../src/shards/nine-dragon-stack-legacy/world/hero/vm-material';
import { canopyGraphs } from '../src/shards/nine-dragon-stack/generators/canopyGraphs';
import NINE_GRAPHS from '../src/shards/nine-dragon-stack/data/lookGraphs.json' with { type: 'json' };
import { validateGraph, type GraphRef } from '../src/format/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';
import type { ShardContext } from '../src/game/plugin/context';

test('Nine source order, linear colours and falloffs match its sealed volume inputs exactly', () => {
  const emitter = (w: number, h: number, power: number, spill: number) => ({ at: new Vector3(w, h, power), color: new Color(0xb47248), w, h, power, spill });
  const lanterns = [emitter(0.2, 0.4, 1, 0.3), emitter(0.75, 1, 2, 0.1)],
    shops = [emitter(1.5, 1, 1, 0.1), emitter(4, 2, 1, 0.9)], lamps = [emitter(0.34, 0.3, 1, 0.3)],
    signs = [emitter(1, 3, 2, 0.3), emitter(2, 1, 0.5, 0)],
    windows = [0, 0.8, 1.15].map(lit => ({ m: new Matrix4().makeRotationY(0.7).scale(new Vector3(1.2, 2.4, 1)).setPosition(3, 4, 5), win: new Vector4(0, lit, 0, 0), light: new Color(0xffaa55) }));
  const rows = lightPoolRows({ lanterns, ctxEmitters: [...shops, ...lamps], signs, windows }, POOL);
  expect(new LightEmitters(rows).volume()).toEqual(gatherPools({ lanterns, shops, lamps: lamps.map(row => row.at), signs, windows }));
  const shared = { value: rows.map(() => new Vector4()) }, current = new LightEmitters(rows, shared);
  current.set('light.0', false); expect(shared.value[0]?.w).toBe(0);
  expect(current.volume()[1]).toEqual(gatherPools({ lanterns, shops, lamps: lamps.map(row => row.at), signs, windows })[1]);
  expect(() => current.set('missing', true)).toThrow();
  expect(() => new LightEmitters([...rows, ...rows])).toThrow();
  const invalid = structuredClone(rows);
  for (const row of invalid) row.gain = Number.NaN;
  expect(() => new LightEmitters(invalid)).toThrow();
});

test('ground reads the owning emitter uniform through dusk updates without a copy or shader rebuild', () => {
  const uniform = { value: Array.from({ length: 4 }, () => new Vector4()) }, material = new MeshStandardMaterial();
  const rows = parseGroundLayer({ pools: { source: 'emitters', low: [1, 0.7, 0.3], high: [1, 0.4, 0.1], split: 0.5, radius: 10, gain: 0.17 } });
  applyGround(material, rows, () => { throw new Error('No textures'); }, id => {
    expect(id).toBe('emitters'); return uniform;
  });
  const readPools = (): unknown => {
    const values: unknown = material.userData['familyUniforms'];
    if (typeof values !== 'object' || values === null || !('famGPools' in values)) throw new Error('Missing pool uniform');
    return values.famGPools;
  };
  expect(readPools()).toBe(uniform);
  const before = material.customProgramCacheKey();
  uniform.value[0]?.set(1, 2, 3, 1); updateGround(material, { albedo: 0.7 });
  expect(readPools()).toBe(uniform);
  expect(material.customProgramCacheKey()).toBe(before); material.dispose();
  expect(() => applyGround(new MeshStandardMaterial(), rows, () => { throw new Error('No textures'); })).toThrow();
});

test('emitter switches restore exact pool and ember state and retain the original flicker waves', () => {
  const rows = parseLightEmitters({ version: 1, input: 'firelights', clock: 'firetime', rows: [{
    id: 'beacon', parent: 'flame', at: { point: 'at' }, pool: { slot: 0, gain: 1 }, initially: false, draws: [],
    emissive: { collection: 'embers', gain: 1.1 },
    light: { part: 'light', at: { point: 'at' }, colour: 0xff8a3a, gain: 14, distance: 40, decay: 1.6, shared: false, waves: [[13, 0, 0.06], [29, 1.3, 0.04]] },
  }] });
  const scope = new Scope('emitters'), handles = new SceneHandles(), root = new Group(), flame = new Group(), light = new PointLight(), embers = new MeshStandardMaterial();
  handles.publish('flame', flame); handles.publish('light', light); handles.publish('at', new Vector3(2, 3, 4)); handles.publishMaterials('embers', [embers]);
  const ctx = { root, product: { slug: 'fixture-emitter' } } as ShardContext;
  const host = new EmitterPresentation(rows, handles, ctx, scope, new Map());
  expect(flame.visible).toBe(false); expect(embers.emissiveIntensity).toBe(0);
  host.set('beacon', true); expect(embers.emissiveIntensity).toBe(1.1);
  expect(sceneVectors('fixture-emitter', 'firelights', 4).value[0]?.toArray()).toEqual([2, 3, 4, 1]);
  host.step(10, new Vector3()); expect(light.intensity).toBe(14 * (1 + Math.sin(130) * 0.06 + Math.sin(291.3) * 0.04));
  host.set('beacon', false); host.step(11, new Vector3()); expect(light.intensity).toBe(0);
  scope.dispose(); embers.dispose();
  expect(() => parseLightEmitters({ ...rows, rows: [...rows.rows, ...rows.rows] })).toThrow();
});

test('Signal generator admits every original fire graph and keeps the four pool slots in order', () => {
  const pools = SIGNAL_EMITTERS.rows.filter(row => row.pool !== undefined).sort((a, b) => (a.pool?.slot ?? 0) - (b.pool?.slot ?? 0));
  expect(pools.map(row => [row.id, row.pool?.slot, row.pool?.gain])).toEqual([
    ['brazier.0', 0, 1], ['brazier.1', 1, 1], ['brazier.2', 2, 1], ['caravan.pool', 3, 0.22],
  ]);
  expect([...new Set(SIGNAL_EMITTERS.rows.flatMap(row => row.draws.map(draw => draw.material)))].sort()).toEqual([
    'fire-embers', 'fire-flame', 'fire-glow', 'fire-lamp-glow', 'fire-pool', 'fire-smoke', 'fire-wisp',
  ]);
  expect(SIGNAL_EMITTERS.rows.filter(row => !row.initially).map(row => row.id)).toEqual(['signal', 'brazier.0', 'brazier.1', 'brazier.2']);
  const shared = SIGNAL_EMITTERS.rows.find(row => row.light?.shared === true);
  if (shared?.light === undefined) throw new Error('Missing declared shared lamp');
  expect(() => parseLightEmitters({ ...SIGNAL_EMITTERS, rows: [{ ...shared, light: { ...shared.light, decay: 1 } }] })).toThrow();
});


test('Nine admitted volume bytes match the sealed live bake for both tiers and entry states', () => {
  const blobs = lightVolumeBlobs();
  expect(blobs).toHaveLength(8);
  for (const tier of ['phone', 'desktop'] as const) for (const caps of [false, true]) {
    const sources = volumeSources(tier, caps);
    expect(sources.lanterns.length).toBe(caps ? 2591 : 2583);
    expect(sources.windows).toHaveLength(9912);
    const lights = gatherPools({ ...sources, shops: sources.ctxEmitters.filter(e => e.w >= 0.5 || e.h >= 0.5),
      lamps: sources.ctxEmitters.filter(e => e.w < 0.5 && e.h < 0.5).map(e => e.at) });
    const boxes = [{ min: new Vector3(-30, 123, -175), max: new Vector3(110, 171, 28), cell: 1 },
      { min: new Vector3(-30, -100, -46), max: new Vector3(2, 123, 18), cell: 1.5 }];
    for (const [index, box] of boxes.entries()) {
      const blob = blobs.find(b => b.file.name === `looks/volumes-${tier}-${caps ? 'capped' : 'open'}-${index}.bin`);
      if (blob === undefined) throw new Error('Missing baked irradiance');
      const bytes = blob.bytes, header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const min = new Vector3(), inv = new Vector3(), live = bakeVolume(lights, box, min, inv);
      const expected = live.tex.image.data;
      if (!(expected instanceof Uint8Array)) throw new Error('Sealed volume has no bytes');
      expect(hashImmutableBytes(unzlibSync(bytes.subarray(108)))).toBe(hashImmutableBytes(expected));
      expect([8, 12, 16].map(offset => header.getUint32(offset, true))).toEqual([live.tex.image.width, live.tex.image.height, live.tex.image.depth]);
      expect(Array.from({ length: 11 }, (_, i) => header.getFloat64(20 + i * 8, true))).toEqual([
        ...min, ...inv, live.stats.lights, live.stats.cells, live.stats.maxE, lights.length, POOL.maximum,
      ]);
      expect(bytes.length).toBeLessThan(1_000_000);
      live.tex.dispose();
    }
  }
}, 30_000);


test('Nine uses the engine LUT with the sealed bytes and sampler', async () => {
  const identity = gradeUniforms(), oldIdentity = sealedGrade();
  const a = identity.uLut.value.image.data, b = oldIdentity.uLut.value.image.data;
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) throw new Error('Missing identity LUT');
  expect(hashImmutableBytes(a)).toBe(hashImmutableBytes(b));
  expect(identity.uLutAmt.value).toBe(oldIdentity.uLutAmt.value);
  identity.uLut.value.dispose(); oldIdentity.uLut.value.dispose();
  const bytes = Uint8Array.from({ length: 33 ** 3 * 4 }, (_, i) => i & 255);
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(bytes)));
  try {
    const actual = await loadLut('/grade.bin'), sealed = await sealedLut('/grade.bin');
    if (sealed === null) throw new Error('Missing sealed LUT');
    const data = actual.image.data, previous = sealed.image.data;
    if (!(data instanceof Uint8Array) || !(previous instanceof Uint8Array)) throw new Error('Missing LUT bytes');
    expect(hashImmutableBytes(data)).toBe(hashImmutableBytes(previous));
    for (const field of ['type', 'format', 'colorSpace', 'minFilter', 'magFilter', 'wrapS', 'wrapT', 'wrapR', 'unpackAlignment'] as const) expect(actual[field]).toBe(sealed[field]);
    expect([actual.image.width, actual.image.height, actual.image.depth]).toEqual([33, 33, 33]);
    actual.dispose(); sealed.dispose();
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 404 })));
    await expect(loadLut('/missing.bin')).rejects.toThrow('Missing Nine grade LUT');
  } finally { vi.unstubAllGlobals(); }
});


test('Nine weave bakes retain every texel and the sealed samplers', () => {
  for (const [original, restored] of [[new SealedShared().u.uSilk.value, restoreWeave(silkWeaveBytes())], [sealedPlainWeave(), restoreWeave(plainWeaveBytes())]]) {
    if (!(original instanceof DataTexture) || !(original.image.data instanceof Uint8Array) || !(restored instanceof DataTexture) || !(restored.image.data instanceof Uint8Array)) throw new Error('Missing weave bytes');
    try {
      expect(hashImmutableBytes(restored.image.data)).toBe(hashImmutableBytes(original.image.data));
      for (const key of ['format', 'type', 'colorSpace', 'wrapS', 'wrapT', 'minFilter', 'magFilter', 'generateMipmaps'] as const) expect(restored[key]).toBe(original[key]);
    } finally { original.dispose(); restored.dispose(); }
  }
  expect(() => restoreWeave(new Uint8Array(1))).toThrow('256 × 256');
});

test('Nine canopy graphs retain vertex fog and fit both catalogue caps', () => {
  const rows = canopyGraphs(NINE_GRAPHS);
  for (const [id, graph] of Object.entries(rows)) {
    expect(Reflect.get(NINE_GRAPHS, id)).toEqual(graph);
    const checked = validateGraph(graph, { trustedBudget: true });
    if (!checked.ok) throw new Error(checked.errors.join('\n'));
    expect(checked.cost.nodes).toBeLessThanOrEqual(4096);
    expect(new TextEncoder().encode(JSON.stringify(graph)).byteLength).toBeLessThanOrEqual(64_000);
    expect(graph.effectState?.fog).toBe(false);
    expect(graph.stages.surface?.targetAlpha).toBeDefined();
    const compiled = compileGraph(graph, { trustedBudget: true });
    if (id === 'nine-canopy-cards') {
      const texture = new DataTexture(new Uint8Array(4), 1, 1);
      compiled.setTexture('atlas', texture); compiled.setParam('atlasSize', [1024, 1024]); texture.dispose();
    }
    if (id !== 'nine-canopy-depth') {
      compiled.setParam('rootAt', [1, 2, 3]); compiled.setParam('lightDir', [0, 1, 0]);
      expect(Object.values(graph.nodes).some(node => node.op === 'varying' && node.in?.some(ref => typeof ref === 'string' && graph.nodes[ref]?.op === 'combine'))).toBe(true);
    }
    compiled.material.dispose();
  }
});

test('canopy mip coverage matches log2 across float32 minification', () => {
  const graph = canopyGraphs(NINE_GRAPHS)['nine-canopy-cards'];
  if (graph === undefined) throw new Error('Missing canopy cards');
  const coverage = Object.values(graph.nodes).find(node => node.op === 'fwidth')?.in?.[0];
  if (coverage === undefined) throw new Error('Missing mip coverage');
  const f = Math.fround;
  for (const x of [0, 1e-8, 0.9, 1, 1.0001, 1.5, 1.9999, 2, 3, 8, 255, 1024, 2 ** 32, 2 ** 64, 1e32]) {
    const evalScalar = (ref: GraphRef): number => {
      if (typeof ref === 'number') return f(ref);
      if (typeof ref !== 'string') throw new Error('Expected scalar coverage input');
      const node = graph.nodes[ref];
      if (node === undefined) throw new Error(`Missing coverage node ${ref}`);
      // Feed the measured squared UV derivative; tx.a = 1 isolates its multiplier.
      if (node.op === 'dot') return f(x);
      if (node.op === 'swizzle' && node.mask === 'w') return 1;
      const [a = 0, b = 0, c = 0] = (node.in ?? []).map(evalScalar);
      switch (node.op) {
        case 'add': return f(a + b);
        case 'sub': return f(a - b);
        case 'mul': return f(a * b);
        case 'div': return f(a / b);
        case 'max': return f(Math.max(a, b));
        case 'pow': return f(a ** b);
        case 'step': return b < a ? 0 : 1;
        case 'gte': return a >= b ? 1 : 0;
        case 'select': return a === 0 ? c : b;
        default: throw new Error(`Unexpected coverage op ${node.op}`);
      }
    };
    expect(Math.abs(evalScalar(coverage) - (1 + 0.125 * Math.log2(Math.max(f(x), 1))))).toBeLessThan(2e-6);
  }
});
