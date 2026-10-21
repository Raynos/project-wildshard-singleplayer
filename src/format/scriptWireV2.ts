/** ABI v2 host-owned layout and immutable call envelope. No guest pointer or
 * count can enlarge these capacities. The record validators own their domains. */
export const V2_REGION_STRIDES = Object.freeze([64,8,8,8,96,16,80,32,56,64,80,64,8,1,32,8,80,8,48,16,64,64]);
export const V2_HEADER_BYTES = 128, V2_DIRECTORY_ENTRY_BYTES = 24, V2_DIRECTORY_BYTES = 22*24;
const outputKinds = new Set([3,10,11,17,18,20,22]);
export interface V2Region { readonly kind: number; readonly offset: number; readonly stride: number; readonly capacity: number }
export interface V2Layout { readonly io: number; readonly pages: number; readonly bytes: number; readonly regions: readonly V2Region[] }
const natural = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
function unsigned(value: number): boolean { return natural(value) && value <= 0xffffffff; }
function handle(value: number): boolean { return Number.isInteger(value) && value > 0 && value <= 0x7fffffff; }
/** Build the complete 22-kind directory outside Wasm, checking arithmetic before
 * multiplying or coercing to u32. Empty kinds retain their specified stride. */
export function layoutV2(io: number,pages: number,capacities: ReadonlyMap<number,number>): V2Layout {
  if (!natural(io) || io%8 !== 0 || !Number.isInteger(pages) || pages < 1 || pages > 4 || io > pages*65536-656) throw new Error('Invalid v2 layout base/pages');
  for (const [kind,capacity] of capacities) if (!Number.isInteger(kind) || kind < 1 || kind > 22 || !natural(capacity)) throw new Error('Unknown v2 region or capacity');
  let end = io+656; const regions: V2Region[] = [];
  for (const [index,stride] of V2_REGION_STRIDES.entries()) {
    const kind = index+1, capacity = capacities.get(kind) ?? 0; end = Math.ceil(end/16)*16;
    if (capacity > Math.floor((pages*65536-end)/stride)) throw new Error('V2 layout exceeds fixed memory');
    regions.push(Object.freeze({ kind,offset: end-io,stride,capacity })); end += capacity*stride;
  }
  return Object.freeze({ io,pages,bytes: end-io,regions: Object.freeze(regions) });
}
/** Relative i32 stamps retain exact f64 absolute ticks across epoch boundaries. */
export function relativeTickV2(tick: number,origin: number): number {
  if (!natural(tick) || !natural(origin)) throw new Error('Invalid v2 absolute tick');
  const relative = tick-origin; if (relative < -0x80000000 || relative > 0x7fffffff) throw new Error('V2 tick stamp outside i32 epoch'); return relative;
}
interface BaseFrame { readonly module: number; readonly sequence: number; readonly tick: number; readonly due: number }
export type V2Frame = BaseFrame & ({ readonly lane: 1 | 2 } | { readonly lane: 3; readonly dt: number; readonly alpha: number; readonly frame: number });
export interface V2FrameAuthority { readonly header: Uint8Array; readonly counts: readonly number[] }
/** Write only header/directory, retaining view scratch between frames. Capture
 * the host envelope for output validation; sim has no view clock/tier fields. */
