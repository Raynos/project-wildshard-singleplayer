/**
 * The minimap's pure row contracts (DS1.1): a named place on the maps, as a level's map palette declares it (the
 * minimap's labels, the full map's pins). The engine's `@wildshard/engine/ui/Minimap` draws them; a shard's `data/`
 * rows declare them.
 */

/** a named place on the maps (the minimap's labels, the full map's pins) */
export interface MapPoi { x: number; z: number; label: string; color: string }
