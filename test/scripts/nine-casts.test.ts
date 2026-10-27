import { ownedWorld, scenes, layout as sourceLayout } from '../fixtures/nine-product-inputs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only golden proof hashes exact typed-array storage.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The offline proof reads retained GLBs and published layout inputs.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { halfFloatBeforeControl } from '../fixtures/half-float-before-control';
import { BufferAttribute, DataUtils, Float16BufferAttribute, Float32BufferAttribute, Mesh, MeshBasicMaterial, Box3, Object3D, Sphere, Vector3, type BufferGeometry } from 'three';

import {nineCastBlobs, rawCast} from '../fixtures/nine-cast-blobs';
import { createOwnedGeometry } from '../../src/engine/models/ownedGeometry';
import { originalHookBounds } from '../fixtures/nine-boot-contract';
import hookBounds from '../../src/shards/nine-dragon-stack/data/hookBounds.json' with { type: 'json' };
import { createModelLibrary } from '../../src/game/plugin/geometry';
import { readSourceModel } from '../../src/sdk/bake/skinned';
import type { PreparedGeometry } from '../../src/shards/nine-dragon-stack/data/casts';
import castRows from '../../src/shards/nine-dragon-stack/data/casts.json' with { type: 'json' };
import { layoutBlobs } from '../../src/shards/nine-dragon-stack/generators/layoutBlobs';
import { bakeLods } from '../../src/shards/nine-dragon-stack/generators/lods';
import { bakeCasts, bakeFixedKits, castGeometry } from '../../src/shards/nine-dragon-stack/generators/casts';
import { layoutProjection, restoreLayoutZeros } from '../../src/shards/nine-dragon-stack/generators/layoutProjection';
import { LayoutRowsSchema, GeometryBootSchema } from '../../src/shards/nine-dragon-stack/generators/sections';
import * as v from 'valibot';
import { Scope } from '../../src/engine/app/scope';
import { modelContext } from '../../src/engine/models/model';
import { Rng } from '../../src/engine/core/rng';
import { bindWorldSceneModelSources, defineWorldSceneCatalogue } from '../../src/game/models/worldSceneCatalogue';
import { parseWorldSceneModels } from '../../src/format/worldSceneModels';
import { floorAtRects } from '../../src/engine/physics/box';
import { deckFloorRows } from '../../src/shards/nine-dragon-stack/generators/floorRows';
import lodBasis from '../fixtures/nine-lods.json' with { type: 'json' };
import baseline from '../fixtures/nine-casts.json' with { type: 'json' };

const CAST_BLOBS=await nineCastBlobs();
const deckFloors = deckFloorRows();

const { CAST_CHANNELS } = castRows;
const names = v.parse(v.array(v.picklist(['walker-dark', 'walker-light', 'sitter-dark', 'sitter-light', 'lion', 'guard', 'entries-open', 'entries-capped', 'facade-signs'])), [...castRows.CASTS, ...castRows.FIXED_KITS]);


/** a middle level as the world-scenes catalogue draws it: its prepared index over the full cast's attributes (the borrow
 *  itself: test/world-scene-shared-lods.test.ts); its sources owner stays live for the suite */
function drawnLevel(name: string, path: string, base: BufferGeometry, prepared: BufferGeometry): BufferGeometry {
  const draw = { id: 'main', library: 'casts', material: 'kit' };
  const rows = { product: 'fixture-casts', models: [{ key: 'cast', id: 'fixture-casts/cast', name: 'Cast', category: 'props', pipeline: 'trellis', file: 'casts.json', defaults: {}, assembly: 'parts',
    choices: [{ id: 'only', params: {}, size: [1, 1, 1], colliders: [], draws: [{ ...draw, model: name }], lods: [{ from: 1, draws: [{ ...draw, model: path, attributes: { library: 'casts', model: name } }] }] }] }] };
  const ctx = modelContext(null);
  bindWorldSceneModelSources(ctx, 'fixture-casts', { catalogue: parseWorldSceneModels(rows), materials: new Map([['kit', new MeshBasicMaterial()]]),
    geometries: new Map([[JSON.stringify(['casts', name]), base], [JSON.stringify(['casts', path]), prepared]]) }, new Scope(`cast-${path}`));
  const parts = defineWorldSceneCatalogue(rows).model('cast').lods?.[0]?.build(ctx, {}, new Rng(1));
  const geometry = parts === undefined || parts instanceof Object3D ? undefined : parts[0]?.geometry;
  if (geometry === undefined) throw new Error(`Missing drawn LOD ${path}`);
  return geometry;
}

