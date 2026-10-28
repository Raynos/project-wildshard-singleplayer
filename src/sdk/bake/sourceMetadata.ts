import * as v from 'valibot';
import type { NamedBlobKind } from '../blobs';

/** Cached author metadata, prior to actual byte/cost admission by nameBlob. */
export interface CachedBlobSource<K extends NamedBlobKind> {
  name: string;
  kind: K;
  source: string;
  options: { decoded: number; gpu: number; triangles: number; draws: number; critical: boolean; dependencies: string[] };
}

/** Re-admit owned cached metadata for an explicit set of file kinds.
 * The envelope strips unrelated cache fields; rows/options reject unknown fields
 * unless an earlier cache stage explicitly requests native stripping.
 * Costs keep the recording grammar; nameBlob validates their actual byte claims. */
export function cachedBlobSources<const K extends readonly NamedBlobKind[]>(input: unknown, kinds: K, unknownFields: 'reject' | 'strip' = 'reject'): CachedBlobSource<K[number]>[] {
  const costs = { decoded: v.number(), gpu: v.number(), triangles: v.number(), draws: v.number(),
    critical: v.boolean(), dependencies: v.array(v.string()) };
  const fields = { name: v.string(), kind: v.picklist(kinds), source: v.string(),
    options: unknownFields === 'strip' ? v.object(costs) : v.strictObject(costs) };
  return v.parse(v.object({ sources: v.array(unknownFields === 'strip' ? v.object(fields) : v.strictObject(fields)) }), input).sources;
}
