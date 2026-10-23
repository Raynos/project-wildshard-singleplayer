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

function boundedJsonData(value: unknown, separateSchemas: boolean, diagnostic?:{nodes:number}): boolean {
  const active = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number, location: 'index' | 'files' | 'file' | 'other'): boolean => {
    if (++nodes > (diagnostic===undefined?100000:1000000) || depth > 64) return false;
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
      const key = array ? i : keys[i] ?? '';
      const next = location === 'index' && key === 'files' ? 'files' : location === 'files' && array ? 'file' : 'other';
      ok = descriptor?.enumerable === true && descriptor.get === undefined && descriptor.set === undefined
        && (separateSchemas && location === 'file' && key === 'jsonSchema' ? isJsonData(descriptor.value) : visit(descriptor.value, depth + 1, next));
    }
    active.delete(item);
    return ok;
  };
  const valid=visit(value, 0, 'index');if(diagnostic!==undefined)diagnostic.nodes=nodes;return valid;
}

/**
 * Any number token that may decode to -0 (a negative zero, or a negative number underflowing through a 3-digit negative
 * exponent) or to ±Infinity (a 2-digit positive exponent, or a run of 100 digits): conservative, so a match only means the
 * reviver checks the parse. A number token always follows `:`, `[`, `,` or whitespace, so text inside a string matches
 * only after one of those (G639: base64 such as `e12` sent every file carrying it through the reviver, ~50 ms of a Nalati
 * entry frame).
 */
const MAYBE_NOT_CANONICAL = /(?<=[:[,\s])(?:-0(?:\.0*)?(?:[eE][+-]?\d+)?(?![\d.])|-?\d+(?:\.\d+)?[eE]\+?\d{2}|-?\d+(?:\.\d+)?[eE]-\d{3}|-?\d{100})/u;
/** Decode an already byte-bounded named payload. JSON.parse supplies only plain
 * data; reject the numeric values JSON can decode but cannot preserve. The
 * defining schema owns the payload's shape and bounds, without a new node cap. */
export function parseNamedJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  // G639: a reviver puts every value through a script call (Nalati's grid entry spent ~70 ms of one frame on one file);
  // text with no token that can decode to -0 or overflow parses without one
  if (!MAYBE_NOT_CANONICAL.test(text)) return JSON.parse(text);
  return JSON.parse(text, (_key: string, value: unknown): unknown => {
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) throw new Error('Named JSON requires finite canonical numbers');
    return value;
  });
}
