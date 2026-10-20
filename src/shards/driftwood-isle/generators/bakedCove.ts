// G532 (4): the Blender spawn cove as one baked-tiles row (format/bakedTiles; the platform's `world.baked` feature draws it):
// its terrain tiles in the island's graph toon look with the Cycles AO and bounce lightmaps, and its prototypes placed
// instanced by family with their collider boxes. The numbers are islandRows.ts's and islandFacts.generated.json's.
import { parse } from 'valibot';
import { BakedTilesSchema } from '@wildshard/format/bakedTiles';
import PLAN_FILES from '../data/islandPlanFiles.json' with { type: 'json' };
import ISLAND_FACTS from '../data/islandFacts.generated.json' with { type: 'json' };
import { COVE_MODELS } from './coveModels';
import { ISLAND_LOOKS } from './islandLook';
import { ISLAND_LOOK, ISLAND_TIERS } from './islandRows';
import { BLENDER_MODELS } from './blenderArea';
import { WORLD_DROP } from './sea';

const at = (name: string) => ({ url: `${BLENDER_MODELS}${name}` });
const lightmap = (param: string, name: string) => ({ param, source: { phone: at(`${name}.phone.webp`), desktop: at(`${name}.webp`) }, channel: 0, anisotropy: 4 });
const cells = { size: 16, pad: 4 };
const plan = (tier: 'phone' | 'desktop') => ({ source: { url: PLAN_FILES[tier].url }, bytes: PLAN_FILES[tier].bytes, used: PLAN_FILES[tier].used });

export const BAKED_COVE = parse(BakedTilesSchema, {
  id: 'cove', glb: at('island.glb'), tiles: { phone: 'terrainlo_', desktop: 'terrain_' }, look: ISLAND_LOOKS.terrain,
  drop: WORLD_DROP, meshPrefix: ISLAND_LOOK.meshPrefix, sky: false, toonDay: true,
  lightmaps: [lightmap('ao', 'lm-ao'), lightmap('bounceMap', 'lm-bounce')],
  sun: { param: 'bounce', referenceY: ISLAND_FACTS.bake.sunY, gain: ISLAND_FACTS.bake.bounceGain },
  instances: {
    table: at('placements.bin'), protos: { file: 'world/island/protos.glb' }, plan: { phone: plan('phone'), desktop: plan('desktop') },
    names: ISLAND_FACTS.protos.map(proto => proto.name),
    looks: {
      cast: { look: ISLAND_LOOKS.props, cull: { phone: { flat: true, casters: 4 }, desktop: { flat: true, casters: 4 } } },
      cover: { look: ISLAND_LOOKS.cover, cull: { phone: { far: ISLAND_TIERS.phone.cover.far + 1, cells }, desktop: { far: ISLAND_TIERS.desktop.cover.far + 1, cells } } },
      big: { look: ISLAND_LOOKS.coverBig, cull: { phone: { far: ISLAND_TIERS.phone.big.far + 1, cells }, desktop: { far: ISLAND_TIERS.desktop.big.far + 1, cells } } },
    },
    families: COVE_MODELS, surface: 'wood', unclaimed: 'Cove rocks',
  },
});
