/** ABI-v2 random continuations. Preparing/copying a bank never advances its
 * owner; the owner commits the checked candidate with the rest of the call. */
import type { V2Layout } from './scriptWireV2';

type State = readonly [number,number,number,number,number,number];
export interface V2RngInput {
  readonly binding: number; readonly stream: number; readonly algorithm: 1 | 2;
  readonly state: State;
}
export interface V2RngCandidate extends V2RngInput { readonly draws: number }
const u32 = (value: number | undefined): boolean => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const safe = (value: number | undefined): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function validate(row: { readonly binding: number; readonly stream: number; readonly algorithm: number; readonly state: readonly number[] }): void {
  const s = row.state;
  if (!Number.isInteger(row.binding) || row.binding < 1 || row.binding > 0x7fffffff || !u32(row.stream) || row.stream === 0
    || s.length !== 6
    || (row.algorithm === 1 ? !u32(s[0]) || !u32(s[1]) || ![0,1].includes(s[2] ?? Number.NaN) || s[3] !== 0 || s[4] !== 0 || s[5] !== 0
      : row.algorithm !== 2 || !u32(s[0]) || !u32(s[1]) || !safe(s[2]) || !safe(s[3]) || !safe(s[4]) || s[5] !== 0)) throw new Error('Invalid v2 RNG continuation');
}

/** Native metadata, not a guest count, bounds the complete bank and binds each
 * continuation to its admitted binding/stream/algorithm. */
export function prepareV2Rng(layout: V2Layout,input: readonly V2RngInput[]): {
  readonly count: number; readonly bytes: Uint8Array;
  readonly readCandidate: (view: DataView,count: number,due: ReadonlySet<number>) => readonly V2RngCandidate[];
} {
  const source = layout.regions[20], target = layout.regions[21];
  if (source === undefined || target === undefined || input.length > source.capacity || input.length > target.capacity) throw new Error('Oversized v2 RNG bank');
  const rows = input.map(row => { validate(row);return { ...row,state: [...row.state] as const }; }).sort((a,b) => a.binding-b.binding || a.stream-b.stream);
  if (new Set(rows.map(row => `${row.binding}:${row.stream}`)).size !== rows.length) throw new Error('Duplicate v2 RNG stream');
  const bytes = new Uint8Array(rows.length*64), packed = new DataView(bytes.buffer);
  rows.forEach((row,i) => {
    const at = i*64;packed.setUint32(at,row.binding,true);packed.setUint32(at+4,row.stream,true);packed.setUint32(at+8,row.algorithm,true);
    row.state.forEach((value,j) => packed.setFloat64(at+16+j*8,value,true));
  });
  return { count: rows.length,bytes,readCandidate: (view,count,due) => {
    if (view.byteLength !== layout.pages*65536 || count !== rows.length) throw new Error('Incomplete v2 RNG candidate');
    return rows.map((row,i): V2RngCandidate => {
      const at = layout.io+target.offset+i*64, draws = view.getUint32(at+12,true);
      if (view.getUint32(at,true) !== row.binding || view.getUint32(at+4,true) !== row.stream || view.getUint32(at+8,true) !== row.algorithm || (!due.has(row.binding) && draws !== 0)) throw new Error('Forged v2 RNG owner or draw count');
      const state: State = [view.getFloat64(at+16,true),view.getFloat64(at+24,true),view.getFloat64(at+32,true),view.getFloat64(at+40,true),view.getFloat64(at+48,true),view.getFloat64(at+56,true)];
      const next = { binding: row.binding,stream: row.stream,algorithm: row.algorithm,state,draws };validate(next);
      const changed = row.algorithm === 1 ? 0 : 2;
      const expected = draws === 0 ? row.state[changed] : row.algorithm === 1 ? (row.state[0]+Math.imul(draws,0x6d2b79f5)) >>> 0 : row.state[2]+draws;
      if (!Number.isSafeInteger(expected) || !Object.is(state[changed],expected) || state.some((value,j) => j !== changed && !Object.is(value,row.state[j]))) throw new Error('Invalid v2 RNG advance');
      return next;
    });
  } };
}
