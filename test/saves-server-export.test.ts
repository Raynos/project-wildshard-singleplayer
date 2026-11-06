// Settings' export and import at the flip: the server's store is the only one, so its file is the only file. A round trip keeps what the
// server wrote and leaves out what a page's export leaves out. A file from before the flip is refused by name, and nothing is written.
import { afterEach, beforeEach, expect, test } from 'vitest';
import { exportServerSaves, importServerSaves, openIndexedSaves, SERVER_SAVES } from '../src/engine/client/saves/indexed';

/** The little of IndexedDB a save store uses: one object store of strings, every transaction committing on the next task. */
function fakeIndexedDb(): { rows: Map<string, string>; api: unknown } {
  const rows = new Map<string, string>();
  const done = <T>(result: () => T): { result: T | undefined; onsuccess: (() => void) | null; onerror: (() => void) | null } => {
    const request: { result: T | undefined; onsuccess: (() => void) | null; onerror: (() => void) | null } = { result: undefined, onsuccess: null, onerror: null };
    queueMicrotask(() => { request.result = result(); request.onsuccess?.(); }); return request;
  };
  const transaction = (): unknown => {
    const row: { oncomplete: (() => void) | null; onerror: (() => void) | null; onabort: (() => void) | null; objectStore: () => unknown } = { oncomplete: null, onerror: null, onabort: null, objectStore: () => ({
      getAllKeys: () => done(() => [...rows.keys()]), getAll: () => done(() => [...rows.values()]),
      put: (value: string, key: string) => { rows.set(key, value); }, delete: (key: string) => { rows.delete(key); } }) };
    setTimeout(() => { row.oncomplete?.(); }, 0); return row;
  };
  return { rows, api: { deleteDatabase: () => undefined, open: () => {
    const request = done(() => ({ transaction, objectStoreNames: { contains: () => true } }));
    return Object.assign(request, { onupgradeneeded: null });
  } } };
}
let fake: ReturnType<typeof fakeIndexedDb>;
beforeEach(() => { fake = fakeIndexedDb(); Reflect.set(globalThis, 'indexedDB', fake.api); });
afterEach(() => { Reflect.deleteProperty(globalThis, 'indexedDB'); });

test('an export carries the server\'s documents, and an import puts them back whole', async () => {
  const saves = await openIndexedSaves(SERVER_SAVES);
  await saves.write('ws.global', '{"keys":{"a":1}}'); await saves.write('ws.standalone-pine', '{"tick":40}');
  await saves.write('ws.device', '{"keys":{"mine":1}}'); await saves.write('ws.session', '{}'); await saves.write('ws.global.corrupt.1', '{}'); await saves.write('other.global', '{}');
  const file = await exportServerSaves('ws.', 'wildshard');
  const parsed = JSON.parse(file) as { format: string; version: number; server: boolean; docs: Record<string, unknown> };
  expect(parsed).toMatchObject({ format: 'wildshard', version: 2, server: true });
  expect(parsed.docs).toEqual({ global: { keys: { a: 1 } }, 'standalone-pine': { tick: 40 } });
  fake.rows.clear();
  const report = await importServerSaves(file, 'ws.', 'wildshard');
  expect(report.imported.sort()).toEqual(['global', 'standalone-pine']); expect(report.skipped).toEqual([]);
  expect(JSON.parse(fake.rows.get('ws.standalone-pine') ?? 'null')).toEqual({ tick: 40 });
  expect(fake.rows.has('imported-page-saves'), 'the page\'s copy is not run over it next boot').toBe(true);
});

test('a file of another format, or a page\'s from before the flip, changes nothing', async () => {
  const refused = [{ key: '*', reason: 'Unknown save format' }];
  expect((await importServerSaves(JSON.stringify({ format: 'other', server: true, docs: { global: {} } }), 'ws.', 'wildshard')).skipped).toEqual(refused);
  expect((await importServerSaves(JSON.stringify({ format: 'wildshard', version: 2, build: '', docs: { global: {} } }), 'ws.', 'wildshard')).skipped).toEqual(refused);
  expect(fake.rows.size).toBe(0);
});
