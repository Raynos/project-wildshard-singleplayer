// oxlint-disable-next-line import/no-nodejs-modules -- Read independent pinned original GLBs, never the current producer or its cache.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Test isolated roots containing only the five committed oracle files.
import { resolve } from 'node:path';
import { hashImmutableBytes } from '../../src/sdk/immutable';

const originals = [
  ['storm-roc.glb', 'test/fixtures/sky-rigs/storm-roc.glb', 492_772, '1c057979c81e5fafd2f97a151b7936c90ccf01555b2f307b911fc628e7c19af0'],
  ['sky-goat.glb', 'test/fixtures/sky-rigs/sky-goat.glb', 94_368, 'bb8ab3271fb98f8c6684f14771d8cb5c7a77b3ba2646087fe0956db18da9c018'],
  ['drift-ray.glb', 'public/assets/far-reach/rigs/drift-ray.glb', 74_448, 'd0f39e6fa142c5f12c9949e6ba91f6bc621cd8bfaa8c2c327650f05439a56020'],
  ['gale-wisp.glb', 'public/assets/far-reach/rigs/gale-wisp.glb', 10_132, '55467d69a6f7144ba38a06a7f917a3de09d30a44e9c9e1729a6e520af2d6be31'],
  ['storm-roc.phone.glb', 'public/assets/gpu/far-reach/rigs/storm-roc-70e5655f.glb', 2_053_504, '70e5655f969dfb40edba0109d16d7baddc6faef7bede8d10d91c2e2661f7d8ad'],
] as const;

/** Complete predecessor oracles: two retired untracked handoffs are frozen here;
 * the other three originals remain committed public assets. Every read checks the
 * pre-publication full byte pins and loans detached bytes without a fallback. */
export function originalSkyRigs(root = '.'): ReadonlyMap<string, Uint8Array> {
  return new Map(originals.map(([name, path, size, hash]) => {
    const bytes = readFileSync(resolve(root, path));
    if (bytes.byteLength !== size || hashImmutableBytes(bytes) !== hash) throw new Error(`Original Sky rig differs: ${name}`);
    return [name, Uint8Array.from(bytes)];
  }));
}