let packs: Map<PreparedGeometry, Uint8Array>;
let originalPacks: Map<PreparedGeometry, Uint8Array>;
let fixed: ReturnType<typeof bakeFixedKits>;
beforeAll(async () => {
  const layout: unknown = sourceLayout;
  const row = v.parse(v.object({ rows: LayoutRowsSchema }), layout);
  fixed = bakeFixedKits(row.rows.slots);
  packs = await bakeCasts(url => new Uint8Array(readFileSync(`public${url}`)));
  for (const [key, bytes] of fixed.packs) packs.set(key, bytes);
  originalPacks = await halfFloatBeforeControl(async () => {
    const original = bakeFixedKits(row.rows.slots);
    try { return new Map([...await bakeCasts(url => new Uint8Array(readFileSync(`public${url}`))), ...original.packs]); }
    finally { for (const geometry of original.geometries.values()) geometry.dispose(); }
  });
}, 30_000);

function channels(geometry: BufferGeometry): unknown {
  const hash = (array: BufferAttribute['array']): string => createHash('sha256')
    .update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
  return {
    attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => {
      if (!(attribute instanceof BufferAttribute)) throw new Error('Unexpected interleaved cast channel');
      return [name, { type: attribute.array.constructor.name, size: attribute.itemSize, normalized: attribute.normalized,
        count: attribute.count, hash: hash(attribute.array) }];
    })),
    index: geometry.index === null ? null : { type: geometry.index.array.constructor.name, count: geometry.index.count, hash: hash(geometry.index.array) },
    box: geometry.boundingBox === null ? null : { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
    sphere: geometry.boundingSphere === null ? null : { center: geometry.boundingSphere.center.toArray(), radius: geometry.boundingSphere.radius },
  };
}

// Captured from the parent runtime prop loader, including signed zero, every packed channel and both bounds.
test.each(names)('%s preserves the original geometry through the existing rest-pool host', async name => {
  const bytes = packs.get(name);
  if (bytes === undefined) throw new Error(`Missing cast ${name}`);
  const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
    geometryPools: [{ url: name, parts: [name], channels: CAST_CHANNELS }],
  }, 'test Nine casts', {}, async () => (await readSourceModel(bytes)).gltf);
  await library.preload();
  const geometry = library.geometry(name, { borrow: true });
  if (geometry === null) throw new Error(`Host lost cast ${name}`);
  const originalBytes = originalPacks.get(name);
  if (originalBytes === undefined) throw new Error(`Missing cast predecessor ${name}`);
  const originalLibrary = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
    geometryPools: [{ url: name, parts: [name], channels: CAST_CHANNELS }],
  }, 'test Nine cast before-control', {}, async () => (await readSourceModel(originalBytes)).gltf);
  await originalLibrary.preload();
  const original = originalLibrary.geometry(name, { borrow: true });
  if (original === null) throw new Error(`Host lost original cast ${name}`);
  expect(channels(original)).toEqual(baseline[name]);
  const expected = original.clone();
  let source = fixed.geometries.get(name);
  if (source === undefined) {
    if (name === 'entries-open' || name === 'entries-capped' || name === 'facade-signs') throw new Error(`Missing source fixed kit ${name}`);
    source = await castGeometry(name, url => new Uint8Array(readFileSync(`public${url}`)));
  }
  try {
    for (const key of ['aFace', 'aPat']) if (source.getAttribute(key) instanceof Float16BufferAttribute) {
      const attribute = original.getAttribute(key);
      expected.setAttribute(key, new Float32BufferAttribute(Float32Array.from(attribute.array, bits => DataUtils.fromHalfFloat(bits)), attribute.itemSize));
    }
    expect(channels(geometry)).toEqual(channels(expected));
  } finally { expected.dispose(); original.dispose(); if (!fixed.geometries.has(name)) source.dispose(); }
  // Borrowing hands the original decoded buffers to the world, without another resident copy.
  expect(library.geometry(name, { borrow: true })).toBe(geometry);
  geometry.dispose();
});

test('fixed sign words, RNG order and all eight cap lantern matrices preserve the parent rows', () => {
  const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value,
    (_key, entry: unknown) => typeof entry === 'number' && Object.is(entry, -0) ? '-0' : entry)).digest('hex');
  expect({ signs: fixed.signs.length, signHash: hash(fixed.signs), lanterns: fixed.lanterns.length, lanternHash: hash(fixed.lanterns) }).toEqual(baseline.fixed);
});


