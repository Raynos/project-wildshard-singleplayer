// G532 (4): Template 2's ground drawn by the platform's baked tiles: world.py's ground tiles (ground.glb) with its Cycles
// AO and sun-bounce lightmaps, encoded to KTX2 here, in the `ground` look. world.glb keeps the same ground as collision,
// edge and far-proxy ground only (`undrawn` in shard.config.ts).
// oxlint-disable-next-line import/no-nodejs-modules -- Build-only: reads the Blender bake's committed ground and lightmaps.
import { readFileSync } from 'node:fs';
import { parse } from 'valibot';
import { BakedTilesSchema } from '@wildshard/format/bakedTiles';
import { parseClientPlan } from '@wildshard/format/clientPlan';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { bakeWorldTexture } from '@wildshard/sdk/bake/textureWasm';
import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';

const asset = (name: string): Uint8Array => Uint8Array.from(readFileSync(new URL(`../assets/${name}`, import.meta.url)));
const lightmap = async (param: string, name: string) => {
  const file = `world/${name}.ktx2`;
  return { blob: nameBlob(file, 'ktx2', await bakeWorldTexture(asset(`${name}.png`), 'linear')),
    row: { param, source: { phone: { file }, desktop: { file } }, channel: 0, anisotropy: 4 } };
};
const maps = [await lightmap('ao', 'lm-ao'), await lightmap('bounceMap', 'lm-bounce')];

/** The game's sun is fixed at 40 degrees up (look.day, dayOverride 0.4); the bake's sun is that sun. Three adds a bounce
 *  map as irradiance, a Cycles indirect bake is irradiance over pi: the gain carries both that and the bake's 2x. */
export const GROUND_TILES = parse(BakedTilesSchema, {
  id: 'ground', glb: { file: 'world/ground.glb' }, tiles: { phone: 'ground_', desktop: 'ground_' }, look: 'ground', drop: 0,
  meshPrefix: 'baked-', sky: true, toonDay: false, lightmaps: maps.map(map => map.row),
  sun: { param: 'bounce', referenceY: 0.649, gain: 2 / Math.PI }, instances: null,
});

const blobs = emitNamedBlobs([nameBlob('world/ground.glb', 'glb', asset('ground.glb')), ...maps.map(map => map.blob)]);
export const output = { namedFiles: blobs.files, assets: blobs.assets, platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
  ['client/plan', parseClientPlan({ version: 1, features: [{ kind: 'world.baked', rows: [GROUND_TILES] }] })],
])) } satisfies ProjectOutput;
