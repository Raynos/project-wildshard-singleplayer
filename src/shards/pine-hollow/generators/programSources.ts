import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { readFileSources, sourcesOf, type PineSources } from './pineSources';
import { bakeTimberWorldFiles } from './bake-timber-world.mjs';

/** One read per build context (the program and its output share it). */
const reads = new WeakMap<object, Promise<PineSources>>();

async function readSources(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles'>): Promise<PineSources> {
  const files = await readFileSources(ctx);
  const timber = await ctx.cached({ id: 'pine-timber-world', inputs: [...files.keys()] }, () => bakeTimberWorldFiles(sourcesOf(files)));
  return sourcesOf(new Map([...files, ...timber]));
}

/** GR8 (D65, G37): Pine's program sources: every committed input (pineSources.ts `readFileSources`), then the timber world
 *  the program bakes over them (bake-timber-world.mjs, cached as one step), served under its former keys (`TIMBER_SOURCE`,
 *  its `assets/<hash>` and the material payloads' product names). */
export function readPineSources(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles'>): Promise<PineSources> {
  let sources = reads.get(ctx);
  if (sources === undefined) { sources = readSources(ctx); reads.set(ctx, sources); }
  return sources;
}
