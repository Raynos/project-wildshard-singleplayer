import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { MODEL_URLS } from './fileInventory';
import { bridgeRestFiles } from './bridgeRest';

/** The original native deck is the only external input to bridge geometry and hierarchy. */
export const BRIDGE_REST_INPUTS: readonly string[] = [MODEL_URLS['bridge-deck']];
/** Original complete native geometry and JSON transport, owned by the source cache. */
export const BRIDGE_REST_FILES: readonly string[] = ['bridge-rest.glb', 'bridge-rest.json'];

/** Compile every original deck, rail, tie, instance matrix and scene port from declared native bytes. */
export async function skyBridgeRestSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== BRIDGE_REST_INPUTS.length || BRIDGE_REST_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky bridge rest input inventory differs');
  }
  const files = await bridgeRestFiles(name => {
    const bytes = inputs.get(name);
    if (bytes === undefined) throw new Error(`Missing declared Sky bridge model ${name}`);
    return bytes;
  });
  return files;
}

/** Cache the complete original pair under the native model bytes and full author-program identity. */
export async function skyBridgeRestProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'bridge-rest', native: true, inputs: BRIDGE_REST_INPUTS }, skyBridgeRestSource);
  if (files.size !== BRIDGE_REST_FILES.length || BRIDGE_REST_FILES.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky bridge rest cache inventory differs');
  }
  return files;
}
