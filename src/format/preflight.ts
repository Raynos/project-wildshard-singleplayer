import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';
import { assertCellBounds, assertCellBoundsSteps } from './cellBounds';
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
  const { files, requires, commons } = collections(input);
  // The bounds fence first validates the complete plain-JSON tree. Reuse that
  // refusal instead of repeating its descriptor/prototype walk beforehand.
  try { assertCellBounds(input); } catch (error) { throw boundsRefusal(error); }

  let bytes = 0;
  const add = (count: number): void => { bytes += count; if (bytes > limits.sourceBytes) throw new Error('Shardfile source exceeds admission cap'); };
  const string = (value: string, maximum: number): void => {
    if (value.length > maximum) throw new Error('Shardfile string exceeds admission cap');
    add(utf8Length(JSON.stringify(value)));
  };
  // T10: keep this walk on builtins (JSON.stringify per value, Object.entries per object). Admission runs it a few times a
  // crossing, mostly before it is optimised, and per-value JS helpers in their place made it ~3x slower in a Chromium phone
  // 4x Pine drive (dc806989b0; preflight 334 -> 960 ms over the drive) although warm Node timings were faster.
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
  declaredWires(files, requires, commons);
}

const encoder = new TextEncoder();
// SF67: an ASCII string's UTF-8 length is its length; only others are encoded (a TextEncoder copy of every string of the
// source was ~40 % of the template's 120-200 ms cached-product task at 4x CPU)
function utf8Length(text: string): number {
  for (let i = 0; i < text.length; i++) if ((text.codePointAt(i) ?? 0) > 0x7f) return encoder.encode(text).length;
  return text.length;
}
/** the collection caps, before any walk */
function collections(input: unknown): { files: unknown; requires: unknown; commons: unknown } {
  const files = own(input, 'files'), requires = own(input, 'requires'), state = own(input, 'state');
  const commons = own(requires, 'commons');
  arrayCap(files, limits.files, 'files'); arrayCap(commons, limits.commons, 'commons');
  arrayCap(own(state, 'shared'), limits.stateFields, 'shared state'); arrayCap(own(state, 'player'), limits.stateFields, 'player state');
  arrayCap(own(input, 'water'), limits.waterBodies, 'water');
  return { files, requires, commons };
}
function boundsRefusal(error: unknown): unknown {
  if (error instanceof Error && error.message === 'Cell bounds require plain JSON data') return new Error('Shardfile preflight requires bounded plain JSON data', { cause: error });
  return error;
}
/** distinct declared wire sizes, after the walks */
function declaredWires(files: unknown, requires: unknown, commons: unknown): void {
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

/**
 * `preflightShardfile` in steps of `every` visited values (T10: product admission walked a whole source in one drawn frame of
 * a drive, 23-34 ms at phone 4x): the same caps, fence, bounds, size count and wire checks in the same order, with the same
 * refusals. The size walk is the same pre-order on the same builtins (JSON.stringify per value, Object.entries per object;
 * dc806989b0 showed hand-rolled helpers slower in cold page code). The value must not change between steps.
 */
export function* preflightShardfileSteps(input: unknown, every = 4096): Generator<void, void> {
  const { files, requires, commons } = collections(input);
  try { yield* assertCellBoundsSteps(input, 'shardfile', every); } catch (error) { throw boundsRefusal(error); }
  let bytes = 0, since = 0;
  const add = (count: number): void => { bytes += count; if (bytes > limits.sourceBytes) throw new Error('Shardfile source exceeds admission cap'); };
  const string = (value: string, maximum: number): void => {
    if (value.length > maximum) throw new Error('Shardfile string exceeds admission cap');
    add(utf8Length(JSON.stringify(value)));
  };
  // pre-order through a stack: a field is pushed as its key with its value, so its key is counted just before its subtree
  const values: unknown[] = [input], keys: (string | null)[] = [null];
  while (values.length > 0) {
    if (++since >= every) { since = 0; yield; }
    const value = values.pop(), key = keys.pop() ?? null;
    if (key !== null) {
      string(key, limits.idCharacters); add(1);
      if (typeof value === 'string' && identifierKeys.has(key)) { string(value, limits.idCharacters); continue; }
    }
    if (typeof value === 'string') { string(value, limits.textCharacters); continue; }
    if (Array.isArray(value)) {
      add(2 + Math.max(0, value.length - 1));
      for (let i = value.length - 1; i >= 0; i--) { values.push(value[i]); keys.push(null); }
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value); add(2 + Math.max(0, entries.length - 1));
      for (let i = entries.length - 1; i >= 0; i--) { const entry = entries[i]; if (entry !== undefined) { values.push(entry[1]); keys.push(entry[0]); } }
      continue;
    }
    add(JSON.stringify(value).length);
  }
  declaredWires(files, requires, commons);
}
