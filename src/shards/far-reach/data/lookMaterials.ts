import { SWARD_ATLAS_FILE, SWARD_ATLAS_SAMPLER } from './swardAtlas';
import { DECK_WOOD_GRAPH, HOVER_FRAME_GRAPH, POST_WEATHER_GRAPH } from './bridgeLook';
import { CROWN_DAIS_GRAPH, FAN_SILK_GRAPH, KEEPER_SCARF_GRAPH, LANTERN_GLOW_GRAPH, TREE_BARK_GRAPH } from './paintLook';
import { SKY_ISLE_GRAPH, SKY_ISLE_KEEL_GRAPH } from './skyIsleLook';
import { SHACK_GRAPHS } from './shackLook';
import { BOULDER_GRAPH, CLUMP_GRAPH, FLOWER_GRAPH } from './dressingLook';
import { ISLE_GRAPHS, ISLE_MAPS } from './isleLook';
import { FALL_GRAPH } from './fallLook';
import { MILL_CANVAS_GRAPH, MILL_TOWER_GRAPH } from './millLook';
import { RAY_WAKE_GRAPH } from './rayWakeLook';
import { WIND_GRAPHS } from './windLook';
import { STORM_RING_GRAPH } from './stormLook';
import { MEADOW_GRAPH } from './meadowLook';

/**
 * The shardfile's look materials (shard.config.ts `look.materials`), every one a material graph the runtime draws its own
 * meshes in (runtime/index.ts): the rope decks' wood, the hover frames' glow, the shacks' four kinds, the dressing's clumps,
 * flowers and boulders, the islands' paint, the falls; and the looks over a model's own map (meshMap, bound per model by
 * world/looks.ts skyMappedLook): the crown dais, the lantern, the keeper's scarf, the fan's silk, the anchor posts, the
 * trees' bark, the sky isles and the playable islands' keels, the mill, the rays' wake, the storm's ring, the meadow and the
 * wind.
 */
const graphs: Readonly<Record<string, unknown>> = {
  'deck-wood': DECK_WOOD_GRAPH, 'hover-frame': HOVER_FRAME_GRAPH, 'dressing-clump': CLUMP_GRAPH, 'dressing-flower': FLOWER_GRAPH, 'dressing-stone': BOULDER_GRAPH, falls: FALL_GRAPH,
  ...ISLE_GRAPHS,
  'crown-dais': CROWN_DAIS_GRAPH, 'lantern-glow': LANTERN_GLOW_GRAPH, 'keeper-scarf': KEEPER_SCARF_GRAPH, 'fan-silk': FAN_SILK_GRAPH, 'post-weather': POST_WEATHER_GRAPH, 'tree-bark': TREE_BARK_GRAPH, 'sky-isle': SKY_ISLE_GRAPH, 'sky-isle-keel': SKY_ISLE_KEEL_GRAPH, 'mill-tower': MILL_TOWER_GRAPH, 'mill-canvas': MILL_CANVAS_GRAPH, 'ray-wake': RAY_WAKE_GRAPH, 'storm-ring': STORM_RING_GRAPH, meadow: MEADOW_GRAPH, ...WIND_GRAPHS,
  ...Object.fromEntries(Object.entries(SHACK_GRAPHS).map(([kind, graph]) => [`shack-${kind}`, graph])),
};
export const SKY_LOOK_MATERIALS = Object.fromEntries(Object.entries(graphs).map(([id, graph]) => [id, { family: 'graph', graph }]));

/** The islands' and boulders' library maps tile (data/skyMapSources.json's sampler rows); the sward atlas keeps its own. */
export const SKY_LOOK_SAMPLERS = { [ISLE_MAPS.rock]: { wrap: 'repeat', anisotropy: 4 }, [ISLE_MAPS.meadow]: { wrap: 'repeat', anisotropy: 4 }, [SWARD_ATLAS_FILE.hash]: SWARD_ATLAS_SAMPLER } as const;
