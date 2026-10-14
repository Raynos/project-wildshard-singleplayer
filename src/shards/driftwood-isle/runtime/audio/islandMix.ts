// SHARD-PLATFORM M3 (audio rows): Driftwood Isle's ambience mix as data (runtime/audio/ambience.ts runs it through
// runtime/audio/ambienceMix): the surf's shoreline emitter and the waterfall's, the zone weights, every bed's level,
// the occlusion of the hold and the cave, the reverb rooms, the diag, the dominant zone and the one-shots (the swells on the
// surf, the jungle birds, the cave drips). Names: the profile's zones (`jungle.x`, `cave.inner` …), levels (`level.surf`)
// and wet sends (`wet.hold`); the ports `ground`, `sea`, `night`, `underwater`, `t`, `windTime`, `windStrength`, the
// bounds `holdBox` / `caveBox`, the points `fall` and `cave`, the palms' nearness `palms.sum` / `.dx` / `.dz`.
import type { AmbienceMixRows } from './ambienceMix';

/** The island's dominant zones. */
export type IslandZone = 'sea' | 'beach' | 'palms' | 'jungle' | 'cove' | 'lookout' | 'hold' | 'cave' | 'shrine';

/** Driftwood's mix: the beds of ./islandBeds, the zone weights (the hold and the cave muffle the outdoor beds and feed
 *  their reverbs, the shrine court its own), the levels and the one-shots. */
export const ISLAND_MIX: AmbienceMixRows<IslandZone> = {
  warm: ['noise-pink', 'noise-white', 'bubble-bed'],
  prewarm: ['bubble-bed', 'ir-shrine', 'ir-cave', 'ir-hold'],
  underwater: [500, 0.15],
  nodes: [
    { id: 'occl', out: 'ambient', filter: ['lowpass', 20000, 0.5] },
    { id: 'surfPan', out: 'occl', panner: [12, 1, 400], follow: { zone: 'shore', rays: 256, step: 2, refine: 3, diag: 'shoreDist' } },
    { id: 'fallPan', out: 'ambient', panner: [6, 1.1, 250], at: 'fall' },
  ],
  bounds: [{ id: 'holdBox', from: 'wreck', key: 'holdBounds' }, { id: 'caveBox', from: 'cove', key: 'caveBounds' }],
  near: [{ id: 'palms', radius: 22 }],
  
  
  steer: [{ pan: 'flutter', toward: 'palms', width: 0.7, tau: 0.2 }],
  
  rooms: { from: 'sfx', to: 'world', list: [
    { id: 'hold', ir: 'ir-hold', weight: 'hold', level: ['*', 'wet.hold', 'hold', 'dry'] },
    { id: 'cave', ir: 'ir-cave', weight: 'cave', level: ['*', 'wet.cave', 'cave', 'dry'], feeds: ['fallPan'] },
    { id: 'shrine', ir: 'ir-shrine', weight: 'shrine', level: ['*', 'wet.shrine', 'shrine', 'dry'] },
  ] },
  
  
  zoneNames: ['sea','beach','palms','jungle','cove','lookout','hold','cave','shrine'],
};
