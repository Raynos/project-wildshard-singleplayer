import { textureMipBytes, type TextureTranscodeSupport } from './contentBounds';
import type { AssetCost } from './product';

const MAX_BYTES = 25_000_000;
function requireRange(bytes: Uint8Array, offset: number, size: number): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > bytes.length) throw new Error('asset truncated or oversized');
}

/** Parse bounded KTX2 headers and mip ranges; absent GPU support retains the full RGBA transcode bound. */
export function parseKtx2(bytes: Uint8Array, support?: TextureTranscodeSupport): AssetCost {
  requireRange(bytes, 0, 80); const signature = [171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10];
  if (bytes.length > MAX_BYTES || signature.some((n, i) => bytes[i] !== n)) throw new Error('invalid KTX2 signature');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), width = view.getUint32(20, true), height = view.getUint32(24, true), levels = view.getUint32(40, true);
  if (width === 0 || height === 0 || width > 4096 || height > 4096 || levels === 0 || levels > 13 || view.getUint32(28, true) > 1 || view.getUint32(32, true) > 1 || view.getUint32(36, true) !== 1 || view.getUint32(44, true) > 2) throw new Error('KTX2 dimensions or encoding cap');
  // Raw R8 is already sampled by data maps; its storage remains one byte per
  // texel after KTX2 decompression. Basis and other formats retain RGBA charging.
  const texelBytes = view.getUint32(12, true) === 9 ? 1 : 4;
  requireRange(bytes, 80, levels * 24); let gpu = 0; const ranges: [number, number][] = [];
  for (let i = 0; i < levels; i++) {
    const offset = Number(view.getBigUint64(80 + i * 24, true)), size = Number(view.getBigUint64(88 + i * 24, true)), raw = Number(view.getBigUint64(96 + i * 24, true));
    requireRange(bytes, offset, size); if (offset < 80 + levels * 24 || size === 0 || raw > MAX_BYTES || ranges.some(([start, end]) => offset < end && offset + size > start)) throw new Error('KTX2 mip range'); ranges.push([offset, offset + size]);
    gpu += Math.max(1, width >> i) * Math.max(1, height >> i) * texelBytes;
  }
  const dfd = view.getUint32(48, true), dfdSize = view.getUint32(52, true); requireRange(bytes, dfd, dfdSize);
  if (dfdSize < 24 || dfd < 80 + levels * 24 || ranges.some(([start, end]) => dfd < end && dfd + dfdSize > start) || gpu > MAX_BYTES) throw new Error('KTX2 descriptor or residency cap');
  // Only ordinary Basis LDR sources use the advertised ASTC/BC7 transcode paths.
  const model = view.getUint8(dfd + 12);
  const basis = view.getUint32(12, true) === 0;
  const compressed = basis && ((model === 166 && support?.astc === true) || ((model === 163 || model === 166) && support?.bc7 === true));
  if (compressed) gpu = textureMipBytes(width, height, levels, true);
  return { decoded: 0, gpu, triangles: 0, draws: 0 };
}

