import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakeSignalRigSources } from './rigSources';

const strider = 'assets/models/dune-strider.glb', manta = 'assets/models/dune-matriarch.glb';
const names = ['skitterer.glb', 'strider.glb', 'striderRig.json', 'ray.glb', 'matriarch.glb'] as const;

/** Cache the defining creature bake from explicit owned inputs; no output file is an input. */
export async function signalRigFiles(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'creature-rigs', native: true, inputs: [strider, manta] }, inputs => {
    const striderBytes = inputs.get(strider), mantaBytes = inputs.get(manta);
    if (striderBytes === undefined || mantaBytes === undefined || inputs.size !== 2) throw new Error('Missing original creature models');
    return bakeSignalRigSources(striderBytes, mantaBytes);
  });
  if (files.size !== names.length || names.some(name => (files.get(name)?.length ?? 0) === 0)) throw new Error('Creature rig cache inventory differs');
  return files;
}
