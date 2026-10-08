// oxlint-disable-next-line import/no-nodejs-modules -- Isolated VM verifies diagnostic instrumentation without launching a browser.
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { CPU_INIT, cpuOwnersExpression } from '../scripts/memory/cpuOwners.mjs';

it('keeps allocation values, aliases and canvas context identity unchanged', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    window = globalThis;
    class Canvas {
      width = 40; height = 30;
      context = { canvas: this };
      getContext() { return this.context; }
    }
    HTMLCanvasElement = Canvas;
    ${CPU_INIT}
    const a = new Float32Array(20000); a[3] = 2.5;
    const b = new Float32Array(a.buffer); b[4] = 7;
    const canvas = new Canvas();
    const ctx = canvas.getContext('2d');
    canvas.getContext('2d');
    result = [a instanceof Float32Array, a[3], a[4], b[3], ctx === canvas.context,
      __g227CpuOwners.length, __g227CpuOwners.every(row => row.object instanceof WeakRef)];
  `, context);
  expect(vm.runInContext('result', context)).toEqual([true, 2.5, 7, 2.5, true, 3, true]);
});

it('observes released storage without restoring a geometry array getter', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    window = globalThis;
    ${CPU_INIT}
    const array = new Float32Array(20000);
    const canvas = { width: 40, height: 30, isConnected: false };
    __g227CpuOwners.push({ kind: 'CanvasRenderingContext2D', object: new WeakRef({ canvas }), stack: 'creator' });
    const released = { get array() { throw new Error('must not restore'); } };
    const retained = { array };
    __wildshard = { world: { game: { rootScene: { traverse(visit) {
      visit({ name: 'live', geometry: { attributes: { normal: released, position: retained } }, material: { map: { isTexture: true, name: 'label', source: { data: canvas } } } });
    } } } } };
    result = ${cpuOwnersExpression};
  `, context);
  expect(vm.runInContext('result.map(row => [row.kind, row.bytes, row.owners])', context)).toEqual([
    ['Float32Array', 80000, ['live:position']],
    ['CanvasRenderingContext2D', 4800, ['live:texture:label']],
  ]);
});
