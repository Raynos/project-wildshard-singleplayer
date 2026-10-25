/** Finite H4 world actions. These are ABI-v2 additions; v0/v1 declarations,
 * generated bindings and shipped module hashes are unchanged. */
import { SCRIPT_V1_COMMANDS } from './scriptAbiV1';
import type { V2Layout } from './scriptWireV2';

export const V2_ACTION_OPS: Readonly<{ impulse: 14; dismount: 23; ignite: 24; trust: 26; ownership: 27; lead: 28; mount: 29; hurt: 30; pose: 31; adopt: 32; bond: 33; release: 34; hide: 35; retire: 36; breaking: 37; notice: 38; playerPose: 39; }> = Object.freeze({ impulse: SCRIPT_V1_COMMANDS.impulse,dismount: 23,ignite: 24,trust:26,ownership:27,lead:28,mount:29,hurt:30,pose:31,adopt:32,bond:33,release:34,hide:35,retire:36,breaking:37,notice:38,playerPose:39 });
export type V2ActionOperation = typeof V2_ACTION_OPS[keyof typeof V2_ACTION_OPS];
export type V2ActionTargetKind = 'player' | 'mount' | 'cell-field' | 'taming' | 'taming-herd' | 'taming-actor';
const operations:ReadonlySet<number>=new Set(Object.values(V2_ACTION_OPS));
const targetKinds:ReadonlySet<string>=new Set(['player','mount','cell-field','taming','taming-herd','taming-actor']);
function declaredOperations(input:ReadonlySet<V2ActionOperation>):boolean {
  // Consume the complete borrowed iterator before testing its private copy.
  const values=[...input];
  for(let index=0;index<values.length;index++){const value=values[index];if(value===undefined||!operations.has(value))return false;}
  return true;
}
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
  | { readonly kind:'taming'; readonly operation:V2ActionOperation; readonly values:readonly [number,number,number,number,number,number] }
);
function positive(value: number): boolean { return Number.isInteger(value) && value > 0 && value <= 0x7fffffff; }
/** Decode and validate the WHOLE ordered bank before borrowing or mutating an
 * owner. Unknown ops, target kinds, reserved words and over-quota suffixes refuse
 * the entire bank. This is used after validateV2Frame checks host-owned bytes. */
export function readV2WorldActions(view: DataView,layout: V2Layout,count: number,bindings: ReadonlyMap<number,V2ActionBinding>,selection?:readonly number[]): readonly V2WorldAction[] {
  const region = layout.regions[9];
  if (region === undefined || view.byteLength !== layout.pages*65536 || !Number.isInteger(count) || count < 0 || count > region.capacity || count > 128) throw new Error('Invalid v2 world action bank');
  let identities:Set<string>|undefined;
  if (bindings.size > 64) throw new Error('V2 action binding capacity');
  for (const [handle,binding] of bindings) {
    if (binding.handle !== handle || !positive(handle) || binding.identity.length === 0 || identities?.has(binding.identity)===true
      || !positive(binding.maxCommands) || binding.maxCommands > 32 || binding.targets.size > 256
      || !Number.isFinite(binding.bounds.coordinate) || binding.bounds.coordinate <= 0 || !Number.isFinite(binding.bounds.velocity) || binding.bounds.velocity < 0
      || !declaredOperations(binding.operations)) throw new Error('Invalid v2 action binding');
    (identities??=new Set()).add(binding.identity);
    const targets = new Set<string>();
    for (const [target,owner] of binding.targets) {
      if (!positive(target) || owner.identity.length === 0 || targets.has(owner.identity) || !targetKinds.has(owner.kind)) throw new Error('Invalid v2 action target');
      targets.add(owner.identity);
    }
  }
  const rows: V2WorldAction[] = [];let used:Map<number,number>|undefined;
  const indices=selection??Array.from({length:count},(_,index)=>index);
  if(indices.length>count||new Set(indices).size!==indices.length||indices.some(index=>!Number.isInteger(index)||index<0||index>=count))throw new Error('Invalid world action selection');
  for (const index of indices) {
    const at = layout.io+region.offset+index*64, handle = view.getUint32(at,true), binding = bindings.get(handle);
    const action = readV2WorldAction(view,at,binding);
    if (binding === undefined) throw new Error('Undeclared v2 world action');
    const n = (used?.get(handle) ?? 0)+1;if (n > binding.maxCommands) throw new Error('V2 world action quota');(used??=new Map()).set(handle,n);
    rows.push(action);
  }
  for(let index=0;index<rows.length;index++)Object.freeze(rows[index]);
  return Object.freeze(rows);
}

