import { resolve } from 'node:path';
import { createProjectGeneration, type ProjectGenerationContext } from '../../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../../src/sdk/immutable';

const project = 'src/shards/pine-hollow';
/** The input roots the author CLI declares for Pine (scripts/wildshard.mjs): its own folder and the public assets. Pine's
 *  producers read committed inputs by these URLs through `ctx.cached` (GR8). */
export const PINE_INPUT_ROOTS: readonly { prefix: string; directory: string }[] = [
  { prefix: '/src/shards/pine-hollow/', directory: project }, { prefix: '/assets/', directory: resolve('public/assets') },
];
/** A Pine generation context over its declared roots, caching under `cache`. */
export function pineGeneration(label: string, cache: string): ProjectGenerationContext {
  return createProjectGeneration(project, hashImmutableBytes(new TextEncoder().encode(label)), new Map(), cache, PINE_INPUT_ROOTS);
}
