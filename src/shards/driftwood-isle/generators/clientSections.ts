import coverFiles from '../data/islandCoverFiles.json' with { type: 'json' };
import { HORIZON_RADIUS } from '@wildshard/format/contentBounds';
import { SHORE_REVETMENT_INNER_FACE } from '@wildshard/engine/sim/shore';
import { OCEAN } from './worldSites';
import coveComposition from '../data/coveComposition.json' with { type: 'json' };
import { WORLD_ASSEMBLY } from './worldAssembly';
import { collectionRows } from './collections';
import { STATIC_BOAT, WORLD_GULL_PERCHES, SHORE_BOULDERS } from './staticWorld';
import { NATIVE_VIEW } from './nativeView';
import { FIXED_DRAW_ROWS } from './modelFiles';
import { DRIFTWOOD_ASSET_NAMES } from './assets';
import { ISLAND_KNOBS } from './tiers';
import { ENTRY_DECKS } from './entryDecks';
import npcScenes from '../data/npcScenes.generated.json' with {type:'json'};
import foliage from '../data/foliagePlacements.generated.json' with { type: 'json' };
import islandFacts from '../data/islandFacts.generated.json' with { type: 'json' };
import cumulusPuffs from '../data/cumulusPuffs.json' with { type: 'json' };
import coveBake from '../data/coveBake.json' with { type: 'json' };
import shrineBake from '../data/shrineBake.json' with { type: 'json' };
import hut from '../data/hutBake.json' with { type: 'json' };
import lookout from '../data/lookoutBake.json' with { type: 'json' };
import piers from '../data/piers.generated.json' with { type: 'json' };
import { GULL_FLOCK } from './gullsLook';
import { OCEAN_SURFACE } from './oceanLook';
import { OCEAN_FILES } from './oceanFiles';
import { OCEAN_FOAM } from './oceanFoam';


const {audioBounds: _audioBounds, audioFall: _audioFall, audioCave: _audioCave, ...runtimeCoveComposition} = coveComposition;

/** O7: the lowered sea as the client plan's `world.water` row: its baked grid per tier, floor and foam, clipped out
 *  under each whole road deck (G170: the socket and its landing, in the landings' edge order), its night param lent from
 *  the toon lighting, whose sea level is the sea's. */
/** a product file name for an authored asset label (the build's asset index; the runtime reads names only) */
const named = (label: string): string => { const name = DRIFTWOOD_ASSET_NAMES[label]; if (name === undefined) throw new Error(`Missing named asset: ${label}`); return name; };
/** E156: the island cover (generators/islandCover.ts) as vertex wear rows: its ground map, then per part aCover (rgba) and aCoverSide */
const coverWear = ({ url, texture, groundRect, parts }: (typeof coverFiles)['phone']) => ({ file: named(url), texture, rect: groundRect, parts,
  attributes: [{ name: 'aCover', size: 4 }, { name: 'aCoverSide', size: 1 }] });
export const OCEAN_WATER_ROW = { id: 'sea',
  surface: { ...OCEAN_SURFACE, params: { level: OCEAN.level, deepDepth: OCEAN.deepDepth, shallow: [...OCEAN.shallowColor], deep: [...OCEAN.deepColor], edgeInset: SHORE_REVETMENT_INNER_FACE, seaEnd: HORIZON_RADIUS } },
  draw: { grid: { phone: { url: OCEAN_FILES.phone }, desktop: { url: OCEAN_FILES.desktop } }, attributes: { _depth: 'aDepth', _seed: 'aSeed' },
    level: OCEAN_FILES.level, floor: { url: OCEAN_FILES.floor }, dry: ENTRY_DECKS.map(({ rect }) => rect), foam: OCEAN_FOAM,
    lent: { night: 'uToonNight' }, toonSeaLevel: true } } as const;

/** Build-only client row assembly; the canonical registry validates it at publication. */
export const DRIFTWOOD_CLIENT_SECTIONS: readonly {name:string;value:unknown}[] = [
  {name:'custom/collections',value:collectionRows()},
  {name:'custom/cumulusPuffs', value:cumulusPuffs},
  {name:'custom/gullFlock', value:GULL_FLOCK},
  {name:'custom/fixedLayouts', value:{coverFiles:{phone:coverWear(coverFiles.phone),desktop:coverWear(coverFiles.desktop)},assembly:WORLD_ASSEMBLY,nativeView:NATIVE_VIEW, fixedDraws:FIXED_DRAW_ROWS.map(({ slot, channels }) => ({ slot, file: named(`fixed:${slot}`), channels })), shadowTiers:Object.fromEntries(Object.entries(ISLAND_KNOBS).map(([tier,row])=>[tier,{bush:row.bushShadows,boulder:row.boulderShadows}])), foliage:{seed:foliage.seed,tiers:foliage.tiers,islandPalms:islandFacts.extraPalms}, npcScenes, gullPerches:WORLD_GULL_PERCHES, boat:STATIC_BOAT, shoreBoulders:SHORE_BOULDERS, cove:{...coveBake,composition:runtimeCoveComposition}, shrine:shrineBake, hut, lookout, piers:piers.map(({paramKey,colliders})=>({paramKey,colliders}))}},
];
