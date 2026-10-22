/** ABI-v2 query wire. Requests resolve local handles into stable identities
 * before leaving guest memory; pending work never saves a transient handle. */
import { SCRIPT_V1_LISTS } from './scriptAbiV1';
import { relativeTickV2,type V2Layout } from './scriptWireV2';

export const V2_QUERY_OPS = Object.freeze({ walkable: SCRIPT_V1_LISTS.nearestWalkable,path: SCRIPT_V1_LISTS.path,ray: 8,overlap: 9 });
export type V2QueryOperation = typeof V2_QUERY_OPS[keyof typeof V2_QUERY_OPS];
type Vec3 = readonly [number,number,number];
type Values = readonly [number,number,number,number,number,number,number];
export interface V2QueryBinding {
  readonly identity: string; readonly handle: number; readonly observed: ReadonlyMap<number,string>;
  readonly operations: ReadonlySet<V2QueryOperation>;
}
export interface V2QueryRequest {
  readonly binding: string; readonly id: number; readonly op: V2QueryOperation;
  readonly target: string | null; readonly atTick: number; readonly values: Values;
}
export type V2QueryAnswer = { readonly status: 2 | 3 } | { readonly status: 1 } & (
  { readonly kind: 'walkable'; readonly point: Vec3 }
  | { readonly kind: 'path'; readonly points: readonly Vec3[] }
  | { readonly kind: 'overlap'; readonly bodies: readonly string[] }
  | { readonly kind: 'ray'; readonly hit: null | { readonly point: Vec3; readonly normal: Vec3; readonly distance: number; readonly body: string | null } }
);
export interface V2QueryReply { readonly request: V2QueryRequest; readonly atTick: number; readonly answer: V2QueryAnswer }
function operation(value: number): value is V2QueryOperation { return value === 4 || value === 5 || value === 8 || value === 9; }
function finite(value: number): number { if (!Number.isFinite(value)) throw new Error('Non-finite v2 query value');return value; }
function uint(value: number): number { if (!Number.isInteger(value) || value < 1 || value > 0xffffffff) throw new Error('Invalid v2 request id');return value; }
function bindingHandle(binding: V2QueryBinding): number { uint(binding.handle);if (binding.handle > 0x7fffffff || binding.identity.length === 0) throw new Error('Invalid v2 query binding');return binding.handle; }
function pose(values: Vec3): Vec3 { return [finite(values[0]),finite(values[1]),finite(values[2])]; }
/** Call after whole-frame validation. Metadata and the authoritative tick come
 * from the host, never from guest-written descriptors or a guest clock. */
export function readV2QueryRequests(view: DataView,layout: V2Layout,count: number,tick: number,bindings: ReadonlyMap<number,V2QueryBinding>): readonly V2QueryRequest[] {
  const region = layout.regions[10];if (region === undefined || view.byteLength !== layout.pages*65536 || !Number.isSafeInteger(count) || count < 0 || count > region.capacity) throw new Error('Invalid v2 query ring length');
  const origin = Math.floor(tick/2**30)*2**30, relative = relativeTickV2(tick,origin), seen = new Set<string>(), rows: V2QueryRequest[] = [];
  for (let i = 0; i < count; i++) {
    const at = layout.io+region.offset+i*80, local = view.getUint32(at,true), binding = bindings.get(local), id = uint(view.getUint32(at+4,true)), op = view.getUint32(at+8,true), target = view.getUint32(at+20,true);
    if (binding === undefined || !operation(op) || !binding.operations.has(op) || view.getUint32(at+12,true) !== 0 || view.getInt32(at+16,true) !== relative) throw new Error('Undeclared v2 query or issue tick');
    if (bindingHandle(binding) !== local || target > 0x7fffffff) throw new Error('Invalid v2 query handle');
    const stable = target === 0 ? null : binding.observed.get(target);if (stable === undefined || stable?.length === 0) throw new Error('Stale v2 query target');
    const value = (j: number): number => finite(view.getFloat64(at+24+j*8,true));
    const values: Values = [value(0),value(1),value(2),value(3),value(4),value(5),value(6)];
    if ((op === 4 && (target !== 0 || values[3] < 0 || values[4] !== 0 || values[5] !== 0 || values[6] !== 0))
      || (op === 5 && (target !== 0 || values[6] < 0))
      || (op === 8 && (values[6] < 0 || Math.abs(Math.hypot(values[3],values[4],values[5])-1) > 1e-6))
      || (op === 9 && (values[3] <= 0 || values[4] !== 0 || values[5] !== 0 || values[6] !== 0))) throw new Error('Invalid v2 query arguments');
    const key = JSON.stringify([binding.identity,id]);if (seen.has(key)) throw new Error('Duplicate v2 request id');seen.add(key);
    rows.push(Object.freeze({ binding: binding.identity,id,op,target: stable,atTick: tick,values: Object.freeze(values) }));
  }
  return Object.freeze(rows);
}
/** Resolve replies against this entry's observed identities. Any stale body,
 * invalid result or full bank refuses the entire batch, without a prefix. The
 * returned banks own their bytes and can be passed to SimBatchV2.extra. */
