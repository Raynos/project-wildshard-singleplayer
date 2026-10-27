import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { STORM_NOISE } from './rows/stormNoise';

export const STORM_NOISE_INPUT = '/assets/far-reach/weather/storm-noise.ktx2';

function checked(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength !== STORM_NOISE.compressed || hashImmutableBytes(bytes) !== STORM_NOISE.hash) throw new Error('Sky storm texture identity differs');
  return bytes;
}
/** Admit the exact committed native texture as a public input, never a generated source-tree blob. */
export async function skyStormNoiseInput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<Uint8Array> {
  const files = await ctx.cached({ id: 'storm-texture-input', inputs: [STORM_NOISE_INPUT] }, inputs => {
    const bytes = inputs.get(STORM_NOISE_INPUT);
    if (inputs.size !== 1 || bytes === undefined) throw new Error('Sky storm texture input inventory differs');
    return new Map([['storm.ktx2', Uint8Array.from(checked(bytes))]]);
  });
  const bytes = files.get('storm.ktx2');
  if (files.size !== 1 || bytes === undefined) throw new Error('Sky storm texture cache inventory differs');
  return Uint8Array.from(checked(bytes));
}
