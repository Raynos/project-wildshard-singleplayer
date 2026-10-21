/** ABI v2 fuel verification. This is one prerequisite of complete admission,
 * not permission to instantiate a image by itself. */
import { SCRIPT_ABI } from './scriptAbi';
import { readV2Module,type V2Instruction,type V2Module,type V2Signature } from './scriptModuleV2';

export const V2_ENTRY_SIGNATURES: Readonly<Record<string,readonly number[]>> = Object.freeze({
  ws_init: [0x7f,0x7f,0x7f], ws_step: [0x7f,0x7f], ws_project: [0x7f], ws_view: [0x7c,0x7c,0x7f],
});
/** H0 measured >15% overhead on tiny blocks. Coalesce each acyclic control
 * region, precharging its scalar instruction count once. Conditional paths
 * may consume fewer instructions than charged; nested loop bodies belong to
 * their own region and are charged again at every loop back-edge. Calls charge
 * their own bodies, while their call opcode belongs to this region. */
export function v2BlockCosts(code: readonly V2Instruction[]): ReadonlyMap<number,number> {
  const costs = new Map<number,number>([[0,0]]), regions = [0], controls: boolean[] = [];
  for (let i = 0; i < code.length; i++) {
    const op = code[i]?.op, region = regions.at(-1); if (region === undefined) throw new Error('Invalid v2 region');
    costs.set(region,(costs.get(region) ?? 0)+1);
    if (op === 0x02 || op === 0x03 || op === 0x04) {
      controls.push(op === 0x03);
      if (op === 0x03) { regions.push(i+1); costs.set(i+1,0); }
    } else if (op === 0x0b && controls.pop() === true) regions.pop();
  }
  return costs;
}
function same(a: readonly number[],b: readonly number[]): boolean { return a.length === b.length && a.every((value,i) => value === b[i]); }
function signature(image: V2Module,index: number): V2Signature {
  const result = image.types[image.functions[index] ?? -1]; if (result === undefined) throw new Error('Missing v2 function signature'); return result;
}
function instruction(code: readonly V2Instruction[],at: number,op: number,arg?: number): boolean {
  const value = code[at]; return value?.op === op && (arg === undefined || (op === 0x41 ? value.literal === arg : value.args[0] === arg));
}
function chargeAt(code: readonly V2Instruction[],at: number,fuel: number): number | undefined {
  const cost = code[at+1]?.literal;
  if (typeof cost !== 'number' || !Number.isInteger(cost) || cost < 1 || cost > SCRIPT_ABI.maxBytes) return undefined;
  const shape: readonly [number,number | undefined][] = [[0x23,fuel],[0x41,cost],[0x6b,undefined],[0x24,fuel],[0x23,fuel],[0x41,0],[0x48,undefined],[0x04,0x40],[0x00,undefined],[0x0b,undefined]];
  return shape.every(([op,arg],i) => instruction(code,at+i,op,arg)) ? cost : undefined;
}
export interface V2FuelInspection {
  fuel: number; globals: readonly string[]; pages: number;
  entries: ReadonlyMap<string,number>; unmetered: readonly (readonly V2Instruction[])[];
}
/** Verify the actual bytes, including all charge writes and all possible direct
 * calls, without invoking getters, init, start or any other guest function. */
