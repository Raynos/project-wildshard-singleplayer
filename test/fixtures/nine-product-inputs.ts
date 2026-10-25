// oxlint-disable-next-line import/no-nodejs-modules -- The declaration fixture owns and removes its isolated byte cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind only the real author project's source root.
import { resolve } from 'node:path';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { readNineProductInputs } from '../../src/shards/nine-dragon-stack/generators/product';
import { nineProductFrom } from '../../src/shards/nine-dragon-stack/generators/productDefinition';

async function sourceInputs(): Promise<Awaited<ReturnType<typeof readNineProductInputs>>> {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-declaration-'));
  try { return await readNineProductInputs(createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'b'.repeat(64), new Map(), cache, [{ prefix: '/assets/', directory: resolve('public/assets') }])); }
  finally { rmSync(cache, { recursive: true, force: true }); }
}

export const inputs = await sourceInputs();
export const casts = inputs.casts;
export const ownedWorld = inputs.ownedWorld;
export const world = ownedWorld.metadata;
export const layout = ownedWorld.layout;
export const scenes = inputs.scenes;
export const { NINE_SCENE_BLOBS, NINE_WORLD_SCENES, LAYOUT_PLACEMENT_BLOBS, SET_TILES, LAYOUT_PLACEMENTS, SET_PLACEMENTS, LION_PLACEMENTS } = scenes;
export const heldProfile = inputs.held.profile;
export const heldGraphFiles = inputs.held.files;
/** Exercise the same pure factory with actual source results and the supplied fixed-page view contract. */
export function nineProduct(movers: { readonly pages: number } = { pages: 1 }): ReturnType<typeof nineProductFrom> {
  return nineProductFrom(inputs, movers);
}
// oxlint-disable-next-line import/no-default-export -- Existing declaration-only tests borrow this real source result.
export default nineProduct();
