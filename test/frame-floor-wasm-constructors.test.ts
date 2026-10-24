import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate the injected page observer from the test process's constructors.
import { createContext, runInContext } from 'node:vm';
import { WASM_CONSTRUCTORS_SCRIPT } from '../scripts/frame-floor-wasm-constructors.mjs';

function page(): { evaluate: (source: string) => unknown } {
  let clock = 0;
  const context = createContext({
    window: { __wildshard: { world: { game: { frameCount: 7, frameRafTime: 32 } } } },
    performance: { timeOrigin: 1234, now: () => ++clock },
    WebAssembly: { Memory: WebAssembly.Memory, Module: WebAssembly.Module, Instance: WebAssembly.Instance },
    // Any new scheduling/subscription would fail the observer before app boot.
    requestAnimationFrame: () => { throw new Error('Unexpected frame subscription'); },
    setTimeout: () => { throw new Error('Unexpected timer'); },
  });
  runInContext(WASM_CONSTRUCTORS_SCRIPT, context);
  return { evaluate: (source) => { const value: unknown = runInContext(source, context); return value; } };
}

test('preserves native prototypes, newTarget, module/instance links and original frame clocks', () => {
  const fixture = page();
  expect(fixture.evaluate(`(() => {
    class Derived extends WebAssembly.Memory {}
    const memory = new Derived({ initial: 1 });
    const module = new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));
    const instance = new WebAssembly.Instance(module, { env: { memory } });
    return memory instanceof Derived && memory instanceof WebAssembly.Memory && instance instanceof WebAssembly.Instance;
  })()`)).toBe(true);
  expect(fixture.evaluate('window.__wasmDurationCensus')).toEqual({
    origin: 1234, installedAt: 1, dropped: 0,
    rows: [
      expect.objectContaining({ sequence: 1, kind: 'Memory', startMs: 2, endMs: 3, durationMs: 1,
        beforeFrame: 7, afterFrame: 7, previousRafMs: 32, memory: 1, descriptor: { initial: 1 }, success: true }),
      expect.objectContaining({ sequence: 2, kind: 'Module', durationMs: 1, module: 1, byteLength: 8 }),
      expect.objectContaining({ sequence: 3, kind: 'Instance', durationMs: 1, module: 1, memory: 1 }),
    ],
  });
});

test('propagates native refusal and bounds the diagnostic bank without blocking later constructors', () => {
  const fixture = page();
  expect(() => fixture.evaluate('new WebAssembly.Memory({ initial: -1 })')).toThrow();
  expect(fixture.evaluate('window.__wasmDurationCensus.rows[0]')).toEqual(expect.objectContaining({ success: false, kind: 'Memory', durationMs: 1 }));
  expect(fixture.evaluate(`(() => {
    for (let i = 0; i < 1025; i++) new WebAssembly.Memory({ initial: 0 });
    return { rows: window.__wasmDurationCensus.rows.length, dropped: window.__wasmDurationCensus.dropped };
  })()`)).toEqual({ rows: 1024, dropped: 2 });
});
