import { Document, NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { normalizeWorldGlb } from '../src/sdk/bake/world';

const source = () => ({ glb: 'assets/world.glb', materials: { Clay: 'world.clay', Paint: 'world.paint' }, colliders: 'mesh', objects: { Bridge: 'bridge' }, interactive: [{ node: 'Door', id: 'door', colliderId: 'door.collider' }] });
const admitted = ['world.clay', 'world.paint'];
function fixture(elevated = false): Promise<Uint8Array> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('World'); doc.getRoot().setDefaultScene(scene);
  const image = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='), (character) => character.codePointAt(0) ?? 0);
  const texture = doc.createTexture('paint').setImage(image).setMimeType('image/png');
  const clay = doc.createMaterial('Clay').setBaseColorFactor([0.4, 0.5, 0.6, 1]).setMetallicFactor(0).setRoughnessFactor(1).setBaseColorTexture(texture);
  const paint = doc.createMaterial('Paint').setBaseColorFactor([0.8, 0.2, 0.1, 1]).setMetallicFactor(0.1).setRoughnessFactor(0.7).setBaseColorTexture(texture).setNormalTexture(texture).setNormalScale(0.5).setOcclusionTexture(texture).setOcclusionStrength(0.25);
  const positions = doc.createAccessor().setType('VEC3').setArray(Float32Array.of(0, 0, 0, 1, elevated ? 1 : 0, 0, 0, 0, 1)).setBuffer(buffer);
  const normals = doc.createAccessor().setType('VEC3').setArray(Float32Array.of(0, 1, 0, 0, 1, 0, 0, 1, 0)).setBuffer(buffer);
  const uv = doc.createAccessor().setType('VEC2').setArray(Float32Array.of(0, 0, 1, 0, 0, 1)).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(Uint16Array.of(0, 1, 2)).setBuffer(buffer);
  const triangle = (material: typeof clay) => doc.createPrimitive().setAttribute('POSITION', positions).setAttribute('NORMAL', normals).setAttribute('TEXCOORD_0', uv).setIndices(indices).setMaterial(material);
  const root = doc.createNode('Placement').setTranslation([10, 2, 20]).setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]).setScale([2, 1, 3]); scene.addChild(root);
  root.addChild(doc.createNode('Bridge').setTranslation([0, 3, 0]).setMesh(doc.createMesh('bridge').addPrimitive(triangle(clay)).addPrimitive(triangle(paint))));
  root.addChild(doc.createNode('Door').setTranslation([2, 0, 0]).setScale([-1, 2, 1]).setMesh(doc.createMesh('door').addPrimitive(triangle(paint))));
  scene.addChild(doc.createNode('ws_terrain_ground').setMesh(doc.createMesh('ground').addPrimitive(triangle(clay))));
  return new NodeIO().writeBinary(doc);
}
function rewrite(bytes: Uint8Array, change: (json: Record<string, unknown>) => void): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), size = view.getUint32(12, true);
  const json: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + size)));
  if (typeof json !== 'object' || json === null || Array.isArray(json)) throw new Error('fixture object');
  change(json as Record<string, unknown>);
  const text = new TextEncoder().encode(JSON.stringify(json)), padded = Math.ceil(text.length / 4) * 4, binary = bytes.subarray(28 + size);
  const output = new Uint8Array(28 + padded + binary.length), header = new DataView(output.buffer);
  for (const [offset, value] of [[0, 0x46546c67], [4, 2], [8, output.length], [12, padded], [16, 0x4e4f534a], [20 + padded, binary.length], [24 + padded, 0x004e4942]]) if (offset !== undefined && value !== undefined) header.setUint32(offset, value, true);
  output.fill(32, 20, 20 + padded); output.set(text, 20); output.set(binary, 28 + padded); return output;
}
function rows(json: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = json[key]; if (!Array.isArray(value)) throw new Error('fixture array');
  return value.map((item: unknown) => { if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error('fixture row'); return item as Record<string, unknown>; });
}

