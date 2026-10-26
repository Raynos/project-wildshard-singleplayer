import { expect, test } from 'vitest';
import { Scope } from '../app/scope';
import { realGc } from '../test/realGc';
import { ScopedWorkerPool } from './scopedWorkerPool';

class ControlledWorker extends EventTarget implements Worker {
  onerror: Worker['onerror'] = null;
  onmessage: Worker['onmessage'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  readonly sent: { message: unknown; transfer: Transferable[] | undefined }[] = [];
  terminated = false;
  postMessage(message: unknown, options?: Transferable[] | StructuredSerializeOptions): void {
    const transfer = Array.isArray(options) ? options : options?.transfer;
    this.sent.push({message, transfer});
  }
  terminate(): void { this.terminated = true; }
  reply(data: unknown): void { this.dispatchEvent(new MessageEvent('message', {data})); }
}

test('an idle live texture worker releases its completed reply backing', async () => {
  await realGc('src/engine/core/scoped-worker-pool.test.ts', 'an idle live texture worker releases', async collect => {
    const owner = new Scope('texture-worker'), pool = new ScopedWorkerPool(owner, 1), worker = new ControlledWorker();
    pool.setWorkerCreator(() => worker);
    try {
      const backing = await (async () => {
        const bytes = new Uint8Array(1024 * 1024), pending = pool.postMessage({job: 1}, []);
        worker.reply({mipmaps: [{data: bytes}]});
        const result = await pending;
        expect(result.data).toEqual({mipmaps: [{data: bytes}]});
        return new WeakRef(bytes.buffer);
      })();
      await collect(backing);
      expect(worker.terminated).toBe(false);
      expect(pool.workers).toHaveLength(1);
      const next = pool.postMessage({job: 2}, []);
      worker.reply({done: 2});
      expect((await next).data).toEqual({done: 2});
    } finally { owner.dispose(); }
    expect(worker.terminated).toBe(true);
  });
});

test('queued texture jobs retain their own resolver and original transfer list', async () => {
  const owner = new Scope('queued-textures'), pool = new ScopedWorkerPool(owner, 1), worker = new ControlledWorker();
  pool.setWorkerCreator(() => worker);
  try {
    const firstTransfer = [new ArrayBuffer(4)], secondTransfer = [new ArrayBuffer(8)];
    const first = pool.postMessage({job: 1}, firstTransfer), second = pool.postMessage({job: 2}, secondTransfer);
    expect(worker.sent).toEqual([{message: {job: 1}, transfer: firstTransfer}]);
    worker.reply({done: 1});
    expect((await first).data).toEqual({done: 1});
    expect(worker.sent[1]).toEqual({message: {job: 2}, transfer: secondTransfer});
    expect(worker.sent[1]?.transfer).toBe(secondTransfer);
    worker.reply({done: 2});
    expect((await second).data).toEqual({done: 2});
  } finally { owner.dispose(); }
});
