/** Parsed native terrain grid and optional authored undergrowth decision log. */
export interface BakedGrid { res: number; size: number; seed: number; /** retained legacy header field; the build checks complete output bytes */ landscapeHash: number; heights: Float32Array; splat: Uint8Array; /** the undergrowth decision log, when the bake has one */ undergrowth: BakedPlacement | null }

/**
 * The build's undergrowth decision log (src/engine/world/forest/placement.ts), a section after the grid in terrain.bin:
 * 'WSPL' · u32 version=1 · u32 decisions · u32 kinds · u32[kinds] counts · f64 checksum sum · u8[⌈decisions/8⌉] bits.
 */
export interface BakedPlacement { length: number; bits: Uint8Array; checksum: { counts: number[]; sum: number } }

function parsePlacement(buf: ArrayBuffer, at: number): BakedPlacement | null {
  const dv = new DataView(buf);
  if (buf.byteLength < at + 16 || dv.getUint8(at) !== 0x57 || dv.getUint8(at + 1) !== 0x53 || dv.getUint8(at + 2) !== 0x50 || dv.getUint8(at + 3) !== 0x4c) return null;
  if (dv.getUint32(at + 4, true) !== 1) return null;
  const length = dv.getUint32(at + 8, true), kinds = dv.getUint32(at + 12, true);
  const head = at + 16 + kinds * 4 + 8;
  if (buf.byteLength !== head + ((length + 7) >> 3)) return null;
  const counts: number[] = [];
  for (let k = 0; k < kinds; k++) counts.push(dv.getUint32(at + 16 + k * 4, true));
  return { length, bits: new Uint8Array(buf, head, (length + 7) >> 3), checksum: { counts, sum: dv.getFloat64(at + 16 + kinds * 4, true) } };
}

/** Decode the original WSTR terrain bytes without runtime services. */
export function parseBakedTerrain(buf: ArrayBuffer): BakedGrid | null {
  const dv = new DataView(buf);
  if (buf.byteLength < 24 || dv.getUint8(0) !== 0x57 || dv.getUint8(1) !== 0x53 || dv.getUint8(2) !== 0x54 || dv.getUint8(3) !== 0x52) return null;
  if (dv.getUint32(4, true) !== 1) return null;
  const res = dv.getUint32(8, true), size = dv.getFloat32(12, true), seed = dv.getUint32(16, true), hash = dv.getUint32(20, true);
  const n = res * res;
  if (buf.byteLength < 24 + n * 8) return null;
  const undergrowth = buf.byteLength > 24 + n * 8 ? parsePlacement(buf, 24 + n * 8) : null;
  if (buf.byteLength > 24 + n * 8 && !undergrowth) return null;
  return { res, size, seed, landscapeHash: hash, heights: new Float32Array(buf, 24, n), splat: new Uint8Array(buf, 24 + n * 4, n * 4), undergrowth };
}

