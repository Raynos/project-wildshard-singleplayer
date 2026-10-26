import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { HD_URLS } from './fileInventory';
import { millSceneSource } from './millScene';

/** The original tower and foot are the complete external motion-binding inputs. */
export const MILL_SCENE_INPUTS: readonly string[] = [HD_URLS['mill-tower'], HD_URLS['mill-foot']];
/** Complete original hierarchy and hub bindings, owned by the source cache. */
export const MILL_SCENE_FILES: readonly string[] = ['mill-scene.json'];

/** Construct the original mill scene from exactly its declared native model bytes. */
export async function skyMillSceneSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== MILL_SCENE_INPUTS.length || MILL_SCENE_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky mill scene input inventory differs');
  }
  const bytes = await millSceneSource(name => {
    const input = inputs.get(name);
    if (input === undefined) throw new Error(`Missing declared Sky mill scene model ${name}`);
    return input;
  });
  return new Map([['mill-scene.json', bytes]]);
}

/** Cache the original scene under both model inputs and the full author-program identity. */
export async function skyMillSceneProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'mill-scene', native: true, inputs: MILL_SCENE_INPUTS }, skyMillSceneSource);
  if (files.size !== MILL_SCENE_FILES.length || MILL_SCENE_FILES.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky mill scene cache inventory differs');
  }
  return files;
}
