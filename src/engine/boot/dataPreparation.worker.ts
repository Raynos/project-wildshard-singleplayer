import { preparationWork } from './preparationWork';

self.onmessage = (event: MessageEvent<unknown>): void => {
  const data = event.data;
  if (typeof data !== 'object' || data === null) { self.postMessage({ error: 'Invalid data preparation request' }, { transfer: [] }); return; }
  const id: unknown = Reflect.get(data, 'id'), kind: unknown = Reflect.get(data, 'kind');
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || (kind !== 'parse' && kind !== 'parse-pages' && kind !== 'receipt')) {
    self.postMessage({ error: 'Invalid data preparation request' }, { transfer: [] }); return;
  }
  try {
    const value = preparationWork(kind, Reflect.get(data, 'value'));
    if (value instanceof Uint8Array && value.buffer instanceof ArrayBuffer) {
      self.postMessage({ id, kind, ok: true, value }, { transfer: [value.buffer] });
    } else self.postMessage({ id, kind, ok: true, value }, { transfer: [] });
  } catch (error) {
    self.postMessage({ id, kind, ok: false, error: error instanceof Error ? { name: error.name, message: error.message } : { name: 'Error', message: String(error) } }, { transfer: [] });
  }
};
