// Fixed model painting, before shipping: original atlas bytes, exact float geometry and both fitted clone paints.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { rawFromGltf, bakeVertexAO } from './modelPainting.ts';

export const MODEL_NAMES = ['horse-saddled', 'horse-wild', 'wolf', 'sheep', 'snow-leopard', 'eagle', 'golden-king', 'spruce',
  'balbal', 'boulder-1', 'boulder-2', 'boulder-3', 'kumis-churn', 'cauldron', 'saddle', 'firewood', 'chest', 'watchtower', 'snow-lotus', 'kokpar-rider'];
export const MODEL_FILES = [...MODEL_NAMES.flatMap(name => [`${name}.glb`, `${name}.phone.glb`]), ...['horse-wild', 'horse-saddled', 'kokpar-rider'].map(name => `${name}.far.glb`)];
const root = resolve(import.meta.dirname, '../../../..');

/** The source image's exact bytes and sampler in the prepared GLB, without decoding or re-encoding it. */
function withAtlas(bytes, texture) {
  if (texture === null) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), jsonLength = view.getUint32(12, true);
  const doc = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  const bin = bytes.subarray(28 + jsonLength), imageAt = bin.length;
  const imageLength = Math.ceil(texture.image.length / 4) * 4;
  doc.bufferViews.push({ buffer: 0, byteOffset: imageAt, byteLength: texture.image.length });
  doc.images = [{ bufferView: doc.bufferViews.length - 1, mimeType: texture.mimeType }];
  doc.samplers = [texture.sampler];
  const webp = texture.mimeType === 'image/webp';
  doc.textures = [webp ? { sampler: 0, extensions: { EXT_texture_webp: { source: 0 } } } : { sampler: 0, source: 0 }];
  if (webp) { doc.extensionsUsed = [...(doc.extensionsUsed ?? []), 'EXT_texture_webp']; doc.extensionsRequired = [...(doc.extensionsRequired ?? []), 'EXT_texture_webp']; }
  doc.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  doc.buffers[0].byteLength = imageAt + imageLength;
  const json = new TextEncoder().encode(JSON.stringify(doc)), padded = Math.ceil(json.length / 4) * 4;
  const out = new Uint8Array(28 + padded + imageAt + imageLength), header = new DataView(out.buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, out.length, true);
  header.setUint32(12, padded, true); header.setUint32(16, 0x4e4f534a, true); out.fill(32, 20, 20 + padded); out.set(json, 20);
  header.setUint32(20 + padded, imageAt + imageLength, true); header.setUint32(24 + padded, 0x004e4942, true);
  out.set(bin, 28 + padded); out.set(texture.image, 28 + padded + imageAt);
  return out;
}

/** Same operation order as fitRock and generatedBalbal before wireLookV2 shaded their clones. */
export function cloneFrame(name, geometry) {
  const halves = { 'boulder-1': [1, 0.74, 1], 'boulder-2': [0.9, 0.95, 0.9], 'boulder-3': [1.45, 0.5, 0.95] };
  const half = halves[name];
  if (half !== undefined) {
    const box = geometry.boundingBox, center = new THREE.Vector3(), size = new THREE.Vector3();
    box.getCenter(center); box.getSize(size);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(half[0] * 2 / size.x, half[1] * 2 / size.y, half[2] * 2 / size.z);
    geometry.computeVertexNormals();
    return geometry;
  }
  return name === 'balbal' ? geometry.rotateY(Math.PI).scale(2.15 / 1.6, 2.15 / 1.6, 2.15 / 1.6) : null;
}

export async function bakeModelPaint(bytes, name) {
  const source = await readSourceModel(bytes), scene = source.gltf.scene;
  const mesh = scene.getObjectByProperty('isMesh', true);
  if (!(mesh instanceof THREE.Mesh)) throw new Error(`Missing model ${name}`);
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (material === undefined) throw new Error(`Missing model ${name}`);
  const { geometry } = rawFromGltf(scene, name), plain = geometry.getAttribute('color').array.slice();
  const clone = cloneFrame(name, geometry.clone());
  geometry.setAttribute('color', new THREE.BufferAttribute(bakeVertexAO(geometry, plain), 3));
  if (clone !== null) geometry.setAttribute('paintClone', new THREE.BufferAttribute(bakeVertexAO(clone, plain), 3));
  const glb = staticGlb([{ name: 'painted', geometry, material: new THREE.MeshStandardMaterial(), compactIndex: true,
    ...(clone === null ? {} : { customAttributes: { _PAINT_CLONE: 'paintClone' } }) }], 'painted');
  return withAtlas(glb, source.texture(material));
}

if (import.meta.main) {
  const writer = byteWriter(process.argv.includes('--check'), 'nalati-model-paint');
  for (const file of MODEL_FILES) {
    const name = file.split('.')[0];
    const bytes = await bakeModelPaint(readFileSync(resolve(root, 'public/assets/nalati/models', file)), name);
    writer.put(resolve(root, 'public/assets/nalati/baked/painted-models', file), bytes);
  }
  writer.finish();
}
