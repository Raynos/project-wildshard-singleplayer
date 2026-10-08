/** A deliberately narrow, bounded M4A index for the optional incremental AAC path.
 * Accepts one unfragmented, self-contained 48 kHz stereo AAC-LC track and one contiguous
 * chunk. Unsupported layouts stay on the existing whole-file decoder; this never decodes PCM.
 * Packet offsets reference the caller's compressed bytes. No file bytes are retained here.
 */
export interface AacIndex {
  readonly sampleRate: 48000;
  readonly channels: 2;
  readonly description: Uint8Array;
  readonly primingFrames: number;
  readonly mediaFrames: number;
  readonly offsets: Uint32Array;
  readonly sizes: Uint32Array;
}
interface Box { readonly type: string; readonly start: number; readonly end: number }
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_PACKETS = 16384;
const MAX_BOXES = 128;
function requireIndex(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(`Unsupported AAC index: ${message}`);
}
class Reader {
  private readonly view: DataView;
  private boxesRead = 0;
  readonly bytes: Uint8Array;
  constructor(bytes: Uint8Array) { this.bytes = bytes; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  u16(at: number, end: number): number { this.bounds(at, 2, end); return this.view.getUint16(at); }
  u32(at: number, end: number): number { this.bounds(at, 4, end); return this.view.getUint32(at); }
  private bounds(at: number, length: number, end: number): void {
    requireIndex(Number.isSafeInteger(at) && at >= 0 && at + length <= end && end <= this.bytes.length, 'truncated field');
  }
  children(start: number, end: number): Box[] {
    const result: Box[] = [];
    for (let at = start; at < end;) {
      requireIndex(++this.boxesRead <= MAX_BOXES, 'box limit');
      const size = this.u32(at, end);
      requireIndex(size >= 8 && at + size <= end, 'box size'); // Extended / to-EOF boxes deliberately unsupported.
      const type = String.fromCodePoint(...this.bytes.subarray(at + 4, at + 8));
      result.push({ type, start: at + 8, end: at + size }); at += size;
    }
    return result;
  }
  one(boxes: readonly Box[], type: string): Box {
    const selected = boxes.filter(box => box.type === type);
    const box = selected[0]; requireIndex(selected.length === 1 && box !== undefined, `one ${type} required`); return box;
  }
  inside(box: Box, type: string): Box { return this.one(this.children(box.start, box.end), type); }
  full(box: Box): number { requireIndex(this.u32(box.start, box.end) === 0, `${box.type} version / flags`); return box.start + 4; }
  table(box: Box, width: number, max: number): { at: number; count: number } {
    const start = this.full(box), count = this.u32(start, box.end);
    requireIndex(count > 0 && count <= max && start + 4 + count * width === box.end, `${box.type} table length`);
    return { at: start + 4, count };
  }
  descriptor(start: number, end: number, tag: number): { start: number; end: number } {
    requireIndex(this.bytes[start] === tag, 'descriptor tag');
    let at = start + 1, size = 0, complete = false;
    for (let i = 0; i < 4; i++) {
      const value = this.bytes[at++]; requireIndex(value !== undefined && at <= end, 'descriptor length');
      size = size * 128 + (value & 127);
      if ((value & 128) === 0) { complete = true; break; }
    }
    requireIndex(complete && size > 0 && at + size <= end, 'descriptor bounds');
    return { start: at, end: at + size };
  }
  config(stsd: Box): Uint8Array {
    const at = this.full(stsd); requireIndex(this.u32(at, stsd.end) === 1, 'one sample description');
    const sample = this.one(this.children(at + 4, stsd.end), 'mp4a');
    requireIndex(this.u16(sample.start + 6, sample.end) === 1, 'external sample data');
    requireIndex(this.u16(sample.start + 8, sample.end) === 0, 'audio sample version');
    requireIndex(this.u16(sample.start + 16, sample.end) === 2 && this.u16(sample.start + 18, sample.end) === 16, 'sample format');
    requireIndex(this.u32(sample.start + 24, sample.end) === 48000 * 65536, 'sample rate');
    const esds = this.one(this.children(sample.start + 28, sample.end), 'esds');
    const es = this.descriptor(this.full(esds), esds.end, 3);
    requireIndex(this.bytes[es.start + 2] === 0, 'ES flags');
    const decoder = this.descriptor(es.start + 3, es.end, 4);
    requireIndex(this.bytes[decoder.start] === 0x40 && this.bytes[decoder.start + 1] === 0x15, 'AAC audio decoder');
    const specific = this.descriptor(decoder.start + 13, decoder.end, 5);
    requireIndex(specific.end === decoder.end && specific.end - specific.start <= 16, 'decoder description');
    const a = this.bytes[specific.start], b = this.bytes[specific.start + 1];
    requireIndex(a !== undefined && b !== undefined && a >>> 3 === 2 && ((a & 7) << 1 | b >>> 7) === 3
      && (b >>> 3 & 15) === 2 && (b & 7) === 0, '48 kHz stereo AAC-LC configuration');
    requireIndex(specific.end - specific.start === 2 || (specific.end - specific.start === 5
      && this.bytes[specific.start + 2] === 0x56 && this.bytes[specific.start + 3] === 0xe5
      && this.bytes[specific.start + 4] === 0), 'AAC extension');
    return this.bytes.slice(specific.start, specific.end);
  }
}

/** Refuses oversized / fragmented / ambiguous / out-of-media packet tables before allocation.
 * The initial supported layout has fixed 1024-frame AAC packets (only the last duration may
 * be shorter), a single rate-one edit for priming, and a maximum 16384 packet descriptors.
 * It has no import-time services and does not select a playback backend.
 */
export function indexAac(bytes: Uint8Array): AacIndex {
  requireIndex(bytes.length >= 8 && bytes.length <= MAX_BYTES, 'file size');
  const r = new Reader(bytes), root = r.children(0, bytes.length);
  requireIndex(!root.some(box => box.type === 'moof'), 'fragmented media');
  r.one(root, 'ftyp'); const movie = r.one(root, 'moov'), media = r.one(root, 'mdat');
  const movieBoxes = r.children(movie.start, movie.end);
  requireIndex(!movieBoxes.some(box => box.type === 'mvex'), 'fragmented movie');
  const track = r.one(movieBoxes, 'trak'), trackBoxes = r.children(track.start, track.end);
  const mdia = r.one(trackBoxes, 'mdia'), mdiaBoxes = r.children(mdia.start, mdia.end);
  const handler = r.one(mdiaBoxes, 'hdlr'), handlerAt = r.full(handler);
  requireIndex(r.u32(handlerAt + 4, handler.end) === 0x736f756e, 'audio handler');
  const mdhd = r.one(mdiaBoxes, 'mdhd'), headerAt = r.full(mdhd);
  requireIndex(r.u32(headerAt + 8, mdhd.end) === 48000, 'media timescale');
  const mediaFrames = r.u32(headerAt + 12, mdhd.end);
  const edit = r.inside(r.one(trackBoxes, 'edts'), 'elst'), editAt = r.full(edit);
  requireIndex(r.u32(editAt, edit.end) === 1 && editAt + 16 === edit.end, 'single edit');
  const primingFrames = r.u32(editAt + 8, edit.end);
  requireIndex(primingFrames <= 8192 && r.u32(editAt + 12, edit.end) === 65536, 'edit rate / priming');
  const table = r.inside(r.one(mdiaBoxes, 'minf'), 'stbl'), entries = r.children(table.start, table.end);
  requireIndex(!entries.some(box => ['ctts', 'stss', 'co64', 'senc', 'saiz', 'saio'].includes(box.type)), 'unsupported sample layout');
  const description = r.config(r.one(entries, 'stsd'));
  const stsz = r.one(entries, 'stsz'), sizeAt = r.full(stsz);
  requireIndex(r.u32(sizeAt, stsz.end) === 0, 'explicit packet sizes');
  const count = r.u32(sizeAt + 4, stsz.end);
  requireIndex(count > 0 && count <= MAX_PACKETS && sizeAt + 8 + count * 4 === stsz.end, 'packet count');
  const sc = r.one(entries, 'stsc'), scTable = r.table(sc, 12, 1);
  requireIndex(r.u32(scTable.at, sc.end) === 1 && r.u32(scTable.at + 4, sc.end) === count
    && r.u32(scTable.at + 8, sc.end) === 1, 'contiguous chunk mapping');
  const co = r.one(entries, 'stco'), coTable = r.table(co, 4, 1), offset = r.u32(coTable.at, co.end);
  requireIndex(offset >= media.start && offset < media.end, 'chunk outside media');
  const ts = r.one(entries, 'stts'), times = r.table(ts, 8, 2);
  let frames = 0, timedPackets = 0;
  for (let i = 0; i < times.count; i++) {
    const n = r.u32(times.at + i * 8, ts.end), duration = r.u32(times.at + i * 8 + 4, ts.end);
    requireIndex(n > 0 && duration > 0 && duration <= 1024
      && (duration === 1024 || (i === times.count - 1 && n === 1)), 'packet duration');
    timedPackets += n; frames += n * duration;
  }
  requireIndex(timedPackets === count && frames === mediaFrames && mediaFrames > primingFrames, 'timing totals');
  // Validate the entire table before allocating the compact descriptor arrays.
  let end = offset;
  for (let i = 0; i < count; i++) {
    const size = r.u32(sizeAt + 8 + i * 4, stsz.end);
    requireIndex(size > 0 && size <= 65536 && end + size <= media.end, 'packet outside media'); end += size;
  }
  const offsets = new Uint32Array(count), sizes = new Uint32Array(count);
  let at = offset;
  for (let i = 0; i < count; i++) {
    const size = r.u32(sizeAt + 8 + i * 4, stsz.end); offsets[i] = at; sizes[i] = size; at += size;
  }
  return { sampleRate: 48000, channels: 2, description, primingFrames, mediaFrames, offsets, sizes };
}
