import { Document, NodeIO } from '@gltf-transform/core';
import * as v from 'valibot';
import { beforeAll, expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { bakeWorldTexture } from '../src/sdk/bake/textureWasm';
import { hashImmutableBytes as hash } from '../src/sdk/immutable';
import { PropsSchema, validatePropsReferences } from '../src/game/shardfile/props';
import { PropMaterialsSchema } from '../src/game/shardfile/propMaterials';
import { parseShardfile, type Shardfile } from '../src/game/shardfile/schema';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { assetCost } from '../src/game/shardfile/assets';

let texture: Uint8Array;
beforeAll(async () => {
  // Exact 2x2 RGBA PNG fixture; image decoding remains owned by the SDK dependency.
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGOQi0r5D8IMMAYAPYQHbeGDBAUAAAAASUVORK5CYII='), character => character.codePointAt(0) ?? 0);
  texture = await bakeWorldTexture(png, 'srgb');
});
function model(name: string, nodeName = 'Door'): Promise<Uint8Array> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('World'); doc.getRoot().setDefaultScene(scene);
  const primitive = doc.createPrimitive().setMaterial(doc.createMaterial(name))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(Float32Array.of(0, 0, 0, 1, 0, 0, 0, 0, 1)).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(Float32Array.of(0, 0, 1, 0, 0, 1)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint16Array.of(0, 2, 1)).setBuffer(buffer));
  scene.addChild(doc.createNode(nodeName).setExtras({ castShadow: false }).setMesh(doc.createMesh().addPrimitive(primitive)));
  return new NodeIO().writeBinary(doc);
}
function add(shard: Shardfile, assets: Map<string, Uint8Array>, bytes: Uint8Array, kind: 'glb' | 'ktx2', dependencies: string[] = []) {
  const file = { hash: hash(bytes), kind, compressed: bytes.length, ...assetCost(kind, bytes), dependencies, critical: false };
  shard.files.push(file); assets.set(file.hash, bytes); return file;
}
async function fixture(kind: 'tile' | 'panel' | 'model' | 'far' = 'model', name = 'Door paint', named = true) {
  const source = emptyShardfile({ slug: 'named-props', name: 'Named props', author: 'Fixture', revision: 1, seed: 1 }), assets = new Map<string, Uint8Array>();
  const tex = add(source, assets, texture, 'ktx2'), file = add(source, assets, await model(name), 'glb', [tex.hash]);
  source.props = { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, colliders: [], textures: [] };
  if (named) source.props.materials = v.parse(PropMaterialsSchema, { 'Door paint': { id: 'pbr', colour: { file: tex.hash, wrapS: 33071, wrapT: 10497, minFilter: 9987, magFilter: 9729 } } });
  const costs = { compressed: file.compressed + tex.compressed, decoded: file.decoded + tex.decoded, gpu: file.gpu + tex.gpu, triangles: file.triangles, draws: file.draws };
  if (kind === 'tile') {
    source.props.tiles.push({ lod: 0, x: 4, z: 4, file: file.hash });
    source.tiles.push({ lod: 0, x: 4, z: 4, files: [file.hash], bounds: { min: [0, 0, 0], max: [62.5, 1, 62.5] }, geometricError: 0, ...costs });
  } else if (kind === 'far') {
    source.props.far = file.hash;
    source.far = { files: [file.hash], bounds: { min: [-250, 0, -250], max: [250, 1, 250] }, ...costs };
  } else {
    if (kind === 'panel') source.props.panels.push({ id: 'door', file: file.hash, visible: true });
    else source.props.models.push({ id: 'door', file: file.hash });
    source.library.push(file.hash); source.budgets.library = { compressed: costs.compressed, resident: costs.decoded + costs.gpu };
  }
  return { source, assets, file, tex };
}
it('keeps an absent materials field absent and the existing family path admissible', async () => {
  const { source, assets } = await fixture('model', 'Door paint', false), before = JSON.stringify(source.props);
  expect(Object.hasOwn(v.parse(PropsSchema, source.props), 'materials')).toBe(false);
  expect(JSON.stringify(validateShardfileAssets(source, assets, hash).props)).toBe(before);
});
it.each(['tile', 'panel', 'model', 'far'] as const)('admits named %s materials through the full schema and real immutable byte validator', async kind => {
  const { source, assets } = await fixture(kind);
  const admitted = validateShardfileAssets(source, assets, hash);
  expect(admitted.props?.materials?.['Door paint']?.id).toBe('pbr');
  expect(admitted.props?.materials?.['Door paint']?.colour?.wrapS).toBe(33071);
  expect(parseShardfile(admitted).props).toEqual(admitted.props);
});
it.each(['tile', 'panel', 'model', 'far'] as const)('refuses an unmapped source glTF name in an admitted %s GLB, naming it', async kind => {
  const { source, assets } = await fixture(kind, 'Brass Rail.001');
  expect(() => validateShardfileAssets(source, assets, hash)).toThrow('props GLB material "Brass Rail.001" is not in props.materials');
});
it('runs named reference checks in the format before immutable reads', async () => {
  const { source } = await fixture();
  const props = source.props; if (props?.materials === undefined) throw new Error('Missing named props fixture');
  const binding = props.materials['Door paint']; if (binding === undefined) throw new Error('Missing named fixture binding');
  binding.id = 'missing.material';
  expect(() => validatePropsReferences(props, source)).toThrow('not an admitted material ID');
  expect(() => parseShardfile(source)).toThrow('shardfile semantic rules');
});
it('refuses a texture declared only by another props GLB, even when their combined dependency union has it', async () => {
  const { source, assets, file, tex } = await fixture();
  const props = source.props; if (props === null) throw new Error('Missing props fixture');
  file.dependencies = [];
  const other = add(source, assets, await model('Door paint', 'Another door'), 'glb', [tex.hash]);
  props.models.push({ id: 'another-door', file: other.hash }); source.library.push(other.hash);
  source.budgets.library.compressed += other.compressed; source.budgets.library.resident += other.decoded + other.gpu;
  expect(() => validatePropsReferences(props, source)).not.toThrow();
  expect(() => validateShardfileAssets(source, assets, hash)).toThrow('texture must be a KTX2 dependency of a declared props GLB');
});
it('checks hashes before parsing material names from immutable props bytes', async () => {
  const { source, assets, file } = await fixture();
  assets.set(file.hash, new Uint8Array(file.compressed));
  expect(() => validateShardfileAssets(source, assets, hash)).toThrow('file hash or wire size mismatch');
});
