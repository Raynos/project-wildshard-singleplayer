/** Native storage only: no instance, export, guest state or strong owner enters
 * this bank. Weak fences keep storage unavailable until teardown finishes. */
import { observeWasmMemory } from '../core/memoryResources';
import type { Scope } from '../app/scope';

const PAGE = 65536, LIMIT = 40, BYTE_LIMIT = LIMIT * 4 * PAGE;
const bank: { readonly pages: number; readonly memory: WebAssembly.Memory; readonly fence: WeakRef<Scope> | undefined; readonly virgin: boolean }[] = [];
let hits = 0, misses = 0, returned = 0, bytes = 0, virginHits = 0, recycledHits = 0;
function ready(row: typeof bank[number]): boolean {
  const owner = row.fence?.deref(); return owner === undefined || (owner.disposed && !owner.disposing);
}
/** Scalar diagnostics, detached from every memory and live owner. */
export function fixedMemoryCensus(): { hits: number; misses: number; returned: number; available: number; bytes: number; virginHits: number; recycledHits: number } {
  return { hits, misses, returned, virginHits, recycledHits, available: bank.filter(ready).length, bytes };
}
function retain(memory: WebAssembly.Memory, pages: number, fence?: WeakRef<Scope>, virgin = false): void {
  if (bank.length >= LIMIT || bytes + pages * PAGE > BYTE_LIMIT) return;
  observeWasmMemory(memory, { owner: 'engine/script', asset: 'script/reserve' });
  bank.push({ pages, memory, fence, virgin }); bytes += pages * PAGE; returned++;
}
/** Fill the measured fixed-page demand while the loading screen is still up.
 * Each allocation yields; this is explicitly invoked by boot, never on import. */
export async function prewarmFixedMemories(counts: readonly number[], yieldTask: () => Promise<void>): Promise<void> {
  if (counts.length !== 4 || Array.from(counts).some(n => !Number.isInteger(n) || n < 0) || counts.reduce((n, x) => n + x, 0) > LIMIT) throw new Error('Invalid fixed memory warmup');
  for (const [index, count] of counts.entries()) {
    const pages = index + 1, missing = count - bank.filter(row => row.pages === pages && ready(row)).length;
    for (let n = 0; n < missing && bank.length < LIMIT; n++) {
      const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
      retain(memory, pages, undefined, true); await yieldTask();
    }
  }
}
/** Only audited native adapters may retain borrowed views during a call; none
 * may escape it. Public memory access permanently excludes this lease. */
export class FixedMemory {
  private memory: WebAssembly.Memory | undefined;
  private escaped = false;
  private readonly pages: number;
  private readonly recyclable: boolean;
  constructor(pages: number, recyclable: boolean, freshOnly = false) {
    this.pages = pages; this.recyclable = recyclable;
    if (!Number.isInteger(pages) || pages < 1 || pages > 4) throw new Error('Invalid fixed memory pages');
    let index = -1;
    if (recyclable || freshOnly) for (let at = bank.length - 1; at >= 0; at--) {
      const row = bank[at];
      if (row !== undefined && row.pages === pages && ready(row) && (!freshOnly || row.virgin)) { index = at; break; }
    }
    const prior = index < 0 ? undefined : bank.splice(index, 1)[0];
    if (prior === undefined) { if (recyclable || freshOnly) misses++; this.memory = new WebAssembly.Memory({ initial: pages, maximum: pages }); }
    else { hits++; if (prior.virgin) virginHits++; else recycledHits++; bytes -= pages * PAGE; this.memory = prior.memory; new Uint8Array(this.memory.buffer).fill(0); }
  }
  get value(): WebAssembly.Memory { if (this.memory === undefined) throw new Error('Script memory owner has ended'); return this.memory; }
  expose(): WebAssembly.Memory { this.escaped = true; return this.value; }
  /** Call only after the last active invocation and ALL native view/export
   * references have been cleared. The closed wrapper itself may remain held. */
  retire(fence?: WeakRef<Scope>): void {
    const memory = this.memory; this.memory = undefined;
    if (memory !== undefined && this.recyclable && !this.escaped && memory.buffer.byteLength === this.pages * PAGE) {
      new Uint8Array(memory.buffer).fill(0); retain(memory, this.pages, fence);
    }
  }
}

/** Legacy fixed memories may consume only never-instantiated boot stock. They
 * are exposed once and NEVER returned. Growable/larger memories stay fresh. */
export function freshScriptMemory(initial: number, maximum: number): WebAssembly.Memory {
  return initial === maximum && Number.isInteger(initial) && initial >= 1 && initial <= 4
    ? new FixedMemory(initial, false, true).expose() : new WebAssembly.Memory({ initial, maximum });
}
