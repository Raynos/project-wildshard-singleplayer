// Passive native save-failure evidence. No keys, values, credentials or retries.
export function observeReleaseStorage() {
  const failures = { rows: [], dropped: 0 };
  Reflect.set(globalThis, '__releaseStorageFaults', failures);
  const original = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (...args) {
    const request = Reflect.apply(original, this, args);
    const record = event => {
      if (failures.rows.length >= 32) { failures.dropped++; return; }
      const target = event.target;
      const error = target instanceof IDBTransaction ? target.error
        : target instanceof IDBRequest && target.readyState === 'done' ? target.error : null;
      const source = target instanceof IDBRequest ? target.source : null;
      failures.rows.push({ at: Date.now(), database: typeof args[0] === 'string' ? args[0] : null,
        event: event.type, error: error?.name ?? null,
        stores: target instanceof IDBTransaction ? [...target.objectStoreNames]
          : source instanceof IDBObjectStore || source instanceof IDBIndex ? [source.name] : [] });
    };
    request.addEventListener('error', record);
    request.addEventListener('blocked', record);
    request.addEventListener('success', () => {
      const database = request.result;
      database.addEventListener('error', record);
      database.addEventListener('abort', record);
      database.addEventListener('close', record);
    }, { once: true });
    return request;
  };
}