/** Exact single record decoder for a combined bank. The combined authority
 * still validates EVERY record, aggregate quotas and all native loans before
 * any operation runs; this reader never skips unknown operations. */
export function readV2WorldAction(view: DataView,at: number,binding: V2ActionBinding | undefined): V2WorldAction {
  if (!Number.isSafeInteger(at) || at < 0 || at%8 !== 0 || at > view.byteLength-64) throw new Error('Invalid v2 world action record');
  const handle = view.getUint32(at,true),op = view.getUint32(at+4,true),target = view.getUint32(at+8,true);
    if (binding === undefined || binding.handle !== handle || !positive(handle) || binding.identity.length === 0 || ![...binding.operations].some(allowed => allowed === op) || !positive(binding.maxCommands) || binding.maxCommands > 32
      || !Number.isFinite(binding.bounds.coordinate) || binding.bounds.coordinate <= 0 || !Number.isFinite(binding.bounds.velocity) || binding.bounds.velocity < 0
      || view.getUint32(at+12,true) !== 0) throw new Error('Undeclared v2 world action');
    const owner = binding.targets.get(target);
    if (!positive(target) || owner === undefined || owner.identity.length === 0) throw new Error('Unowned v2 world action target');
    const values = Array.from({ length: 6 },(_,i) => view.getFloat64(at+16+i*8,true));
    if (!values.every(Number.isFinite)) throw new Error('Non-finite v2 world action');
    const [x,y,z] = values;if (x === undefined || y === undefined || z === undefined) throw new Error('Missing v2 world action values');
    const zero = (from: number): boolean => values.slice(from).every(value => Object.is(value,0));
    if (op === V2_ACTION_OPS.dismount && (owner.kind === 'mount'||owner.kind==='taming') && (x === 0 || x === 1) && zero(1)) return Object.freeze({ binding: binding.identity,target: owner.identity,kind: 'dismount',thrown: x === 1 });
    if (op === V2_ACTION_OPS.ignite && owner.kind === 'cell-field' && Math.abs(x) <= binding.bounds.coordinate && Math.abs(y) <= binding.bounds.coordinate && zero(2)) return Object.freeze({ binding: binding.identity,target: owner.identity,kind: 'ignite',x,z: y });
    if (op === V2_ACTION_OPS.impulse && owner.kind === 'player' && Math.hypot(x,y,z) <= binding.bounds.velocity && zero(3)) return Object.freeze({ binding: binding.identity,target: owner.identity,kind: 'impulse',x,y,z });
    if(validV2TamingAction(op,owner.kind,values,binding.bounds.coordinate))return Object.freeze({binding:binding.identity,target:owner.identity,kind:'taming',operation:op,values:Object.freeze([values[0]??0,values[1]??0,values[2]??0,values[3]??0,values[4]??0,values[5]??0] as const)});
    throw new Error('Invalid v2 world action operands');
}

/** Exact taming operands. Finite deltas and yaw stay unbounded, preserving
 * long-frame native laws; unused words must be positive zero. */
export function validV2TamingAction(op:number,kind:string,values:readonly number[],coordinate:number):op is V2ActionOperation {
  if(values.length!==6||!values.every(Number.isFinite))return false;
  const [a=0,b=0,c=0,d=0,e=0,f=0]=values,bit=(n:number):boolean=>n===0||n===1,zero=(n:number):boolean=>values.slice(n).every(x=>Object.is(x,0));
  if(kind==='taming-herd')return op===26&&bit(b)&&c>=0&&c<=100&&(b===1||Object.is(c,0))&&zero(3)
    ||op===27&&bit(a)&&zero(1)||op===28&&Math.abs(a)<=coordinate&&Math.abs(b)<=coordinate&&zero(2)||op===34&&zero(0);
  if(kind==='taming-actor')return (op===29||op===33)&&bit(a)&&zero(1)||(op===35||op===36)&&zero(0)
    ||op===31&&a>=0&&a<=1&&(b===-1||b===1)&&c>=-1&&c<=1&&bit(d)&&bit(e)&&Number.isFinite(f);
  return kind==='taming'&&(op===23&&bit(a)&&zero(1)||op===30&&a>=0&&zero(1)||op===32&&Math.abs(a)<=coordinate&&Math.abs(b)<=coordinate&&bit(d)&&zero(4)
    ||op===37&&bit(a)&&zero(1)||op===38&&(a===0||a===1||a===2)&&zero(1)||op===39&&Math.abs(b)<=Math.PI/2&&zero(2));
}
