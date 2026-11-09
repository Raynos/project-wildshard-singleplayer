// Passive native save-failure evidence. No keys, values, credentials or retries.
export function observeReleaseStorage() {
  const failures = [];
  Reflect.set(globalThis, '__releaseStorageFaults', failures);
  const original = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (...args) {
    const request = Reflect.apply(original, this, args);
    request.addEventListener('success', () => {
      const database = request.result;
      const record = event => {
        if (failures.length >= 32) return;
        const target = event.target;
        const error = target instanceof IDBTransaction || target instanceof IDBRequest ? target.error : null;
        failures.push({ at: Date.now(), database: database.name, event: event.type,
          error: error?.name ?? null,
          stores: target instanceof IDBTransaction ? [...target.objectStoreNames] : [] });
      };
      database.addEventListener('error', record);
      database.addEventListener('abort', record);
    }, { once: true });
    return request;
  };
}
