/** Internal snapshot byte bounds; compression never changes or omits native world data. */
export const MAX_PHYSICS_BYTES = 32_000_000;
/** Worst-case literal framing overhead, even when a match splits every 64 bytes. */
export const MAX_REFERENCE_BYTES = MAX_PHYSICS_BYTES + Math.ceil(MAX_PHYSICS_BYTES / 64) * 3 + 16;
const literalLimit = 65_536, matchMinimum = 64;

// Long-range matches cover repeated native geometry/BVHs outside DEFLATE's 32 KiB window.
// All decisions affect compression ratio only; full bytes and lengths remain authoritative.
function hash(bytes: Uint8Array, at: number): number {
  let value = 2166136261;
  for (let i = 0; i < 16; i += 4) {
    const word = (bytes[at + i] ?? 0) | ((bytes[at + i + 1] ?? 0) << 8) | ((bytes[at + i + 2] ?? 0) << 16) | ((bytes[at + i + 3] ?? 0) << 24);
    value = Math.imul(value ^ word, 16777619);
  }
  return (value >>> 0) & 0xfffff;
}
// rt3-freeze: a regional autosave once hashed every basis position and every byte inside each match (~1 M 16-byte
// hashes for a 440 KB template world). The basis is indexed every 16 bytes (a 64-byte match always spans an indexed
// start, so at most 15 more literal bytes begin it), and bytes copied from the basis are not re-indexed (the basis
// holds them already). Compression ratio may move slightly; decoding and the exact bytes never change.
const basisStride = 16;
/** Native bytes as the snapshot's plain JSON array: an indexed copy, ~10x faster than Array.from's iterator on a phone (rt3-freeze). */
export function byteArray(bytes: Uint8Array): number[] {
  const array: number[] = [];
  array.length = bytes.length; // sized once: push or Array.from regrow or iterate
  for (let index = 0; index < bytes.length; index++) array[index] = bytes[index] ?? 0;
  return array;
}
/** Lossless literal/copy framing with bounded dictionaries; a basis is immutable, freshly admitted world data. */
export function encodePhysicsReferences(bytes: Uint8Array, basis?: Uint8Array): Uint8Array {
  if (bytes.length === 0 || bytes.length > MAX_PHYSICS_BYTES) throw new RangeError('Snapshot physics exceeds byte bounds');
  if (basis !== undefined && (basis.length === 0 || basis.length > MAX_PHYSICS_BYTES)) throw new RangeError('Snapshot physics basis exceeds byte bounds');
  const encoded = new Uint8Array(bytes.length + Math.ceil(bytes.length / matchMinimum) * 3 + 16), view = new DataView(encoded.buffer);
  const dictionary = new Int32Array(0x100000).fill(-1);
  const basisDictionary = basis === undefined ? undefined : new Int32Array(0x100000).fill(-1);
  if (basis !== undefined && basisDictionary !== undefined) for (let i = 0; i + matchMinimum <= basis.length; i += basisStride) basisDictionary[hash(basis, i)] = i;
  let written = 0, literal = 0, at = 0;
  const flush = (end: number): void => {
    while (literal < end) {
      const length = Math.min(literalLimit, end - literal);
      encoded[written++] = 0; view.setUint16(written, length - 1, true); written += 2;
      encoded.set(bytes.subarray(literal, literal + length), written); written += length; literal += length;
    }
  };
  while (at + matchMinimum <= bytes.length) {
    const key = hash(bytes, at), previous = dictionary[key] ?? -1; dictionary[key] = at;
    let length = 0;
    if (previous >= 0) while (at + length < bytes.length && bytes[previous + length] === bytes[at + length]) length++;
    const basisAt = basisDictionary?.[key] ?? -1;
    let basisLength = 0;
    if (basis !== undefined && basisAt >= 0) while (at + basisLength < bytes.length && basisAt + basisLength < basis.length && basis[basisAt + basisLength] === bytes[at + basisLength]) basisLength++;
    const external = basisLength >= matchMinimum && basisLength >= length;
    if (external) length = basisLength;
    if (length < matchMinimum) { at++; continue; }
    flush(at);
    encoded[written++] = external ? 2 : 1; view.setUint32(written, external ? basisAt : at - previous, true); written += 4; view.setUint32(written, length, true); written += 4;
    if (!external) for (let i = at + 1; i < at + length && i + 16 <= bytes.length; i++) dictionary[hash(bytes, i)] = i;
    at += length; literal = at;
  }
  flush(bytes.length);
  return encoded.subarray(0, written);
}
/** Reject malformed references before copying; output allocation and total reconstructed work are bounded by length. */
function references(bytes: Uint8Array, length: number, basisLength: number | undefined, result?: Uint8Array, basis?: Uint8Array): void {
  if (!Number.isSafeInteger(length) || length < 1 || length > MAX_PHYSICS_BYTES || bytes.length > MAX_REFERENCE_BYTES) throw new RangeError('Snapshot physics exceeds byte bounds');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0, written = 0;
  while (at < bytes.length) {
    const kind = bytes[at++];
    if (kind === 0) {
      if (at + 2 > bytes.length) throw new RangeError('Truncated snapshot physics literal');
      const count = view.getUint16(at, true) + 1; at += 2;
      if (at + count > bytes.length || written + count > length) throw new RangeError('Invalid snapshot physics literal length');
      result?.set(bytes.subarray(at, at + count), written); at += count; written += count;
    } else if (kind === 1 || kind === 2) {
      if (at + 8 > bytes.length) throw new RangeError('Truncated snapshot physics reference');
      const distance = view.getUint32(at, true), count = view.getUint32(at + 4, true); at += 8;
      if (kind === 2) {
        if (basisLength === undefined || count < matchMinimum || distance + count > basisLength || written + count > length) throw new RangeError('Invalid snapshot physics basis reference');
        if (result !== undefined && basis !== undefined) result.set(basis.subarray(distance, distance + count), written);
        written += count; continue;
      }
      if (distance < 1 || distance > written || count < matchMinimum || written + count > length) throw new RangeError('Invalid snapshot physics reference');
      const end = written + count;
      if (result === undefined) written = end;
      else while (written < end) { result[written] = result[written - distance] ?? 0; written++; }
    } else throw new RangeError('Unknown snapshot physics token');
  }
  if (written !== length) throw new RangeError('Snapshot physics decoded length mismatch');
}
/** Validate all literal/copy bounds against the declared old basis without replaying unknown bytes. This is not an integrity proof. */
export function validatePhysicsReferences(bytes: Uint8Array, length: number, basisLength?: number): void {
  references(bytes, length, basisLength);
}
/** Reconstruct exact bytes only with the caller's checked basis. */
export function decodePhysicsReferences(bytes: Uint8Array, length: number, basis?: Uint8Array): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 1 || length > MAX_PHYSICS_BYTES || bytes.length > MAX_REFERENCE_BYTES) throw new RangeError('Snapshot physics exceeds byte bounds');
  const result = new Uint8Array(length);
  references(bytes, length, basis?.length, result, basis);
  return result;
}
