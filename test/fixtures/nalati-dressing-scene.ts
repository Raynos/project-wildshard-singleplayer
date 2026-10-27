import { dressingScene as scene, dressingSceneBlobs as blobs } from '../../src/shards/nalati-grasslands/generators/dressingScene';
import paint from './nalati-poi-paint-original.json' with { type: 'json' };
import { nalatiPredecessorCoverRows } from './nalati-cover';
import { nalatiCragRows } from './nalati-crags';

/** Supply the immutable predecessor paint header and cover rows to the original scene oracles. */
export function dressingScene(tier: 'phone' | 'desktop', input: unknown, runtime: unknown, balbal: unknown, specimens: unknown): ReturnType<typeof scene> {
  return scene(tier, input, runtime, balbal, specimens, paint, nalatiPredecessorCoverRows, nalatiCragRows);
}
export function dressingSceneBlobs(input: unknown, runtime: unknown, balbal: unknown, specimens: unknown): ReturnType<typeof blobs> {
  return blobs(input, runtime, balbal, specimens, paint, nalatiPredecessorCoverRows, nalatiCragRows);
}