export function writeV2Frame(view: DataView,layout: V2Layout,frame: V2Frame,counts: ReadonlyMap<number,number>): V2FrameAuthority {
  if (view.byteLength !== layout.pages*65536 || !handle(frame.module) || !unsigned(frame.sequence) || !natural(frame.tick) || !natural(frame.due)) throw new Error('Invalid v2 call envelope');
  if (![1,2,3].includes(frame.lane)) throw new Error('Unknown v2 lane');
  for (const [kind,count] of counts) if (!Number.isInteger(kind) || kind < 1 || kind > 22 || !natural(count)) throw new Error('Unknown v2 input count');
  const actual = layout.regions.map(region => {
    const count = counts.get(region.kind) ?? (region.kind === 17 ? region.capacity : 0);
    if (count > region.capacity || (outputKinds.has(region.kind) && count !== (region.kind === 17 ? region.capacity : 0))) throw new Error('Invalid v2 initial output/input count'); return count;
  });
  if (frame.due > (actual[0] ?? 0)) throw new Error('V2 due count exceeds bindings');
  const at = layout.io, origin = Math.floor(frame.tick/2**30)*2**30;
  new Uint8Array(view.buffer,view.byteOffset+at,656).fill(0);
  view.setUint32(at,0x32565357,true); view.setUint16(at+4,2,true); view.setUint32(at+8,128,true); view.setUint32(at+12,layout.bytes,true);
  view.setUint32(at+16,frame.module,true); view.setUint32(at+20,frame.lane,true); view.setUint32(at+24,frame.sequence,true); view.setInt32(at+28,relativeTickV2(frame.tick,origin),true);
  for (const [offset,kind] of [[36,7],[40,9],[44,8],[48,12],[52,19],[68,13]] as const) view.setUint32(at+offset,actual[kind-1] ?? 0,true);
  view.setUint32(at+32,frame.due,true); view.setUint32(at+96,22,true); view.setUint32(at+100,128,true); view.setFloat64(at+104,origin,true);
  if (frame.lane === 3) {
    if (!Number.isFinite(frame.dt) || frame.dt < 0 || !Number.isFinite(frame.alpha) || frame.alpha < 0 || frame.alpha > 1 || !unsigned(frame.frame)) throw new Error('Invalid v2 view clock');
    view.setFloat64(at+80,frame.dt,true); view.setFloat64(at+88,frame.alpha,true); view.setUint32(at+112,frame.frame,true);
  }
  for (const [index,region] of layout.regions.entries()) {
    const entry = at+128+index*24;
    view.setUint32(entry,region.kind,true);view.setUint32(entry+4,region.offset,true);view.setUint32(entry+8,region.stride,true);
    view.setUint32(entry+12,region.capacity,true);view.setUint32(entry+16,actual[index] ?? 0,true);
    if (region.kind === 17) for (let i = 0; i < region.capacity; i++) view.setUint32(at+region.offset+i*80+12,0,true);
  }
  return { header: new Uint8Array(view.buffer,view.byteOffset+at,128).slice(),counts: Object.freeze(actual) };
}
/** Validate the entire envelope before trusting a single output count. Domain
 * IDs, numeric columns, RNG and command authority are checked by their owners. */
export function validateV2Frame(view: DataView,layout: V2Layout,authority: V2FrameAuthority): readonly number[] {
  const at = layout.io;
  if (view.byteLength !== layout.pages*65536 || authority.header.length !== 128 || authority.counts.length !== 22) throw new Error('Invalid v2 frame authority');
  const header = new Uint8Array(view.buffer,view.byteOffset+at,128);
  for (let i = 0; i < 128; i++) if (!(i >= 56 && i < 68 || i >= 72 && i < 80) && header[i] !== authority.header[i]) throw new Error('Guest changed the v2 call envelope');
  const counts: number[] = [];
  for (const [index,region] of layout.regions.entries()) {
    const entry = at+128+index*24, count = view.getUint32(entry+16,true);
    if (view.getUint32(entry,true) !== region.kind || view.getUint32(entry+4,true) !== region.offset || view.getUint32(entry+8,true) !== region.stride || view.getUint32(entry+12,true) !== region.capacity || view.getUint32(entry+20,true) !== 0 || count > region.capacity
      || (!outputKinds.has(region.kind) && count !== authority.counts[index])) throw new Error('Guest changed the v2 region directory'); counts.push(count);
  }
  const lane = new DataView(authority.header.buffer,authority.header.byteOffset,128).getUint32(20,true);
  if (lane === 3 && ((counts[9] ?? 0) > 0 || (counts[10] ?? 0) > 0)) throw new Error('V2 view cannot publish sim commands or queries');
  if (view.getUint32(at+56,true) !== counts[9] || view.getUint32(at+60,true) !== counts[10]) throw new Error('V2 output count mismatch');
  const transforms = layout.regions[16], channels = layout.regions[17]; if (transforms === undefined || channels === undefined) throw new Error('Missing v2 view regions');
  if (counts[16] !== transforms.capacity || (counts[17] !== 0 && counts[17] !== channels.capacity) || view.getUint32(at+76,true) !== counts[17]) throw new Error('Incomplete v2 view output bank');
  let changed = 0;
  for (let i = 0; i < transforms.capacity; i++) { const flag = view.getUint32(at+transforms.offset+i*80+12,true); if (flag > 1) throw new Error('Unknown v2 transform changed flag'); changed += flag; }
  if (view.getUint32(at+72,true) !== changed) throw new Error('V2 changed transform count mismatch'); return counts;
}
