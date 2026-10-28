import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';
import { assertCellBounds } from './cellBounds';
import { assertCommonsCosts } from './commonsCosts';

const identifierKeys = new Set(['id', 'slug', 'name', 'actorId', 'rewardId', 'field', 'scene', 'entity', 'owner', 'sharedField', 'playerField']);

function own(input: unknown, key: string): unknown {
  if (typeof input !== 'object' || input === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new Error('Shardfile preflight refuses accessors');
  const value: unknown = descriptor?.value; return value;
}
function arrayCap(input: unknown, maximum: number, label: string): void {
  if (Array.isArray(input) && input.length > maximum) throw new Error(`Shardfile ${label} exceeds admission cap`);
}
function wire(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 0) throw new Error('Shardfile wire sizes must be nonnegative safe integers');
  return input;
}

/** Check collection, JSON source and distinct declared wire bounds without reading any immutable asset. */
export function preflightShardfile(input: unknown): void {
  const files = own(input, 'files'), requires = own(input, 'requires'), state = own(input, 'state');
  const commons = own(requires, 'commons');
  arrayCap(files, limits.files, 'files'); arrayCap(commons, limits.commons, 'commons');
  arrayCap(own(state, 'shared'), limits.stateFields, 'shared state'); arrayCap(own(state, 'player'), limits.stateFields, 'player state');
  arrayCap(own(input, 'water'), limits.waterBodies, 'water');
  // The bounds fence first validates the complete plain-JSON tree. Reuse that
  // refusal instead of repeating its descriptor/prototype walk beforehand.
  try { assertCellBounds(input); } catch (error) {
    if (error instanceof Error && error.message === 'Cell bounds require plain JSON data') throw new Error('Shardfile preflight requires bounded plain JSON data', { cause: error });
    throw error;
  }

  let bytes = 0;
  const encoder = new TextEncoder();
  // SF67: an ASCII string's UTF-8 length is its length; only others are encoded (a TextEncoder copy of every string of the
  // source was ~40 % of the template's 120-200 ms cached-product task at 4x CPU)
  const utf8Length = (text: string): number => {
    for (let i = 0; i < text.length; i++) if ((text.codePointAt(i) ?? 0) > 0x7f) return encoder.encode(text).length;
    return text.length;
  };
  const add = (count: number): void => { bytes += count; if (bytes > limits.sourceBytes) throw new Error('Shardfile source exceeds admission cap'); };
  // T10: the serialized length of each value without serializing it where that is plain (a JSON string per string and per
  // number, and a pair array per object, were most of this walk in a Pine crossing's product admission at phone 4x)
  const quoted = (text: string): number => {
    // printable ASCII with no quote or backslash is written as itself between two quotes; anything else is escaped
    for (let i = 0; i < text.length; i++) { const c = text.codePointAt(i) ?? 0; if (c < 0x20 || c > 0x7e || c === 0x22 || c === 0x5c) return utf8Length(JSON.stringify(text)); }
    return text.length + 2;
  };
  const string = (value: string, maximum: number): void => {
    if (value.length > maximum) throw new Error('Shardfile string exceeds admission cap');
    add(quoted(value));
  };
  const scalar = (value: unknown): number => {
    if (value === null) return 4;
    if (value === true) return 4;
    if (value === false) return 5;
    // a safe integer is its digits and sign (the plain-JSON fence refused NaN, the infinities and -0)
    if (typeof value === 'number' && Number.isSafeInteger(value)) { let digits = 1; for (let n = Math.abs(value); n >= 10; n = Math.floor(n / 10)) digits++; return digits + (value < 0 ? 1 : 0); }
    return JSON.stringify(value).length;
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'string') { string(value, limits.textCharacters); return; }
    if (Array.isArray(value)) {
      add(2 + Math.max(0, value.length - 1)); for (let i = 0; i < value.length; i++) visit(value[i]); return;
    }
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value), fields = value as Readonly<Record<string, unknown>>; add(2 + Math.max(0, keys.length - 1));
      for (const key of keys) {
        const item = fields[key];
        string(key, limits.idCharacters); add(1);
        if (typeof item === 'string' && identifierKeys.has(key)) string(item, limits.idCharacters); else visit(item);
      }
      return;
    }
    add(scalar(value));
  };
  visit(input);

  const declared = new Map<string, number>(); let total = 0;
  const include = (hash: unknown, size: unknown): void => {
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/u.test(hash)) throw new Error('Shardfile wire declaration requires a content hash');
    const count = wire(size), previous = declared.get(hash);
    if (previous !== undefined) { if (previous !== count) throw new Error('Conflicting distinct wire sizes'); return; }
    total += count; if (total > limits.wireBytes) throw new Error('Shardfile total wire exceeds admission cap');
    declared.set(hash, count);
  };
  if (Array.isArray(files)) for (const file of files) include(own(file, 'hash'), own(file, 'compressed'));
  if (Array.isArray(commons)) {
    const sizes = own(requires, 'commonsWire');
    if (commons.length > 0 && (typeof sizes !== 'object' || sizes === null || Array.isArray(sizes))) throw new Error('Commons require exact wire declarations');
    const keys = typeof sizes === 'object' && sizes !== null ? Object.keys(sizes) : [];
    if (new Set(commons).size !== commons.length || keys.length !== commons.length || keys.some((key) => !commons.includes(key))) throw new Error('Commons require an exact wire key set');
    for (const hash of commons) include(hash, typeof hash === 'string' ? own(sizes, hash) : undefined);
    if (commons.every((hash): hash is string => typeof hash === 'string')) assertCommonsCosts(commons, own(requires, 'commonsCosts'));
  }
}
