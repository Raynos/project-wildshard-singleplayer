import signalStages from './data/signalStages.json' with { type: 'json' };
import navigation from './data/navigation.generated.json' with { type: 'json' };
import bossStages from './data/bossStages.json' with { type: 'json' };
import { SIGNAL_DUNES_RUNTIME_COST } from './data/runtimeCost';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { AUDIO } from './data/audio';
import tiles from './data/tiles.json' with { type: 'json' };
import { SIGNAL_LEDGER } from './data/ledger';
import { WHIP_ITEMS } from './data/items';
import { SIGNAL_SPAWNS } from './data/spawns';
import { SIGNAL_QUESTS } from './data/signalQuest';
import sandMaps from './data/sandMaps.json' with { type: 'json' };
import { sandEntry } from './look/sandEntry';
import { SAND_DUSK } from './data/dusk';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// SF50-p / M3 (the runtime-owner binding): "The signal" quest, its ledger facts, the bullwhip and the creatures' homes and
// the Matriarch's body (runtime.spawns) are declared rows here; the trusted runtime owns the world and play scope and binds
// them (runtime.binds; @wildshard/game/shardfile/hybridRows).
// SF50-g edges (G93 / G99 / G103 / G131): the four 8 m midpoint entryways (`emptyShardfile`'s, the engine's ENTRY_WIDTH, kind
// ground) stand on Signal Dunes' real boundary rows: the engine's entry roads already hold each midpoint at exactly road
// height, so each 8 × 15 m socket footprint is flat at y = 0, clear and dry with no change to the world.
// M3 / G227 ("the shardfile is the bake"): the dune field is compiled into the shardfile's 62.5 m terrain tiles
// (generators/tiles.ts, scripts/bake-hybrid-tiles.mjs → ./data/tiles.json + ./assets/<sha256>), bound by the runtime
// (`runtime.binds: ['terrain']`: the data client installs none of it). The edge rows are the same bake's, so seams,
// collider and tiles agree exactly (within 8 cm of the old WSTR-read rows).
// G345 (presentation-only data client): the tiles are no longer runtime-bound. The data client draws them in the look's sand
// (look/sandEntry.ts: the PBR ground layer over the three single-level KTX2 maps, data/sandMaps.json, sampled as the
// old DataTextures were), shading neither way (`terrain.shadow`), the fine ring following the viewer past 8 m, and the sand's
// dusk terms move with the runtime's host field `shared.dusk` (`runtime.binds: state`, look/dusk.ts DUSK) through `look.curves`.
// The ground draws before the engine horizon's ridge rings (`terrain.order: -1`), as the runtime's own sand did, so a far
// depth tie between them resolves as it always has.
// The sim budget is exactly the critical collider's cost (the tiles are render residency, charged per tile).
const collider = [...tiles.files, ...navigation.files].filter((file) => [...tiles.critical, ...navigation.critical].includes(file.hash));
const sim = { resident: collider.reduce((sum, file) => sum + file.decoded + file.gpu, 0), compressed: collider.reduce((sum, file) => sum + file.compressed, 0) };

const maps = Object.values(sandMaps), ref = (name: keyof typeof sandMaps): string => sandMaps[name].hash;
const sand = sandEntry({ grain: ref('grain'), trail: ref('trail'), shadow: ref('shadow') });
const library = { resident: maps.reduce((sum, file) => sum + file.decoded + file.gpu, 0), compressed: maps.reduce((sum, file) => sum + file.compressed, 0) };
const base = emptyShardfile({ slug: 'sunscar-dunes', name: 'Signal Dunes', author: 'Wildshard', revision: 1, seed: 5363 });
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base, navigation: navigation.navigation, serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + navigation.files.reduce((sum, file) => sum + file.decoded, 0) }, budgets: { ...base.budgets, library, sim }, accent: 'orchid', runtime: { entry: 'runtime/index.ts', cost: SIGNAL_DUNES_RUNTIME_COST, binds: ['quests', 'ledger', 'items', 'spawns', 'state'], spawns: SIGNAL_SPAWNS }, audio: AUDIO, directors: [bossStages, signalStages],
  quests: SIGNAL_QUESTS, ledger: SIGNAL_LEDGER, items: WHIP_ITEMS,
  state: { ...base.state, shared: [{ id: 1, name: 'dusk', type: 'f64', privacy: 'host', default: 0, min: 0, max: 1 }] },
  look: { ...base.look, families: ['pbr'], materials: { pbr: sand }, curves: { pbr: SAND_DUSK }, samplers: { [ref('grain')]: { wrap: 'repeat', anisotropy: 8, mips: 'gpu' }, [ref('trail')]: { filter: 'linear' }, [ref('shadow')]: { filter: 'linear' } } },
  terrain: { ...tiles.terrain, shadow: { cast: false, receive: false }, follow: 8, order: -1 }, tiles: tiles.tiles, files: [...tiles.files, ...navigation.files, ...maps].sort((a, b) => a.hash.localeCompare(b.hash)), library: maps.map((file) => file.hash), critical: [...tiles.critical, ...navigation.critical], edge: tiles.edge });
