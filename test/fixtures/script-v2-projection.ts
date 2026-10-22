import { expect } from 'vitest';
import { ScriptModuleV2 } from '../../src/engine/script/moduleV2';
import type { FloatColumnV2 } from '../../src/format/scriptMemoryV2';
import type { DualPortFixture } from './script-v2-port';

const callable = (value: unknown): value is (...args: number[]) => unknown => typeof value === 'function';
function finite(value: number): number { if (!Number.isFinite(value)) throw new Error('Non-finite legacy output');return value; }

/** Execute both admitted shadow artifacts on the same samples. The v2 host
 * rewinds memory/globals on each projection; authored stateless rules must
 * still agree with v1 across successive calls and varying observations. */
export function projectionPair(pair: Parameters<DualPortFixture['verify']>[0],options: {
  readonly ioBytes: number; readonly output: readonly FloatColumnV2[];
}): <T>(write: (view: DataView,base: number) => void,read: (view: DataView,base: number) => T) => T {
  const pages = pair.candidate.artifact.pages, memory = new WebAssembly.Memory({ initial: pages,maximum: pages });
  let fuel = 0, depth = 0;
  const instance = new WebAssembly.Instance(new WebAssembly.Module(Uint8Array.from(pair.legacy.bytes)),{ env: {
    memory,enter: () => { if (++depth > 64) throw new Error('Legacy stack exhausted'); },leave: () => { depth--; },
    fuel: (amount: number) => { fuel -= amount;if (fuel < 0) throw new Error('Legacy fuel exhausted'); },
    finite32: finite,finite64: finite,abort: () => { throw new Error('Legacy abort'); },
  } });
  const invoke = (name: string,...args: number[]): unknown => {
    const method = instance.exports[name];if (!callable(method)) throw new Error('Missing admitted legacy entry');return method(...args);
  };
  fuel = 1_000_000_000;
  if (instance.exports['__start'] !== undefined) invoke('__start');invoke('ws_init',0,0);
  const oldIO = invoke('ws_io');if (typeof oldIO !== 'number') throw new Error('Invalid legacy IO');
  const module = new ScriptModuleV2(pair.candidate.bytes,{ seed: [0,0],initFuel: 1_000_000,...options });
  return (write,read) => {
    const oldView = new DataView(memory.buffer);write(oldView,oldIO);fuel = 1_000_000_000;invoke('ws_handle');
    const expected = read(oldView,oldIO);
    const actual = module.project(1_000_000,view => { write(view,module.io); },view => read(view,module.io)).value;
    expect(actual).toEqual(expected);expect(depth).toBe(0);return actual;
  };
}
