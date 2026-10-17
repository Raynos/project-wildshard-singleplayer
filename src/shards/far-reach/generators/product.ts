import { SKY_SECTIONS } from './sections';
import { STORM_NOISE } from './rows/stormNoise';
import { SWARD_ATLAS_FILE, SWARD_ATLAS_SAMPLER } from './rows/swardAtlas';
import skyMaps from '../data/skyMaps.json' with { type: 'json' };
import navigation from '../data/navigation.generated.json' with { type: 'json' };
import { SKY_REACH_RUNTIME_COST } from './rows/budgets';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { SKY_SPAWNS } from './rows/spawns';
import { SKY_LIFT_PROMPTS } from './rows/liftPrompts';
import { SKY_MOVER_VIEWS } from './rows/moverViews';
import MOVERS from '../data/movers.generated.json' with { type: 'json' };
import isletRows from '../data/islets.generated.json' with { type: 'json' };
import { RISING_ISLETS, ENTRYWAYS } from './rows/islets.generated';
import isleProps from '../data/props.json' with { type: 'json' };
import lookGraphs from '../data/lookGraphs.json' with { type: 'json' };
import { ISLE_MAPS } from './rows/isleLook';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// SF49-g (G99 / G183) and SF8c's socketLift: every entry meets the road over the cloud sea's void (no ground below y = 0
// anywhere at an edge), so each is a `socketLift`: the platform's socket deck, then a static approach over a stone lip
// (top y = 0, across the socket's full 8 m inner line) to the Rising Islet resting at its road stop; the islet rides its
// chains to the gate isle, whose walk strips are the onward route's playable ground. The islets and their stationary road
// gates are this shardfile's compiled `movers` (one admitted module, fixed ride driver); the trusted runtime installs
// exactly these rows (runtime/movers.ts). world/islets.ts is the one source of the geometry.

const base = emptyShardfile({ slug: 'far-reach', name: 'Sky Reach', author: 'Wildshard', revision: 1, seed: 6417 });
const product = parseShardfile({ ...base, ...SKY_SECTIONS, navigation: navigation.navigation, serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + navigation.files.reduce((sum, file) => sum + file.decoded, 0) }, accent: 'pink', runtime: { entry: 'runtime/index.ts', cost: SKY_REACH_RUNTIME_COST, binds: ['quests', 'ledger', 'state', 'items', 'spawns', 'modes', 'props', 'clientChannels'], spawns: SKY_SPAWNS },
  // the material graphs the runtime draws its own meshes in (authored SF59 graph JSON, data/lookGraphs.json), and the
  // samplers: the islands' and boulders' library maps tile, the sward atlas keeps its own
  look: { ...base.look, materials: { ...base.look.materials, ...lookGraphs }, samplers: { ...base.look.samplers, [ISLE_MAPS.rock]: { wrap: 'repeat', anisotropy: 4 }, [ISLE_MAPS.meadow]: { wrap: 'repeat', anisotropy: 4 }, [SWARD_ATLAS_FILE.hash]: SWARD_ATLAS_SAMPLER } },
  clientChannels: [...SKY_MOVER_VIEWS, ...SKY_LIFT_PROMPTS],
  entryways: [...ENTRYWAYS],
  // The authored clips declare every bridge, islet and gate; both hosts install this admitted order once.
  movers: MOVERS,
  // the twelve static islands' compiled props tiles (generators/isleProps.ts), drawn by the runtime (runtime.binds props)
  library: [...base.library, ...skyMaps.library, STORM_NOISE.hash, SWARD_ATLAS_FILE.hash], tiles: isleProps.tiles, files: [...skyMaps.files, { ...STORM_NOISE, dependencies: [] }, { ...SWARD_ATLAS_FILE, dependencies: [] }, ...navigation.files, ...isleProps.files], critical: [...navigation.critical],
  budgets: { ...base.budgets, library: { ...skyMaps.budget, compressed: skyMaps.budget.compressed + STORM_NOISE.compressed + SWARD_ATLAS_FILE.compressed, resident: skyMaps.budget.resident + STORM_NOISE.decoded + STORM_NOISE.gpu + SWARD_ATLAS_FILE.gpu, downloadAllowance: 8_811_813 + STORM_NOISE.compressed + SWARD_ATLAS_FILE.compressed }, sim: { resident: 1_000_000 + navigation.files.reduce((sum, file) => sum + file.decoded, 0), compressed: navigation.files.reduce((sum, file) => sum + file.compressed, 0) } },
  sim: { ...base.sim, scripts: [] },
  props: { version: 1, family: 'toon', tiles: isleProps.props.tiles, panels: [], models: [], far: null, textures: [],
    colliders: [...RISING_ISLETS.map((entry) => ({ id: `landing.${entry.edge}`, panel: null, initialActive: true, shapes: [{ ...entry.landing }] })),
      ...RISING_ISLETS.map((entry) => ({ id: `gate-isle.${entry.edge}`, panel: null, initialActive: true, shapes: isletRows.entries.flatMap(row => row.edge === entry.edge ? row.strips.map(strip => ({ ...strip, kind: 'box' as const, surface: 'grass' as const })) : []) }))] } });


/** Build-time declaration rows; runtime reads the generated admitted product. */
export function skyProductRows(): typeof product { return product; }

// oxlint-disable-next-line import/no-default-export -- Documented entry for SDK author projects.
export default product;
