import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { skyStaticSceneBytes } from './staticScene';
import { WORLD_PLACEMENT_INPUTS } from './worldPlacementBytes';

/** Exact original model bank for both decorative placement envelopes. */
export const STATIC_SCENE_INPUTS: readonly string[] = [...WORLD_PLACEMENT_INPUTS];
/** The retained static hierarchy is cached as owned bytes, never published into source. */
export const STATIC_SCENE_FILES: readonly string[] = ['static-scenes.json'];

/** Construct both original static scenes from their complete declared native inputs. */
export async function skyStaticSceneSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== STATIC_SCENE_INPUTS.length || STATIC_SCENE_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky static scene input inventory differs');
  }
  const bytes = await skyStaticSceneBytes(name => {
    const input = inputs.get(name);
    if (input === undefined) throw new Error(`Missing declared Sky static scene model ${name}`);
    return input;
  });
  return new Map([['static-scenes.json', bytes]]);
}

/** Native models and the full author-program identity key every persistent result. */
export async function skyStaticSceneProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'static-scenes', native: true, inputs: STATIC_SCENE_INPUTS }, skyStaticSceneSource);
  if (files.size !== STATIC_SCENE_FILES.length || STATIC_SCENE_FILES.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky static scene cache inventory differs');
  }
  return files;
}
