import { afterEach, expect, it } from 'vitest';
import { installAllocationJournal } from '../../src/engine/render/allocationJournal';
import { installDiagnosticJournal } from '../../src/engine/render/diagnosticJournal';
import { MemoryAttribution } from '../../src/engine/core/memoryAttribution';

afterEach(() => { Reflect.deleteProperty(window, '__sc_label_gl'); });
function fixture(on: boolean) {
  const context = { canvas: new EventTarget(), createTexture: () => ({}) }, ledger = new MemoryAttribution();
  let notify = (_on: boolean): void => undefined, subscribed = false;
  const stop = installDiagnosticJournal(context, { read: () => on, subscribe: read => { subscribed = true; notify = read; return () => { subscribed = false; }; } }, gl => installAllocationJournal(gl, ledger));
  return { context, ledger, stop, change: (value: boolean) => { notify(value); }, subscribed: () => subscribed };
}
it('leaves public GL calls native, starts Developer observation on demand, and restores calls on disable/dispose', () => {
  const f = fixture(false), native = f.context.createTexture;
  f.context.createTexture(); expect(f.ledger.snapshot().allocations).toHaveLength(0);
  f.change(true); expect(f.context.createTexture).not.toBe(native);
  f.context.createTexture(); expect(f.ledger.snapshot().allocations).toHaveLength(1);
  f.change(false); expect(f.context.createTexture).toBe(native);
  expect(f.ledger.snapshot().allocations).toHaveLength(0);
  f.change(true); f.stop(); f.stop();
  expect(f.context.createTexture).toBe(native); expect(f.subscribed()).toBe(false);
});
it('keeps the explicit census active with Developer off and releases it on renderer disposal', () => {
  Reflect.set(window, '__sc_label_gl', () => undefined);
  const f = fixture(false);
  f.context.createTexture(); f.change(false); f.context.createTexture();
  expect(f.ledger.snapshot().allocations).toHaveLength(2);
  f.stop(); expect(f.ledger.snapshot().allocations).toHaveLength(0);
});
// @vitest-environment happy-dom
