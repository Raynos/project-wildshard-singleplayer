/**
 * Refuse values JSON would silently discard or change, without invoking authored accessors.
 *
 * SF67: one own-property descriptor per key, read as it is visited, instead of `getOwnPropertyDescriptors` plus
 * `Object.entries` (and, for arrays, an index list and a regex per key): every shardfile parse walks the whole source
 * three times, and that walk was ~30 % of a 110-160 ms boot task. The verdict is the same: it is order independent (every
 * check must pass and every node is counted), an array must own exactly its indices plus `length`, and every key must be
 * an enumerable data property whose value is JSON data.
 */
export function isJsonData(value: unknown): boolean { return boundedJsonData(value, false); }

/** An output index gives each files[].jsonSchema its own unchanged plain-JSON
 * budget. Repeated defining schemas do not spend the envelope's node budget. */
export function isJsonDataWithFileSchemas(value: unknown): boolean { return boundedJsonData(value, true); }

/** Failure-only measurement; this never participates in admission. The normal
 * 100,000-node guard is unchanged. Oversized diagnostics stop at one million. */
export function jsonDataNodes(value:unknown):number|undefined{
  const count={nodes:0};return boundedJsonData(value,false,count)?count.nodes:undefined;
}

/** Conservative JSON heap estimate from the same admitted descriptors: strings,
 * scalar values, containers and keys. Invalid data retains the ordinary guard. */
export function jsonDataHeapBytes(value: unknown): number | undefined {
  const heap = { bytes: 0 };
  return boundedJsonData(value, false, undefined, heap) ? heap.bytes : undefined;
}

function boundedJsonData(value: unknown, separateSchemas: boolean, diagnostic?:{nodes:number}, heap?: { bytes: number }): boolean {
  const active = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number, location: 'index' | 'files' | 'file' | 'other'): boolean => {
    if (++nodes > (diagnostic===undefined?100000:1000000) || depth > 64) return false;
    if (item === null || typeof item === 'boolean' || typeof item === 'string') {
      if (heap !== undefined) heap.bytes += typeof item === 'string' ? 24 + item.length * 2 : 8;
      return true;
    }
    if (typeof item === 'number') { if (heap !== undefined) heap.bytes += 8; return Number.isFinite(item) && !Object.is(item, -0); }
    if (typeof item !== 'object' || active.has(item) || Object.getOwnPropertySymbols(item).length > 0) return false;
    const array = Array.isArray(item);
    if (array && item.length > 100000) return false;
    if (!array && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return false;
    const keys = Object.getOwnPropertyNames(item);
    // an array owns `length` and each index below it, nothing else: with every index present (checked as it is visited),
    // one more key than its length means no other key
    if (array && keys.length !== item.length + 1) return false;
    if (heap !== undefined) heap.bytes += array ? 40 + item.length * 8 : 64 + keys.length * 16;
    active.add(item);
    let ok = true;
    const count = array ? item.length : keys.length;
    for (let i = 0; ok && i < count; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(item, array ? i : keys[i] ?? '');
      const key = array ? i : keys[i] ?? '';
      if (heap !== undefined && !array) heap.bytes += 24 + (keys[i]?.length ?? 0) * 2;
      const next = location === 'index' && key === 'files' ? 'files' : location === 'files' && array ? 'file' : 'other';
      ok = descriptor?.enumerable === true && descriptor.get === undefined && descriptor.set === undefined
        && (separateSchemas && location === 'file' && key === 'jsonSchema' ? isJsonData(descriptor.value) : visit(descriptor.value, depth + 1, next));
    }
    active.delete(item);
    return ok;
  };
  const valid=visit(value, 0, 'index');if(diagnostic!==undefined)diagnostic.nodes=nodes;return valid;
}

/** Decode an already byte-bounded named payload. JSON.parse supplies only plain
 * data; reject the numeric values JSON can decode but cannot preserve. The
 * defining schema owns the payload's shape and bounds, without a new node cap. */
export function parseNamedJson(bytes: Uint8Array): unknown {
  const result: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  // Inspect decoded numbers, not every character of large strings. A reviver
  // invokes script for every value; a text prefilter can also miss root -0 and
  // decimal underflow. The worklist is iterative and retains only containers.
  const pending: unknown[] = [result];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error('Named JSON requires finite canonical numbers');
    } else if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
          const child: unknown = value[index];
          if (typeof child === 'number') {
            if (!Number.isFinite(child) || Object.is(child, -0)) throw new Error('Named JSON requires finite canonical numbers');
          } else if (child !== null && typeof child === 'object') pending.push(child);
        }
      } else {
        for (const key of Object.keys(value)) {
          const child: unknown = Reflect.get(value, key);
          if (typeof child === 'number') {
            if (!Number.isFinite(child) || Object.is(child, -0)) throw new Error('Named JSON requires finite canonical numbers');
          } else if (child !== null && typeof child === 'object') pending.push(child);
        }
      }
    }
  }
  return result;
}
