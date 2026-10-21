/** Stateless ABI v2 sim/projection instance. Only the Developer-owned v2 lane
 * opts in; existing ScriptHost and DecisionModule never construct this class. */
import { admitScriptV2 } from '@wildshard/format/scriptAdmissionV2';
import { validateV2FloatColumns,type FloatColumnV2 } from '@wildshard/format/scriptMemoryV2';
import { observeWasmMemory } from '../core/memoryResources';

const callable = (value: unknown): value is (...args: number[]) => unknown => typeof value === 'function';
function budget(value: number): void { if (!Number.isInteger(value) || value < 0 || value > 0x7fffffff) throw new Error('Invalid v2 i32 fuel budget'); }
/** One fixed memory per module per lane. Initialized scratch and every mutable
 * state global rewind before each sim/project call, including retries after traps
 * and caller refusals. Durable columns and committed results belong to the host. */
export class ScriptModuleV2 {
  readonly memory: WebAssembly.Memory;
  readonly io: number;
  private readonly instance: WebAssembly.Instance;
  private readonly image: Uint8Array;
  private readonly globals: readonly { global: WebAssembly.Global; value: number | bigint }[];
  private readonly columns: readonly FloatColumnV2[];
  private busy = false;
  constructor(bytes: Uint8Array,options: {
    readonly seed: readonly [number,number]; readonly initFuel: number;
    readonly output: readonly FloatColumnV2[]; readonly ioBytes?: number;
    readonly initialize?: (view: DataView,io: number) => void;
  }) {
    budget(options.initFuel);
    if (options.seed.some(value => !Number.isInteger(value) || value < 0 || value > 0xffffffff)) throw new Error('Invalid v2 seed words');
    const source = Uint8Array.from(bytes), admitted = admitScriptV2(source,options.ioBytes === undefined ? {} : { ioBytes: options.ioBytes });
    this.io = admitted.io; this.memory = new WebAssembly.Memory({ initial: admitted.initialPages,maximum: admitted.maximumPages });
    observeWasmMemory(this.memory,{ owner: 'engine/script',asset: 'v2/module' });
    this.instance = new WebAssembly.Instance(new WebAssembly.Module(source),{ env: { memory: this.memory } });
    this.columns = options.output.map(column => Object.freeze({ ...column }));
    options.initialize?.(new DataView(this.memory.buffer),this.io);
    this.invoke('ws_init',[options.seed[0],options.seed[1]],options.initFuel);
    validateV2FloatColumns(new DataView(this.memory.buffer),this.columns);
    this.image = new Uint8Array(this.memory.buffer).slice();
    this.globals = admitted.globals.map(name => {
      const global = this.instance.exports[name]; if (!(global instanceof WebAssembly.Global)) throw new Error('Missing v2 state global');
      const value: unknown = global.value;
      if ((typeof value !== 'number' && typeof value !== 'bigint') || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Invalid v2 initialized global');
      return { global,value };
    });
  }
  private rewind(): void {
    new Uint8Array(this.memory.buffer).set(this.image);
    for (const entry of this.globals) entry.global.value = entry.value;
  }
  private invoke(name: string,args: number[],fuel: number): number {
    const fn = this.instance.exports[name]; if (!callable(fn)) throw new Error('Missing v2 work entry');
    const remaining = fn(...args,fuel);
    if (typeof remaining !== 'number' || !Number.isInteger(remaining) || remaining < 0 || remaining > fuel) throw new Error('Invalid v2 fuel remainder'); return remaining;
  }
  private run<T>(name: string,args: number[],fuel: number,write: (view: DataView) => void,read: (view: DataView) => T): { value: T; remaining: number } {
    budget(fuel); if (this.busy) throw new Error('V2 module re-entry'); this.busy = true;
    try {
      this.rewind(); const view = new DataView(this.memory.buffer); write(view);
      const remaining = this.invoke(name,args,fuel); validateV2FloatColumns(view,this.columns);
      return { value: read(view),remaining };
    } finally { this.busy = false; }
  }
  /** `read` copies the validated candidate into host-owned storage. It must not
   * publish effects or return borrowed Wasm views; the next entry rewinds the image. */
  step<T>(tick: number,fuel: number,write: (view: DataView) => void,read: (view: DataView) => T): { value: T; remaining: number } {
    if (!Number.isInteger(tick) || tick < 0 || tick > 0x7fffffff) throw new Error('Invalid v2 relative tick');
    return this.run('ws_step',[tick],fuel,write,read);
  }
  /** Synchronous projections use exactly the same image/global rewind rule. */
  project<T>(fuel: number,write: (view: DataView) => void,read: (view: DataView) => T): { value: T; remaining: number } {
    return this.run('ws_project',[],fuel,write,read);
  }
}
