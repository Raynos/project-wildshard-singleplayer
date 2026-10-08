import { afterEach, expect, it, vi } from 'vitest';
import { installLegacyProbeAdapter } from '../scripts/parity/probe.mjs';
const originalWindow = Reflect.get(globalThis, 'window'), originalDocument = Reflect.get(globalThis, 'document');
afterEach(() => { Reflect.set(globalThis, 'window', originalWindow); Reflect.set(globalThis, 'document', originalDocument); });
it('adapts an old page without capturing its world and refuses after that slot clears', () => {
  const document = new EventTarget(), world = {}, probe = { world, requireWorld: undefined as (() => object) | undefined };
  Reflect.set(globalThis, 'document', document); Reflect.set(globalThis, 'window', { __wildshard: probe });
  installLegacyProbeAdapter(); document.dispatchEvent(new Event('ws:ready'));
  expect(probe.requireWorld?.()).toBe(world);
  Reflect.deleteProperty(probe, 'world');
  expect(() => probe.requireWorld?.()).toThrow('retired');
});
it('preserves the new page active-world fence and its retired refusal exactly', () => {
  const document = new EventTarget(), world = {}, read = vi.fn(() => world), probe = { world, requireWorld: read };
  Reflect.set(globalThis, 'document', document); Reflect.set(globalThis, 'window', { __wildshard: probe });
  installLegacyProbeAdapter(); document.dispatchEvent(new Event('ws:ready'));
  expect(probe.requireWorld).toBe(read); expect(probe.requireWorld()).toBe(world);
  read.mockImplementation(() => { throw new Error('Debug level has retired'); });
  expect(() => probe.requireWorld()).toThrow('retired');
});
