import { HD_URLS } from './fileInventory';
import { SKY_ISLE_MODELS } from './rows/skyIsles';
import { bakeSkyIsleFrames } from './skyIsleFrames';
import { bakeSkyIslePines } from './skyIslePines';
import { bakeSkyPlacements } from './placements';

/** Original model intake order for frames, decorative pines and both placement envelopes. */
export const WORLD_PLACEMENT_INPUTS: readonly string[] = SKY_ISLE_MODELS.map(model => HD_URLS[model]);
/** Original logical JSON handoffs, retained here as owned bytes rather than source-file prerequisites. */
export const WORLD_PLACEMENT_FILES: readonly string[] = ['data/skyIsleFrames.json', 'data/skyIslePines.json', 'data/placements.json'];

/** Derive the original frame -> pine -> placement chain from one explicit native model bank. */
export async function skyWorldPlacementSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== WORLD_PLACEMENT_INPUTS.length || WORLD_PLACEMENT_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky world placement input inventory differs');
  }
  const read = (name: string): Uint8Array => {
    const bytes = inputs.get(name); if (bytes === undefined) throw new Error(`Missing declared Sky placement model ${name}`); return bytes;
  };
  const frames = await bakeSkyIsleFrames(read), pines = await bakeSkyIslePines(read, frames);
  const placements = await bakeSkyPlacements(read, frames, pines), text = new TextEncoder();
  return new Map([
    ['data/skyIsleFrames.json', text.encode(`${JSON.stringify(frames, null, 2)}\n`)],
    ['data/skyIslePines.json', text.encode(`${JSON.stringify(pines, null, 2)}\n`)],
    ['data/placements.json', text.encode(`${JSON.stringify(placements)}\n`)],
  ]);
}
