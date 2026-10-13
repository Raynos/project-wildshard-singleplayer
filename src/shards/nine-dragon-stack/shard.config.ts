import { NINE_CLIENT_CHANNELS } from './data/clientMotion';
import { NINE_MODES } from './data/modes';
import { NINE_DRAGON_RUNTIME_COST } from './data/runtimeCost';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { ND_AUDIO } from './data/audio';
import { NINE_ITEMS } from './data/items';
import { NINE_LEDGER } from './data/ledger';
import navigation from './data/navigation.generated.json' with { type: 'json' };
import world from './data/world.generated.json' with { type: 'json' };
import portalStages from './data/portalStages.json' with { type: 'json' };
import portalEntries from './data/portalEntries.generated.json' with { type: 'json' };
import portalFloors from './data/portalFloors.generated.json' with { type: 'json' };

// The trusted runtime preserves today's fragment geometry; audio is selected by its declared section. G285: its two feats
// are ledger rows (data/ledger.ts) the runtime emits as they are played (world/feats.ts); the platform grants each once.
// G224 (Jake): Nine Dragon's four road-height decks each carry a portal to Lantern Square, and the square's one portal out
// sends you back to the deck you came in by. Each entry is a `portalLink` (SF8c, src/game/shardfile/portalLink.ts): the
// road portal on its deck, the square's arrival, the square's exit bound back to that road, and the walked route between
// (world/portalPlan.ts `portalLinks`). The floors they bind are this file's `props.colliders` (the generated portal-floor rows: each whole deck, `deck.<edge>`, and the square's slab, `square`), the very boxes the trusted runtime
// installs under those ids (world/install.ts), so its ride (world/portalRide.ts) is the format's checked transfer.
const base = emptyShardfile({ slug: 'nine-dragon-stack', name: 'Nine Dragon Stack', author: 'Wildshard', revision: 1, seed: 0x9d2a });
const library = new Set(world.shardfile.library), charged = world.shardfile.files.filter(file => library.has(file.hash));
const navigationResident = navigation.files.reduce((sum, file) => sum + file.decoded, 0);
const budgets = { ...base.budgets, sim: { resident: navigationResident, compressed: navigation.files.reduce((sum, file) => sum + file.compressed, 0) }, library: { compressed: charged.reduce((sum, file) => sum + file.compressed, 0), resident: charged.reduce((sum, file) => sum + file.decoded + file.gpu, 0) } };
// parseShardfile admits each link against the format's PortalLink schema (strict nodes, bound links, the walked route)
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base, budgets, navigation: navigation.navigation, critical: navigation.critical,
  serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + navigationResident },
  files: [...world.shardfile.files, ...navigation.files].sort((a, b) => a.hash.localeCompare(b.hash)), tiles: world.shardfile.tiles, library: world.shardfile.library,
  accent: 'iris', runtime: { entry: 'runtime/index.ts', binds: ['props', 'items', 'ledger', 'modes', 'clientChannels'], cost: NINE_DRAGON_RUNTIME_COST }, audio: ND_AUDIO, clientChannels: NINE_CLIENT_CHANNELS, modes: NINE_MODES, items: NINE_ITEMS, ledger: NINE_LEDGER, spawn: { x: 0.95, y: 125, z: 7.5, yaw: -12 * (Math.PI / 180) },
  entryways: portalEntries, directors: [portalStages],
  props: { ...world.props, wholeLibrary: world.shardfile.library, colliders: portalFloors } });
