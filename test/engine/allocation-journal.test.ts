import { expect, it } from 'vitest';
import { installAllocationJournal } from '../../src/engine/render/allocationJournal';
import { MemoryAttribution } from '../../src/engine/core/memoryAttribution';

class Context {
  readonly canvas = new EventTarget();
  createTexture(): object { return {}; }
  createBuffer(): object { return {}; }
  createRenderbuffer(): object { return {}; }
  bindTexture(..._args: unknown[]): void { /* Native binding double. */ }
  bindBuffer(..._args: unknown[]): void { /* Native binding double. */ }
  bindRenderbuffer(..._args: unknown[]): void { /* Native binding double. */ }
  texStorage2D(..._args: unknown[]): void { /* Native storage double. */ }
  texStorage3D(..._args: unknown[]): void { /* Native storage double. */ }
  texImage2D(..._args: unknown[]): void { /* Native storage double. */ }
  generateMipmap(..._args: unknown[]): void { /* Native storage double. */ }
  compressedTexSubImage3D(..._args: unknown[]): void { /* No new allocation. */ }
  bufferData(..._args: unknown[]): void { /* Native storage double. */ }
  deleteTexture(..._args: unknown[]): void { /* Native delete double. */ }
  renderbufferStorageMultisample(..._args: unknown[]): void { /* Native storage double. */ }
  getParameter(): never { throw new Error('Instrumentation must not query the GPU'); }
}
it('counts native buffers, compressed array layers, cube mips and multisample targets without synchronous GL reads', () => {
  const context = new Context(), ledger = new MemoryAttribution(), stop = installAllocationJournal(context, ledger);
  const texture = context.createTexture(), buffer = context.createBuffer(), target = context.createRenderbuffer();
  context.bindTexture(0x8c1a, texture);
  context.texStorage3D(0x8c1a, 3, 0x93b0, 8, 8, 4); // ASTC layers do not shrink with mips: 256+64+64.
  context.compressedTexSubImage3D(0x8c1a, 0, 0, 0, 0, 8, 8, 4, 0x93b0, new Uint8Array(256));
  expect(ledger.snapshot().totals.gpu).toBe(384);
  context.bindBuffer(0x8892, buffer);
  const array = new Float32Array(32);
  ledger.buffer(array, { owner: 'level.tree', asset: 'tree/position' });
  context.bufferData(0x8892, array, 0x88e4, 4, 8);
  expect(ledger.snapshot().allocations.find(row => row.kind === 'buffer')).toMatchObject({ bytes: 32, owner: 'level.tree', asset: 'tree/position' });
  context.bindRenderbuffer(0x8d41, target);
  context.renderbufferStorageMultisample(0x8d41, 4, 0x88f0, 8, 8);
  expect(ledger.snapshot().totals.gpu).toBe(384 + 32 + 1024);
  const cube = context.createTexture(); context.bindTexture(0x8513, cube); context.texStorage2D(0x8513, 2, 0x8058, 4, 4);
  expect(ledger.snapshot().totals.gpu).toBe(384 + 32 + 1024 + 6 * (64 + 16));
  context.deleteTexture(texture);
  expect(ledger.snapshot().totals.gpu).toBe(32 + 1024 + 480);
  context.canvas.dispatchEvent(new Event('webglcontextlost'));
  expect(ledger.snapshot().totals.gpu).toBe(0);
  expect(ledger.snapshot().totals.ram).toBe(128); // A lost GPU context does not delete CPU storage.
  stop(); stop();
  expect(Object.hasOwn(context, 'bufferData')).toBe(false);
});
it('replaces a level allocation, generates exact odd-sized mips, and separates contexts with identical bindings', () => {
  const a = new Context(), b = new Context(), ledger = new MemoryAttribution();
  const stopA = installAllocationJournal(a, ledger), stopB = installAllocationJournal(b, ledger);
  for (const context of [a, b]) {
    context.bindTexture(0x0de1, context.createTexture());
    context.texImage2D(0x0de1, 0, 0x8058, 5, 3, 0, 0x1908, 0x1401, null);
    context.generateMipmap(0x0de1);
  }
  expect(ledger.snapshot().totals.gpu).toBe(2 * (60 + 8 + 4));
  expect(new Set(ledger.snapshot().allocations.map(row => row.id)).size).toBe(2);
  stopA(); expect(ledger.snapshot().totals.gpu).toBe(72); stopB();
});