export function prepareV2QueryReplies(layout: V2Layout,tick: number,replies: readonly V2QueryReply[],bindings: ReadonlyMap<string,V2QueryBinding>): readonly { readonly kind: number; readonly count: number; readonly bytes: Uint8Array }[] {
  const records = layout.regions[11], scalars = layout.regions[12];
  if (records === undefined || scalars === undefined || replies.length > records.capacity) throw new Error('V2 reply ring full');
  const origin = Math.floor(tick/2**30)*2**30;relativeTickV2(tick,origin);
  const rows: { readonly binding: number; readonly id: number; readonly stamp: number; readonly status: number; readonly values: readonly number[]; readonly data: readonly number[] }[] = [], seen = new Set<string>();let dataCount = 0;
  for (const reply of replies) {
    const request = reply.request, binding = bindings.get(request.binding), answer = reply.answer, key = JSON.stringify([request.binding,request.id]);
    if (binding === undefined || !binding.operations.has(request.op) || seen.has(key) || reply.atTick < request.atTick || reply.atTick >= tick) throw new Error('Invalid v2 reply identity or delivery tick');seen.add(key);uint(request.id);
    const body = (identity: string | null): number => {
      if (identity === null) return 0;
      const matches = [...binding.observed].filter(([,value]) => value === identity);const value = matches[0]?.[0];
      if (matches.length !== 1 || value === undefined || !Number.isInteger(value) || value < 1 || value > 0x7fffffff) throw new Error('Stale v2 reply body');return value;
    };
    let values: readonly number[] = [0,0,0,0,0], data: readonly number[] = [];
    if (answer.status === 1) {
      if (V2_QUERY_OPS[answer.kind] !== request.op) throw new Error('Mismatched v2 query answer');
      switch (answer.kind) {
        case 'walkable': values = [...pose(answer.point),0,0];break;
        case 'path':
          if (answer.points.length > Math.floor((scalars.capacity-dataCount)/3)) throw new Error('V2 reply data ring full');
          values = [answer.points.length,0,0,0,0];data = answer.points.flatMap(value => [...pose(value)]);break;
        case 'overlap':
          if (answer.bodies.length > scalars.capacity-dataCount || new Set(answer.bodies).size !== answer.bodies.length) throw new Error('V2 overlap reply full or duplicated');
          values = [answer.bodies.length,0,0,0,0];data = answer.bodies.map(body);break;
        case 'ray': if (answer.hit !== null) {
          const hit = answer.hit;finite(hit.distance);if (hit.distance < 0 || hit.distance > request.values[6]) throw new Error('Invalid v2 ray distance');
          values = [1,...pose(hit.point),hit.distance];data = [...pose(hit.normal),body(hit.body)];
        }break;
        default: throw new Error('Unknown v2 reply kind');
      }
    }
    if (data.length > scalars.capacity-dataCount) throw new Error('V2 reply data ring full');dataCount += data.length;
    rows.push({ binding: bindingHandle(binding),id: request.id,stamp: relativeTickV2(reply.atTick,origin),status: answer.status,values,data });
  }
  const bytes = new Uint8Array(rows.length*64), dataBytes = new Uint8Array(dataCount*8), out = new DataView(bytes.buffer), dataOut = new DataView(dataBytes.buffer);let base = 0;
  for (const [i,row] of rows.entries()) {
    const at = i*64;[row.binding,row.id,row.status,row.data.length].forEach((value,j) => out.setUint32(at+j*4,value,true));out.setInt32(at+16,row.stamp,true);out.setUint32(at+20,base,true);
    row.values.forEach((value,j) => out.setFloat64(at+24+j*8,value,true));row.data.forEach((value,j) => dataOut.setFloat64((base+j)*8,value,true));base += row.data.length;
  }
  return Object.freeze([{ kind: 12,count: rows.length,bytes },{ kind: 13,count: dataCount,bytes: dataBytes }]);
}
