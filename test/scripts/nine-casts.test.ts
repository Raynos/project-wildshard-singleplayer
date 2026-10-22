// oxlint-disable-next-line import/no-nodejs-modules -- Node-only golden proof hashes exact typed-array storage.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The offline proof reads retained GLBs and published layout inputs.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { BufferAttribute, Float32BufferAttribute, Mesh, MeshBasicMaterial, Box3, Object3D, Sphere, Vector3, type BufferGeometry } from 'three';
import { CAST_BLOBS } from '../../src/shards/nine-dragon-stack/generators/castSources';
import { createOwnedGeometry } from '../../src/engine/models/ownedGeometry';
import metadata from '../../src/shards/nine-dragon-stack/boot/metadata.generated.json' with { type: 'json' };
import hookBounds from '../../src/shards/nine-dragon-stack/data/hookBounds.json' with { type: 'json' };
import { createModelLibrary } from '../../src/game/plugin/geometry';
import { readSourceModel } from '../../src/sdk/bake/skinned';
import type { PreparedGeometry } from '../../src/shards/nine-dragon-stack/data/casts';
import castRows from '../../src/shards/nine-dragon-stack/data/casts.json' with { type: 'json' };
import { layoutBlobs } from '../../src/shards/nine-dragon-stack/generators/layoutBlobs';
import { bakeCasts, bakeFixedKits, castGeometry } from '../../src/shards/nine-dragon-stack/generators/casts';
import { layoutProjection, restoreLayoutZeros, reviveLayout as layoutReviver } from '../../src/shards/nine-dragon-stack/generators/layoutProjection';
import { LayoutRowsSchema, GeometryBootSchema } from '../../src/shards/nine-dragon-stack/generators/sections';
import * as v from 'valibot';
import { Scope } from '../../src/engine/app/scope';
import { modelContext } from '../../src/engine/models/model';
import { Rng } from '../../src/engine/core/rng';
import { bindWorldSceneModelSources, defineWorldSceneCatalogue } from '../../src/game/models/worldSceneCatalogue';
import { parseWorldSceneModels } from '../../src/format/worldSceneModels';
import { floorAtRects } from '../../src/engine/physics/box';
import deckFloors from '../../src/shards/nine-dragon-stack/data/deckFloors.generated.json' with { type: 'json' };
import lodBasis from '../fixtures/nine-lods.json' with { type: 'json' };
import baseline from '../fixtures/nine-casts.json' with { type: 'json' };

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
let fixed: ReturnType<typeof bakeFixedKits>;
beforeAll(async () => {
  const layout: unknown = JSON.parse(readFileSync('src/shards/nine-dragon-stack/data/layout.generated.json', 'utf8'), layoutReviver);
  const row = v.parse(v.object({ rows: LayoutRowsSchema }), layout);
  fixed = bakeFixedKits(row.rows.slots);
  packs = await bakeCasts(url => new Uint8Array(readFileSync(`public${url}`)));
  for (const [key, bytes] of fixed.packs) packs.set(key, bytes);
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
  expect(channels(geometry)).toEqual(baseline[name]);
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
  const raw: unknown = JSON.parse(readFileSync('src/shards/nine-dragon-stack/data/layout.generated.json', 'utf8'), layoutReviver);
  const original = v.parse(v.object({ rows: LayoutRowsSchema, count: v.number(), records: v.array(v.number()),
    bounds: v.array(v.object({ sphere: v.array(v.number()), box: v.array(v.number()) })) }), raw);
  const blobs = layoutBlobs(), rows = blobs.find(row => row.file.name === 'geometry/layout.json');
  if (rows === undefined) throw new Error('Missing layout boot blobs');
  expect(blobs.some(row => row.file.name === 'geometry/layout-f64.bin')).toBe(false);
  const decoded: unknown = JSON.parse(new TextDecoder().decode(rows.bytes));
  expect(restoreLayoutZeros(v.parse(GeometryBootSchema, decoded))).toEqual(original.rows);
  expect(rows.file.jsonSchema).toBeDefined();
  expect(layoutProjection(original.rows, original.records, original.bounds).fixed.lanterns).toEqual(fixed.lanterns);
});


const lodGeometries = new Map<string, BufferGeometry>();
const lodBases = new Map<string, BufferGeometry>();
beforeAll(async () => {
  const read = (url: string): Uint8Array => new Uint8Array(readFileSync(`public${url}`));
  for (const name of ['lion', 'walker-dark', 'walker-light', 'sitter-dark', 'sitter-light'] as const) lodBases.set(name, await castGeometry(name, read));
  for (const name of ['walker-oxblood', 'walker-paper', 'walker-blue']) {
    const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
      geometryPools: [{ url: name, parts: [name], channels: CAST_CHANNELS }],
    }, 'test Nine baked dye', {}, async () => (await readSourceModel(read(`/assets/nine-dragon/baked/casts/${name}.glb`))).gltf);
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
  const nativeHook = bakedHook.take(), bounds = metadata.specimens.hook.bounds;
  nativeHook.boundingBox = new Box3(new Vector3().fromArray(bounds.box.min), new Vector3().fromArray(bounds.box.max));
  nativeHook.boundingSphere = new Sphere(new Vector3().fromArray(bounds.sphere.center), bounds.sphere.radius);
  // the catalogue row's sphere (data/hookBounds.json) is the source cast's own
  expect(hookBounds.sphere).toEqual([...bounds.sphere.center, bounds.sphere.radius]);
  expect(channels(nativeHook)).toEqual(channels(hook));
  for (const key of Object.keys(lodBasis)) {
    const [name, suffix] = key.split(':'), base = lodBases.get(name ?? '');
    if (base === undefined || suffix === undefined) throw new Error(`Missing native LOD base ${key}`);
    const path = `${name}-${suffix}`;
    const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
      geometryPools: [{ url: path, parts: [path], channels: name === 'dragon-hook' ? [] : CAST_CHANNELS }],
    }, 'test Nine LOD casts', {}, async () => (await readSourceModel(read(`/assets/nine-dragon/baked/casts/${path}.glb`))).gltf);
    await library.preload();
    const prepared = library.geometry(path, { borrow: true });
    if (prepared === null) throw new Error(`Missing packed LOD ${key}`);
    lodGeometries.set(key, suffix === 'far' ? prepared : drawnLevel(name ?? '', path, base, prepared));
  }
}, 30_000);

test.each(Object.entries(lodBasis))('%s retains native bytes, bounds and buffer sharing', (key, expected) => {
  const geometry = lodGeometries.get(key), base = lodBases.get(key.split(':')[0] ?? '');
  if (geometry === undefined || base === undefined) throw new Error(`Missing prepared LOD ${key}`);
  if (!key.includes(':mid')) { expect(channels(geometry)).toEqual(expected); return; }
  // a middle level draws its own index over the full cast's attributes, so it carries the full cast's bounds
  const { box: _box, sphere: _sphere, ...bytes } = expected, donor = channels(base);
  expect(channels(geometry)).toEqual({ ...bytes, box: v.parse(v.object({ box: v.unknown() }), donor).box, sphere: v.parse(v.object({ sphere: v.unknown() }), donor).sphere });
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
