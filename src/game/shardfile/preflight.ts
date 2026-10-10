import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';
import { isJsonData } from './json';
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
  if (!isJsonData(input)) throw new Error('Shardfile preflight requires bounded plain JSON data');

  let bytes = 0;
  const encoder = new TextEncoder();
  // SF67: an ASCII string's UTF-8 length is its length; only others are encoded (a TextEncoder copy of every string of the
  // source was ~40 % of the template's 120-200 ms cached-product task at 4x CPU)
  const utf8Length = (text: string): number => {
    for (let i = 0; i < text.length; i++) if ((text.codePointAt(i) ?? 0) > 0x7f) return encoder.encode(text).length;
    return text.length;
  };
  const add = (count: number): void => { bytes += count; if (bytes > limits.sourceBytes) throw new Error('Shardfile source exceeds admission cap'); };
  const string = (value: string, maximum: number): void => {
    if (value.length > maximum) throw new Error('Shardfile string exceeds admission cap');
    add(utf8Length(JSON.stringify(value)));
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'string') { string(value, limits.textCharacters); return; }
    if (Array.isArray(value)) {
      add(2 + Math.max(0, value.length - 1)); for (const item of value) visit(item); return;
    }
    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value); add(2 + Math.max(0, entries.length - 1));
      for (const [key, item] of entries) {
        string(key, limits.idCharacters); add(1);
        if (typeof item === 'string' && identifierKeys.has(key)) string(item, limits.idCharacters); else visit(item);
      }
      return;
    }
    add(JSON.stringify(value).length);
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
