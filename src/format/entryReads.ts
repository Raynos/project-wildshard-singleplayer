import * as v from 'valibot';
import { SHARDFILE_ADMISSION_LIMITS } from './admissionLimits';

/** A same-product path or immutable public asset URL; no origin, fragment, escaped separator or parent traversal crosses
 * a prefetch boundary. The one query is a build's version token (`?v=<hex>`): the HTTP cache keys a read by its whole URL. */
export const EntryReadUrlSchema: v.GenericSchema<string> = v.pipe(v.string(), v.minLength(1), v.maxLength(512),
  v.regex(/^(?:\/(?:assets|shardfiles)\/)?[a-zA-Z0-9_-][a-zA-Z0-9_./-]*(?:\?v=[a-f0-9]{6,64})?$/u),
  v.check(url => { const path = url.split('?')[0] ?? ''; return path.split('/').every((part, index) => index === 0 && path.startsWith('/') || part !== '' && part !== '.' && part !== '..'); }, 'Canonical entry read URL'));
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const coordinate = v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250));
export interface EntryRead {
  readonly url: string;
  readonly hash: string;
  readonly bytes: number;
}
/** First-demand order from one entry crawl. This is read-ahead metadata, never
 * an admission root, a visited marker, a constructor or a readiness claim. */
export interface RegionEntryReads {
  readonly region: string;
  readonly tier: 'phone' | 'desktop';
  readonly at: readonly [number, number];
  readonly reads: readonly EntryRead[];
}
export type EntryReadSet = readonly RegionEntryReads[];
export const EntryReadSetSchema: v.GenericSchema<EntryReadSet> = v.pipe(v.array(v.strictObject({
  region: v.pipe(v.string(), v.minLength(1), v.maxLength(96), v.regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/u)),
  tier: v.picklist(['phone', 'desktop']), at: v.tuple([coordinate, coordinate]),
  reads: v.pipe(v.array(v.strictObject({ url: EntryReadUrlSchema, hash,
    bytes: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(SHARDFILE_ADMISSION_LIMITS.wireBytes)) })),
  v.maxLength(8192), v.check(reads => new Set(reads.map(read => read.url)).size === reads.length, 'Entry URLs are unique')),
})), v.maxLength(128), v.check(rows => new Set(rows.map(row => `${row.region}:${row.tier}`)).size === rows.length, 'Entry tier rows are unique'));
/** Intrinsic format validation, also used before a build starts its entry walk. */
export function parseEntryReadSet(input: unknown): EntryReadSet { return v.parse(EntryReadSetSchema, input); }

/** Pick the closest declared entry in cell-local coordinates; equal distances
 * keep declaration order and the read order within that entry stays untouched. */
export function nearestEntryReads(rows: EntryReadSet, tier: RegionEntryReads['tier'], at: { readonly x: number; readonly z: number }): RegionEntryReads | undefined {
  if (!Number.isFinite(at.x) || !Number.isFinite(at.z)) throw new Error('Finite entry approach position required');
  let nearest: RegionEntryReads | undefined, distance = Infinity;
  for (const row of rows) if (row.tier === tier) {
    const next = Math.hypot(row.at[0] - at.x, row.at[1] - at.z);
    if (next < distance) { distance = next; nearest = row; }
  }
  return nearest;
}