it('normalizes real transformed multi-material geometry and retains embedded textures deterministically', async () => {
  const bytes = await fixture(), a = await normalizeWorldGlb(bytes, source(), admitted), b = await normalizeWorldGlb(bytes, source(), admitted);
  expect(a).toEqual(b); expect(a.static).toHaveLength(3); expect(a.collision).toHaveLength(3); expect(a.panels).toHaveLength(1);
  const bridge = a.static.find((primitive) => primitive.objectId === 'bridge');
  expect(bridge?.positions[0]).toBeCloseTo(10); expect(bridge?.positions[1]).toBeCloseTo(5); expect(bridge?.positions[2]).toBeCloseTo(20);
  expect(bridge?.positions[3]).toBeCloseTo(10); expect(bridge?.positions[5]).toBeCloseTo(18); expect(bridge?.positions[6]).toBeCloseTo(13);
  expect(a.static.filter((primitive) => primitive.node === 'Bridge').map((primitive) => a.materials[primitive.material]?.name)).toEqual(['Clay', 'Paint']);
  expect(a.static.some((primitive) => primitive.terrain)).toBe(true); expect(a.images).toHaveLength(1); expect(a.images[0]?.width).toBe(1);
  expect(a.materials.find((material) => material.name === 'Paint')?.normalScale).toBe(0.5);
  expect(a.materials.find((material) => material.name === 'Paint')?.maps.normal?.image).toBe(a.images[0]?.hash);
  expect(a.materials.find((material) => material.name === 'Paint')?.maps.occlusion?.image).toBe(a.images[0]?.hash);
});

it('partitions a mirrored door from static render/collision while retaining local geometry and exact placement', async () => {
  const result = await normalizeWorldGlb(await fixture(), source(), admitted), panel = result.panels[0], triangle = panel?.primitives[0];
  expect(result.static.some((primitive) => primitive.node === 'Door')).toBe(false); expect(result.collision.some((primitive) => primitive.node === 'Door')).toBe(false);
  expect(panel?.colliderId).toBe('door.collider'); expect(Array.from(triangle?.indices ?? [])).toEqual([0, 1, 2]);
  if (panel === undefined || triangle === undefined) throw new Error('door panel');
  const placed = new Vector3().fromArray(triangle.positions, 3).applyMatrix4(new Matrix4().fromArray(panel.transform));
  expect(placed.x).toBeCloseTo(10); expect(placed.y).toBeCloseTo(2); expect(placed.z).toBeCloseTo(18);
});

it('keeps collision-only nodes out of render and refuses absent or overlapping annotations', async () => {
  const bytes = await fixture(), nodeCollision = { ...source(), colliders: 'nodes:ws_terrain', objects: { Bridge: 'bridge', ws_terrain_ground: 'ground' } };
  const result = await normalizeWorldGlb(bytes, nodeCollision, admitted);
  expect(result.collision.map((primitive) => primitive.node)).toEqual(['ws_terrain_ground']); expect(result.collision[0]?.objectId).toBe('ground'); expect(result.static.map((primitive) => primitive.node)).toEqual(['Bridge', 'Bridge']);
  await expect(normalizeWorldGlb(bytes, { ...source(), colliders: 'nodes:missing_' }, admitted)).rejects.toThrow('matches no nodes');
  await expect(normalizeWorldGlb(bytes, { ...source(), colliders: 'nodes:Door' }, admitted)).rejects.toThrow('hierarchies overlap');
  await expect(normalizeWorldGlb(bytes, { ...source(), objects: { Missing: 'missing' } }, admitted)).rejects.toThrow('Missing is missing');
  await expect(normalizeWorldGlb(bytes, { ...source(), objects: { Placement: 'parent' } }, admitted)).rejects.toThrow('hierarchies overlap');
});

it('retains affine shear without TRS decomposition and corrects static mirrored winding', async () => {
  const bytes = rewrite(await fixture(true), (json) => {
    const bridge = rows(json, 'nodes').find((node) => node['name'] === 'Bridge'); if (bridge === undefined) throw new Error('bridge');
    Reflect.deleteProperty(bridge, 'translation'); bridge['matrix'] = [-1, 0, 0, 0, 0.5, 1, 0, 0, 0, 0, 1, 0, 0, 3, 0, 1];
  });
  const result = await normalizeWorldGlb(bytes, source(), admitted), bridge = result.static[0];
  expect(Array.from(bridge?.indices ?? [])).toEqual([0, 2, 1]); expect(bridge?.positions[5]).toBeCloseTo(21); expect(bridge?.positions[4]).toBeCloseTo(6);
  expect(bridge?.normals?.[1]).toBeCloseTo(1);
});

it('names unmapped materials and rejects mappings to undeclared output IDs', async () => {
  const bytes = await fixture();
  await expect(normalizeWorldGlb(bytes, { ...source(), materials: { Clay: 'world.clay' } }, admitted)).rejects.toThrow('material Paint is unmapped');
  await expect(normalizeWorldGlb(bytes, source(), ['world.clay'])).rejects.toThrow('material Paint is unmapped');
  await expect(normalizeWorldGlb(bytes, { ...source(), materials: { ...source().materials, Typo: 'world.clay' } }, admitted)).rejects.toThrow('mapping Typo has no source material');
});

