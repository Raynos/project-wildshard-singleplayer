import { admitScript } from '@wildshard/format/scriptAdmission';
import { SCRIPT_ABI } from '@wildshard/format/scriptAbi';
import { observeWasmMemory } from '../core/memoryResources';

/** One shared, admitted instance. Durable binding state never lives in this memory. */
export class DecisionModule {
  readonly memory: WebAssembly.Memory;
  readonly instance: WebAssembly.Instance;
  readonly io: number;
  readonly view: DataView;
  fuel = 0;
  private remaining = 0;
  private depth = 0;
  private readonly image: Uint8Array;
  private readonly bytes: Uint8Array;
  private readonly globals: { global: WebAssembly.Global; value: number | bigint }[];
  constructor(bytes: Uint8Array, seed: readonly [number, number], ports: {
    read: (op: number, a: number, b: number) => number;
    list: (op: number, a: number, b: number, out: number, cap: number) => number;
  }) {
    const admission = admitScript(bytes, 1);
    this.memory = new WebAssembly.Memory({ initial: admission.initialPages, maximum: admission.maximumPages });
    observeWasmMemory(this.memory, { owner: 'engine/script', asset: 'decision/module' });
    this.begin(2_000_000);
    this.instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), { env: {
      memory: this.memory,
      enter: () => { this.charge(1); if (++this.depth > SCRIPT_ABI.callDepth) throw new Error('Decision depth limit'); },
      leave: () => { if (--this.depth < 0) throw new Error('Decision depth underflow'); },
      fuel: (cost: number) => { this.charge(cost); },
      finite32: (value: number) => this.finite(value),
      finite64: (value: number) => this.finite(value),
      abort: () => { throw new Error('Decision abort'); },
      ws_read: (op: number, a: number, b: number) => { this.charge(256); return ports.read(op, a, b); },
      ws_list: (op: number, a: number, b: number, out: number, cap: number) => { this.charge(256); return ports.list(op, a, b, out, cap); },
    } });
    if (typeof this.instance.exports['__start'] === 'function') this.invoke('__start');
    if (this.invoke('ws_abi') !== 1) throw new Error('Decision ABI major mismatch');
    this.invoke('ws_init', seed[0], seed[1]);
    this.io = this.invoke('ws_io');
    if (!Number.isSafeInteger(this.io) || this.io < 0 || this.io % 8 !== 0 || this.io >= this.memory.buffer.byteLength) throw new Error('Decision IO outside memory');
    this.bytes = new Uint8Array(this.memory.buffer);
    this.view = new DataView(this.memory.buffer);
    this.image = this.bytes.slice();
    this.globals = admission.globals.map(name => {
      const global = this.instance.exports[name];
      if (!(global instanceof WebAssembly.Global)) throw new Error('Decision global snapshot missing');
      const value: unknown = global.value;
      if (typeof value !== 'number' && typeof value !== 'bigint') throw new Error('Decision global is not numeric');
      return { global, value };
    });
  }
  begin(limit: number): void { this.remaining = limit; this.fuel = 0; this.depth = 0; }
  private charge(cost: number): void {
    if (!Number.isSafeInteger(cost) || cost < 1) throw new Error('Invalid decision fuel charge');
    this.fuel += cost; this.remaining -= cost;
    if (this.remaining < 0) throw new Error('Decision fuel exhausted');
  }
  private finite(value: number): number {
    this.charge(1); if (!Number.isFinite(value)) throw new Error('Non-finite decision value'); return value;
  }
  invoke(name: string, a?: number, b?: number): number {
    const fn = this.instance.exports[name];
    if (typeof fn !== 'function') throw new Error(`Missing decision function ${name}`);
    const call = fn as (a?: number, b?: number) => unknown;
    const value = a === undefined ? call() : call(a, b);
    if (value === undefined) return 0;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid decision result');
    return value;
  }
  /** Reset scratch and every mutable global before each binding call, including after a trap. */
  rewind(): void {
    this.bytes.set(this.image);
    for (const entry of this.globals) entry.global.value = entry.value;
  }
}
