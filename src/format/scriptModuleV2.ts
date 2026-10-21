/** Scalar Wasm reader for ABI v2 admission. Parsing never instantiates a guest;
 * this structural result alone is not permission to execute one. */
import { SCRIPT_ABI } from './scriptAbi';

export interface V2Signature { params: readonly number[]; result: number | undefined }
export interface V2Instruction { op: number; args: readonly number[]; literal: number | bigint | undefined; at: number; end: number }
export interface V2Body { locals: readonly number[]; code: readonly V2Instruction[]; bytes: Uint8Array; prefix: number }
export interface V2Global { type: number; mutable: boolean; value: number | bigint }
export interface V2Export { kind: number; index: number }
export interface V2Section { id: number; bytes: Uint8Array }
export interface V2Module {
  types: readonly V2Signature[]; functions: readonly number[]; bodies: readonly V2Body[];
  globals: readonly V2Global[]; exports: ReadonlyMap<string, V2Export>;
  pages: number; sections: readonly V2Section[];
}
const numeric = new Set([0x7f,0x7e,0x7d,0x7c]);
class Reader {
  pos = 0;
  constructor(readonly bytes: Uint8Array) {}
  byte(): number { const value = this.bytes[this.pos++]; if (value === undefined) throw new Error('Truncated v2 module'); return value; }
  take(length: number): Uint8Array {
    if (!Number.isSafeInteger(length) || length < 0 || length > this.bytes.length-this.pos) throw new Error('Truncated v2 section');
    const bytes = this.bytes.subarray(this.pos,this.pos+length); this.pos += length; return bytes;
  }
  uint(): number {
    let value = 0;
    for (let i = 0; i < 5; i++) { const byte = this.byte(); if (i === 4 && byte > 15) throw new Error('Invalid v2 u32'); value += (byte & 127)*2**(7*i); if (byte < 128) return value; }
    throw new Error('Invalid v2 u32');
  }
  signed(width: 32 | 64): bigint {
    let value = 0n, shift = 0n;
    for (let i = 0; i < Math.ceil(width/7); i++) {
      const byte = this.byte(); value |= BigInt(byte & 127)<<shift; shift += 7n;
      if (byte < 128) { if (byte & 64) value -= 1n<<shift; if (BigInt.asIntN(width,value) !== value) throw new Error('Invalid v2 signed integer'); return value; }
    }
    throw new Error('Invalid v2 signed integer');
  }
  float(width: 32 | 64): number { const bytes = this.take(width/8), view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); return width === 32 ? view.getFloat32(0,true) : view.getFloat64(0,true); }
  type(): number { const value = this.byte(); if (!numeric.has(value)) throw new Error('Non-scalar v2 type'); return value; }
  name(): string { return new TextDecoder('utf-8',{ fatal: true }).decode(this.take(this.uint())); }
  done(): void { if (this.pos !== this.bytes.length) throw new Error('Trailing v2 section bytes'); }
}
function instructions(reader: Reader): V2Instruction[] {
  const code: V2Instruction[] = [];
  while (reader.pos < reader.bytes.length) {
    const at = reader.pos, op = reader.byte(), args: number[] = []; let literal: number | bigint | undefined;
    if (op >= 0x02 && op <= 0x04) { const type = reader.byte(); if (type !== 0x40 && !numeric.has(type)) throw new Error('Multivalue v2 block'); args.push(type); }
    else if ([0x0c,0x0d,0x10,0x20,0x21,0x22,0x23,0x24].includes(op)) args.push(reader.uint());
    else if (op === 0x0e) { const count = reader.uint(); if (count > SCRIPT_ABI.maxBytes) throw new Error('V2 branch table cap'); for (let i = 0; i <= count; i++) args.push(reader.uint()); }
    else if (op >= 0x28 && op <= 0x3e) { args.push(reader.uint(),reader.uint()); }
    else if (op === 0x3f) { if (reader.byte() !== 0) throw new Error('Multiple v2 memories'); }
    else if (op === 0x41) literal = Number(reader.signed(32));
    else if (op === 0x42) literal = reader.signed(64);
    else if (op === 0x43 || op === 0x44) literal = reader.float(op === 0x43 ? 32 : 64);
    else if (op === 0xfc) { const sub = reader.uint(); if (sub > 7) throw new Error('V2 bulk memory is forbidden'); args.push(sub); }
    else if (![0x00,0x01,0x05,0x0b,0x0f,0x1a,0x1b].includes(op) && !(op >= 0x45 && op <= 0xc4)) throw new Error('Forbidden v2 instruction (grow, tables, SIMD or references)');
    code.push({ op,args,literal,at,end: reader.pos });
  }
  return code;
}
function signature(reader: Reader): V2Signature {
  if (reader.byte() !== 0x60) throw new Error('V2 GC type');
  const count = reader.uint(); if (count > 16) throw new Error('V2 parameter cap');
  const params = Array.from({ length: count },() => reader.type()), results = reader.uint();
  if (results > 1) throw new Error('V2 multivalue result'); return { params,result: results === 1 ? reader.type() : undefined };
}
/** Read the scalar, fixed-memory subset. Fuel, finite guards and entry contracts
 * are deliberately verified separately before any runtime can instantiate it. */
