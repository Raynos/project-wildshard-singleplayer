import { resolve } from 'node:path';
import { createProjectGeneration, type ProjectGenerationContext } from '../../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../../src/sdk/immutable';

const project = 'src/shards/pine-hollow';
/** The input roots the author CLI declares for Pine (scripts/wildshard.mjs): its own folder and the public assets. Pine's
 *  producers read committed inputs by these URLs through `ctx.cached` (GR8). */
export const PINE_INPUT_ROOTS: readonly { prefix: string; directory: string }[] = [
  { prefix: '/src/shards/pine-hollow/', directory: project }, { prefix: '/assets/', directory: resolve('public/assets') },
];
/** A Pine generation context over its declared roots, caching under `cache`; `assets` receives what the program hands over
 *  with `ctx.asset`, by hash. */
export function pineGeneration(label: string, cache: string, assets: Map<string, Uint8Array> = new Map()): ProjectGenerationContext {
  return createProjectGeneration(project, hashImmutableBytes(new TextEncoder().encode(label)), assets, cache, PINE_INPUT_ROOTS);
}
