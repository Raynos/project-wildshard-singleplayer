// bulk-pack-reader.mjs: read one WSPK part (E525 bulk-download spike, docs/plans/bulk-download-mini-spike.md).
//
// A part is: 8-byte magic "WSPK" 01 00 00 00, a u32 little-endian header length H, H bytes of UTF-8 JSON
// {"v":1,"files":[[path, offset, bytes, hash], …]} and then the member bodies. Offsets count from the start of the
// part and every body starts on a 16-byte boundary, so a Float32Array / Uint32Array view over a .bin member is valid
// without a copy. Plain ESM with no imports: the Node packer, the Node verifier and the browser bench page all load
// this one file. The runtime reader in the game is a build row, not this file.

export const MAGIC = [0x57, 0x53, 0x50, 0x4b, 1, 0, 0, 0];
export const ALIGN = 16;

/** The member table of a whole part held in `buffer` (an ArrayBuffer or a Uint8Array over one). */
export function readPackIndex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength < 12) throw new Error('WSPK: part too short');
  for (let i = 0; i < MAGIC.length; i++) if (bytes[i] !== MAGIC[i]) throw new Error('WSPK: bad magic');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(8, true);
  if (12 + length > bytes.byteLength) throw new Error('WSPK: header past the end');
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + length)));
  if (header.v !== 1 || !Array.isArray(header.files)) throw new Error('WSPK: unknown header');
  const files = new Map();
  for (const [path, offset, size, hash] of header.files) {
    if (offset % ALIGN !== 0 || offset + size > bytes.byteLength) throw new Error(`WSPK: bad range for ${path}`);
    files.set(path, { offset, bytes: size, hash });
  }
  return { headerBytes: 12 + length, files };
}

/** A zero-copy view of one member. The view keeps the whole part alive: drop it once the member is decoded. */
export function member(buffer, entry) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return bytes.subarray(entry.offset, entry.offset + entry.bytes);
}
