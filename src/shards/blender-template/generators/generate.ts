import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { project, type BlenderProject } from './project';
import { output } from './ground';
import { blenderMap } from './mapProgram';

/** GR9 (G783): one build program returns the declaration (its `behaviour` still compiled by the SDK), the baked ground
 *  output and the map lattice painted from the world GLB; no catalogue job writes the map. */
export async function generate(ctx: ProjectGenerationContext): Promise<{ shard: BlenderProject; output: typeof output; map: { pixels: Uint8Array } }> {
  return { shard: project, output, map: { pixels: await blenderMap(ctx) } };
}
