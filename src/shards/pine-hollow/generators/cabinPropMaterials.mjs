/** Retain original tier-specific material/image recipes, without downloading the discarded source meshes. GR8 G37: the
 *  recipes and source scans come from the program's sources (pineSources.ts), the tier folders listed through them. */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { CABIN_PROP_SOURCES } from './cabinPropShapes.ts';

/** The cabin props' source scans. */
export const CABIN_MATERIAL_IDS = ['wooden_crate_02', 'wine_barrel_01', 'wooden_bucket_01', 'hatchet'];
/** The folders a cabin prop's source and tier recipes live in. */
export const cabinMaterialFolders = id => [`/assets/models/${id}/`, `/assets/gpu/models/${id}/`, `/assets/pine-hollow/astc6/models/${id}/`];
const utf8 = bytes => new TextDecoder().decode(bytes);
export function pineCabinMaterialFiles(sources) {
  return materialFiles(sources);
}

/** @param {Record<string,unknown>} doc */
function materialGlb(doc) {
  const text = new TextEncoder().encode(JSON.stringify(doc)), jsonBytes = (text.length + 3) & ~3;
  const packed = new Uint8Array(28 + jsonBytes + 96), header = new DataView(packed.buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, packed.length, true);
  header.setUint32(12, jsonBytes, true); header.setUint32(16, 0x4e4f534a, true);
  packed.fill(0x20, 20, 20 + jsonBytes); packed.set(text, 20);
  header.setUint32(20 + jsonBytes, 96, true); header.setUint32(24 + jsonBytes, 0x004e4942, true);
  return packed;
}

/** Material recipes carry geometry in the native GLB BIN chunk. */
function materialFiles(sources) {
  const aliases = {}, outputs = {}, costs = [];
  for (const id of CABIN_MATERIAL_IDS) {
    const original = `/assets/models/${id}/${id}.gltf`, folder = `/assets/models/${id}/`;
    const urls = [original, ...[`/assets/gpu/models/${id}/`, `/assets/pine-hollow/astc6/models/${id}/`].flatMap(directory => sources.list(directory).filter(url => !url.slice(directory.length).includes('/') && url.endsWith('.gltf')).sort())];
    for (const url of urls) {
      const bytes = sources.bytes(url), doc = JSON.parse(utf8(bytes));
      if (doc.materials.length !== 1) throw new Error('Cabin material recipe changed its original roster');
      for (const image of doc.images) image.uri = new URL(image.uri, `https://author.invalid${folder}`).pathname;
      const compact = { asset: doc.asset, images: doc.images, textures: doc.textures, samplers: doc.samplers, materials: doc.materials,
        ...(doc.extensionsUsed === undefined ? {} : { extensionsUsed: doc.extensionsUsed }), ...(doc.extensionsRequired === undefined ? {} : { extensionsRequired: doc.extensionsRequired }),
        buffers: [{ byteLength: 96 }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 36 }, { buffer: 0, byteOffset: 72, byteLength: 24 }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [0,0,0] }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 2, componentType: 5126, count: 3, type: 'VEC2' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0, mode: 4 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
      const packed = materialGlb(compact), hash = hashImmutableBytes(packed), target = `/assets/pine-hollow/baked/cabin-materials/${hash}.glb`;
      aliases[url] = target; outputs[`public${target}`] = packed;
      costs.push({ original: url, before: bytes.length + doc.buffers.reduce((size, buffer) => size + buffer.byteLength, 0), after: packed.length });
    }
  }
  return { aliases, outputs, costs };
}

/** Decode only the original embedded geometry buffer; textures are retained separately without a Node image host. */
export async function pineCabinPropParts(sources) {
  const rows = {};
  for (const [kind, id] of Object.entries(CABIN_PROP_SOURCES)) {
    const folder = `/assets/models/${id}/`, doc = JSON.parse(utf8(sources.bytes(`${folder}${id}.gltf`)));
    if (doc.materials.length !== 1 || doc.buffers.length !== 1) throw new Error('Cabin scan changed its original material or buffer roster');
    delete doc.images; delete doc.textures; delete doc.samplers;
    for (const material of doc.materials) {
      delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture;
      if (material.pbrMetallicRoughness !== undefined) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.pbrMetallicRoughness.metallicRoughnessTexture; }
    }
    const binary = sources.bytes(`${folder}${doc.buffers[0].uri}`); delete doc.buffers[0].uri;
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