test('layout blobs retain every float64 bit and signed author zero', () => {
  const raw: unknown = sourceLayout;
  const original = v.parse(v.object({ rows: LayoutRowsSchema, count: v.number(), records: v.array(v.number()),
    bounds: v.array(v.object({ sphere: v.array(v.number()), box: v.array(v.number()) })) }), raw);
  const blobs = layoutBlobs(ownedWorld, scenes), rows = blobs.find(row => row.file.name === 'geometry/layout.json');
  if (rows === undefined) throw new Error('Missing layout boot blobs');
  expect(blobs.some(row => row.file.name === 'geometry/layout-f64.bin')).toBe(false);
  const decoded: unknown = JSON.parse(new TextDecoder().decode(rows.bytes));
  expect(restoreLayoutZeros(v.parse(GeometryBootSchema, decoded))).toEqual(original.rows);
  expect(rows.file.jsonSchema).toBeDefined();
  expect(layoutProjection(original.rows, original.records, original.bounds).fixed.lanterns).toEqual(fixed.lanterns);
});


const lodGeometries = new Map<string, BufferGeometry>();
const lodBases = new Map<string, BufferGeometry>();
const originalColourLods = new Map<string, { geometry: BufferGeometry; base: BufferGeometry; half: readonly string[] }>();
beforeAll(async () => {
  const read = (url: string): Uint8Array => new Uint8Array(readFileSync(`public${url}`));
  for (const name of ['lion', 'walker-dark', 'walker-light', 'sitter-dark', 'sitter-light'] as const) lodBases.set(name, await castGeometry(name, read));
  for (const name of ['walker-oxblood', 'walker-paper', 'walker-blue']) {
    const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
      geometryPools: [{ url: name, parts: [name], channels: CAST_CHANNELS }],
    }, 'test Nine baked dye', {}, async () => (await readSourceModel(rawCast(name))).gltf);
    await library.preload();
    const geometry = library.geometry(name, { borrow: true });
    if (geometry === null) throw new Error(`Missing baked dye ${name}`);
    lodBases.set(name, geometry);
  }
  const { gltf } = await readSourceModel(read('/assets/nine-dragon/lab/grapple/dragon-hook.glb'));
  gltf.scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  const isMesh = (object: Object3D): object is Mesh => object instanceof Mesh;
  gltf.scene.traverse(object => { if (isMesh(object)) meshes.push(object); });
  const source = meshes[0];
  if (source === undefined) throw new Error('Missing native hook');
  const hook = source.geometry.clone();
  for (const name of ['position', 'normal', 'tangent']) {
    if (!hook.hasAttribute(name)) continue;
    const a = hook.getAttribute(name);
    if (a.array instanceof Float32Array && !a.normalized) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    hook.setAttribute(name, new Float32BufferAttribute(out, a.itemSize));
  }
  hook.applyMatrix4(source.matrixWorld); lodBases.set('dragon-hook', hook);
  const bakedHook = createOwnedGeometry('hook');
  const fullHook = CAST_BLOBS.find(row => row.file.name === 'geometry/dragon-hook.glb');
  if (fullHook === undefined) throw new Error('Missing full-detail hook blob');
  await bakedHook.load(fullHook.bytes);
  const nativeHook = bakedHook.take(), bounds = originalHookBounds;
  nativeHook.boundingBox = new Box3(new Vector3().fromArray(bounds.box.min), new Vector3().fromArray(bounds.box.max));
  nativeHook.boundingSphere = new Sphere(new Vector3().fromArray(bounds.sphere.center), bounds.sphere.radius);
  // the catalogue row's sphere (data/hookBounds.json) is the source cast's own
  expect(hookBounds.sphere).toEqual([...bounds.sphere.center, bounds.sphere.radius]);
  expect(channels(nativeHook)).toEqual(channels(hook));
  const oldLods = await halfFloatBeforeControl(() => bakeLods(read));
  const original = async (name: string): Promise<BufferGeometry> => {
    const bytes = oldLods.get(name);
    if (bytes === undefined) throw new Error(`Missing original colourway ${name}`);
    const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
      geometryPools: [{ url: name, parts: [name], channels: CAST_CHANNELS }],
    }, 'test original colourway', {}, async () => (await readSourceModel(bytes)).gltf);
    await library.preload();
    const geometry = library.geometry(name, { borrow: true });
    if (geometry === null) throw new Error(`Missing original colourway geometry ${name}`);
    return geometry;
  };
  for (const key of Object.keys(lodBasis)) {
    const [name, suffix] = key.split(':'), base = lodBases.get(name ?? '');
    if (base === undefined || suffix === undefined) throw new Error(`Missing native LOD base ${key}`);
    const path = `${name}-${suffix}`;
    const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
      geometryPools: [{ url: path, parts: [path], channels: name === 'dragon-hook' ? [] : CAST_CHANNELS }],
    }, 'test Nine LOD casts', {}, async () => (await readSourceModel(rawCast(path))).gltf);
    await library.preload();
    const prepared = library.geometry(path, { borrow: true });
    if (prepared === null) throw new Error(`Missing packed LOD ${key}`);
    lodGeometries.set(key, suffix === 'far' ? prepared : drawnLevel(name ?? '', path, base, prepared));
    if (suffix.startsWith('mid') && ['walker-oxblood', 'walker-blue', 'walker-paper'].includes(name ?? '')) {
      const previousBase = await original(name ?? ''), previousPrepared = await original(path);
      const variantSource = lodBases.get(name === 'walker-paper' ? 'walker-light' : 'walker-dark');
      if (variantSource === undefined) throw new Error('Missing original colourway source');
      originalColourLods.set(key, { geometry: drawnLevel(name ?? '', path, previousBase, previousPrepared), base: previousBase,
        half: ['aFace', 'aPat'].filter(channel => variantSource.getAttribute(channel) instanceof Float16BufferAttribute) });
    }
  }
}, 30_000);

