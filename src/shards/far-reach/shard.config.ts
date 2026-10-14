import { SKY_SECTIONS } from './data/sections';
import { STORM_NOISE } from './data/stormNoise';
import { SWARD_ATLAS_FILE, SWARD_ATLAS_SAMPLER } from './data/swardAtlas';
import skyMaps from './data/skyMaps.json' with { type: 'json' };
import navigation from './data/navigation.generated.json' with { type: 'json' };
import { SKY_REACH_RUNTIME_COST } from './data/budgets';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { SKY_SPAWNS } from './data/spawns';
import { SKY_LIFT_PROMPTS } from './data/liftPrompts';
import { SKY_MOVER_VIEWS } from './data/moverViews';
import { MOVERS } from './data/movers';
import { LIFT_MODULE } from './data/liftModule';
import { FAN_GUST_MODULE } from './data/fanGustModule';
import { BRIDGE_MODULE } from './data/bridgeModule';
import isletRows from './data/islets.generated.json' with { type: 'json' };
import { RISING_ISLETS, ENTRYWAYS } from './data/islets.generated';
import isleProps from './data/props.json' with { type: 'json' };
import { DECK_WOOD_GRAPH, HOVER_FRAME_GRAPH, POST_WEATHER_GRAPH } from './data/bridgeLook';
import { CROWN_DAIS_GRAPH, FAN_SILK_GRAPH, KEEPER_SCARF_GRAPH, LANTERN_GLOW_GRAPH, TREE_BARK_GRAPH } from './data/paintLook';
import { SKY_ISLE_GRAPH, SKY_ISLE_KEEL_GRAPH } from './data/skyIsleLook';
import { SHACK_GRAPHS } from './data/shackLook';
import { BOULDER_GRAPH, CLUMP_GRAPH, FLOWER_GRAPH } from './data/dressingLook';
import { ISLE_GRAPHS, ISLE_MAPS } from './data/isleLook';
import { FALL_GRAPH } from './data/fallLook';
import { MILL_CANVAS_GRAPH, MILL_TOWER_GRAPH } from './data/millLook';
import { RAY_WAKE_GRAPH } from './data/rayWakeLook';
import { WIND_GRAPHS } from './data/windLook';
import { STORM_RING_GRAPH } from './data/stormLook';
import { MEADOW_GRAPH } from './data/meadowLook';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// SF49-g (G99 / G183) and SF8c's socketLift: every entry meets the road over the cloud sea's void (no ground below y = 0
// anywhere at an edge), so each is a `socketLift`: the platform's socket deck, then a static approach over a stone lip
// (top y = 0, across the socket's full 8 m inner line) to the Rising Islet resting at its road stop; the islet rides its
// chains to the gate isle, whose walk strips are the onward route's playable ground. The islets and their stationary road
// gates are this shardfile's compiled `movers` (one admitted module, fixed ride driver); the trusted runtime installs
// exactly these rows (runtime/movers.ts). world/islets.ts is the one source of the geometry.

