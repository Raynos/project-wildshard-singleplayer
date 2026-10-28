import { zlibSync } from 'fflate';
import { dressingScene as scene, dressingSceneBlobs as blobs } from '../../src/shards/nalati-grasslands/generators/dressingScene';
import paint from './nalati-poi-paint-original.json' with { type: 'json' };
import { nalatiPredecessorCoverRows } from './nalati-cover';
import { nalatiCragRows } from './nalati-crags';

// Independent historical wire transport; production always publishes named byte loans.
const encoded = (raw: Uint8Array): string => {
  let text = ''; for (const byte of zlibSync(raw)) text += String.fromCodePoint(byte);
  return btoa(text);
};
/** Supply the immutable predecessor paint header and cover rows to the original scene oracles. */
export function dressingScene(tier: 'phone' | 'desktop', input: unknown, runtime: unknown, balbal: unknown, specimens: unknown): ReturnType<typeof scene> {
  return scene(tier, input, runtime, balbal, specimens, paint, nalatiPredecessorCoverRows, nalatiCragRows, {
    contact: raw => ({ data: encoded(raw) }), cloth: raw => ({ kind: 'inline', data: encoded(raw) }),
  });
}
export function dressingSceneBlobs(input: unknown, runtime: unknown, balbal: unknown, specimens: unknown, cragFiles?: Readonly<Record<'phone'|'desktop',string>>): ReturnType<typeof blobs> {
  return blobs(input, runtime, balbal, specimens, paint, nalatiPredecessorCoverRows, nalatiCragRows,cragFiles);
}
