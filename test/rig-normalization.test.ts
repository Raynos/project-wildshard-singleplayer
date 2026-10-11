// oxlint-disable-next-line import/no-nodejs-modules -- Committed Meshopt figures are the exact authoring source oracle.
import { readFileSync } from 'node:fs';
import { NodeIO, type Accessor, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { expect, it } from 'vitest';
import { normalizeRigSource } from '../src/sdk/bake/normalizeRig';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseGlb } from '../src/sdk/assets';

const variants = ['wood-wood', 'straw-cloth', 'wood-steel'];
const source = (variant: string): Uint8Array => Uint8Array.from(readFileSync(new URL(`../public/assets/practice/dummies/${variant}.glb`, import.meta.url)));
const decoder = (): NodeIO => new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
function values(accessor: Accessor | null): Float32Array {
  if (accessor === null) throw new Error('Missing actual channel');
  const result = new Float32Array(accessor.getCount() * accessor.getElementSize()), row: number[] = [];
  for (let index = 0; index < accessor.getCount(); index++) { accessor.getElement(index, row); result.set(row, index * accessor.getElementSize()); }
  return result;
}
function digest(accessor: Accessor | null): unknown {
  const array = accessor?.getArray();
  return array === undefined || array === null ? null : { count: accessor?.getCount(), type: accessor?.getType(), component: accessor?.getComponentType(),
    hash: hashImmutableBytes(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)) };
}
function structure(document: Document): unknown {
  const root = document.getRoot(), nodes = root.listNodes();
  return { nodes: nodes.map(node => { const mesh = node.getMesh(), skin = node.getSkin(); return { name: node.getName(), translation: node.getTranslation(), rotation: node.getRotation(), scale: node.getScale(),
    children: node.listChildren().map(child => nodes.indexOf(child)), mesh: mesh === null ? null : root.listMeshes().indexOf(mesh),
    skin: skin === null ? null : root.listSkins().indexOf(skin) }; }),
  skins: root.listSkins().map(skin => ({ joints: skin.listJoints().map(node => nodes.indexOf(node)), bind: values(skin.getInverseBindMatrices()) })),
  materials: root.listMaterials().map(material => ({ name: material.getName(), base: material.getBaseColorFactor(), metal: material.getMetallicFactor(), rough: material.getRoughnessFactor(),
    alpha: material.getAlphaMode(), cutoff: material.getAlphaCutoff(), sided: material.getDoubleSided(), emissive: material.getEmissiveFactor(), normal: material.getNormalScale(),
    occlusion: material.getOcclusionStrength(), textures: [material.getBaseColorTexture(), material.getNormalTexture(), material.getMetallicRoughnessTexture(), material.getOcclusionTexture(), material.getEmissiveTexture()]
      .map(texture => texture === null ? null : hashImmutableBytes(texture.getImage() ?? new Uint8Array())),
    samplers: [material.getBaseColorTextureInfo(), material.getNormalTextureInfo(), material.getMetallicRoughnessTextureInfo(), material.getOcclusionTextureInfo(), material.getEmissiveTextureInfo()]
      .map(info => info === null ? null : [info.getWrapS(), info.getWrapT(), info.getMinFilter(), info.getMagFilter(), info.getTexCoord()]) })) };
}

it.each(variants)('normalizes %s without changing any decoded channel, joint, topology, sampler or image byte', async variant => {
  await MeshoptDecoder.ready;
  const input = source(variant), original = await decoder().readBinary(input), normalized = await normalizeRigSource(input);
  const output = await decoder().readJSON(structuredClone(normalized));
  expect(structure(output)).toEqual(structure(original));
  expect(normalized.json.extensionsUsed).not.toContain('EXT_meshopt_compression');
  expect(normalized.json.extensionsUsed).not.toContain('KHR_mesh_quantization');
  expect(normalized.json.images).toHaveLength(2);
  for (const image of normalized.json.images ?? []) {
    const bytes = image.uri === undefined ? undefined : normalized.resources[image.uri];
    if (bytes === undefined) throw new Error('Missing external original WebP');
    expect(image.bufferView).toBeUndefined(); expect(image.uri).toBe(`${hashImmutableBytes(bytes)}.webp`);
    expect(original.getRoot().listTextures().some(texture => hashImmutableBytes(texture.getImage() ?? new Uint8Array()) === hashImmutableBytes(bytes))).toBe(true);
  }
  const inputs = original.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives()), outputs = output.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
  expect(outputs).toHaveLength(inputs.length);
  for (const [index, primitive] of inputs.entries()) {
    const result = outputs[index]; if (result === undefined) throw new Error('Lost source primitive');
    expect(result.listSemantics()).toEqual(primitive.listSemantics()); expect(result.getMode()).toBe(primitive.getMode());
    expect(digest(result.getIndices())).toEqual(digest(primitive.getIndices()));
    for (const semantic of primitive.listSemantics()) {
      expect(hashImmutableBytes(new Uint8Array(values(result.getAttribute(semantic)).buffer))).toBe(hashImmutableBytes(new Uint8Array(values(primitive.getAttribute(semantic)).buffer)));
      if (semantic.startsWith('JOINTS_') || semantic.startsWith('WEIGHTS_')) {
        expect(digest(result.getAttribute(semantic))).toEqual(digest(primitive.getAttribute(semantic)));
        expect(result.getAttribute(semantic)?.getNormalized()).toBe(primitive.getAttribute(semantic)?.getComponentType() === 5126 ? false : primitive.getAttribute(semantic)?.getNormalized());
      } else expect(result.getAttribute(semantic)?.getComponentType()).toBe(5126);
    }
  }
  const repeated = await normalizeRigSource(input);
  expect(repeated.json).toEqual(normalized.json);
  for (const [name, bytes] of Object.entries(repeated.resources)) expect(hashImmutableBytes(normalized.resources[name] ?? new Uint8Array())).toBe(hashImmutableBytes(bytes));
  input.fill(0); expect(Object.values(normalized.resources).every(bytes => bytes.some(value => value !== 0))).toBe(true);
  // Prove plain geometry meets admission independently. Float32 skin bytes stay exact; their meaningless
  // normalized=true flag is cleared. Original WebP material dependencies still need their own contract.
  for (const texture of output.getRoot().listTextures()) texture.dispose();
  for (const extension of output.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_texture_webp') extension.dispose();
  const geometry = await decoder().writeBinary(output);
  expect(parseGlb(geometry).triangles).toBeGreaterThan(0);
  expect(parseGlb(geometry).gpu).toBeGreaterThan(0);
});

it('refuses unsupported extensions and incomplete bytes instead of silently dropping them', async () => {
  const input = source(variants[0] ?? ''), view = new DataView(input.buffer), jsonLength = view.getUint32(12, true);
  const text = new TextDecoder().decode(input.subarray(20, 20 + jsonLength));
  const changed = text.replaceAll('KHR_mesh_quantization', 'KHR_fake_quantization');
  input.set(new TextEncoder().encode(changed), 20);
  await expect(normalizeRigSource(input)).rejects.toThrow('explicit extension compiler');
  await expect(normalizeRigSource(source(variants[0] ?? '').subarray(0, -1))).rejects.toThrow('complete GLB');
});
