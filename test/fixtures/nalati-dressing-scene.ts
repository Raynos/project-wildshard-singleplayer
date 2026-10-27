import { dressingScene as scene, dressingSceneBlobs as blobs } from '../../src/shards/nalati-grasslands/generators/dressingScene';
import paint from './nalati-poi-paint-original.json' with { type: 'json' };

/** Supply the immutable predecessor paint header to the original scene oracles. */
export function dressingScene(tier: 'phone' | 'desktop', input: unknown, runtime: unknown, balbal: unknown, specimens: unknown): ReturnType<typeof scene> {
  return scene(tier, input, runtime, balbal, specimens, paint);
}
export function dressingSceneBlobs(input: unknown, runtime: unknown, balbal: unknown, specimens: unknown): ReturnType<typeof blobs> {
  return blobs(input, runtime, balbal, specimens, paint);
}