export function readV2Module(bytes: Uint8Array): V2Module {
  if (bytes.length > SCRIPT_ABI.maxBytes || !WebAssembly.validate(new Uint8Array(bytes))) throw new Error('Invalid or oversized v2 module');
  const reader = new Reader(bytes); reader.take(8);
  const types: V2Signature[] = [], functions: number[] = [], globals: V2Global[] = [], bodies: V2Body[] = [];
  const exports = new Map<string,V2Export>(), sections: V2Section[] = []; let pages = 0;
  while (reader.pos < bytes.length) {
    const id = reader.byte(), data = reader.take(reader.uint()), section = new Reader(data); sections.push({ id,bytes: data });
    if (id === 0) continue;
    const count = section.uint();
    if (id === 1) { if (count > SCRIPT_ABI.maxFunctions) throw new Error('V2 type cap'); for (let i = 0; i < count; i++) types.push(signature(section)); }
    else if (id === 2) {
      if (count !== 1 || section.name() !== 'env' || section.name() !== 'memory' || section.byte() !== 2 || section.uint() !== 1) throw new Error('V2 imports only fixed env.memory');
      pages = section.uint(); if (pages < 1 || pages > 4 || section.uint() !== pages) throw new Error('V2 memory must be fixed at 1..4 pages');
    } else if (id === 3) { if (count > SCRIPT_ABI.maxFunctions) throw new Error('V2 function cap'); for (let i = 0; i < count; i++) functions.push(section.uint()); }
    else if (id === 6) {
      if (count > SCRIPT_ABI.maxGlobals) throw new Error('V2 global cap');
      for (let i = 0; i < count; i++) {
        const type = section.type(), mutable = section.byte() === 1, op = section.byte(); let value: number | bigint;
        if (op === 0x41 && type === 0x7f) value = Number(section.signed(32));
        else if (op === 0x42 && type === 0x7e) value = section.signed(64);
        else if ((op === 0x43 && type === 0x7d) || (op === 0x44 && type === 0x7c)) { value = section.float(op === 0x43 ? 32 : 64); if (!Number.isFinite(value)) throw new Error('Non-finite v2 global initializer'); }
        else throw new Error('V2 constant global initializer required');
        if (section.byte() !== 0x0b) throw new Error('V2 global initializer end'); globals.push({ type,mutable,value });
      }
    } else if (id === 7) {
      if (count > SCRIPT_ABI.maxFunctions+SCRIPT_ABI.maxGlobals) throw new Error('V2 export cap');
      for (let i = 0; i < count; i++) { const name = section.name(), kind = section.byte(), index = section.uint(); if (kind !== 0 && kind !== 3) throw new Error('V2 exports only functions/globals'); exports.set(name,{ kind,index }); }
    } else if (id === 10) {
      if (count !== functions.length) throw new Error('V2 code/function count');
      for (let i = 0; i < count; i++) {
        const body = new Reader(section.take(section.uint())), groups = body.uint(), locals: number[] = [];
        if (groups > SCRIPT_ABI.maxLocals) throw new Error('V2 local group cap');
        for (let j = 0; j < groups; j++) { const length = body.uint(), type = body.type(); if (length > SCRIPT_ABI.maxLocals-locals.length) throw new Error('V2 local cap'); for (let k = 0; k < length; k++) locals.push(type); }
        const prefix = body.pos, code = instructions(body); bodies.push({ locals,code,bytes: body.bytes,prefix });
      }
    } else if (id === 11) {
      for (let i = 0; i < count; i++) {
        if (section.uint() !== 0 || section.byte() !== 0x41) throw new Error('V2 only active data');
        const offset = Number(section.signed(32)); if (section.byte() !== 0x0b || offset < 0) throw new Error('V2 data offset');
        const length = section.uint(); if (length > pages*65536-offset) throw new Error('V2 data outside memory'); section.take(length);
      }
    } else throw new Error('Forbidden v2 section (start, tables, private memory or data count)');
    section.done();
  }
  if (pages === 0 || bodies.length !== functions.length) throw new Error('Missing v2 memory or bodies');
  return { types,functions,bodies,globals,exports,pages,sections };
}
