import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { PineSources } from './pineSources';
/** The keyed sky rows (sky.json with each key's packed file, size and horizon) and the packed key bytes by product name
 *  (src/shards/pine-hollow/generators/bake-keyed-sky.mjs), decoded by the build context's image reader. */
export function pineKeyedSky(sources: PineSources, readImagePixels: ProjectGenerationContext['readImagePixels']): Promise<{ rows: Readonly<Record<string, unknown>>; blobs: [string, Uint8Array][] }>;
