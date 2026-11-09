import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { MessageChannel } from 'node:worker_threads';
import { observeReleasePorts, finishReleasePorts } from '../scripts/release-port-profile.mjs';

test('port diagnosis preserves native transfers and excludes reliable data', async () => {
  const original = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'postMessage');
  const { port1, port2 } = new MessageChannel();
  const reliable = { channel: 'reliable', bytes: new Uint8Array([99, 88]).buffer };
  observeReleasePorts();
  try {
    for (const [sender, receiver, marker] of [[port1, port2, 1], [port2, port1, 2], [port1, port2, 3]]) {
      const result = once(receiver, 'message');
      const bytes = new Uint8Array([marker, 4, 5]).buffer;
      sender.postMessage({ channel: 'unreliable', bytes }, [bytes]);
      assert.equal(bytes.byteLength, 0, 'the original native transfer still detaches');
      const [data] = await result;
      assert.deepEqual([...new Uint8Array(data.bytes)], [marker, 4, 5]);
    }
    const delivered = once(port2, 'message');
    port1.postMessage(reliable, [reliable.bytes]);
    assert.deepEqual([...new Uint8Array((await delivered)[0].bytes)], [99, 88]);
    const result = finishReleasePorts();
    assert.equal(result.overflow, false);
    assert.equal(result.ports, 2);
    assert.equal(typeof result.longTasksSupported, 'boolean');
    assert.equal(result.longTaskOverflow, false);
    assert.equal(result.cleanupError, null);
    assert.equal(result.rows.filter(row => row.direction === 'send').length, 3);
    assert.equal(result.rows.filter(row => row.direction === 'receive').length, 2);
    assert.ok(result.rows.every(row => row.length === 3 && row.header.length === 3 && row.at > 0));
    assert.deepEqual(Object.getOwnPropertyDescriptor(MessagePort.prototype, 'postMessage'), original);
    assert.equal(Reflect.has(globalThis, '__releasePortStop'), false);
  } finally {
    if (Reflect.has(globalThis, '__releasePortStop')) finishReleasePorts();
    port1.close(); port2.close();
  }
});

test('observer retains evidence and preserves a later prototype owner', () => {
  const original = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'postMessage');
  observeReleasePorts();
  const later = function (...args) { return Reflect.apply(original.value, this, args); };
  try {
    Object.defineProperty(MessagePort.prototype, 'postMessage', { ...original, value: later });
    const result = finishReleasePorts();
    assert.match(result.cleanupError, /changed during capture/u);
    assert.deepEqual(result.rows, []);
    assert.equal(MessagePort.prototype.postMessage, later);
    assert.equal(Reflect.has(globalThis, '__releasePortStop'), false);
  } finally { Object.defineProperty(MessagePort.prototype, 'postMessage', original); }
});
