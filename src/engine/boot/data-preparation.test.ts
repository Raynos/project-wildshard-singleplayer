import { afterEach, expect, test, vi } from 'vitest';
import { Scope } from '../app/scope';
import { DataPreparationWorker, dataPreparation, setDataPreparation } from './dataPreparation';
import { isDev, setDev } from '../core/devMode';
import { preparationWork } from './preparationWork';
import { validationSourceBytes } from '@wildshard/format/validationReceipt';

class ControlledWorker extends EventTarget implements Worker {
  onerror: Worker['onerror'] = null;
  onmessage: Worker['onmessage'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  readonly sent: unknown[] = [];
  terminated = false;
  postMessage(value: unknown, options?: Transferable[] | StructuredSerializeOptions): void {
    const transfer = Array.isArray(options) ? options : options?.transfer;
    this.sent.push(structuredClone(value, transfer === undefined ? {} : { transfer }));
  }
  terminate(): void { this.terminated = true; }
  reply(data: unknown): void { this.dispatchEvent(new MessageEvent('message', { data })); }
  complete(index = 0): void {
    const request = this.sent[index];
    if (typeof request !== 'object' || request === null) throw new Error('Missing request');
    const id: unknown = Reflect.get(request, 'id'), kind: unknown = Reflect.get(request, 'kind');
    if (kind !== 'parse' && kind !== 'receipt') throw new Error('Invalid test operation');
    try { this.reply({ id, kind, ok: true, value: preparationWork(kind, Reflect.get(request, 'value')) }); }
    catch (error) {
      if (!(error instanceof Error)) throw error;
      this.reply({ id, kind, ok: false, error: { name: error.name, message: error.message } });
    }
  }
}
const owners: Scope[] = [];
function fixture(): { owner: Scope; worker: ControlledWorker; client: DataPreparationWorker } {
  const owner = new Scope('data-worker-test'), worker = new ControlledWorker();
  owners.push(owner);
  return { owner, worker, client: new DataPreparationWorker(owner, () => worker) };
}
afterEach(() => { for (const owner of owners.splice(0)) owner.dispose(); vi.useRealTimers(); });

test('data-only jobs preserve exact canonical bytes and correlate out-of-order replies', async () => {
  const { client, worker } = fixture();
  const source = { unicode: '森林 🐟', precise: 0.004753960503472321, zero: -0, indexed: { '10': 1, '2': 2 }, nested: [null, false, ''] };
  const bytes = new TextEncoder().encode(JSON.stringify(source)), before = bytes.slice();
  const parsed = client.parse(bytes), receipt = client.receipt(source);
  expect(bytes).toEqual(before); expect(bytes.byteLength).toBe(before.length);
  source.unicode = 'caller mutation';
  worker.complete(1); worker.complete(0);
  expect(await parsed).toEqual(JSON.parse(new TextDecoder().decode(before)));
  const original = { ...source, unicode: '森林 🐟' };
  expect(await receipt).toEqual(validationSourceBytes(original));
});

test.each([new Uint8Array([0xff]), new TextEncoder().encode('{broken')])('malformed bytes retain native parser refusal', async bytes => {
  const { client, worker } = fixture();
  const pending = client.parse(bytes), refused = expect(pending).rejects.toThrow(bytes[0] === 0xff ? TypeError : SyntaxError);
  worker.complete(); await refused;
  expect(bytes.length).toBeGreaterThan(0);
});

test('cyclic receipt data retains the canonical encoder refusal', async () => {
  const { client, worker } = fixture(), cycle: { self?: object } = {};
  cycle.self = cycle;
  const pending = client.receipt(cycle), refused = expect(pending).rejects.toThrow();
  worker.complete(); await refused;
});

test('operation mismatch drains every job and terminates the owned thread', async () => {
  const { client, worker, owner } = fixture();
  const left = expect(client.parse(new Uint8Array([49]))).rejects.toThrow('operation differs');
  const right = expect(client.receipt({ a: 1 })).rejects.toThrow('operation differs');
  worker.reply({ id: 1, kind: 'receipt', ok: true, value: new Uint8Array() });
  await Promise.all([left, right]);
  expect(worker.terminated).toBe(true); expect(owner.census.listeners).toBe(0); expect(owner.census.timers).toBe(0);
});

test('a stalled job has a visible bounded refusal and drains all started jobs', async () => {
  vi.useFakeTimers(); const { client, worker } = fixture();
  const left = expect(client.parse(new Uint8Array([49]))).rejects.toThrow('deadline: parse');
  const right = expect(client.receipt({ a: 1 })).rejects.toThrow('deadline: parse');
  await vi.advanceTimersByTimeAsync(30_000); await Promise.all([left, right]);
  expect(worker.terminated).toBe(true);
});

test('owner disposal refuses pending work and future work without publication', async () => {
  const { client, worker, owner } = fixture();
  const refused = expect(client.parse(new Uint8Array([49]))).rejects.toThrow('owner ended');
  owner.dispose(); await refused;
  await expect(client.receipt({})).rejects.toThrow('owner ended'); expect(worker.terminated).toBe(true);
});

test('unused workers stay absent and idle threads retire then recreate on demand', async () => {
  vi.useFakeTimers(); const owner = new Scope('idle-data-worker'); owners.push(owner);
  const workers: ControlledWorker[] = [], create = vi.fn(() => { const worker = new ControlledWorker(); workers.push(worker); return worker; });
  const client = new DataPreparationWorker(owner, create);
  await vi.advanceTimersByTimeAsync(30_000); expect(create).not.toHaveBeenCalled();
  const pending = client.parse(new Uint8Array([49])), worker = workers[0];
  if (worker === undefined) throw new Error('No worker');
  worker.complete(); expect(await pending).toBe(1);
  await vi.advanceTimersByTimeAsync(30_000); expect(worker.terminated).toBe(true);
  expect(owner.census.listeners).toBe(0); expect(owner.census.timers).toBe(0);
  const next = client.parse(new Uint8Array([50])), replacement = workers[1];
  if (replacement === undefined) throw new Error('No replacement');
  replacement.complete(); expect(await next).toBe(2); expect(create).toHaveBeenCalledTimes(2);
});


test('saved worker picks are ignored outside Developer and public writes are inert', () => {
  const previousDev = isDev(); setDev(true); const previous = dataPreparation();
  try {
    setDataPreparation('workers'); expect(dataPreparation()).toBe('workers');
    setDev(false); expect(dataPreparation()).toBe('main');
    setDataPreparation('main'); setDev(true); expect(dataPreparation()).toBe('workers');
    setDataPreparation('main'); expect(dataPreparation()).toBe('main');
  } finally { setDev(true); setDataPreparation(previous); setDev(previousDev); }
});


test('unavailable diagnostic marks do not refuse an otherwise valid worker result', async () => {
  const previous = isDev(); setDev(true);
  const mark = vi.spyOn(performance, 'mark').mockImplementation(() => { throw new Error('diagnostic unavailable'); });
  try {
    const { client, worker } = fixture(), pending = client.parse(new Uint8Array([49]));
    worker.complete(); expect(await pending).toBe(1);
  } finally { mark.mockRestore(); setDev(previous); }
});
