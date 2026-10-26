import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakeSkyFan } from './fan';
import { HD_URLS } from './fileInventory';

/** Original textured hand; all fan shapes and tassel curves belong to the author program. */
export const FAN_POOL_INPUTS: readonly string[] = [HD_URLS['hand-hd']];

/** Preserve the complete original fitted hand, pleats, UVs, guards and tassel geometry. */
export async function skyFanPoolSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  if (inputs.size !== FAN_POOL_INPUTS.length || FAN_POOL_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky fan pool input inventory differs');
  }
  const made = await bakeSkyFan(name => {
    const bytes = inputs.get(name);
    if (bytes === undefined) throw new Error(`Missing declared Sky fan model ${name}`);
    return bytes;
  });
  return made.glb;
}

/** Cache native geometry under the hand bytes and complete author-program identity. */
export async function skyFanPoolProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<Uint8Array> {
  const files = await ctx.cached({ id: 'fan-pool', native: true, inputs: FAN_POOL_INPUTS }, async inputs =>
    new Map([['fan.glb', await skyFanPoolSource(inputs)]]));
  const binary = files.get('fan.glb');
  if (files.size !== 1 || binary === undefined || binary.byteLength === 0) throw new Error('Sky fan pool cache inventory differs');
  return binary;
}
