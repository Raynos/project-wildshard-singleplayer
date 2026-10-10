/**
 * Refuse values JSON would silently discard or change, without invoking authored accessors.
 *
 * SF67: one own-property descriptor per key, read as it is visited, instead of `getOwnPropertyDescriptors` plus
 * `Object.entries` (and, for arrays, an index list and a regex per key): every shardfile parse walks the whole source
 * three times, and that walk was ~30 % of a 110-160 ms boot task. The verdict is the same: it is order independent (every
 * check must pass and every node is counted), an array must own exactly its indices plus `length`, and every key must be
 * an enumerable data property whose value is JSON data.
 */
export function isJsonData(value: unknown): boolean {
  const active = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number): boolean => {
    if (++nodes > 100000 || depth > 64) return false;
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return true;
    if (typeof item === 'number') return Number.isFinite(item) && !Object.is(item, -0);
    if (typeof item !== 'object' || active.has(item) || Object.getOwnPropertySymbols(item).length > 0) return false;
    const array = Array.isArray(item);
    if (array && item.length > 100000) return false;
    if (!array && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return false;
    const keys = Object.getOwnPropertyNames(item);
    // an array owns `length` and each index below it, nothing else: with every index present (checked as it is visited),
    // one more key than its length means no other key
    if (array && keys.length !== item.length + 1) return false;
    active.add(item);
    let ok = true;
    const count = array ? item.length : keys.length;
    for (let i = 0; ok && i < count; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(item, array ? i : keys[i] ?? '');
      ok = descriptor?.enumerable === true && descriptor.get === undefined && descriptor.set === undefined && visit(descriptor.value, depth + 1);
    }
    active.delete(item);
    return ok;
  };
  return visit(value, 0);
}