it.each(['external-buffer', 'external-image', 'extension', 'animation', 'cycle', 'multiple-parents', 'outside', 'zero-scale', 'accessor', 'duplicate', 'attribute', 'morph', 'no-uv', 'duplicate-material', 'image-mime', 'uv1', 'sampler', 'missing-image', 'missing-texture'])('refuses unsupported or invalid real GLB %s', async (kind) => {
  const bytes = rewrite(await fixture(), (json) => {
    const nodes = rows(json, 'nodes'), bridge = nodes.find((node) => node['name'] === 'Bridge');
    if (bridge === undefined) throw new Error('bridge');
    if (kind === 'external-buffer') { const buffer = rows(json, 'buffers')[0]; if (buffer !== undefined) buffer['uri'] = 'https://invalid/buffer'; }
    if (kind === 'external-image') { const image = rows(json, 'images')[0]; if (image !== undefined) image['uri'] = 'https://invalid/image.png'; }
    if (kind === 'extension') bridge['extensions'] = { EXT_mesh_gpu_instancing: {} };
    if (kind === 'animation') json['animations'] = [{}];
    if (kind === 'cycle') bridge['children'] = [0];
    if (kind === 'multiple-parents') { const ground = nodes.find((node) => node['name'] === 'ws_terrain_ground'); if (ground !== undefined) ground['children'] = [nodes.indexOf(bridge)]; }
    if (kind === 'outside') bridge['translation'] = [300, 3, 0];
    if (kind === 'zero-scale') bridge['scale'] = [0, 1, 1];
    if (kind === 'accessor') { const accessor = rows(json, 'accessors')[0]; if (accessor !== undefined) accessor['count'] = 12_000_001; }
    if (kind === 'duplicate') bridge['name'] = 'Door';
    if (kind === 'duplicate-material') { const material = rows(json, 'materials')[1]; if (material !== undefined) material['name'] = 'Clay'; }
    if (kind === 'image-mime') { const image = rows(json, 'images')[0]; if (image !== undefined) image['mimeType'] = 'image/jpeg'; }
    if (kind === 'sampler') { const sampler = rows(json, 'samplers')[0]; if (sampler !== undefined) sampler['wrapS'] = 42; }
    if (kind === 'missing-image') { const texture = rows(json, 'textures')[0]; if (texture !== undefined) texture['source'] = 10000; }
    if (kind === 'missing-texture') json['textures'] = [];
    if (kind === 'uv1') {
      const material = rows(json, 'materials')[0], pbr = material?.['pbrMetallicRoughness'];
      if (typeof pbr !== 'object' || pbr === null) throw new Error('pbr');
      const texture: unknown = Reflect.get(pbr, 'baseColorTexture');
      if (typeof texture !== 'object' || texture === null) throw new Error('texture'); Reflect.set(texture, 'texCoord', 1);
    }
    if (['attribute', 'morph', 'no-uv'].includes(kind)) {
      const mesh = rows(json, 'meshes')[0]; if (mesh === undefined) throw new Error('mesh');
      const primitive = rows(mesh, 'primitives')[0]; if (primitive === undefined) throw new Error('primitive');
      const attributes = primitive['attributes']; if (typeof attributes !== 'object' || attributes === null) throw new Error('attributes');
      if (kind === 'attribute') Reflect.set(attributes, 'TEXCOORD_1', Reflect.get(attributes, 'TEXCOORD_0'));
      if (kind === 'morph') primitive['targets'] = [{}];
      if (kind === 'no-uv') Reflect.deleteProperty(attributes, 'TEXCOORD_0');
    }
  });
  await expect(normalizeWorldGlb(bytes, source(), admitted)).rejects.toThrow(/World GLB/u);
});

it('handles an unaligned owned slice without changing source bytes and refuses truncation before decode', async () => {
  const original = await fixture(), padded = new Uint8Array(original.length + 1); padded.set(original, 1);
  expect(await normalizeWorldGlb(padded.subarray(1), source(), admitted)).toEqual(await normalizeWorldGlb(original, source(), admitted));
  expect(padded.subarray(1)).toEqual(original);
  await expect(normalizeWorldGlb(original.subarray(0, -4), source(), admitted)).rejects.toThrow('World GLB');
});
