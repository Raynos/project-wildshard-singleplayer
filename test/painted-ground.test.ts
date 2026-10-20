// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { BufferAttribute, Matrix4, MeshLambertMaterial, Texture, Vector3, Vector4 } from 'three';
import { Terrain } from '../src/engine/world/Terrain';
import type { PainterField } from '../src/engine/render/look';
import { Scope } from '../src/engine/app/scope';
import { paintedGroundPainter } from '../src/game/looks/painterlyLook';
import * as specimens from '../src/game/models/specimenCatalogue';
import * as runtimeProducts from '../src/game/shardfile/runtimeProduct';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import slate from '../src/shards/far-reach/data/rocSlate.json' with { type: 'json' };

// A made-up reed marsh (the painted ground's fixture second user): two tile layers, its own colour graph, ground and bank.
function triangle(): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 } }] }], buffers: [{ byteLength: 72 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' }] }));
  const padded = Math.ceil(json.length / 4) * 4, bytes = new Uint8Array(12 + 8 + padded + 8 + 72), header = new DataView(bytes.buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, bytes.length, true);
  header.setUint32(12, padded, true); header.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + padded); bytes.set(json, 20);
  header.setUint32(20 + padded, 72, true); header.setUint32(24 + padded, 0x004e4942, true);
  bytes.set(new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer), 28 + padded);
  bytes.set(new Uint8Array(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]).buffer), 64 + padded);
  return bytes;
}
const tile = (name: string) => ({ url: `/assets/marsh/${name}.webp`, phoneUrl: `/assets/marsh/${name}.phone.webp`, name: `marsh-${name}` });
const tiles = { mud: { id: 'mud', texture: tile('mud') }, reed: { id: 'reed', texture: tile('reed') } };
const marsh = { layers: ['mud', 'reed'], colour: 'reeds', material: { bands: 0.3, rim: 0.1, shade: 0.9 },
  surface: { maps: { base: 'mud', track: 'mud', gravel: 'mud', rock: 'reed', snow: 'reed' }, metres: { base: 3, track: 3, gravel: 3, rock: 5, snow: 5 },
    means: { base: [0.4, 0.4, 0.3], rock: [0.5, 0.5, 0.5] }, snow: { line: 400, high: [40, 80] }, wet: [-2, -4] },
  shapes: ['bed', 'bank'], recipe: { file: 'world/marsh.json', key: 'ground' }, mesh: 'bed' };
const recipe = { scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: ['bed', 'bank'] },
  { kind: 'mesh', id: 'bed', geometry: 'bed', material: 'terrain', missing: 'empty' }, { kind: 'mesh', id: 'bank', geometry: 'bank', material: 'terrain', missing: 'empty' }],
  materials: [{ kind: 'port', id: 'terrain', source: 'terrain' }] }, imports: [] };
const bake = { tBakeShadow: { value: null }, uBakeMatrix: { value: new Matrix4() }, uBakeInfo: { value: new Vector3() }, tBakeContact: { value: null }, uContactXf: { value: new Vector4() } };
const field = { ready: () => Promise.resolve(true) } as Pick<PainterField, 'ready'> as PainterField;

afterEach(() => { vi.restoreAllMocks(); });

function product(reads: string[]): ShardProduct {
  const fake = { section: () => ({ reeds: slate }), file: (name: string) => { reads.push(name); return Promise.resolve(triangle()); },
    json: (name: string) => { reads.push(name); return Promise.resolve({ ground: recipe }); } };
  return fake as Pick<ShardProduct, 'section' | 'file' | 'json'> as ShardProduct;
}

test('a second shard paints its ground from its own tiles, colour graph, shapes and recipe', async () => {
  const reads: string[] = [], textures = vi.spyOn(specimens, 'loadSpecimenTexture').mockResolvedValue(new Texture());
  vi.spyOn(runtimeProducts, 'loadFirstPartyProduct').mockResolvedValue(product(reads));
  const terrain = new Terrain();
  await paintedGroundPainter('reed-marsh', marsh, tiles, bake).build(terrain, field, new Scope('reed-marsh'));
  expect(textures.mock.calls.map(call => call[0].name)).toEqual(['marsh-mud', 'marsh-reed']);
  expect(reads).toEqual(['world/terrain/bed.glb', 'world/terrain/bank.glb', 'world/marsh.json']);
  expect(terrain.material).toBeInstanceOf(MeshLambertMaterial); expect(terrain.mesh.material).toBe(terrain.material);
  expect(terrain.group.children.map(child => child.name || child.type)).toHaveLength(2);
  const geometry = terrain.mesh.geometry, normal = geometry.getAttribute('normal');
  if (!(normal instanceof BufferAttribute)) throw new Error('Missing ground normals');
  expect(normal.array.byteLength).toBe(36); normal.onUploadCallback();
  expect(normal.array.byteLength).toBe(0); expect(normal.count).toBe(3);
  expect(geometry.getAttribute('position').array.byteLength).toBe(36);
  expect(geometry.boundingSphere?.radius).toBeGreaterThan(0);
});

test('rows refuse a missing tile, an unknown colour graph and a recipe without its named mesh', async () => {
  vi.spyOn(specimens, 'loadSpecimenTexture').mockResolvedValue(new Texture());
  vi.spyOn(runtimeProducts, 'loadFirstPartyProduct').mockResolvedValue(product([]));
  await expect(paintedGroundPainter('reed-marsh', marsh, { mud: tiles.mud }, bake).build(new Terrain(), field, new Scope('a'))).rejects.toThrow('tile');
  await expect(paintedGroundPainter('reed-marsh', { ...marsh, colour: 'peat' }, tiles, bake).build(new Terrain(), field, new Scope('b'))).rejects.toThrow('colour');
  await expect(paintedGroundPainter('reed-marsh', { ...marsh, mesh: 'pool' }, tiles, bake).build(new Terrain(), field, new Scope('c'))).rejects.toThrow('ground mesh');
});
