import piers from '../data/pierScenes.generated.json' with { type: 'json' };
import landings from '../data/entryFloors.generated.json' with { type: 'json' };
import wreck from '../data/wreckBake.json' with { type: 'json' };
import cove from '../data/coveBake.json' with { type: 'json' };
import bridges from '../data/bridgeBake.json' with { type: 'json' };
import trailside from '../data/trailsideBake.json' with { type: 'json' };
import hut from '../data/hutBake.json' with { type: 'json' };
import lookout from '../data/lookoutBake.json' with { type: 'json' };
import shrine from '../data/shrineBake.json' with { type: 'json' };
import { ENTRY_DECKS } from './entryDecks';
import { STATIC_BOAT, SHORE_BOULDERS } from './staticWorld';
import { BRIDGE } from './worldSites';
import { OCEAN_FILES } from './oceanFiles';
import { OCEAN_SURFACE } from './oceanLook';

export interface Box { readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly rot: number; readonly yTop: number; readonly yBottom: number }
interface Site { readonly origin: { readonly x: number; readonly y: number; readonly z: number }; readonly colliders: readonly Box[] }

const placedSite = ({ origin, colliders }: Site): Box[] => colliders.map(box => ({ ...box, x: box.x + origin.x, z: box.z + origin.z, yTop: box.yTop + origin.y, yBottom: box.yBottom + origin.y }));
/** The island span's baked colliders (its key as game/models/ropeDeckSite `key`: the island span has the default width). */
function islandBridge(): readonly Box[] {
  const key = JSON.stringify([BRIDGE.a, BRIDGE.b, 1.4, BRIDGE.sag]), row = bridges.find(candidate => candidate.key === key);
  if (row === undefined) throw new Error('Missing baked island bridge');
  return row.colliders;
}
const bridge = islandBridge();

/** Every static box standing in the sea the world build places (piers and jetties, the entry decks' slabs, the moored
 *  boat, the shore boulders, the sites, the wreck, the trail, the bridge, the sea cave), kept only where it pierces the
 *  foam band and rounded to the centimetre: the ocean stamps its foam rings around these (`WaterSurface.foamAround`). */
function foam(): Box[] {
  const { foamBand } = OCEAN_SURFACE.floor, level = OCEAN_FILES.level, cm = (value: number): number => Math.round(value * 100) / 100;
  const edges = new Set(landings.rows.map(row => row.edge));
  const boxes: Box[] = [...ENTRY_DECKS.filter(row => edges.has(row.edge)).map(row => row.slab), ...piers.facts.flatMap(row => row.boxes), ...STATIC_BOAT.walls,
    ...SHORE_BOULDERS.boxes, ...placedSite(hut), ...placedSite(lookout), ...wreck.colliders, ...placedSite(shrine.world), ...trailside.colliders,
    ...bridge, ...cove.native.colliders];
  return boxes.filter(b => b.yBottom < level + foamBand && b.yTop > level - foamBand)
    .map(({ x, z, hw, hd, rot, yTop, yBottom }) => ({ x: cm(x), z: cm(z), hw: cm(hw), hd: cm(hd), rot: cm(rot), yTop: cm(yTop), yBottom: cm(yBottom) }));
}
export const OCEAN_FOAM = foam();
