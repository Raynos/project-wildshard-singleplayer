import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakeSignalWorldSources } from './worldSources';

const input = 'assets/models/dry-well.glb';
const pieces = ['rocks', 'dressing', 'tower', 'caravan', 'well', 'braziers', 'lash'];
const names = [...pieces.flatMap(piece => [`${piece}.glb`, `${piece}.json`]), 'plait.bin'];

/** Cache the original world bake from its explicit model input, never from a generated piece or metadata file. */
export async function signalWorldFiles(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'world-geometry', native: true, inputs: [input] }, async inputs => {
    const well = inputs.get(input);
    if (inputs.size !== 1 || well === undefined) throw new Error('Missing original well model');
    return (await bakeSignalWorldSources(well)).files;
  });
  if (files.size !== names.length || names.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('World geometry cache inventory differs');
  }
  return files;
}
