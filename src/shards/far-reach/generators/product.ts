import { SKY_SECTIONS } from '../data/sections';
import { STORM_NOISE } from '../data/stormNoise';
import { SWARD_ATLAS_FILE } from '../data/swardAtlas';
import skyMaps from '../data/skyMaps.json' with { type: 'json' };
import navigation from '../data/navigation.generated.json' with { type: 'json' };
import { SKY_REACH_RUNTIME_COST } from '../data/budgets';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { SKY_SPAWNS } from '../data/spawns';
import { SKY_LIFT_PROMPTS } from '../data/liftPrompts';
import { SKY_MOVER_VIEWS } from '../data/moverViews';
import { MOVERS } from '../data/movers';
import { LIFT_MODULE } from '../data/liftModule';
import { FAN_GUST_MODULE } from '../data/fanGustModule';
import { BRIDGE_MODULE } from '../data/bridgeModule';
import isletRows from '../data/islets.generated.json' with { type: 'json' };
import { RISING_ISLETS, ENTRYWAYS } from '../data/islets.generated';
import isleProps from '../data/props.json' with { type: 'json' };
import { SKY_LOOK_MATERIALS, SKY_LOOK_SAMPLERS } from '../data/lookMaterials';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// SF49-g (G99 / G183) and SF8c's socketLift: every entry meets the road over the cloud sea's void (no ground below y = 0
// anywhere at an edge), so each is a `socketLift`: the platform's socket deck, then a static approach over a stone lip
// (top y = 0, across the socket's full 8 m inner line) to the Rising Islet resting at its road stop; the islet rides its
// chains to the gate isle, whose walk strips are the onward route's playable ground. The islets and their stationary road
// gates are this shardfile's compiled `movers` (one admitted module, fixed ride driver); the trusted runtime installs
// exactly these rows (runtime/movers.ts). world/islets.ts is the one source of the geometry.

const base = emptyShardfile({ slug: 'far-reach', name: 'Sky Reach', author: 'Wildshard', revision: 1, seed: 6417 });
const wasm = (module: { hash: string; bytes: number }) => ({ hash: module.hash, kind: 'wasm', compressed: module.bytes, decoded: module.bytes, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
const product = parseShardfile({ ...base, ...SKY_SECTIONS, navigation: navigation.navigation, serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + navigation.files.reduce((sum, file) => sum + file.decoded, 0) }, accent: 'pink', runtime: { entry: 'runtime/index.ts', cost: SKY_REACH_RUNTIME_COST, binds: ['quests', 'ledger', 'state', 'items', 'spawns', 'modes', 'props', 'clientChannels'], spawns: SKY_SPAWNS },
  // the material graphs the runtime draws its own meshes in, and the library maps' samplers (data/lookMaterials.ts)
  look: { ...base.look, materials: { ...base.look.materials, ...SKY_LOOK_MATERIALS }, samplers: { ...base.look.samplers, ...SKY_LOOK_SAMPLERS } },
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


/** Build-time declaration rows; runtime reads the generated admitted product. */
export function skyProductRows(): typeof product { return product; }

// oxlint-disable-next-line import/no-default-export -- Documented entry for SDK author projects.
export default product;
