import { parseGlb } from '@wildshard/sdk/assets';

type ObjectRow = Record<string, unknown>;
function object(input: unknown): ObjectRow {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('Painted model object required');
  return input as ObjectRow;
}
function list(input: unknown): unknown[] {
  if (!Array.isArray(input) || input.length > 10_000) throw new Error('Painted model list required');
  return input;
}
function one(input: unknown): ObjectRow {
  const rows = list(input); if (rows.length !== 1) throw new Error('Painted model requires one declaration'); return object(rows[0]);
}
function integer(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 0 || input > 25_000_000) throw new Error('Invalid painted model integer');
  return input;
}
function keys(row: ObjectRow, names: readonly string[]): void {
  if (Object.keys(row).some(key => !names.includes(key))) throw new Error('Unsupported painted atlas declaration');
}

/** Original WebP bytes and geometry from the fixed painter, before any texture encoding. */
export interface NalatiModelSourceParts {
  readonly geometry: Uint8Array;
  readonly webp: Uint8Array | null;
}

/** Inverse of the fixed painter's atlas append; native readers share this exact geometry validation. */
export function nalatiModelSourceParts(bytes: Uint8Array): NalatiModelSourceParts {
  if (!(bytes.buffer instanceof ArrayBuffer) || bytes.length < 28 || bytes.length > 25_000_000) throw new Error('Invalid painted model extent');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length
    || view.getUint32(16, true) !== 0x4e4f534a) throw new Error('Invalid painted model header');
  const jsonLength = view.getUint32(12, true), binStart = 28 + jsonLength;
  if (jsonLength % 4 !== 0 || binStart > bytes.length || view.getUint32(24 + jsonLength, true) !== 0x004e4942
    || view.getUint32(20 + jsonLength, true) !== bytes.length - binStart) throw new Error('Invalid painted model chunks');
  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(20, 20 + jsonLength)));
  const doc = object(input), bin = bytes.subarray(binStart), buffer = one(doc['buffers']);
  keys(buffer, ['byteLength']);
  if (integer(buffer['byteLength']) !== bin.length) throw new Error('Painted model buffer extent differs');
  const rawViews = list(doc['bufferViews']);
  const views = rawViews.map(value => {
    const row = object(value);
    if (row['buffer'] !== 0) throw new Error('Painted model requires one local buffer');
    return { byteOffset: integer(row['byteOffset']), byteLength: integer(row['byteLength']) };
  });
  const pbr = object(one(doc['materials'])['pbrMetallicRoughness']);
  if (doc['images'] === undefined) {
    if (doc['textures'] !== undefined || doc['samplers'] !== undefined || pbr['baseColorTexture'] !== undefined) throw new Error('Incomplete painted atlas');
    parseGlb(bytes);
    return { geometry: bytes.slice(), webp: null };
  }
  const image = one(doc['images']), sampler = one(doc['samplers']), texture = one(doc['textures']);
  keys(image, ['bufferView', 'mimeType']); keys(sampler, ['magFilter', 'minFilter', 'wrapS', 'wrapT']); keys(texture, ['sampler', 'extensions']);
  if (image['mimeType'] !== 'image/webp' || sampler['magFilter'] !== 9729 || sampler['minFilter'] !== 9987 || sampler['wrapS'] !== 10497 || sampler['wrapT'] !== 10497 || texture['sampler'] !== 0) throw new Error('Painted atlas sampler differs');
  const extensions = object(texture['extensions']); keys(extensions, ['EXT_texture_webp']);
  const source = object(extensions['EXT_texture_webp']), binding = object(pbr['baseColorTexture']);
  keys(source, ['source']); keys(binding, ['index']);
  if (source['source'] !== 0 || binding['index'] !== 0) throw new Error('Painted atlas binding differs');
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    if (doc[key] !== undefined && list(doc[key]).some(value => value !== 'EXT_texture_webp')) throw new Error('Unsupported painted texture extension');
  }
  const last = views.length - 1, imageView = views[last];
  if (image['bufferView'] !== last || imageView === undefined || imageView.byteLength === 0 || imageView.byteOffset % 4 !== 0
    || imageView.byteOffset + Math.ceil(imageView.byteLength / 4) * 4 !== bin.length
    || list(doc['accessors']).some(value => integer(object(value)['bufferView']) >= last)
    || views.slice(0, last).some(row => row.byteOffset + row.byteLength > imageView.byteOffset)) throw new Error('Painted atlas must own the final disjoint view');
  const imageBytes = bin.slice(imageView.byteOffset, imageView.byteOffset + imageView.byteLength);
  const geometryBytes = bin.slice(0, imageView.byteOffset);
  rawViews.pop();
  buffer['byteLength'] = geometryBytes.length;
  delete pbr['baseColorTexture'];
  for (const key of ['images', 'textures', 'samplers', 'extensionsUsed', 'extensionsRequired']) Reflect.deleteProperty(doc, key);
  const json = new TextEncoder().encode(JSON.stringify(doc)), padded = Math.ceil(json.length / 4) * 4;
  const geometry = new Uint8Array(28 + padded + geometryBytes.length), header = new DataView(geometry.buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, geometry.length, true);
  header.setUint32(12, padded, true); header.setUint32(16, 0x4e4f534a, true); geometry.fill(32, 20, 20 + padded); geometry.set(json, 20);
  header.setUint32(20 + padded, geometryBytes.length, true); header.setUint32(24 + padded, 0x004e4942, true); geometry.set(geometryBytes, 28 + padded);
  parseGlb(geometry);
  return { geometry, webp: imageBytes };
}
