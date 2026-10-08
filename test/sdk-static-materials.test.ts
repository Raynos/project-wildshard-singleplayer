import { BufferGeometry, Float32BufferAttribute, Matrix4, MeshLambertMaterial, MeshStandardMaterial, Texture, SRGBColorSpace } from 'three';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshGPUInstancing } from '@gltf-transform/extensions';
import * as v from 'valibot';
import { beforeAll, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- A real bounded raster fixture exercises the owned SDK encoder.
import { readFile } from 'node:fs/promises';
import { captureStaticMaterial, StaticMaterialCatalogue, checkStaticMaterialDependencies, staticMaterialNames } from '../src/sdk/bake/staticMaterials';
import { bakeWorldTexture } from '../src/sdk/bake/textureWasm';
import { staticGlb } from '../src/sdk/bake/glb';
import { WorldBakeRows } from '../src/sdk/bake/worldRows';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { MaterialsSchema } from '../src/game/shardfile/materials';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { emptyShardfile } from '../src/sdk/author';

let colour: Uint8Array, linear: Uint8Array;
beforeAll(async () => {
  const png = await readFile('test/fixtures/world-source/image.png');
  colour = await bakeWorldTexture(png, 'srgb'); linear = await bakeWorldTexture(png, 'linear');
  expect(await bakeWorldTexture(png, 'srgb', { flipY: true })).not.toEqual(colour);
});
const look = () => v.parse(MaterialsSchema, { 'native.ground': { family: 'painterly', colour: [1, 1, 1] }, 'props.paint': { family: 'pbr', colour: [1, 1, 1] } });
function surface(name = 'sign.front', id = 'props.paint', textured = true) {
  const source = new MeshLambertMaterial(); source.color.setRGB(0.2, 0.4, 0.6); source.emissive.setRGB(0.1, 0.2, 0.3); source.emissiveIntensity = 0.5;
  if (textured) { source.map = new Texture(); source.map.colorSpace = SRGBColorSpace; source.map.anisotropy = 4; }
  const captured = captureStaticMaterial(source, { name, id }, () => ({ id: 'generated/sign-atlas-original', width: 8, height: 8 }));
  return { source, captured };
}
function triangles() {
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 4, 0, 0, 0, 0, 4, 4, 0, 4], 3))
    .setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    .setAttribute('uv', new Float32BufferAttribute([0.1, 0.2, 0.4, 0.2, 0.1, 0.8, 0.4, 0.8], 2)).setIndex([0, 2, 1, 1, 2, 3]);
}
it('captures unnamed real Lambert factors and atlas identity independently of later source mutation', () => {
  const { source, captured } = surface();
  expect(source.name).toBe(''); expect(captured.name).toBe('sign.front');
  expect(captured.colour).toEqual([0.2, 0.4, 0.6, 1]); expect(captured.emissive).toEqual([0.05, 0.1, 0.15]);
  expect(captured.maps.colour).toMatchObject({ image: 'generated/sign-atlas-original', width: 8, height: 8, anisotropy: 4, flipY: true });
  source.color.setRGB(1, 0, 0); expect(captured.colour[0]).toBe(0.2); source.map?.dispose(); source.dispose();
});
it('packs ground and atlas-bearing props under distinct named look entries with exact UVs, factors and instances', async () => {
  const ground = surface('ground', 'native.ground', false), prop = surface(), geometry = triangles();
  geometry.addGroup(0, 3, 0); geometry.addGroup(3, 3, 1);
  const catalogue = new StaticMaterialCatalogue([ground.captured, prop.captured], look(), (image, role) => {
    expect(image.image).toBe('generated/sign-atlas-original'); expect(image.flipY).toBe(true); expect(role).toBe('srgb'); return colour;
  });
  let sourceDisposed = false; geometry.addEventListener('dispose', () => { sourceDisposed = true; });
  try {
    const instances = [new Matrix4(), new Matrix4().makeTranslation(2, 0, 0)];
    const primitives = catalogue.primitives(geometry, ['ground', 'sign.front'], { instances });
    expect(primitives).toHaveLength(2); expect(primitives[0]?.instances).toBe(instances);
    expect(primitives.map(row => Array.from(row.geometry.index?.array ?? []))).toEqual([[0, 2, 1], [1, 2, 3]]);
    const bytes = staticGlb(primitives), snapshot = catalogue.snapshot(), deps = catalogue.dependencies(['ground', 'sign.front']);
    expect(staticMaterialNames(bytes)).toEqual(['ground', 'sign.front']);
    expect(snapshot.materials['ground']?.id).toBe('native.ground'); expect(snapshot.materials['sign.front']?.id).toBe('props.paint');
    expect(snapshot.materials['sign.front']?.colour?.anisotropy).toBe(4); expect(deps).toEqual([hashImmutableBytes(colour)]);
    checkStaticMaterialDependencies(bytes, snapshot.materials, deps);
    const doc = await new NodeIO().registerExtensions([EXTMeshGPUInstancing]).readBinary(bytes), material = doc.getRoot().listMaterials()[1];
    expect(material?.getBaseColorFactor()).toEqual(prop.captured.colour); expect(material?.getEmissiveFactor()).toEqual(prop.captured.emissive);
    expect(Array.from(doc.getRoot().listMeshes()[1]?.listPrimitives()[0]?.getAttribute('TEXCOORD_0')?.getArray() ?? [])).toEqual(Array.from(geometry.getAttribute('uv').array));
    const rows = new WorldBakeRows(); for (const texture of snapshot.textures.values()) rows.asset(texture, 'ktx2');
    rows.tile({ lod: 0, x: 4, z: 4, bounds: { min: [0, 0, 0], max: [62.5, 0, 62.5] }, bytes, dependencies: deps });
    const packed = rows.finish('native.ground', snapshot);
    expect(packed.files.filter(row => row.kind === 'ktx2')).toHaveLength(1);
    const source = emptyShardfile({ slug: 'material-fixture', name: 'Material fixture', author: 'Fixture', revision: 1, seed: 435 });
    source.look.materials = look(); source.props = packed.props; source.files = packed.files; source.tiles = packed.tiles;
    expect(validateShardfileAssets(source, packed.assets, hashImmutableBytes).props?.materials).toEqual(snapshot.materials);
  } finally { catalogue.dispose(); expect(sourceDisposed).toBe(false); geometry.dispose(); ground.source.dispose(); prop.source.map?.dispose(); prop.source.dispose(); }
});
it('refuses an unresolved slot, lost UVs, unsupported shader transport and an atlas resized or in the wrong colour role', () => {
  const { source, captured } = surface(), geometry = triangles();
  expect(() => new StaticMaterialCatalogue([captured], {}, () => colour)).toThrow('explicit look');
  expect(() => new StaticMaterialCatalogue([{ ...captured, maps: { ...captured.maps, colour: { ...captured.maps.colour, image: 'atlas', width: 9, height: 8, wrapS: 10497, wrapT: 10497, minFilter: 9987, magFilter: 9729 } } }], look(), () => colour)).toThrow('extent changed');
  expect(() => new StaticMaterialCatalogue([captured], look(), () => linear)).toThrow('transfer');
  const catalogue = new StaticMaterialCatalogue([captured], look(), () => colour);
  try {
    expect(() => catalogue.primitive('unknown', geometry)).toThrow('Unmapped');
    geometry.deleteAttribute('uv'); expect(() => catalogue.primitive('sign.front', geometry)).toThrow('UV0');
    source.map?.repeat.set(2, 1); expect(() => captureStaticMaterial(source, { name: 'sign.front', id: 'props.paint' }, () => ({ id: 'atlas', width: 8, height: 8 }))).toThrow('identity transform');
  } finally { catalogue.dispose(); source.map?.dispose(); source.dispose(); geometry.dispose(); }
});
it('refuses sampler conflicts, incomplete material groups and dependencies borrowed from another tile', () => {
  const a = surface(), b = surface('sign.back'); if (b.captured.maps.colour === null) throw new Error('Missing atlas');
  b.captured.maps.colour.wrapS = 10497;
  expect(() => new StaticMaterialCatalogue([a.captured, b.captured], look(), () => colour)).toThrow('mix samplers');
  const geometry = triangles(), catalogue = new StaticMaterialCatalogue([a.captured], look(), () => colour);
  try {
    geometry.addGroup(0, 3, 0); expect(() => catalogue.primitives(geometry, ['sign.front', 'sign.front'])).toThrow('omit triangles');
    const bytes = staticGlb([catalogue.primitive('sign.front', geometry)]), snapshot = catalogue.snapshot();
    const rows = new WorldBakeRows(); rows.asset(colour, 'ktx2'); rows.tile({ lod: 0, x: 4, z: 4, bounds: { min: [0, 0, 0], max: [4, 0, 4] }, bytes });
    expect(() => rows.finish('props.paint', snapshot)).toThrow('missing its own colour dependency');
    expect(() => checkStaticMaterialDependencies(bytes, {}, catalogue.dependencies(['sign.front']))).toThrow('Unmapped');
  } finally { catalogue.dispose(); geometry.dispose(); for (const row of [a, b]) { row.source.map?.dispose(); row.source.dispose(); } }
});
it('retains mask cutoff and emission in the real GLB instead of silently turning masked surfaces opaque', async () => {
  const source = new MeshStandardMaterial({ alphaTest: 0.4 }); source.emissive.setRGB(0.2, 0.3, 0.4);
  const captured = captureStaticMaterial(source, { name: 'leaf', id: 'leaf' }, () => { throw new Error('No textures'); });
  const catalogue = new StaticMaterialCatalogue([captured], v.parse(MaterialsSchema, { leaf: { family: 'pbr', alphaCutoff: 0.4 } }), () => { throw new Error('No textures'); });
  const geometry = triangles();
  try {
    const doc = await new NodeIO().readBinary(staticGlb([catalogue.primitive('leaf', geometry)])), material = doc.getRoot().listMaterials()[0];
    expect(material?.getAlphaMode()).toBe('MASK'); expect(material?.getAlphaCutoff()).toBe(0.4); expect(material?.getEmissiveFactor()).toEqual([0.2, 0.3, 0.4]);
  } finally { catalogue.dispose(); geometry.dispose(); source.dispose(); }
});
