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
 * The envelope strips unrelated cache fields; rows/options reject unknown fields.
 * Costs keep the recording grammar; nameBlob validates their actual byte claims. */
export function cachedBlobSources<const K extends readonly NamedBlobKind[]>(input: unknown, kinds: K): CachedBlobSource<K[number]>[] {
  return v.parse(v.object({ sources: v.array(v.strictObject({
    name: v.string(), kind: v.picklist(kinds), source: v.string(),
    options: v.strictObject({ decoded: v.number(), gpu: v.number(), triangles: v.number(), draws: v.number(),
      critical: v.boolean(), dependencies: v.array(v.string()) }),
  })) }), input).sources;
}
