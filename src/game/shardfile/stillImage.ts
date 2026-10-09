/** Bounded inert SHARD SELECT images. These limits apply before a browser decoder sees any bytes. */
export const STILL_IMAGE_LIMITS = { bytes: 4_194_304, dimension: 4096, chunks: 1024 } as const;
/** Byte-derived image envelope and conservative CPU/data-URL and compositor residency. */
export interface StillImage { mime: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number; decoded: number; gpu: number }
const crcTable = Uint32Array.from({ length: 256 }, (_unused, value) => {
  let result = value;
  for (let bit = 0; bit < 8; bit++) result = (result >>> 1) ^ ((result & 1) === 0 ? 0 : 0xedb88320);
  return result;
});
function crc(view: DataView, start: number, end: number): number {
  let value = 0xffffffff;
  for (let at = start; at < end; at++) value = (value >>> 8) ^ (crcTable[(value ^ view.getUint8(at)) & 255] ?? 0);
  return (value ^ 0xffffffff) >>> 0;
}

function envelope(bytes: Uint8Array, mime: StillImage['mime'], width: number, height: number): StillImage {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > STILL_IMAGE_LIMITS.dimension || height > STILL_IMAGE_LIMITS.dimension) throw new Error('Still image dimensions exceed admission bounds');
  const pixels = width * height * 4;
  // Include the immutable wire bytes and the UTF-16 base64 URL, rounded conservatively to four times wire.
  return { mime, width, height, decoded: pixels + bytes.length * 4, gpu: pixels };
}

function png(bytes: Uint8Array, view: DataView): StillImage {
  let offset = 8, width = 0, height = 0, chunks = 0, data = false, endedData = false;
  while (offset + 12 <= bytes.length && ++chunks <= STILL_IMAGE_LIMITS.chunks) {
    const length = view.getUint32(offset), type = view.getUint32(offset + 4), end = offset + 12 + length;
    if (end > bytes.length) throw new Error('Truncated PNG chunk');
    if (chunks === 1) {
      if (type !== 0x49484452 || length !== 13) throw new Error('PNG requires one leading IHDR');
      width = view.getUint32(offset + 8); height = view.getUint32(offset + 12);
      envelope(bytes, 'image/png', width, height);
      const colour = view.getUint8(offset + 17), depth = view.getUint8(offset + 16);
      if (![0, 2, 3, 4, 6].includes(colour) || ![1, 2, 4, 8].includes(depth) || (colour !== 0 && colour !== 3 && depth !== 8)
        || view.getUint8(offset + 18) !== 0 || view.getUint8(offset + 19) !== 0 || view.getUint8(offset + 20) > 1) throw new Error('Unsupported PNG encoding');
    } else if (type === 0x49484452) throw new Error('Duplicate PNG dimensions');
    if (type === 0x6163544c || type === 0x6663544c || type === 0x66644154) throw new Error('Animated PNG is not a still image');
    // Compressed metadata can expand independently of the admitted pixel envelope.
    if ([0x69434350, 0x7a545874, 0x69545874].includes(type)) throw new Error('Compressed PNG metadata is not admitted');
    if ((view.getUint8(offset + 4) & 32) === 0 && ![0x49484452, 0x504c5445, 0x49444154, 0x49454e44].includes(type)) throw new Error('Unknown critical PNG chunk');
    if (crc(view, offset + 4, end - 4) !== view.getUint32(end - 4)) throw new Error('PNG chunk checksum differs');
    if (type === 0x49444154) { if (endedData) throw new Error('Noncontiguous PNG image data'); data = true; }
    else if (data) endedData = true;
    if (type === 0x49454e44) {
      if (length !== 0 || !data || end !== bytes.length) throw new Error('Invalid PNG end');
      return envelope(bytes, 'image/png', width, height);
    }
    offset = end;
  }
  throw new Error('PNG has no bounded complete image');
}

