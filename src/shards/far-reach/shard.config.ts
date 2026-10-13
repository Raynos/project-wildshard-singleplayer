import navigation from './data/navigation.generated.json' with { type: 'json' };
import bossStages from './data/bossStages.json' with { type: 'json' };
import { SKY_REACH_RUNTIME_COST } from './data/budgets';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { SKY_QUESTS } from './data/quests';
import { SKY_LEDGER } from './data/ledger';
import { SKY_ITEMS } from './data/items';
import { SKY_SPAWNS } from './data/spawns';
import { SKY_STATE } from './data/state';
import { AUDIO } from './data/audio';
import { SKY_MOVER_VIEWS } from './data/moverViews';
import { SKY_MODES } from './data/modes';
import { MOVERS } from './data/movers';
import { LIFT_MODULE } from './data/liftModule';
import { BRIDGE_MODULE } from './data/bridgeModule';
import isletRows from './data/islets.generated.json' with { type: 'json' };
import { RISING_ISLETS } from './world/islets';
import { ISLET_LIFTS } from './data/isletLift';
import isleProps from './data/props.json' with { type: 'json' };
import { DECK_WOOD_GRAPH, HOVER_FRAME_GRAPH } from './data/bridgeLook';
import { SHACK_GRAPHS } from './data/shackLook';
import { CLUMP_GRAPH, FLOWER_GRAPH } from './data/dressingLook';
import { FALL_GRAPH } from './data/fallLook';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// SF49-g (G99 / G183) and SF8c's socketLift: every entry meets the road over the cloud sea's void (no ground below y = 0
// anywhere at an edge), so each is a `socketLift`: the platform's socket deck, then a static approach over a stone lip
// (top y = 0, across the socket's full 8 m inner line) to the Rising Islet resting at its road stop; the islet rides its
// chains to the gate isle, whose walk strips are the onward route's playable ground. The islets and their stationary road
// gates are this shardfile's compiled `movers` (one admitted module, fixed ride driver); the trusted runtime installs
// exactly these rows (runtime/movers.ts). world/islets.ts is the one source of the geometry.

const base = emptyShardfile({ slug: 'far-reach', name: 'Sky Reach', author: 'Wildshard', revision: 1, seed: 6417 });
const lifts = new Map(ISLET_LIFTS.map((entry) => [entry.edge, entry.lift]));
const wasm = (module: { hash: string; bytes: number }) => ({ hash: module.hash, kind: 'wasm', compressed: module.bytes, decoded: module.bytes, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base, navigation: navigation.navigation, serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + navigation.files.reduce((sum, file) => sum + file.decoded, 0) }, accent: 'pink', runtime: { entry: 'runtime/index.ts', cost: SKY_REACH_RUNTIME_COST, binds: ['quests', 'ledger', 'state', 'items', 'spawns', 'modes', 'props', 'clientChannels'], spawns: SKY_SPAWNS }, audio: AUDIO, directors: [bossStages],
  // the material graphs the runtime draws its own meshes in (runtime/index.ts): the rope decks' wood, the hover frames' glow,
  // the shacks' four kinds, the dressing's clumps and flowers, the falls
  look: { ...base.look, materials: { ...base.look.materials, 'deck-wood': { family: 'graph', graph: DECK_WOOD_GRAPH }, 'hover-frame': { family: 'graph', graph: HOVER_FRAME_GRAPH },
    'dressing-clump': { family: 'graph', graph: CLUMP_GRAPH }, 'dressing-flower': { family: 'graph', graph: FLOWER_GRAPH }, falls: { family: 'graph', graph: FALL_GRAPH },
    ...Object.fromEntries(Object.entries(SHACK_GRAPHS).map(([kind, graph]) => [`shack-${kind}`, { family: 'graph', graph }])) } },
  clientChannels: SKY_MOVER_VIEWS, modes: SKY_MODES, quests: SKY_QUESTS, ledger: SKY_LEDGER, state: SKY_STATE, items: SKY_ITEMS,
  entryways: base.entryways.map(({ edge, at, width }) => {
    const lift = lifts.get(edge); if (lift === undefined) throw new Error(`Sky Reach entry ${edge} has no Rising Islet`);
    return { edge, at, width, kind: 'socketLift' as const, lift };
  }),
  // The authored clips declare every bridge, islet and gate; both hosts install this admitted order once.
  movers: MOVERS,
  // the twelve static islands' compiled props tiles (generators/isleProps.ts), drawn by the runtime (runtime.binds props)
  tiles: isleProps.tiles, files: [wasm(BRIDGE_MODULE), wasm(LIFT_MODULE), ...navigation.files, ...isleProps.files], critical: [BRIDGE_MODULE.hash, LIFT_MODULE.hash, ...navigation.critical],
  budgets: { ...base.budgets, sim: { resident: 1_000_000 + navigation.files.reduce((sum, file) => sum + file.decoded, 0), compressed: LIFT_MODULE.bytes + BRIDGE_MODULE.bytes + navigation.files.reduce((sum, file) => sum + file.compressed, 0) } },
  sim: { ...base.sim, scripts: [BRIDGE_MODULE.hash, LIFT_MODULE.hash] },
  props: { version: 1, family: 'toon', tiles: isleProps.props.tiles, panels: [], models: [], far: null, textures: [],
    colliders: [...RISING_ISLETS.map((entry) => ({ id: `landing.${entry.edge}`, panel: null, initialActive: true, shapes: [{ ...entry.landing }] })),
      ...RISING_ISLETS.map((entry) => ({ id: `gate-isle.${entry.edge}`, panel: null, initialActive: true, shapes: isletRows.entries.flatMap(row => row.edge === entry.edge ? row.strips.map(strip => ({ ...strip, kind: 'box' as const, surface: 'grass' as const })) : []) }))] } });