const base = emptyShardfile({ slug: 'far-reach', name: 'Sky Reach', author: 'Wildshard', revision: 1, seed: 6417 });
const wasm = (module: { hash: string; bytes: number }) => ({ hash: module.hash, kind: 'wasm', compressed: module.bytes, decoded: module.bytes, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base, ...SKY_SECTIONS, navigation: navigation.navigation, serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + navigation.files.reduce((sum, file) => sum + file.decoded, 0) }, accent: 'pink', runtime: { entry: 'runtime/index.ts', cost: SKY_REACH_RUNTIME_COST, binds: ['quests', 'ledger', 'state', 'items', 'spawns', 'modes', 'props', 'clientChannels'], spawns: SKY_SPAWNS },
  // the material graphs the runtime draws its own meshes in (runtime/index.ts): the rope decks' wood, the hover frames' glow,
  // the shacks' four kinds, the dressing's clumps, flowers and boulders, the islands' paint, the falls; and the looks over a model's own map (meshMap, bound per model by
  // world/looks.ts skyMappedLook): the crown dais, the lantern, the keeper's scarf, the fan's silk, the anchor posts, the trees' bark,
  // the sky isles and the playable islands' keels
  look: { ...base.look, materials: { ...base.look.materials, 'deck-wood': { family: 'graph', graph: DECK_WOOD_GRAPH }, 'hover-frame': { family: 'graph', graph: HOVER_FRAME_GRAPH },
    'dressing-clump': { family: 'graph', graph: CLUMP_GRAPH }, 'dressing-flower': { family: 'graph', graph: FLOWER_GRAPH }, 'dressing-stone': { family: 'graph', graph: BOULDER_GRAPH }, falls: { family: 'graph', graph: FALL_GRAPH },
    ...Object.fromEntries(Object.entries(ISLE_GRAPHS).map(([id, graph]) => [id, { family: 'graph', graph }])),
    ...Object.fromEntries(Object.entries({ 'crown-dais': CROWN_DAIS_GRAPH, 'lantern-glow': LANTERN_GLOW_GRAPH, 'keeper-scarf': KEEPER_SCARF_GRAPH, 'fan-silk': FAN_SILK_GRAPH, 'post-weather': POST_WEATHER_GRAPH, 'tree-bark': TREE_BARK_GRAPH, 'sky-isle': SKY_ISLE_GRAPH, 'sky-isle-keel': SKY_ISLE_KEEL_GRAPH, 'mill-tower': MILL_TOWER_GRAPH, 'mill-canvas': MILL_CANVAS_GRAPH, 'ray-wake': RAY_WAKE_GRAPH, 'storm-ring': STORM_RING_GRAPH, meadow: MEADOW_GRAPH, ...WIND_GRAPHS })
      .map(([id, graph]) => [id, { family: 'graph', graph }])),
    ...Object.fromEntries(Object.entries(SHACK_GRAPHS).map(([kind, graph]) => [`shack-${kind}`, { family: 'graph', graph }])) },
    // the islands' and boulders' library maps tile (data/skyMapSources.json's sampler rows)
    samplers: { ...base.look.samplers, [ISLE_MAPS.rock]: { wrap: 'repeat', anisotropy: 4 }, [ISLE_MAPS.meadow]: { wrap: 'repeat', anisotropy: 4 }, [SWARD_ATLAS_FILE.hash]: SWARD_ATLAS_SAMPLER } },
  clientChannels: [...SKY_MOVER_VIEWS, ...SKY_LIFT_PROMPTS],
  entryways: [...ENTRYWAYS],
  // The authored clips declare every bridge, islet and gate; both hosts install this admitted order once.
  movers: MOVERS,
  // the twelve static islands' compiled props tiles (generators/isleProps.ts), drawn by the runtime (runtime.binds props)
  library: [...base.library, ...skyMaps.library, STORM_NOISE.hash, SWARD_ATLAS_FILE.hash], tiles: isleProps.tiles, files: [...skyMaps.files, { ...STORM_NOISE, dependencies: [] }, { ...SWARD_ATLAS_FILE, dependencies: [] }, wasm(BRIDGE_MODULE), wasm(LIFT_MODULE), wasm(FAN_GUST_MODULE), ...navigation.files, ...isleProps.files], critical: [BRIDGE_MODULE.hash, LIFT_MODULE.hash, FAN_GUST_MODULE.hash, ...navigation.critical],
  budgets: { ...base.budgets, library: { ...skyMaps.budget, compressed: skyMaps.budget.compressed + STORM_NOISE.compressed + SWARD_ATLAS_FILE.compressed, resident: skyMaps.budget.resident + STORM_NOISE.decoded + STORM_NOISE.gpu + SWARD_ATLAS_FILE.gpu, downloadAllowance: 8_811_813 + STORM_NOISE.compressed + SWARD_ATLAS_FILE.compressed }, sim: { resident: 1_000_000 + 65_536 + FAN_GUST_MODULE.bytes + navigation.files.reduce((sum, file) => sum + file.decoded, 0), compressed: LIFT_MODULE.bytes + BRIDGE_MODULE.bytes + FAN_GUST_MODULE.bytes + navigation.files.reduce((sum, file) => sum + file.compressed, 0) } },
  sim: { ...base.sim, scripts: [BRIDGE_MODULE.hash, LIFT_MODULE.hash, FAN_GUST_MODULE.hash] },
  props: { version: 1, family: 'toon', tiles: isleProps.props.tiles, panels: [], models: [], far: null, textures: [],
    colliders: [...RISING_ISLETS.map((entry) => ({ id: `landing.${entry.edge}`, panel: null, initialActive: true, shapes: [{ ...entry.landing }] })),
      ...RISING_ISLETS.map((entry) => ({ id: `gate-isle.${entry.edge}`, panel: null, initialActive: true, shapes: isletRows.entries.flatMap(row => row.edge === entry.edge ? row.strips.map(strip => ({ ...strip, kind: 'box' as const, surface: 'grass' as const })) : []) }))] } });
