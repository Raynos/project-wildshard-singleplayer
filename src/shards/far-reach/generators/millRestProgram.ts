import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { HD_URLS } from './fileInventory';
import { millRestFiles } from './millModel';

/** The two original textured models are the complete external mill geometry input inventory. */
export const MILL_REST_INPUTS: readonly string[] = [HD_URLS['mill-tower'], HD_URLS['mill-foot']];
/** Original geometry, UV channels, fitted bounds and pool declaration owned by the source cache. */
export const MILL_REST_FILES: readonly string[] = ['mill-rest.glb', 'mill-rest.json'];

/** Compile the original tower and stone foot from exactly the declared native model bytes. */
export async function skyMillRestSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== MILL_REST_INPUTS.length || MILL_REST_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky mill rest input inventory differs');
  }
  const files = await millRestFiles(name => {
    const bytes = inputs.get(name);
    if (bytes === undefined) throw new Error(`Missing declared Sky mill model ${name}`);
    return bytes;
  });
  return files;
}

/** Cache the complete original pair under both native inputs and the full author-program identity. */
export async function skyMillRestProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'mill-rest', native: true, inputs: MILL_REST_INPUTS }, skyMillRestSource);
  if (files.size !== MILL_REST_FILES.length || MILL_REST_FILES.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky mill rest cache inventory differs');
  }
  return files;
}