test.each(Object.entries(lodBasis))('%s retains native bytes, bounds and buffer sharing', (key, expected) => {
  const geometry = lodGeometries.get(key), base = lodBases.get(key.split(':')[0] ?? '');
  if (geometry === undefined || base === undefined) throw new Error(`Missing prepared LOD ${key}`);
  if (!key.includes(':mid')) { expect(channels(geometry)).toEqual(expected); return; }
  // a middle level draws its own index over the full cast's attributes, so it carries the full cast's bounds
  const { box: _box, sphere: _sphere, ...bytes } = expected, donor = channels(base);
  const original = originalColourLods.get(key);
  if (original === undefined) {
    expect(channels(geometry)).toEqual({ ...bytes, box: v.parse(v.object({ box: v.unknown() }), donor).box, sphere: v.parse(v.object({ sphere: v.unknown() }), donor).sphere });
  } else {
    const previous = channels(original.base);
    expect(channels(original.geometry)).toEqual({ ...bytes, box: v.parse(v.object({ box: v.unknown() }), previous).box, sphere: v.parse(v.object({ sphere: v.unknown() }), previous).sphere });
    const corrected = original.geometry.clone();
    try {
      for (const channel of original.half) {
        const attribute = corrected.getAttribute(channel);
        corrected.setAttribute(channel, new Float32BufferAttribute(Float32Array.from(attribute.array, bits => DataUtils.fromHalfFloat(bits)), attribute.itemSize));
      }
      expect(channels(geometry)).toEqual(channels(corrected));
    } finally { corrected.dispose(); }
  }
  for (const [name, values] of Object.entries(base.attributes)) expect(geometry.getAttribute(name)).toBe(values);
});

test('all entry floors preserve inclusive native deck boundaries', () => {
  const native = [ { x:0, z:242, sx:9.2, sz:16 }, { x:0, z:-242, sx:9.2, sz:16 }, { x:242, z:0, sx:16, sz:9.2 }, { x:-242, z:0, sx:16, sz:9.2 } ];
  for (const slab of native) for (const dx of [-slab.sx/2-1e-7,-slab.sx/2,0,slab.sx/2,slab.sx/2+1e-7]) for (const dz of [-slab.sz/2-1e-7,-slab.sz/2,0,slab.sz/2,slab.sz/2+1e-7]) {
    const x=slab.x+dx,z=slab.z+dz;
    const expected=native.some(s => Math.abs(x-s.x)<=s.sx/2 && Math.abs(z-s.z)<=s.sz/2) ? 0 : undefined;
    expect(floorAtRects(deckFloors,x,z,'first')).toBe(expected);
  }
});
