/** Retain original tier-specific material/image recipes, without downloading the discarded source meshes. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CABIN_PROP_SOURCES } from './cabinPropShapes.ts';

const root = resolve(import.meta.dirname, '../../../..');
export function pineCabinMaterialFiles() {
  const aliases = {}, outputs = {}, costs = [];
  for (const id of ['wooden_crate_02', 'wine_barrel_01', 'wooden_bucket_01', 'hatchet']) {
    const original = `/assets/models/${id}/${id}.gltf`, folder = `/assets/models/${id}/`;
    const urls = [original, ...[`/assets/gpu/models/${id}`, `/assets/pine-hollow/astc6/models/${id}`].flatMap(directory => readdirSync(resolve(root, `public${directory}`)).filter(file => file.endsWith('.gltf')).sort().map(file => `${directory}/${file}`))];
    for (const url of urls) {
      const bytes = readFileSync(resolve(root, `public${url}`)), doc = JSON.parse(bytes.toString());
      if (doc.materials.length !== 1) throw new Error('Cabin material recipe changed its original roster');
      for (const image of doc.images) image.uri = new URL(image.uri, `https://author.invalid${folder}`).pathname;
      const compact = { asset: doc.asset, images: doc.images, textures: doc.textures, samplers: doc.samplers, materials: doc.materials,
        ...(doc.extensionsUsed === undefined ? {} : { extensionsUsed: doc.extensionsUsed }), ...(doc.extensionsRequired === undefined ? {} : { extensionsRequired: doc.extensionsRequired }),
        buffers: [{ byteLength: 96, uri: `data:application/octet-stream;base64,${Buffer.alloc(96).toString('base64')}` }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 36 }, { buffer: 0, byteOffset: 72, byteLength: 24 }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [0,0,0] }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 2, componentType: 5126, count: 3, type: 'VEC2' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0, mode: 4 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
      const packed = Buffer.from(JSON.stringify(compact)), hash = createHash('sha256').update(packed).digest('hex'), target = `/assets/pine-hollow/baked/cabin-materials/${hash}.gltf`;
      aliases[url] = target; outputs[`public${target}`] = packed;
      costs.push({ original: url, before: bytes.length + doc.buffers.reduce((size, buffer) => size + buffer.byteLength, 0), after: packed.length });
    }
  }
  return { aliases, outputs, costs };
}

/** Decode only the original embedded geometry buffer; textures are retained separately without a Node image host. */
export async function pineCabinPropParts() {
  const rows = {};
  for (const [kind, id] of Object.entries(CABIN_PROP_SOURCES)) {
    const folder = resolve(root, 'public/assets/models', id), doc = JSON.parse(readFileSync(resolve(folder, `${id}.gltf`), 'utf8'));
    if (doc.materials.length !== 1 || doc.buffers.length !== 1) throw new Error('Cabin scan changed its original material or buffer roster');
    delete doc.images; delete doc.textures; delete doc.samplers;
    for (const material of doc.materials) {
      delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture;
      if (material.pbrMetallicRoughness !== undefined) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.pbrMetallicRoughness.metallicRoughnessTexture; }
    }
    const binary = readFileSync(resolve(folder, doc.buffers[0].uri)); delete doc.buffers[0].uri;
    const text = new TextEncoder().encode(JSON.stringify(doc)), jsonBytes = (text.length + 3) & ~3, binBytes = (binary.length + 3) & ~3;
    const packed = new Uint8Array(28 + jsonBytes + binBytes), header = new DataView(packed.buffer);
    header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, packed.length, true);
    header.setUint32(12, jsonBytes, true); header.setUint32(16, 0x4e4f534a, true);
    packed.fill(0x20, 20, 20 + jsonBytes); packed.set(text, 20);
    header.setUint32(20 + jsonBytes, binBytes, true); header.setUint32(24 + jsonBytes, 0x004e4942, true); packed.set(binary, 28 + jsonBytes);
    const gltf = await new GLTFLoader().parseAsync(packed.buffer, ''); gltf.scene.updateMatrixWorld(true);
    const parts = [];
    gltf.scene.traverse(node => { if (node.isMesh) parts.push({ geometry: node.geometry, matrix: node.matrixWorld.clone() }); });
    rows[kind] = parts;
  }
  return rows;
}
