// G532 (4): Template 2's ground drawn by the platform's baked tiles: world.py's ground tiles (ground.glb) with its Cycles
// AO and sun-bounce lightmaps, in the `ground` look. world.glb keeps the same ground as collision, edge and far-proxy
// ground only (`undrawn` in shard.config.ts). The CLI reads the declared blobs; this sidecar opens no file.
import { parse } from 'valibot';
import { BakedTilesSchema } from '@wildshard/format/bakedTiles';
import { parseClientPlan } from '@wildshard/format/clientPlan';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';

const lightmap = (param: string, file: string) => ({ param, source: { phone: { file }, desktop: { file } }, channel: 0, anisotropy: 4 } as const);

/** The game's sun is fixed at 40 degrees up (look.day, dayOverride 0.4); the bake's sun is that sun. Three adds a bounce
 *  map as irradiance, a Cycles indirect bake is irradiance over pi: the gain carries both that and the bake's 2x. */
export const GROUND_TILES = parse(BakedTilesSchema, {
  id: 'ground', glb: { file: 'world/ground.glb' }, tiles: { phone: 'ground_', desktop: 'ground_' }, look: 'ground', drop: 0,
  meshPrefix: 'baked-', sky: true, toonDay: false, lightmaps: [lightmap('ao', 'world/lm-ao.png'), lightmap('bounceMap', 'world/lm-bounce.png')],
  sun: { param: 'bounce', referenceY: 0.649, gain: 2 / Math.PI }, instances: null,
});

export const output = {
  blobs: [{ name: 'world/ground.glb', kind: 'glb', source: 'assets/ground.glb' }, { name: 'world/lm-ao.png', kind: 'image', source: 'assets/lm-ao.png' },
    { name: 'world/lm-bounce.png', kind: 'image', source: 'assets/lm-bounce.png' }],
  platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
    ['client/plan', parseClientPlan({ version: 1, features: [{ kind: 'world.baked', rows: [GROUND_TILES] }] })],
  ])),
} satisfies ProjectOutput;
