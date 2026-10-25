import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { HD_URLS, SKY_HD } from './fileInventory';
import { CARVED, MODEL_FITS } from './modelFrames';
import { bakeSkyIsleFrames } from './skyIsleFrames';
import { bakePreparedModels } from './preparedModelBytes';

/** Original painted model inputs, in their defining intake order. */
export const PREPARED_MODEL_INPUTS: readonly string[] = SKY_HD.map(name => HD_URLS[name]);

/** Derive fitting frames from the authored models and layout, without a generated handoff. */
export async function preparedModelSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  if (inputs.size !== PREPARED_MODEL_INPUTS.length || PREPARED_MODEL_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Prepared model input inventory differs');
  }
  const read = (name: string): Uint8Array => {
    const bytes = inputs.get(name); if (bytes === undefined) throw new Error(`Missing declared prepared model ${name}`); return bytes;
  };
  const frames = await bakeSkyIsleFrames(read);
  return bakePreparedModels(read, { frames, fits: MODEL_FITS, daisHeight: CARVED.daisH });
}

/** Own cached raw geometry; original textures and runtime publication remain with their readers. */
export async function preparedModelProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<Uint8Array> {
  const files = await ctx.cached({ id: 'prepared-models', native: true, inputs: PREPARED_MODEL_INPUTS }, async inputs =>
    new Map([['prepared-models.glb', await preparedModelSource(inputs)]]));
  const binary = files.get('prepared-models.glb');
  if (files.size !== 1 || binary === undefined || binary.byteLength === 0) throw new Error('Prepared model cache inventory differs');
  return binary;
}