export function inspectV2Fuel(bytes: Uint8Array): V2FuelInspection {
  const image = readV2Module(bytes), fuel = image.globals.length-1, privateGlobal = image.globals[fuel];
  if (privateGlobal?.type !== 0x7f || !privateGlobal.mutable || privateGlobal.value !== 0) throw new Error('Missing private v2 fuel global');
  const entries = new Map<string,number>(), getters = new Set<number>(), implementations = new Set<number>(), globals: string[] = [];
  for (const [name,params] of Object.entries(V2_ENTRY_SIGNATURES)) {
    const entry = image.exports.get(name); if (entry?.kind !== 0) throw new Error('Missing v2 fueled entry');
    const type = signature(image,entry.index); if (type.result !== 0x7f || !same(type.params,params) || [...entries.values()].includes(entry.index)) throw new Error('Wrong v2 entry signature or alias');
    entries.set(name,entry.index);
  }
  for (const name of ['ws_abi','ws_io']) {
    const exp = image.exports.get(name); if (exp?.kind !== 0) throw new Error('Missing v2 constant getter');
    const type = signature(image,exp.index), code = image.bodies[exp.index]?.code, value = code?.[0]?.literal;
    if (type.params.length > 0 || type.result !== 0x7f || code?.length !== 2 || !instruction(code,0,0x41) || !instruction(code,1,0x0b) || typeof value !== 'number'
      || (name === 'ws_abi' ? value !== 2 : value < 0 || value%8 !== 0 || value > image.pages*65536-656)) throw new Error('Invalid v2 constant getter');
    getters.add(exp.index);
  }
  for (let i = 0; i < image.globals.length; i++) if (i !== fuel && image.globals[i]?.mutable) {
    const name = `__state_${i}`, exp = image.exports.get(name); if (exp?.kind !== 3 || exp.index !== i) throw new Error('Missing v2 mutable-global snapshot'); globals.push(name);
  }
  const allowedFunctions = new Set([...entries.values(),...getters]);
  for (const [name,exp] of image.exports) {
    if (exp.kind === 0 && (!allowedFunctions.has(exp.index) || !(Object.hasOwn(V2_ENTRY_SIGNATURES,name) || name === 'ws_abi' || name === 'ws_io'))) throw new Error('Unexpected v2 function export');
    if (exp.kind === 3 && (exp.index === fuel || name !== `__state_${exp.index}` || !image.globals[exp.index]?.mutable)) throw new Error('V2 fuel exported or noncanonical global alias');
  }
  for (const index of entries.values()) {
    const body = image.bodies[index]; if (body === undefined) throw new Error('Missing v2 entry wrapper');
    if (body.locals.length > 0) throw new Error('Invalid v2 entry wrapper');
    const params = signature(image,index).params, code = body.code, target = code[8+params.length]?.args[0];
    if (target === undefined || allowedFunctions.has(target) || implementations.has(target)) throw new Error('Invalid v2 entry target');
    const type = signature(image,target); if (type.result !== 0x7f || !same(type.params,params)) throw new Error('V2 entry implementation signature');
    const expected: [number,number | undefined][] = [[0x20,params.length-1],[0x24,fuel],[0x23,fuel],[0x41,0],[0x48,undefined],[0x04,0x40],[0x00,undefined],[0x0b,undefined],
      ...params.map((_,i): [number,number] => [0x20,i]),[0x10,target],[0x1a,undefined],[0x23,fuel],[0x0b,undefined]];
    if (code.length !== expected.length || expected.some(([op,arg],i) => !instruction(code,i,op,arg))) throw new Error('Invalid v2 entry fuel setup');
    implementations.add(target);
  }
  const unmetered: V2Instruction[][] = [], calls: number[][] = [];
  for (let index = 0; index < image.bodies.length; index++) {
    const body = image.bodies[index]; if (body === undefined) throw new Error('Missing v2 body');
    if (allowedFunctions.has(index)) { unmetered.push([...body.code]); calls.push(body.code.filter(value => value.op === 0x10).map(value => value.args[0] ?? -1)); continue; }
    const plain: V2Instruction[] = [], charges = new Map<number,number>(), edges: number[] = [];
    for (let at = 0; at < body.code.length;) {
      const cost = chargeAt(body.code,at,fuel);
      if (cost !== undefined) { if (charges.has(plain.length)) throw new Error('Duplicate v2 block charge'); charges.set(plain.length,cost); at += 10; continue; }
      const value = body.code[at++]; if (value === undefined) throw new Error('Missing v2 instruction');
      if (value.op === 0x24 && value.args[0] === fuel) throw new Error('V2 fuel access outside a verified charge');
      if (value.op === 0x10) {
        const target = value.args[0]; if (target === undefined || [...entries.values()].includes(target) || implementations.has(target)) throw new Error('Guest calls a v2 entry or its implementation'); edges.push(target);
      }
      plain.push(value);
    }
    const costs = v2BlockCosts(plain);
    if (costs.size !== charges.size || [...costs].some(([at,cost]) => charges.get(at) !== cost)) throw new Error('Missing or underpriced v2 basic block region');
    unmetered.push(plain); calls.push(edges);
  }
  const depths = new Map<number,number>(), active = new Set<number>();
  const visit = (index: number): number => {
    const previous = depths.get(index); if (previous !== undefined) return previous;
    if (active.has(index)) throw new Error('V2 call graph cycle'); if (active.size >= SCRIPT_ABI.callDepth) throw new Error('V2 call graph depth exceeds 64');
    active.add(index); let depth = 1;
    for (const target of calls[index] ?? []) depth = Math.max(depth,visit(target)+1);
    active.delete(index); if (depth > SCRIPT_ABI.callDepth) throw new Error('V2 call graph depth exceeds 64'); depths.set(index,depth); return depth;
  };
  for (let i = 0; i < image.bodies.length; i++) visit(i);
  return { fuel,globals,pages: image.pages,entries,unmetered };
}
