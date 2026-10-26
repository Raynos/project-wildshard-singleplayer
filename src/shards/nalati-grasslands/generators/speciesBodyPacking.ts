/** Authored layout of the existing unshuffled creature body binary. Bones and dimensions stay opaque and exact. */
export interface SpeciesBodySource {
  readonly bytes: number;
  readonly bodies: readonly {
    readonly key: string; readonly bones: unknown; readonly dims: unknown;
    readonly fur: readonly (readonly number[])[];
    readonly hard: readonly (readonly number[])[];
    readonly eye: readonly (readonly number[])[];
  }[];
}

type Attribute = [string, 'f32' | 'u16', number, boolean];
interface Part {
  offsets: number[]; groups: number[][]; indexEncoding: 'raw';
  row: { attrs: Attribute[]; count: number; index: 'u16' | 'u32'; indexCount: number; box: false };
}
interface Body { kind: string; variant: string; bones: unknown; dims: unknown; fur: Part[]; hard: Part[]; eye: Part[] }
type CompactPart = [number, number, number, number[][], 'u16' | 'u32'];
/** Fresh raw bytes and both original metadata views; compression and publication belong to the caller. */
export interface SpeciesBodyPacking {
  bytes: Uint8Array<ArrayBuffer>; attrs: Attribute[]; bodies: Body[];
  skeletons: { bones: unknown; dims: unknown }[];
  rows: { kind: string; variant: string; skeleton: number; fur: CompactPart[]; hard: CompactPart[]; eye: CompactPart[] }[];
}

function concat(blocks: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(blocks.reduce((length, block) => length + block.length, 0));
  let at = 0; for (const block of blocks) { result.set(block, at); at += block.length; }
  return result;
}

/** Pair only lists exceeding the existing 64-part limit, preserving every channel byte, group and index operation. */
export function packNalatiSpeciesBodies(input: SpeciesBodySource, raw: Uint8Array): SpeciesBodyPacking {
  if (!Number.isSafeInteger(input.bytes) || input.bytes !== raw.byteLength || raw.byteLength % 4 !== 0)
    throw new Error('Creature body source byte length differs');
  const source = structuredClone(input);
  const attrs: Attribute[] = [['position','f32',3,false],['normal','f32',3,false],['uv','f32',2,false],['color','f32',3,false],
    ['skinIndex','u16',4,false],['skinWeight','f32',4,false],['furLen','f32',1,false]];
  let offset = 0;
  const sourceParts = (parts: readonly (readonly number[])[]): Part[] => parts.map(([count,indexCount,...flat]) => {
    if (count === undefined || indexCount === undefined || !Number.isSafeInteger(count) || count < 0
      || !Number.isSafeInteger(indexCount) || indexCount < 0 || flat.length % 3 !== 0 || flat.some(value => !Number.isSafeInteger(value) || value < 0))
      throw new Error('Invalid creature body part layout');
    const offsets = attrs.map(([,type,size]) => { const at = offset, n = count * size * (type === 'u16' ? 2 : 4); offset += n + (4 - n % 4) % 4; return at; });
    offsets.push(offset); const n = indexCount * 2; offset += n + (4 - n % 4) % 4;
    if (offset > raw.byteLength) throw new Error('Creature body part exceeds source bytes');
    const groups: number[][] = []; for (let i = 0; i < flat.length; i += 3) groups.push(flat.slice(i, i + 3));
    return { offsets, groups, indexEncoding: 'raw', row: { attrs, count, index: 'u16', indexCount, box: false } };
  });
  const bodies = source.bodies.map(body => {
    const kind = body.key.split(':')[0]; if (!kind) throw new Error('Missing creature body kind');
    return { kind, variant: body.key, bones: body.bones, dims: body.dims,
      fur: sourceParts(body.fur), hard: sourceParts(body.hard), eye: sourceParts(body.eye) };
  });
  if (offset !== source.bytes) throw new Error('Creature body offsets do not cover the existing bake');
  let packedSize = 0; const blocks: Uint8Array[] = [];
  const block = (bytes: Uint8Array): number => {
    const at = packedSize, pad = (4 - bytes.length % 4) % 4;
    blocks.push(bytes, new Uint8Array(pad)); packedSize += bytes.length + pad; return at;
  };
  const pack = (parts: readonly Part[]): Part[] => {
    const result: Part[] = [];
    for (let i = 0; i < parts.length; i += parts.length > 64 ? 2 : 1) {
      const group = parts.slice(i, i + (parts.length > 64 ? 2 : 1));
      const count = group.reduce((n, part) => n + part.row.count, 0), indexCount = group.reduce((n, part) => n + part.row.indexCount, 0);
      const offsets = attrs.map(([,type,width], attribute) => block(concat(group.map(part => {
        const at = part.offsets[attribute]; if (at === undefined) throw new Error('Missing creature channel offset');
        return raw.slice(at, at + part.row.count * width * (type === 'u16' ? 2 : 4));
      }))));
      const indices = count > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
      let vertex = 0, index = 0; const groups: number[][] = [];
      for (const chunk of group) {
        const start = chunk.offsets[attrs.length]; if (start === undefined) throw new Error('Missing creature index offset');
        const view = new DataView(raw.buffer, raw.byteOffset + start, chunk.row.indexCount * 2);
        for (let j = 0; j < chunk.row.indexCount; j++) {
          const original = view.getUint16(j * 2, true);
          if (original >= chunk.row.count) throw new Error('Creature index exceeds its source part');
          indices[index + j] = original + vertex;
        }
        for (const [at,n,material] of chunk.groups) {
          if (at === undefined || n === undefined || material === undefined) throw new Error('Missing creature material group');
          groups.push([at + index, n, material]);
        }
        vertex += chunk.row.count; index += chunk.row.indexCount;
      }
      offsets.push(block(new Uint8Array(indices.buffer)));
      result.push({ offsets, groups, indexEncoding: 'raw', row: { attrs, count, index: count > 65535 ? 'u32' : 'u16', indexCount, box: false } });
    }
    return result;
  };
  const packed = bodies.map(body => ({ kind: body.kind, variant: body.variant, bones: body.bones, dims: body.dims,
    fur: pack(body.fur), hard: pack(body.hard), eye: pack(body.eye) }));
  const skeletons: SpeciesBodyPacking['skeletons'] = [], skeletonKeys = new Map<string, number>();
  const compactParts = (parts: readonly Part[]): CompactPart[] => parts.map(part => {
    const start = part.offsets[0]; if (start === undefined) throw new Error('Missing compact creature offset');
    return [part.row.count, part.row.indexCount, start, part.groups, part.row.index];
  });
  const rows = packed.map(body => {
    const key = JSON.stringify([body.bones, body.dims]); let skeleton = skeletonKeys.get(key);
    if (skeleton === undefined) { skeleton = skeletons.length; skeletonKeys.set(key, skeleton); skeletons.push({ bones: body.bones, dims: body.dims }); }
    return { kind: body.kind, variant: body.variant, skeleton, fur: compactParts(body.fur), hard: compactParts(body.hard), eye: compactParts(body.eye) };
  });
  return { bytes: concat(blocks), attrs, bodies: packed, skeletons, rows };
}
