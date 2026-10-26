import { parseStillImage } from './stillImage';

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('GLB image object required');
  return value as Record<string, unknown>;
};
function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('GLB image inventory exceeds cap');
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 25_000_000) throw new Error('Invalid GLB image index or range');
  return value;
}
function noExtensions(row: Record<string, unknown>): void {
  if (row['extensions'] !== undefined && Object.keys(record(row['extensions'])).length > 0) throw new Error('Unsupported GLB image binding extension');
}
function mipBytes(width: number, height: number): number {
  let bytes = 0, w = width, h = height;
  while (true) {
    bytes += w * h * 4;
    if (w === 1 && h === 1) return bytes;
    w = Math.max(1, Math.floor(w / 2)); h = Math.max(1, Math.floor(h / 2));
  }
}

/** Admit only bounded buffer-view WebP paint through EXT_texture_webp; external/data URIs and other image
 * bindings still refuse. Charge every decoded image and a full RGBA8 mip chain per texture/material use,
 * conservatively covering loader clones for different material colour spaces. The GLB aggregate cap also applies. */
export function glbImageCost(doc: Record<string, unknown>, views: readonly Record<string, unknown>[], binary: Uint8Array): { decoded: number; gpu: number } {
  let decoded = 0;
  const images = list(doc['images'] ?? [], 16).map(value => {
    const image = record(value); noExtensions(image);
    if (image['uri'] !== undefined || image['mimeType'] !== 'image/webp') throw new Error('GLB images require embedded WebP bytes');
    const view = views[count(image['bufferView'])];
    if (view === undefined || view['byteStride'] !== undefined || view['target'] !== undefined) throw new Error('Invalid GLB image view');
    const offset = count(view['byteOffset'] ?? 0), length = count(view['byteLength']);
    if (offset + length > binary.length) throw new Error('GLB image outside buffer');
    const parsed = parseStillImage(binary.subarray(offset, offset + length));
    if (parsed.mime !== image['mimeType']) throw new Error('GLB image MIME differs from its bytes');
    decoded += parsed.decoded;
    if (decoded > 25_000_000) throw new Error('GLB image resource cap');
    return parsed;
  });
  const samplers = list(doc['samplers'] ?? [], 32).map(value => {
    const sampler = record(value); noExtensions(sampler);
    if (![9728, 9729].includes(count(sampler['magFilter'] ?? 9729))
      || ![9728, 9729, 9984, 9985, 9986, 9987].includes(count(sampler['minFilter'] ?? 9987))
      || ![33071, 33648, 10497].includes(count(sampler['wrapS'] ?? 10497))
      || ![33071, 33648, 10497].includes(count(sampler['wrapT'] ?? 10497))) throw new Error('Invalid GLB image sampler');
    return sampler;
  });
  const textures = list(doc['textures'] ?? [], 32).map(value => {
    const texture = record(value), extensions = record(texture['extensions']);
    if (texture['source'] !== undefined || Object.keys(extensions).length !== 1 || extensions['EXT_texture_webp'] === undefined
      || !list(doc['extensionsUsed'] ?? [], 32).includes('EXT_texture_webp')) throw new Error('GLB texture requires unambiguous WebP extension');
    const binding = record(extensions['EXT_texture_webp']);
    if (Object.keys(binding).some(key => key !== 'source')) throw new Error('Unsupported GLB WebP binding');
    const image = images[count(binding['source'])];
    if (image === undefined || (texture['sampler'] !== undefined && samplers[count(texture['sampler'])] === undefined)) throw new Error('Missing GLB texture image or sampler');
    return { bytes: mipBytes(image.width, image.height), uses: 0 };
  });
  if (images.length === 0 && textures.length === 0) return { decoded: 0, gpu: 0 };
  const bind = (value: unknown): void => {
    if (value === undefined) return;
    const binding = record(value); noExtensions(binding);
    const texture = textures[count(binding['index'])];
    if (texture === undefined) throw new Error('Missing GLB material texture');
    if (count(binding['texCoord'] ?? 0) > 1) throw new Error('Unsupported GLB texture coordinates');
    texture.uses++;
  };
  for (const value of list(doc['materials'] ?? [], 10_000)) {
    const material = record(value); noExtensions(material);
    const pbr = material['pbrMetallicRoughness'] === undefined ? {} : record(material['pbrMetallicRoughness']);
    noExtensions(pbr);
    bind(pbr['baseColorTexture']); bind(pbr['metallicRoughnessTexture']);
    bind(material['normalTexture']); bind(material['occlusionTexture']); bind(material['emissiveTexture']);
  }
  const gpu = textures.reduce((sum, texture) => sum + texture.bytes * Math.max(1, texture.uses), 0);
  if (gpu > 25_000_000) throw new Error('GLB image resource cap');
  return { decoded, gpu };
}
