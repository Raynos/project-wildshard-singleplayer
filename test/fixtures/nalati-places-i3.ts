// oxlint-disable-next-line import/no-nodejs-modules -- Independently restore original and current lossless lane codecs.
import { inflateSync, zstdDecompressSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare words natively.
import { Buffer } from 'node:buffer';
import { nativePlaceFile } from './nalati-native-place-files';

/** iPhone downloads I3's predecessor layer for places.bin: the shipped ('i3') bake is the pinned 'exact' one with the world
 *  places' vec3 normals as normalized Int8 and their in-range colours as normalized Uint8 (writeGeometry `compact`). Every
 *  row, mesh, vertex count, index and every other channel stays the exact bake's, so the only other change is where each
 *  mesh's block starts. */
type Attr = readonly [string, 'f32' | 'f16' | 'u16' | 'i8' | 'u8', number, boolean];
interface Geometry { readonly attrs: readonly Attr[]; readonly count: number; readonly index: 'u16' | 'u32' | null; readonly indexCount: number; readonly box: boolean; readonly expand: boolean }
interface Document { readonly bin: string; readonly bytes: number; readonly rows: readonly { readonly meshes?: readonly { readonly geometry: Geometry }[]; readonly parts?: readonly { readonly geometry: Geometry }[] }[] }
/** the two banks the places program bakes with the I3 writer: places.bin (world places) and specimens.bin (camp specimens) */
export type PlaceBank = 'places' | 'specimens';
const FILES = { places: ['places.bin', 'places.json'], specimens: ['specimens.bin', 'placeSpecimens.json'] } as const;
const WIDTH = { f32: 4, f16: 2, u16: 2, i8: 1, u8: 1 } as const;
const block = (g: Geometry, attr: Attr): number => Math.ceil(g.count * attr[2] * WIDTH[attr[1]] / 4) * 4;
const span = (g: Geometry): number => g.attrs.reduce((sum, attr) => sum + block(g, attr), 0) + (g.index === null ? 0 : g.indexCount * 4);
const parse = (bytes: Uint8Array): Document => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Document;
const meshes = (document: Document): Geometry[] => document.rows.flatMap(row => (row.meshes ?? row.parts ?? []).map(mesh => mesh.geometry));
const exactDocuments = { places: parse(nativePlaceFile(FILES.places[1])), specimens: parse(nativePlaceFile(FILES.specimens[1])) };

/** Each exact mesh block's start → the shipped bake's start of the same mesh. Refuses a bake whose rows differ in any
 *  way but the I3 attribute storage. */
export function placeOffsetsI3(shippedDocument: Uint8Array, bank: PlaceBank = 'places'): ReadonlyMap<number, number> {
  const exactDocument = exactDocuments[bank], shipped = parse(shippedDocument), a = meshes(exactDocument), b = meshes(shipped), map = new Map<number, number>();
  const refuse = (what: string): never => { throw new Error(`Nalati I3 places differ from the exact bake: ${what}`); };
  if (shipped.rows.length !== exactDocument.rows.length || a.length !== b.length) refuse(`${bank} inventory`);
  let from = 0, to = 0;
  a.forEach((g, i) => {
    const h = b[i];
    if (h === undefined || h.count !== g.count || h.index !== g.index || h.indexCount !== g.indexCount || h.box !== g.box || h.expand !== g.expand || h.attrs.length !== g.attrs.length) return refuse(`mesh ${i}`);
    g.attrs.forEach((attr, k) => {
      const next = h.attrs[k];
      if (next === undefined || next[0] !== attr[0] || next[2] !== attr[2]) return refuse(`mesh ${i} channel ${attr[0]}`);
      const same = next[1] === attr[1] && next[3] === attr[3];
      const compact = attr[1] === 'f32' && !attr[3] && next[3] && ((attr[0] === 'normal' && attr[2] === 3 && next[1] === 'i8') || (attr[0] === 'color' && next[1] === 'u8'));
      if (!same && !compact) refuse(`mesh ${i} channel ${attr[0]} storage`);
      return undefined;
    });
    map.set(from, to); from += span(g); to += span(h);
    return undefined;
  });
  if (from !== exactDocument.bytes || to !== shipped.bytes) refuse('span');
  return map;
}

/** The shipped places.bin against the exact one, word by word: every float block and index byte for byte, each Int8
 *  normal within half its step of the exact normal (clamped to [-1, 1]), each Uint8 colour within half its step. */
export function qualifyPlacesI3(shippedBytes: Uint8Array, shippedDocument: Uint8Array, bank: PlaceBank = 'places'): { worstNormal: number; worstColour: number } {
  const exactDocument = exactDocuments[bank], offsets = placeOffsetsI3(shippedDocument, bank), shipped = parse(shippedDocument);
  const words = (deflated: Uint8Array): Uint8Array => {
    const zstd = deflated[0] === 0x28 && deflated[1] === 0xb5 && deflated[2] === 0x2f && deflated[3] === 0xfd;
    const lanes = new Uint8Array(zstd ? zstdDecompressSync(deflated) : inflateSync(deflated)), n = lanes.length / 4, out = new Uint8Array(lanes.length);
    for (let i = 0; i < n; i++) for (let b = 0; b < 4; b++) out[i * 4 + b] = lanes[b * n + i] ?? 0;
    return out;
  };
  const exactBin = words(nativePlaceFile(FILES[bank][0])), shippedBin = words(shippedBytes);
  if (exactBin.length !== exactDocument.bytes || shippedBin.length !== shipped.bytes) throw new Error('Nalati I3 places span differs');
  const a = meshes(exactDocument), b = meshes(shipped);
  let worstNormal = 0, worstColour = 0, from = 0;
  a.forEach((g, i) => {
    const h = b[i], start = offsets.get(from);
    if (h === undefined || start === undefined) throw new Error(`Missing I3 place mesh ${i}`);
    let at = from, next = start;
    g.attrs.forEach((attr, k) => {
      const stored = h.attrs[k];
      if (stored === undefined) throw new Error('Missing I3 place channel');
      const length = g.count * attr[2];
      if (stored[1] === 'f32') {
        if (Buffer.compare(Buffer.from(exactBin.subarray(at, at + length * 4)), Buffer.from(shippedBin.subarray(next, next + length * 4))) !== 0) throw new Error(`Nalati I3 place mesh ${i} ${attr[0]} differs`);
      } else {
        const floats = new Float32Array(exactBin.slice(at, at + length * 4).buffer);
        for (let j = 0; j < length; j++) {
          const value = floats[j] ?? 0;
          if (stored[1] === 'i8') worstNormal = Math.max(worstNormal, Math.abs(Math.max(-1, Math.min(1, value)) - (new Int8Array(shippedBin.buffer, shippedBin.byteOffset + next + j, 1)[0] ?? 0) / 127));
          else worstColour = Math.max(worstColour, Math.abs(value - (shippedBin[next + j] ?? 0) / 255));
        }
      }
      at += block(g, attr); next += block(h, stored);
    });
    const index = g.index === null ? 0 : g.indexCount * 4;
    if (Buffer.compare(Buffer.from(exactBin.subarray(at, at + index)), Buffer.from(shippedBin.subarray(next, next + index))) !== 0) throw new Error(`Nalati I3 place mesh ${i} index differs`);
    from += span(g);
  });
  if (worstNormal > 0.5 / 127 + 1e-6 || worstColour > 0.5 / 255 + 1e-6) throw new Error(`Nalati I3 places outside their storage step: normal ${worstNormal}, colour ${worstColour}`);
  return { worstNormal, worstColour };
}

/** A dressing scene (its JSON and its address table) as the shipped places bake lays it out: each baked-file geometry of
 *  world/places.bin keeps its mesh but takes the shipped mesh's channel storage, and its address word the shipped start. */
export function sceneI3(scene: unknown, addresses: Uint8Array, shippedDocument: Uint8Array): { scene: unknown; addresses: Uint8Array } {
  const offsets = placeOffsetsI3(shippedDocument), shippedMeshes = meshes(parse(shippedDocument)), starts = new Map<number, Geometry>();
  let at = 0;
  for (const g of shippedMeshes) { starts.set(at, g); at += span(g); }
  const out = addresses.slice(), view = new DataView(out.buffer), source = new DataView(addresses.buffer, addresses.byteOffset, addresses.byteLength);
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value !== 'object' || value === null) return value;
    const row = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, walk(child)]));
    if (row['kind'] !== 'baked-file' || row['file'] !== 'world/places.bin') return row;
    const address: unknown = row['address'];
    if (typeof address !== 'object' || address === null || !('word' in address) || typeof address.word !== 'number') throw new Error('Place geometry without its address');
    const exact = source.getUint32(address.word * 4, true), start = offsets.get(exact), g = start === undefined ? undefined : starts.get(start);
    if (start === undefined || g === undefined) throw new Error('Place address is not a place mesh');
    view.setUint32(address.word * 4, start, true);
    const geometry: unknown = row['row'];
    if (typeof geometry !== 'object' || geometry === null) throw new Error('Place geometry without its row');
    return { ...row, row: { ...geometry, attrs: g.attrs.map(attr => [...attr]) } };
  };
  return { scene: walk(scene), addresses: out };
}

/** A dressing scene's packed specimen catalogue as the shipped specimens bake lays it out: each part keeps its mesh but
 *  takes the shipped part's channel storage, and the bank its shipped decoded size. */
export function packedSpecimensI3<P extends { readonly bytes: number; readonly rows: readonly { readonly parts: readonly { readonly geometry: unknown }[] }[] }>(packed: P, shippedDocument: Uint8Array): P {
  placeOffsetsI3(shippedDocument, 'specimens');
  const shipped = parse(shippedDocument), parts = meshes(shipped);
  let at = 0;
  const rows = packed.rows.map(row => ({ ...row, parts: row.parts.map(part => {
    const g = parts[at++];
    if (g === undefined || typeof part.geometry !== 'object' || part.geometry === null) throw new Error('Packed specimen part is not a shipped part');
    return { ...part, geometry: { ...part.geometry, attrs: g.attrs.map(attr => [...attr]) } };
  }) }));
  if (at !== parts.length) throw new Error('Packed specimens differ from the shipped bank');
  return { ...packed, bytes: shipped.bytes, rows };
}
