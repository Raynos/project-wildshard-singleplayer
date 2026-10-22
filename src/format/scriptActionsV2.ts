/** Finite H4 world actions. These are ABI-v2 additions; v0/v1 declarations,
 * generated bindings and shipped module hashes are unchanged. */
import { SCRIPT_V1_COMMANDS } from './scriptAbiV1';
import type { V2Layout } from './scriptWireV2';

export const V2_ACTION_OPS = Object.freeze({ impulse: SCRIPT_V1_COMMANDS.impulse,dismount: 23,ignite: 24 });
export type V2ActionOperation = typeof V2_ACTION_OPS[keyof typeof V2_ACTION_OPS];
export type V2ActionTargetKind = 'player' | 'mount' | 'cell-field';
export interface V2ActionTarget { readonly identity: string; readonly kind: V2ActionTargetKind }
export interface V2ActionBinding {
  readonly identity: string; readonly handle: number;
  readonly targets: ReadonlyMap<number,V2ActionTarget>;
  readonly operations: ReadonlySet<V2ActionOperation>;
  readonly maxCommands: number;
  /** Explicit admitted bounds, in world coordinates and metres per second. */
  readonly bounds: { readonly coordinate: number; readonly velocity: number };
}
interface Target { readonly binding: string; readonly target: string }
export type V2WorldAction = Target & (
  { readonly kind: 'dismount'; readonly thrown: boolean }
  | { readonly kind: 'ignite'; readonly x: number; readonly z: number }
  | { readonly kind: 'impulse'; readonly x: number; readonly y: number; readonly z: number }
);
function positive(value: number): boolean { return Number.isInteger(value) && value > 0 && value <= 0x7fffffff; }
/** Decode and validate the WHOLE ordered bank before borrowing or mutating an
 * owner. Unknown ops, target kinds, reserved words and over-quota suffixes refuse
 * the entire bank. This is used after validateV2Frame checks host-owned bytes. */
export function readV2WorldActions(view: DataView,layout: V2Layout,count: number,bindings: ReadonlyMap<number,V2ActionBinding>): readonly V2WorldAction[] {
  const region = layout.regions[9];
  if (region === undefined || view.byteLength !== layout.pages*65536 || !Number.isInteger(count) || count < 0 || count > region.capacity || count > 128) throw new Error('Invalid v2 world action bank');
  const identities = new Set<string>();
  if (bindings.size > 64) throw new Error('V2 action binding capacity');
  for (const [handle,binding] of bindings) {
    if (binding.handle !== handle || !positive(handle) || binding.identity.length === 0 || identities.has(binding.identity)
      || !positive(binding.maxCommands) || binding.maxCommands > 32 || binding.targets.size > 256
      || !Number.isFinite(binding.bounds.coordinate) || binding.bounds.coordinate <= 0 || !Number.isFinite(binding.bounds.velocity) || binding.bounds.velocity < 0
      || [...binding.operations].some(op => !Object.values(V2_ACTION_OPS).includes(op))) throw new Error('Invalid v2 action binding');
    identities.add(binding.identity);
    const targets = new Set<string>();
    for (const [target,owner] of binding.targets) {
      if (!positive(target) || owner.identity.length === 0 || targets.has(owner.identity) || !['player','mount','cell-field'].includes(owner.kind)) throw new Error('Invalid v2 action target');
      targets.add(owner.identity);
    }
  }
  const rows: V2WorldAction[] = [], used = new Map<number,number>();
  for (let index = 0; index < count; index++) {
    const at = layout.io+region.offset+index*64, handle = view.getUint32(at,true), op = view.getUint32(at+4,true), target = view.getUint32(at+8,true), binding = bindings.get(handle);
    if (binding === undefined || binding.handle !== handle || !positive(handle) || binding.identity.length === 0 || ![...binding.operations].some(allowed => allowed === op) || !positive(binding.maxCommands) || binding.maxCommands > 32
      || !Number.isFinite(binding.bounds.coordinate) || binding.bounds.coordinate <= 0 || !Number.isFinite(binding.bounds.velocity) || binding.bounds.velocity < 0
      || view.getUint32(at+12,true) !== 0) throw new Error('Undeclared v2 world action');
    const owner = binding.targets.get(target);
    if (!positive(target) || owner === undefined || owner.identity.length === 0) throw new Error('Unowned v2 world action target');
    const n = (used.get(handle) ?? 0)+1;if (n > binding.maxCommands) throw new Error('V2 world action quota');used.set(handle,n);
    const values = Array.from({ length: 6 },(_,i) => view.getFloat64(at+16+i*8,true));
    if (!values.every(Number.isFinite)) throw new Error('Non-finite v2 world action');
    const [x,y,z] = values;if (x === undefined || y === undefined || z === undefined) throw new Error('Missing v2 world action values');
    const zero = (from: number): boolean => values.slice(from).every(value => Object.is(value,0));
    if (op === V2_ACTION_OPS.dismount && owner.kind === 'mount' && (x === 0 || x === 1) && zero(1)) rows.push({ binding: binding.identity,target: owner.identity,kind: 'dismount',thrown: x === 1 });
    else if (op === V2_ACTION_OPS.ignite && owner.kind === 'cell-field' && Math.abs(x) <= binding.bounds.coordinate && Math.abs(y) <= binding.bounds.coordinate && zero(2)) rows.push({ binding: binding.identity,target: owner.identity,kind: 'ignite',x,z: y });
    else if (op === V2_ACTION_OPS.impulse && owner.kind === 'player' && Math.hypot(x,y,z) <= binding.bounds.velocity && zero(3)) rows.push({ binding: binding.identity,target: owner.identity,kind: 'impulse',x,y,z });
    else throw new Error('Invalid v2 world action operands');
  }
  return Object.freeze(rows.map(row => Object.freeze(row)));
}
