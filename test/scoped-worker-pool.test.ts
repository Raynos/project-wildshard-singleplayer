import { expect, it } from 'vitest';
import { Scope, scopeRegistrations } from '../src/engine/app/scope';
import { ScopedWorkerPool } from '../src/engine/core/scopedWorkerPool';

class FakeWorker extends EventTarget implements Worker {
  onerror: ((this: AbstractWorker, event: ErrorEvent) => unknown) | null = null;
  onmessage: ((this: Worker, event: MessageEvent) => unknown) | null = null;
  onmessageerror: ((this: Worker, event: MessageEvent) => unknown) | null = null;
  terminated = false;
  postMessage(message: unknown, _options?: Transferable[] | StructuredSerializeOptions): void {
    queueMicrotask(() => { this.dispatchEvent(new MessageEvent('message', { data: message })); });
  }
  terminate(): void { this.terminated = true; }
}

it('keeps decoder workers through level unload and removes their listeners on page disposal', async () => {
  const page = new Scope('decoder-page'), level = new Scope('decoder-level', page);
  const workers: FakeWorker[] = [], pool = new ScopedWorkerPool(page, 2);
  pool.setWorkerCreator(() => { const worker = new FakeWorker(); workers.push(worker); return worker; });
  const replies = await Promise.all([pool.postMessage('first', []), pool.postMessage('second', []), pool.postMessage('queued', [])]);
  expect(replies.map(reply => { const data: unknown = reply.data; return data; })).toEqual(['first', 'second', 'queued']);
  expect(workers).toHaveLength(2);
  expect(page.census.listeners).toBe(2);
  expect(scopeRegistrations(scope => scope === page).listeners.other).toBe(2);
  level.dispose();
  expect(workers.every(worker => !worker.terminated)).toBe(true);
  expect((await pool.postMessage('reentry', [])).data).toBe('reentry');
  page.dispose();
  expect(workers.every(worker => worker.terminated)).toBe(true);
  expect(page.census.listeners).toBe(0);
  expect(scopeRegistrations(scope => scope === page).listeners.other).toBe(0);
  await expect(pool.postMessage('closed', [])).rejects.toThrow('owner is disposed');
});

it('explicit decoder disposal removes subscriptions before worker termination and remains reusable under its owner', async () => {
  const page = new Scope('decoder-page'), workers: FakeWorker[] = [], pool = new ScopedWorkerPool(page, 1);
  pool.setWorkerCreator(() => { const worker = new FakeWorker(); workers.push(worker); return worker; });
  await pool.postMessage('first', []);
  pool.dispose();
  expect(page.census.listeners).toBe(0);
  expect(workers[0]?.terminated).toBe(true);
  await pool.postMessage('rebuilt', []);
  expect(page.census.listeners).toBe(1);
  page.dispose();
  expect(workers.every(worker => worker.terminated)).toBe(true);
});
