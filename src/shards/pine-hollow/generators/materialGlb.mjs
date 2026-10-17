/** Preserve all source material/image bytes while dropping redundant scan geometry. */
export function compactMaterialGlb(bytes) {
  const length = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + length).toString()), input = bytes.subarray(28 + length), pieces = [], views = [];
  const append = (part) => { const byteOffset = pieces.reduce((n, row) => n + row.length, 0); pieces.push(part, Buffer.alloc((-part.length) & 3)); views.push({ buffer: 0, byteOffset, byteLength: part.length }); return views.length - 1; };
  for (const image of doc.images ?? []) { const view = doc.bufferViews[image.bufferView]; image.bufferView = append(input.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)); }
  const position = append(Buffer.alloc(36)), normal = append(Buffer.alloc(36)), uv = append(Buffer.alloc(24));
  const compact = { asset: doc.asset, images: doc.images, textures: doc.textures, samplers: doc.samplers, materials: doc.materials,
    ...(doc.extensionsUsed === undefined ? {} : { extensionsUsed: doc.extensionsUsed }), ...(doc.extensionsRequired === undefined ? {} : { extensionsRequired: doc.extensionsRequired }),
    buffers: [{ byteLength: pieces.reduce((n, row) => n + row.length, 0) }], bufferViews: views,
    accessors: [{ bufferView: position, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [0,0,0] }, { bufferView: normal, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: uv, componentType: 5126, count: 3, type: 'VEC2' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0, mode: 4 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
  const json = Buffer.from(JSON.stringify(compact)), text = Buffer.concat([json, Buffer.alloc((-json.length) & 3, 0x20)]), bin = Buffer.concat(pieces), header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2,4); header.writeUInt32LE(28 + text.length + bin.length,8); header.writeUInt32LE(text.length,12); header.writeUInt32LE(0x4e4f534a,16);
  binaryHeader.writeUInt32LE(bin.length); binaryHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,text,binaryHeader,bin]);
}
