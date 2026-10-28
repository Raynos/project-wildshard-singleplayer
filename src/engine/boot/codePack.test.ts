// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Scope } from '../app/scope';
import { prepareCodePack } from './codePack';

class TestPort {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  close(): void { this.closed = true; this.onmessage = null; }
}
const channels: TestChannel[] = [];
class TestChannel {
  readonly port1 = new TestPort();
  readonly port2 = new TestPort();
  constructor() { channels.push(this); }
}
let owner = new Scope('code-pack'), sent = vi.fn();
const pack = [`/assets/code/${'a'.repeat(64)}.pack`, 100, 200, [0]];
const reply = (data: unknown): void => {
  const channel = channels[0]; if (channel === undefined) throw new Error('Missing pack channel');
  channel.port1.onmessage?.({ data });
};
beforeEach(() => {
  vi.useFakeTimers(); channels.length = 0; owner = new Scope('code-pack'); sent = vi.fn();
  vi.stubGlobal('MessageChannel', TestChannel);
  vi.stubGlobal('navigator', { serviceWorker: { controller: { postMessage: sent } } });
});
afterEach(() => { owner.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('a started worker that never finishes yields to individual modules at its transfer deadline', async () => {
  const work = prepareCodePack(pack, owner);
  reply({ type: 'CODE_PACK_STARTED' });
  let complete = false; void work.then(() => { complete = true; return true; });
  await vi.advanceTimersByTimeAsync(14999); expect(complete).toBe(false);
  reply({ type: 'CODE_PACK_STARTED' }); // Duplicate messages cannot extend the deadline.
  await vi.advanceTimersByTimeAsync(1);
  expect(await work).toBeNull();
  expect(sent).toHaveBeenCalledTimes(1);
  expect(channels[0]?.port1.closed).toBe(true); expect(channels[0]?.port2.closed).toBe(true);
  expect(owner.census.timers).toBe(0);
});

test('an unsupported worker retains the original 2.5 second handshake fallback', async () => {
  const work = prepareCodePack(pack, owner);
  await vi.advanceTimersByTimeAsync(2500);
  expect(await work).toBeNull(); expect(owner.census.timers).toBe(0);
});

test('a verified stored pack finishes before the deadline and releases both timers', async () => {
  const work = prepareCodePack(pack, owner);
  reply({ type: 'CODE_PACK_STARTED' }); await vi.advanceTimersByTimeAsync(12000);
  reply({ type: 'CODE_PACK_DONE', status: 'stored' });
  expect(typeof await work).toBe('function'); expect(owner.census.timers).toBe(0);
  expect(channels[0]?.port1.closed).toBe(true);
});

test('retirement keeps its refusal and cancels a started worker wait', async () => {
  const work = expect(prepareCodePack(pack, owner)).rejects.toThrow('Retired code pack preparation');
  reply({ type: 'CODE_PACK_STARTED' }); owner.dispose(); await work;
  expect(owner.census.timers).toBe(0); expect(channels[0]?.port2.closed).toBe(true);
});
