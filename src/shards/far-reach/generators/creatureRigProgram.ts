import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakeSkyCreatures } from './creatures';
import { SKY_CREATURES } from './fileInventory';
import { SKY_CREATURE_SOURCES } from './rows/creatures';

/** Original Roc, goat and ray models; the gale wisp is entirely authored in the program. */
export const CREATURE_RIG_INPUTS: readonly string[] = Object.values(SKY_CREATURE_SOURCES);
/** Preserve all four original outputs, including the procedural wisp omitted by the old catalogue row. */
export const CREATURE_RIG_FILES: readonly string[] = SKY_CREATURES.map(creature => `${creature}.glb`);

/** Keep complete original skins, bones, fitted geometry, materials and embedded WebP bytes. */
export async function skyCreatureRigSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== CREATURE_RIG_INPUTS.length || CREATURE_RIG_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky creature rig input inventory differs');
  }
  const made = await bakeSkyCreatures(name => {
    const bytes = inputs.get(name);
    if (bytes === undefined) throw new Error(`Missing declared Sky creature model ${name}`);
    return bytes;
  });
  return new Map(SKY_CREATURES.map(creature => [`${creature}.glb`, made[creature].glb]));
}

/** Key the full original rig bank on all three native inputs and the complete author program. */
export async function skyCreatureRigProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'creature-rigs', native: true, inputs: CREATURE_RIG_INPUTS }, skyCreatureRigSource);
  if (files.size !== CREATURE_RIG_FILES.length || CREATURE_RIG_FILES.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky creature rig cache inventory differs');
  }
  return files;
}
