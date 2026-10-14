/** The island's dominant zones. */
export type IslandZone = 'sea' | 'beach' | 'palms' | 'jungle' | 'cove' | 'lookout' | 'hold' | 'cave' | 'shrine';

/** Driftwood's mix: the beds of ./islandBeds, the zone weights (the hold and the cave muffle the outdoor beds and feed
 *  their reverbs, the shrine court its own), the levels and the one-shots. */
export const ISLAND_ROUTING = {
  listener: 'context',
  warm: ['noise-pink', 'noise-white', 'bubble-bed'],
  prewarm: ['bubble-bed', 'ir-shrine', 'ir-cave', 'ir-hold'],
  underwater: [500, 0.15],
  bounds:[],near:[],probes:[{kind:'bounds',id:'holdBox',from:'wreck',key:'holdBounds'},{kind:'bounds',id:'caveBox',from:'cove',key:'caveBounds'},{kind:'near',id:'palms',radius:22}],
  
  
  steer: [{ pan: 'flutter', toward: 'palms', width: 0.7, tau: 0.2 }],
  
  rooms: { from: 'sfx', to: 'world', list: [
    { id: 'hold', ir: 'ir-hold', weight: 'hold', level: ['*', 'wet.hold', 'hold', 'dry'] },
    { id: 'cave', ir: 'ir-cave', weight: 'cave', level: ['*', 'wet.cave', 'cave', 'dry'], feeds: ['fallPan'] },
    { id: 'shrine', ir: 'ir-shrine', weight: 'shrine', level: ['*', 'wet.shrine', 'shrine', 'dry'] },
  ] },
  
  
  zoneNames: ['sea','beach','palms','jungle','cove','lookout','hold','cave','shrine'],
};
