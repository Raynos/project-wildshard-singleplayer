/** ABI v2 executable intake: validate actual bytes before any guest code runs.
 * Kept separate from scriptAdmission so shipped v0/v1 contracts stay unchanged. */
import { readV2Module,type V2Body,type V2Instruction,type V2Signature } from './scriptModuleV2';
import { inspectV2Fuel,type V2Lane } from './scriptFuelV2';

interface Control { start: number; end: number; type: number; op: number }
interface Guard { control: Control; type: number; set: number }
const f32 = 0x7d, f64 = 0x7c;
function op(code: readonly V2Instruction[],at: number,operation: number,arg?: number): boolean {
  const value = code[at]; return value?.op === operation && (arg === undefined || value.args[0] === arg);
}
function finiteGuards(body: V2Body,type: V2Signature,code: readonly V2Instruction[],floatGlobals: ReadonlyMap<number,number>): void {
  const root: Control = { start: -1,end: code.length-1,type: type.result ?? 0x40,op: 0x02 }, controls = [root], stack = [root];
  const branches: { at: number; targets: Control[] }[] = [];
  for (let i = 0; i < code.length; i++) {
    const value = code[i]; if (value === undefined) throw new Error('Missing v2 finite instruction');
    if (value.op >= 0x02 && value.op <= 0x04) {
      const control = { start: i,end: -1,type: value.args[0] ?? -1,op: value.op }; controls.push(control); stack.push(control);
    } else if (value.op === 0x0b) {
      const control = stack.pop(); if (control === undefined) throw new Error('Unbalanced v2 finite control'); control.end = i;
    } else if (value.op === 0x0c || value.op === 0x0d || value.op === 0x0e) {
      branches.push({ at: i,targets: value.args.map(depth => { const target = stack.at(-1-depth); if (target === undefined) throw new Error('Invalid v2 branch depth'); return target; }) });
    } else if (value.op === 0x0f) branches.push({ at: i,targets: [root] });
  }
  const locals = [...type.params,...body.locals], guards: Guard[] = [];
  for (const control of controls) {
    if (control.op !== 0x02 || (control.type !== f32 && control.type !== f64)) continue;
    const at = control.end-13, local = code[at]?.args[0], narrow = control.type === f32;
    if (local === undefined || locals[local] !== control.type || at <= control.start+1 || !op(code,at,0x21,local)) continue;
    const maximum = code[at+6]?.literal, expected = narrow ? Math.fround(3.4028234663852886e38) : Number.MAX_VALUE;
    if (maximum !== expected) continue;
    const shape: readonly [number,number | undefined][] = [[0x20,local],[0x20,local],[narrow ? 0x5c : 0x62,undefined],[0x20,local],
      [narrow ? 0x8b : 0x99,undefined],[narrow ? 0x43 : 0x44,undefined],[narrow ? 0x5e : 0x64,undefined],[0x72,undefined],[0x04,0x40],[0x00,undefined],[0x0b,undefined],[0x20,local],[0x0b,undefined]];
    if (shape.every(([operation,arg],i) => op(code,at+1+i,operation,arg))) guards.push({ control,type: control.type,set: at });
  }
  const byEnd = new Map(guards.map(guard => [guard.control.end,guard])), checkedReinterpret = new Map(guards.map(guard => [guard.set-1,guard.type]));
  const protectedControls = new Set(guards.map(guard => guard.control));
  for (const branch of branches) if (branch.targets.some(target => protectedControls.has(target))) throw new Error('Branch bypasses a v2 finite guard');
  for (let i = 0; i < code.length; i++) {
    const value = code[i]; if (value === undefined) throw new Error('Missing v2 finite instruction');
    const width = value.op === 0x38 || value.op === 0xbc ? f32 : value.op === 0x39 || value.op === 0xbd ? f64
      : value.op === 0x24 ? floatGlobals.get(value.args[0] ?? -1) : undefined;
    if (width !== undefined) {
      const actual = byEnd.get(i-1)?.type;
      if (actual === undefined || actual !== width) throw new Error('Missing v2 finite input guard');
    }
    if ((value.op === 0xbe && checkedReinterpret.get(i) !== f32) || (value.op === 0xbf && checkedReinterpret.get(i) !== f64)) throw new Error('Missing v2 finite reinterpret guard');
  }
}
export interface ScriptAdmissionV2 {
  initialPages: number; maximumPages: number; globals: readonly string[];
  fuel: number; lane: V2Lane; io: number; ioBytes: number; entries: ReadonlyMap<string,number>;
}
/** No instantiation, getters or initialization occurs during admission. The
 * runtime must still validate host-owned output regions before publishing. */
export function admitScriptV2(bytes: Uint8Array,options: { readonly ioBytes?: number; readonly lane?: V2Lane } = {}): ScriptAdmissionV2 {
  const image = readV2Module(bytes), fuel = inspectV2Fuel(bytes,options);
  const floats = new Map(image.globals.flatMap((global,index): [number,number][] => global.type === f32 || global.type === f64 ? [[index,global.type]] : []));
  for (let i = 0; i < image.bodies.length; i++) {
    const body = image.bodies[i], type = image.types[image.functions[i] ?? -1], code = fuel.unmetered[i];
    if (body === undefined || type === undefined || code === undefined) throw new Error('Missing v2 finite body'); finiteGuards(body,type,code,floats);
  }
  const index = image.exports.get('ws_io')?.index, io = image.bodies[index ?? -1]?.code[0]?.literal;
  if (typeof io !== 'number') throw new Error('Missing v2 IO constant');
  const ioBytes = options.ioBytes ?? 656;
  if (!Number.isSafeInteger(ioBytes) || ioBytes < 656 || ioBytes > image.pages*65536-io) throw new Error('V2 IO does not fit fixed memory');
  if (image.data.some(row => row.length > 0 && row.offset < io+ioBytes && row.offset+row.length > io)) throw new Error('V2 static data overlaps host IO');
  return { initialPages: fuel.pages,maximumPages: fuel.pages,globals: fuel.globals,fuel: fuel.fuel,lane: fuel.lane,io,ioBytes,entries: fuel.entries };
}
