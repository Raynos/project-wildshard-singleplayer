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
import { DRIFTWOOD_ASSET_NAMES } from './assets';
import coverFiles from '../data/islandCoverFiles.json' with { type: 'json' };

const at = (name: string) => ({ url: `${BLENDER_MODELS}${name}` });
const lightmap = (param: string, name: string) => ({ param, source: { phone: at(`${name}.phone.webp`), desktop: at(`${name}.webp`) }, channel: 0, anisotropy: 4 });
const cells = { size: 16, pad: 4 };
/** E156: the island cover (generators/islandCover.ts) as vertex wear rows: its ground map, then per part aCover (rgba) and
 *  aCoverSide, part 0 the faceted ground and one part per baked tile */
const coverWear = ({ url, texture, groundRect, parts }: (typeof coverFiles)['phone']) => {
  const file = DRIFTWOOD_ASSET_NAMES[url]; if (file === undefined) throw new Error(`Missing named asset: ${url}`);
  return { file, texture, rect: groundRect, parts, attributes: [{ name: 'aCover', size: 4 }, { name: 'aCoverSide', size: 1 }] };
};
/** a cover look's fade (start, end, grow): it grows in from `near` to `near + grow`, out by `far` */
const fade = (reach: { near: number; far: number; grow: number }) => [reach.near + reach.grow, reach.far, reach.grow];
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
  // the cover the ground and tiles wear; the cover looks fade into its ground map
  wear: { files: { phone: coverWear(coverFiles.phone), desktop: coverWear(coverFiles.desktop) }, ground: true, looks: [
    { look: ISLAND_LOOKS.cover, fade: { phone: fade(ISLAND_TIERS.phone.cover), desktop: fade(ISLAND_TIERS.desktop.cover) } },
    { look: ISLAND_LOOKS.coverBig, fade: { phone: fade(ISLAND_TIERS.phone.big), desktop: fade(ISLAND_TIERS.desktop.big) } }] },
});