function jpeg(bytes: Uint8Array, view: DataView): StillImage {
  let offset = 2, width = 0, height = 0, scans = 0, markers = 0;
  while (offset < bytes.length && ++markers <= STILL_IMAGE_LIMITS.chunks) {
    if (view.getUint8(offset++) !== 0xff) throw new Error('Invalid JPEG marker');
    while (offset < bytes.length && view.getUint8(offset) === 0xff) offset++;
    const marker = view.getUint8(offset++);
    if (marker === 0xd9) {
      if (offset !== bytes.length || scans === 0) throw new Error('Invalid JPEG end');
      return envelope(bytes, 'image/jpeg', width, height);
    }
    if (marker === 0xd8 || marker === 0 || marker === 1 || marker >= 0xd0 && marker <= 0xd7) throw new Error('Unexpected JPEG marker');
    const length = view.getUint16(offset), end = offset + length;
    if (length < 2 || end > bytes.length) throw new Error('Truncated JPEG segment');
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (![0xc0, 0xc1, 0xc2].includes(marker) || width !== 0 || length < 8 || view.getUint8(offset + 2) !== 8) throw new Error('Unsupported JPEG frame');
      height = view.getUint16(offset + 3); width = view.getUint16(offset + 5);
      const components = view.getUint8(offset + 7);
      if (![1, 3, 4].includes(components) || length !== 8 + components * 3) throw new Error('Invalid JPEG components');
    }
    offset = end;
    if (marker === 0xda) {
      if (width === 0) throw new Error('JPEG scan precedes its frame');
      scans++;
      // Entropy bytes may stuff FF00 or contain restart markers. Other markers end this scan.
      while (offset + 1 < bytes.length) {
        if (view.getUint8(offset) !== 0xff) { offset++; continue; }
        const next = view.getUint8(offset + 1);
        if (next === 0 || next >= 0xd0 && next <= 0xd7) offset += 2; else break;
      }
    }
  }
  throw new Error('JPEG has no bounded complete image');
}

function webp(bytes: Uint8Array, view: DataView): StillImage {
  if (view.getUint32(4, true) + 8 !== bytes.length) throw new Error('Invalid WebP RIFF length');
  let offset = 12, width = 0, height = 0, chunks = 0, images = 0, extended = false;
  const u24 = (at: number): number => view.getUint8(at) + view.getUint8(at + 1) * 256 + view.getUint8(at + 2) * 65536;
  while (offset + 8 <= bytes.length && ++chunks <= STILL_IMAGE_LIMITS.chunks) {
    const type = view.getUint32(offset), length = view.getUint32(offset + 4, true), at = offset + 8, end = at + length;
    if (end > bytes.length) throw new Error('Truncated WebP chunk');
    if (type === 0x414e494d || type === 0x414e4d46) throw new Error('Animated WebP is not a still image');
    if (type === 0x56503858) {
      if (chunks !== 1 || length !== 10 || (view.getUint8(at) & 0xc3) !== 0 || view.getUint8(at + 1) + view.getUint8(at + 2) + view.getUint8(at + 3) !== 0) throw new Error('Invalid or animated WebP extension');
      width = u24(at + 4) + 1; height = u24(at + 7) + 1; extended = true;
    }
    if (type === 0x56503820 || type === 0x5650384c) {
      if (++images !== 1) throw new Error('Multiple WebP images');
      let w: number, h: number;
      if (type === 0x56503820) {
        if (length < 10 || (view.getUint8(at) & 1) !== 0 || view.getUint8(at + 3) !== 0x9d || view.getUint8(at + 4) !== 1 || view.getUint8(at + 5) !== 0x2a) throw new Error('Invalid WebP key frame');
        w = view.getUint16(at + 6, true) & 0x3fff; h = view.getUint16(at + 8, true) & 0x3fff;
      } else {
        if (length < 5 || view.getUint8(at) !== 0x2f || (view.getUint8(at + 4) & 0xe0) !== 0) throw new Error('Invalid lossless WebP frame');
        const bits = view.getUint32(at + 1, true); w = (bits & 0x3fff) + 1; h = ((bits >>> 14) & 0x3fff) + 1;
      }
      if (extended && (width !== w || height !== h)) throw new Error('WebP canvas differs from its image');
      width = w; height = h;
    }
    offset = end + (length % 2);
  }
  if (offset !== bytes.length || images !== 1) throw new Error('WebP has no bounded complete image');
  return envelope(bytes, 'image/webp', width, height);
}

/** Admit PNG (up to 8-bit), 8-bit JPEG or single-frame WebP; reject SVG, animation and oversized payloads. */
export function parseStillImage(bytes: Uint8Array): StillImage {
  if (bytes.length < 12 || bytes.length > STILL_IMAGE_LIMITS.bytes) throw new Error('Still image wire exceeds admission bounds');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) return png(bytes, view);
  if (view.getUint16(0) === 0xffd8) return jpeg(bytes, view);
  if (view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) return webp(bytes, view);
  throw new Error('Only bounded PNG, JPEG and WebP still images are admitted');
}

/** Resolve verified immutable bytes to a MIME-sniffed inert URL; never accept an authored URL or SVG. */
export function stillImageUrl(bytes: Uint8Array): string {
  const { mime } = parseStillImage(bytes);
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCodePoint(...bytes.subarray(start, start + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}
