import { HORIZON_RADIUS } from '@wildshard/format/contentBounds';
import { SHORE_REVETMENT_INNER_FACE } from '@wildshard/engine/sim/shore';
import { OCEAN } from './worldSites';
import { COVE_MODELS } from './coveModels';
import coveComposition from '../data/coveComposition.json' with { type: 'json' };
import islandAssets from '../data/islandAssets.json' with { type: 'json' };
import { WORLD_ASSEMBLY } from './worldAssembly';
import { collectionRows } from './collections';
import { STATIC_BOAT, WORLD_GULL_PERCHES, SHORE_BOULDERS, ENTRY_FLOORS } from './staticWorld';
import { NATIVE_VIEW } from './nativeView';
import { FIXED_DRAW_ROWS } from './modelFiles';
import { ISLAND_KNOBS } from './tiers';
import { ENTRY_DECKS } from './entryDecks';
import npcScenes from '../data/npcScenes.generated.json' with {type:'json'};
import foliage from '../data/foliagePlacements.generated.json' with { type: 'json' };
import cumulusPuffs from '../data/cumulusPuffs.json' with { type: 'json' };
import coveBake from '../data/coveBake.json' with { type: 'json' };
import shrineBake from '../data/shrineBake.json' with { type: 'json' };
import hut from '../data/hutBake.json' with { type: 'json' };
import lookout from '../data/lookoutBake.json' with { type: 'json' };
import trailside from '../data/trailsideBake.json' with { type: 'json' };
import piers from '../data/piers.generated.json' with { type: 'json' };
import { GULL_FLOCK } from './gullsLook';
import { OCEAN_SURFACE } from './oceanLook';
import { OCEAN_FILES } from './oceanFiles';
import { OCEAN_FOAM } from './oceanFoam';


const {audioBounds: _audioBounds, ...runtimeCoveComposition} = coveComposition;

/** Build-only client row assembly; the canonical registry validates it at publication. */
export const DRIFTWOOD_CLIENT_SECTIONS: readonly {name:string;value:unknown}[] = [
  {name:'custom/collections',value:collectionRows()},
  {name:'custom/cumulusPuffs', value:cumulusPuffs},
  {name:'custom/gullFlock', value:GULL_FLOCK},
  {name:'custom/oceanSurface', value:{surface:{...OCEAN_SURFACE,params:{level:OCEAN.level,deepDepth:OCEAN.deepDepth,shallow:[...OCEAN.shallowColor],deep:[...OCEAN.deepColor],edgeInset:SHORE_REVETMENT_INNER_FACE,seaEnd:HORIZON_RADIUS}}, files:OCEAN_FILES, foam:OCEAN_FOAM}},
  {name:'custom/fixedLayouts', value:{assembly:WORLD_ASSEMBLY,nativeView:NATIVE_VIEW, fixedDraws:FIXED_DRAW_ROWS, shadowTiers:Object.fromEntries(Object.entries(ISLAND_KNOBS).map(([tier,row])=>[tier,{bush:row.bushShadows,boulder:row.boulderShadows}])), entryDecks:ENTRY_DECKS, entryFloors:ENTRY_FLOORS, foliage:{seed:foliage.seed,tiers:foliage.tiers}, npcScenes, gullPerches:WORLD_GULL_PERCHES, boat:STATIC_BOAT, shoreBoulders:SHORE_BOULDERS, cove:{...coveBake,composition:runtimeCoveComposition},island:{...islandAssets,models:COVE_MODELS}, shrine:shrineBake, hut, lookout, piers:piers.map(({paramKey,colliders})=>({paramKey,colliders}))}},
  {name:'custom/trailside', value:trailside},
];
