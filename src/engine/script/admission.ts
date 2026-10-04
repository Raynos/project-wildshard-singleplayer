import { SCRIPT_ABI, SCRIPT_EXPORTS, SCRIPT_IMPORTS } from './abi';

class Reader {
  pos = 0;
  readonly bytes: Uint8Array;
  constructor(bytes: Uint8Array) { this.bytes = bytes; }
  byte(): number { const n = this.bytes[this.pos++]; if (n === undefined) throw new Error('Truncated module'); return n; }
  uint(): number {
    let n = 0;
    for (let i = 0; i < 5; i++) { const b = this.byte(); if (i === 4 && b > 15) throw new Error('Invalid u32'); n += (b & 127) * 2 ** (i * 7); if (b < 128) return n; }
    throw new Error('Invalid u32');
  }
  signed(max = 5): number {
    let n = 0, shift = 0;
    for (let i = 0; i < max; i++) { const b = this.byte(); n += (b & 127) * 2 ** shift; shift += 7; if (b < 128) return b & 64 ? n - 2 ** shift : n; }
    throw new Error('Invalid signed integer');
  }
  take(n: number): Uint8Array { if (n < 0 || this.pos + n > this.bytes.length) throw new Error('Truncated section'); const b = this.bytes.subarray(this.pos, this.pos + n); this.pos += n; return b; }
  name(): string { return new TextDecoder('utf-8', { fatal: true }).decode(this.take(this.uint())); }
  done(): boolean { return this.pos === this.bytes.length; }
}
interface Signature { params: number[]; result: number | undefined }
interface Instruction { op: number; arg: number | undefined }
/** Limits and complete mutable-global snapshot names established without executing module code. */
export interface ScriptAdmission { initialPages: number; maximumPages: number; globals: readonly string[]; functions: number }
const NUMERIC = new Set([0x7f, 0x7e, 0x7d, 0x7c]);
function numeric(r: Reader): number { const n = r.byte(); if (!NUMERIC.has(n)) throw new Error('Non-numeric type'); return n; }
function equal(a: readonly number[], b: readonly number[]): boolean { return a.length === b.length && a.every((n, i) => n === b[i]); }
function signature(s: Signature): number[] { return [...s.params, s.result ?? 0]; }
function instructions(r: Reader): Instruction[] {
  const out: Instruction[] = [];
  while (!r.done()) {
    const op = r.byte(); let arg: number | undefined;
    if (op >= 0x02 && op <= 0x04) { const t = r.byte(); if (t !== 0x40 && !NUMERIC.has(t)) throw new Error('Multivalue block'); }
    else if ([0x0c, 0x0d, 0x10, 0x20, 0x21, 0x22, 0x23, 0x24].includes(op)) arg = r.uint();
    else if (op === 0x0e) { const n = r.uint(); if (n > SCRIPT_ABI.maxBytes) throw new Error('Branch table cap'); for (let i = 0; i <= n; i++) r.uint(); }
    else if (op >= 0x28 && op <= 0x3e) { r.uint(); r.uint(); }
    else if (op === 0x3f || op === 0x40) { if (r.byte() !== 0) throw new Error('Multiple memories'); }
    else if (op === 0x41) arg = r.signed();
    else if (op === 0x42) r.signed(10);
    else if (op === 0x43) r.take(4);
    else if (op === 0x44) r.take(8);
    else if (op === 0xfc) {
      const sub = r.uint();
      if (sub <= 7) { /* Saturating numeric conversions. */ }
      else throw new Error('Unsupported bulk instruction');
    } else if (![0x00, 0x01, 0x05, 0x0b, 0x0f, 0x1a, 0x1b].includes(op) && !(op >= 0x45 && op <= 0xc4)) throw new Error('Banned instruction or feature');
    out.push({ op, arg });
  }
  return out;
}
function isCall(i: Instruction | undefined, target: number): boolean { return i?.op === 0x10 && i.arg === target; }
function charge(code: readonly Instruction[], at: number, fuel: number, bytes: number): boolean {
  const i = code[at]; return i?.op === 0x41 && (i.arg ?? 0) >= bytes && isCall(code[at + 1], fuel);
}
/** Validate bytes and metering without instantiating or executing any module code. Tables are capped at zero in v0. */
export function admitScript(bytes: Uint8Array): ScriptAdmission {
  if (bytes.length > SCRIPT_ABI.maxBytes || !WebAssembly.validate(new Uint8Array(bytes))) throw new Error('Invalid or oversized module');
  const r = new Reader(bytes); r.take(8);
  const types: Signature[] = [], functions: number[] = [], imports = new Map<string, number>();
  const exports = new Map<string, { kind: number; index: number }>();
  const mutable: number[] = [], bodies: { code: Instruction[]; bytes: number; locals: number }[] = [];
  let imported = 0, initialPages = 0, maximumPages = 0;
  let declaredDataCount: number | undefined, dataCount = 0;
  while (!r.done()) {
    const id = r.byte(), s = new Reader(r.take(r.uint()));
    if (id === 0) continue;
    if (id === 1) {
      const count = s.uint(); if (count > SCRIPT_ABI.maxFunctions) throw new Error('Type cap');
      for (let i = 0; i < count; i++) { if (s.byte() !== 0x60) throw new Error('GC type'); const n = s.uint(); if (n > 16) throw new Error('Parameter cap'); const params = Array.from({ length: n }, () => numeric(s)); const results = s.uint(); if (results > 1) throw new Error('Multivalue'); types.push({ params, result: results === 1 ? numeric(s) : undefined }); }
    } else if (id === 2) {
      const count = s.uint(); if (count > 9) throw new Error('Import cap');
      for (let i = 0; i < count; i++) {
        const mod = s.name(), name = s.name(), kind = s.byte(); if (mod !== 'env' || imports.has(name)) throw new Error('Import outside ABI');
        if (kind === 0) {
          const t = s.uint(), expected = SCRIPT_IMPORTS[name], actual = types[t];
          if (!expected || !actual || !equal(signature(actual), expected)) throw new Error('Import signature outside ABI');
          imports.set(name, imported++); functions.push(t);
        } else if (kind === 2 && name === 'memory' && initialPages === 0) {
          if (s.uint() !== 1) throw new Error('Memory must be capped and unshared'); initialPages = s.uint(); maximumPages = s.uint();
          if (initialPages < 1 || maximumPages < initialPages || maximumPages > SCRIPT_ABI.memoryPages) throw new Error('Memory cap'); imports.set(name, -1);
        } else throw new Error('Import outside ABI');
      }
    } else if (id === 3) { const count = s.uint(); if (count + imported > SCRIPT_ABI.maxFunctions) throw new Error('Function cap'); for (let i = 0; i < count; i++) functions.push(s.uint()); }
    else if (id === 6) {
      const globals = s.uint(); if (globals > SCRIPT_ABI.maxGlobals) throw new Error('Global cap');
      for (let i = 0; i < globals; i++) { numeric(s); const mut = s.byte(); if (mut === 1) mutable.push(i); const op = s.byte(); if (op === 0x41) s.signed(); else if (op === 0x42) s.signed(10); else if (op === 0x43 || op === 0x44) { const b = s.take(op === 0x43 ? 4 : 8), view = new DataView(b.buffer, b.byteOffset, b.byteLength); if (!Number.isFinite(op === 0x43 ? view.getFloat32(0, true) : view.getFloat64(0, true))) throw new Error('Non-finite global initializer'); } else throw new Error('Global initializer'); if (s.byte() !== 0x0b) throw new Error('Global initializer'); }
    } else if (id === 7) { const n = s.uint(); for (let i = 0; i < n; i++) exports.set(s.name(), { kind: s.byte(), index: s.uint() }); }
    else if (id === 10) {
      const count = s.uint();
      for (let i = 0; i < count; i++) { const b = new Reader(s.take(s.uint())), size = b.bytes.length, groups = b.uint(); let locals = 0; for (let j = 0; j < groups; j++) { locals += b.uint(); numeric(b); } if (locals > SCRIPT_ABI.maxLocals) throw new Error('Local cap'); bodies.push({ code: instructions(b), bytes: size, locals }); }
    } else if (id === 11) {
      const n = s.uint(); dataCount = n; for (let i = 0; i < n; i++) { if (s.uint() !== 0 || s.byte() !== 0x41) throw new Error('Only active memory data'); const offset = s.signed(); if (s.byte() !== 0x0b || offset < 0) throw new Error('Data offset'); const len = s.uint(); if (offset + len > initialPages * 65536) throw new Error('Data cap'); s.take(len); }
    } else if (id === 12) declaredDataCount = s.uint();
    else throw new Error('Banned section (start, table, memory, tags or passive data)');
    if (!s.done()) throw new Error('Trailing section bytes');
  }
  const enter = imports.get('enter'), leave = imports.get('leave'), fuel = imports.get('fuel');
  if (declaredDataCount !== undefined && declaredDataCount !== dataCount) throw new Error('Wrong data count');
  if (enter === undefined || leave === undefined || fuel === undefined || initialPages === 0) throw new Error('Missing instrumentation');
  const wrappers = new Set<number>(), implementations = new Set<number>();
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]; if (!body) throw new Error('Missing body'); const type = types[functions[i + imported] ?? -1]; if (!type) throw new Error('Missing signature');
    if (!isCall(body.code[0], enter)) continue;
    const expected: Instruction[] = [{ op: 0x10, arg: enter }, ...type.params.map((_, arg) => ({ op: 0x20, arg }))];
    const target = body.code[expected.length]?.arg;
    if (target === undefined || target < imported || !equal(signature(type), signature(types[functions[target] ?? -1] ?? { params: [], result: undefined }))) throw new Error('Invalid depth wrapper target');
    expected.push({ op: 0x10, arg: target });
    if (type.result !== undefined) expected.push({ op: 0x21, arg: type.params.length });
    expected.push({ op: 0x10, arg: leave });
    if (type.result !== undefined) expected.push({ op: 0x20, arg: type.params.length });
    expected.push({ op: 0x0b, arg: undefined });
    if (body.locals !== (type.result === undefined ? 0 : 1) || body.code.length !== expected.length || body.code.some((v, j) => { const e = expected[j]; return !e || v.op !== e.op || v.arg !== e.arg; })) throw new Error('Invalid depth wrapper');
    wrappers.add(i + imported); implementations.add(target);
  }
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]; if (!body) throw new Error('Missing body'); const index = i + imported;
    if (wrappers.has(index)) continue;
    if (!implementations.has(index) || !charge(body.code, 0, fuel, body.bytes)) throw new Error('Missing function fuel instrumentation');
    for (let j = 0; j < body.code.length; j++) {
      const instr = body.code[j]; if (!instr) throw new Error('Missing instruction');
      if (instr.op === 0x03 && !charge(body.code, j + 1, fuel, body.bytes)) throw new Error('Missing loop fuel instrumentation');
      if (isCall(instr, fuel) && !charge(body.code, j - 1, fuel, body.bytes)) throw new Error('Invalid fuel charge');
      const float32 = instr.op === 0x2a || instr.op === 0x43 || (instr.op >= 0x8b && instr.op <= 0x98) || (instr.op >= 0xb2 && instr.op <= 0xb6) || instr.op === 0xbe;
      const float64 = instr.op === 0x2b || instr.op === 0x44 || (instr.op >= 0x99 && instr.op <= 0xa6) || (instr.op >= 0xb7 && instr.op <= 0xbb) || instr.op === 0xbf;
      if (float32 || float64) { const check = imports.get(float32 ? 'finite32' : 'finite64'); if (check === undefined || !isCall(body.code[j + 1], check)) throw new Error('Missing finite float instrumentation'); }
      if (instr.op === 0x10 && (instr.arg === enter || instr.arg === leave || ((instr.arg ?? -1) >= imported && !wrappers.has(instr.arg ?? -1)))) throw new Error('Bypassed depth instrumentation');
    }
  }
  if (wrappers.size === 0 || bodies.length !== functions.length - imported) throw new Error('Missing instrumented functions');
  for (const [name, contract] of Object.entries(SCRIPT_EXPORTS)) {
    const exp = exports.get(name), type = types[functions[exp?.index ?? -1] ?? -1];
    const expected = contract.length === 0 ? [0] : contract;
    if (exp?.kind !== 0 || !wrappers.has(exp.index) || !type || !equal(signature(type), expected)) throw new Error(`Missing or wrong ABI export: ${name}`);
  }
  for (const exp of exports.values()) if (exp.kind === 0 && !wrappers.has(exp.index)) throw new Error('Unwrapped function export');
  const stateNames = mutable.map((index) => { const name = `__state_${index}`, exp = exports.get(name); if (exp?.kind !== 3 || exp.index !== index) throw new Error('Missing mutable-global snapshot export'); return name; });
  return { initialPages, maximumPages, globals: stateNames, functions: wrappers.size };
}
