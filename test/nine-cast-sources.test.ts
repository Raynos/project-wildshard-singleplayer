// oxlint-disable-next-line import/no-nodejs-modules -- Verify declared source URLs against retained generated cast files.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every decoded geometry byte without object-matcher traversal.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { CAST_BLOBS, CAST_SOURCES } from '../src/shards/nine-dragon-stack/generators/castSources';
import { createModelLibrary } from '../src/game/plugin/geometry';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { parseWorldSceneWeld } from '../src/format/worldSceneWeld';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { loadCrowd } from '../src/shards/nine-dragon-stack/models/crowd';
import type { NdLook } from '../src/shards/nine-dragon-stack/world/modelLook';
import { BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, Texture, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { hydrateWorldSceneWeld } from '../src/game/shardfile/worldSceneWeld';
import hookRows from '../src/shards/nine-dragon-stack/data/hookSpecimen.json' with { type: 'json' };

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;

test('cast resource rows publish exact channels and preserve middle-LOD sharing without mutating source templates', async () => {
  const named = (name: string): Uint8Array => {
    const row = CAST_BLOBS.find(blob => blob.file.name === name);
    if (row === undefined) throw new Error(`Missing cast source blob ${name}`);
    return row.bytes;
  };
  const libraries = new Map(CAST_SOURCES.map(source => [source.id, createModelLibrary<never, never>({
    meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
    geometryPools: source.files.map(({ file, ...row }) => ({ url: file, ...row })),
  }, 'cast-resource proof', {}, async file => {
    const [packed, original] = await Promise.all([readSourceModel(named(file)),
      readSourceModel(new Uint8Array(readFileSync(`public/assets/nine-dragon/baked/casts/${file.split('/').at(-1)}`)))]);
    const name = file.split('/').at(-1)?.replace('.glb', ''), actual = name === undefined ? undefined : packed.gltf.scene.getObjectByName(name);
    const expected = name === undefined ? undefined : original.gltf.scene.getObjectByName(name);
    if (!(actual instanceof Mesh) || !(expected instanceof Mesh)) throw new Error('Missing decoded cast for lossless proof');
    const actualGeometry: unknown = actual.geometry, expectedGeometry: unknown = expected.geometry;
    if (!isGeometry(actualGeometry) || !isGeometry(expectedGeometry)) throw new Error('Missing cast buffer geometry');
    expect(Object.keys(actualGeometry.attributes)).toEqual(Object.keys(expectedGeometry.attributes));
    for (const [key, attribute] of Object.entries(expectedGeometry.attributes)) {
      const decoded = actualGeometry.getAttribute(key);
      expect(decoded.normalized).toBe(attribute.normalized); expect(decoded.itemSize).toBe(attribute.itemSize);
      expect(decoded.array.constructor).toBe(attribute.array.constructor);
      expect(Buffer.compare(new Uint8Array(decoded.array.buffer, decoded.array.byteOffset, decoded.array.byteLength),
        new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)), `${file}:${key}`).toBe(0);
    }
    expect(actualGeometry.index?.array).toEqual(expectedGeometry.index?.array);
    expect(actualGeometry.groups).toEqual(expectedGeometry.groups);
    return packed.gltf;
  })]));
  await Promise.all([...libraries.values()].map(library => library.preload()));
  const hook = createOwnedGeometry('hook'); await hook.load(named('geometry/dragon-hook.glb'));
  const rows = parseWorldSceneWeld(JSON.parse(new TextDecoder().decode(named('world/casts.json'))));
  const handles = new SceneHandles();
  for (const row of rows.resources) {
    if (row.kind !== 'geometry') throw new Error('Casts require geometry resources');
    const geometry = row.source.library === 'cast-hook' ? hook.take() : libraries.get(row.source.library)?.geometry(row.source.model);
    if (geometry === null || geometry === undefined) throw new Error(`Missing declared cast ${row.source.model}`);
    handles.publish(row.id, geometry);
  }
  expect(rows.resources).toHaveLength(37);
  const look: NdLook = { geo: new Map(), neon: null, hookMat: null };
  loadCrowd(look, handles);
  for (const key of ['walker-dark', 'walker-light', 'walker-oxblood', 'walker-paper', 'walker-blue', 'sitter-dark', 'sitter-light']) {
    const base = handles.geometry(`casts.${key}`);
    expect(look.geo.get(key)).toBe(base);
    for (const distance of [12, 22]) {
      const middle = look.geo.get(`${key}:mid${distance}`);
      const source = CAST_SOURCES.find(row => row.files.some(pool => pool.parts.includes(`${key}-mid${distance}`)));
      const template = source === undefined ? null : libraries.get(source.id)?.geometry(`${key}-mid${distance}`, { borrow: true });
      if (middle === undefined || template === null || template === undefined) throw new Error('Missing prepared crowd LOD');
      for (const [name, attribute] of Object.entries(base.attributes)) {
        expect(middle.getAttribute(name)).toBe(attribute);
        expect(template.getAttribute(name)).not.toBe(attribute);
      }
      expect(middle.index).not.toBe(template.index);
      expect(middle.boundingBox).toBeNull();
    }
  }
  expect(handles.geometry('casts.dragon-hook').getAttribute('uv').array).toBeInstanceOf(Uint16Array);
  for (const row of rows.resources) handles.geometry(row.id).dispose();
}, 30_000);

test('hook material rows retain native properties and borrow the original maps', async () => {
  const { gltf } = await readSourceModel(new Uint8Array(readFileSync('public/assets/nine-dragon/lab/grapple/dragon-hook.glb')));
  const meshes: Mesh[] = [];
  const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
  gltf.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
  const source = meshes[0]?.material;
  if (!(source instanceof MeshStandardMaterial)) throw new Error('Native hook needs a standard surface');
  source.map = new Texture(); source.normalMap = new Texture();
  const expected = source.clone(); expected.color.multiply(new Color(hookRows.material.tint));
  expected.roughness = hookRows.material.roughness; expected.metalness = hookRows.material.metalness;
  const blob = CAST_BLOBS.find(entry => entry.file.name === 'world/casts.json');
  if (blob === undefined) throw new Error('Missing hook material rows');
  const owner = new Scope('hook-material-rows'), handles = new SceneHandles();
  handles.publish('dressing.root', new Group());
  hydrateWorldSceneWeld(JSON.parse(new TextDecoder().decode(blob.bytes)), handles,
    { geometry: new Map(), materials: new Map([['hook-source', source]]) }, owner);
  const actual = handles.standard('casts.hook-brass');
  for (const key of ['side', 'roughness', 'metalness', 'envMapIntensity', 'emissiveIntensity', 'transparent', 'opacity', 'depthWrite', 'vertexColors'] as const) expect(actual[key]).toBe(expected[key]);
  expect(actual.color).toEqual(expected.color); expect(actual.emissive).toEqual(expected.emissive); expect(actual.normalScale).toEqual(expected.normalScale);
  expect(actual.map).toBe(source.map); expect(actual.normalMap).toBe(source.normalMap);
  owner.dispose(); expected.dispose(); source.dispose(); source.map.dispose(); source.normalMap.dispose();
});
