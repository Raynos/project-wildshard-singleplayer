import type { NineSourceCasts } from './castsProgram';
import type { NineSourceSigns } from './signsProgram';
import type { NineSourceWorld } from './worldProgram';
import type { NineWorldScenes } from './worldScenes';
import type { NineNavigation } from './navigationProgram';
import type { NineHeldInputs } from './heldGraphFiles';
import { filamentGraph } from './filamentGraph';
import { haloGraph } from './haloGraph';
import { architectureGraphs } from './architectureGraphs';
import { burstGraphs } from './burstGraphs';
import { streakGraph } from './streakGraph';
import plumbing from '../data/plumbing.json' with { type: 'json' };
import { ND_AUDIO } from './audio';
import NINE_MODES from '../data/modes.json' with { type: 'json' };
import NINE_DRAGON_RUNTIME_COST from '../data/runtimeCost.json' with { type: 'json' };
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, type Shardfile } from '@wildshard/sdk/shardfile';
import NINE_ITEMS from '../data/items.json' with { type: 'json' };
import ledgerRows from '../data/ledger.json' with { type: 'json' };
import { parseLedgerRules } from '@wildshard/sdk/ledger';
import portalStages from '../data/portalStages.json' with { type: 'json' };
import { portalEntryRows } from './portalEntries';
import { portalFloorRows } from './portalFloors';
import lookGraphs from '../data/lookGraphs.json' with { type: 'json' };
import presentationGraphs from '../data/scrollGraph.json' with { type: 'json' };

const NINE_LEDGER = parseLedgerRules(ledgerRows);
const portalEntries = portalEntryRows(), portalFloors = portalFloorRows();

// The trusted runtime preserves today's fragment geometry; audio is selected by its declared section. G285: its two feats
// are ledger rows (data/ledger.ts) the runtime emits as they are played (world/feats.ts); the platform grants each once.
// G224 (Jake): Nine Dragon's four road-height decks each carry a portal to Lantern Square, and the square's one portal out
// sends you back to the deck you came in by. Each entry is a `portalLink` (SF8c, src/game/shardfile/portalLink.ts): the
// road portal on its deck, the square's arrival, the square's exit bound back to that road, and the walked route between
// (world/portalPlan.ts `portalLinks`). The floors they bind are this file's `props.colliders` (the generated portal-floor rows: each whole deck, `deck.<edge>`, and the square's slab, `square`), the very boxes the trusted runtime
// installs under those ids (world/install.ts), so its ride (world/portalRide.ts) is the format's checked transfer.
const DEFAULT_MOVERS = { pages: 1 };

/** Owned source results consumed by the declaration in this same build. */
export interface NineProductInputs {
  readonly casts: NineSourceCasts;
  readonly signs: NineSourceSigns;
  readonly ownedWorld: NineSourceWorld; readonly scenes: NineWorldScenes;
  readonly held: NineHeldInputs;
  readonly courseProgram: { readonly compiled: { readonly bytes: number }; readonly script: { readonly pages: number } };
  readonly navigation: NineNavigation;
  readonly world: { readonly shardfile: { readonly library: readonly string[]; readonly files: readonly NineInputFile[]; readonly tiles: unknown }; readonly props: Readonly<Record<string, unknown>> | null | undefined };
}

/** Raw file metadata retains its original final parseShardfile admission. */
interface NineInputFile {
  readonly hash: string; readonly kind: string; readonly compressed: number; readonly decoded: number;
  readonly gpu: number; readonly triangles: number; readonly draws: number;
  readonly dependencies: readonly string[]; readonly critical: boolean;
}

/** Assemble the declaration from owned world/navigation/course results and the fixed-page view contract. */
export function nineProductFrom(inputs: NineProductInputs, movers: { readonly pages: number } = DEFAULT_MOVERS): Shardfile {
const { courseProgram, navigation, world, held: { files: heldGraphFiles } } = inputs;
const base = emptyShardfile({ slug: 'nine-dragon-stack', name: 'Nine Dragon Stack', author: 'Wildshard', revision: 1, seed: 0x9d2a });
const library = new Set([...world.shardfile.library, ...heldGraphFiles.library]), charged = [...world.shardfile.files.filter(file => library.has(file.hash)), ...heldGraphFiles.files];
const courseBytes=courseProgram.compiled.bytes, courseMemory=courseBytes+courseProgram.script.pages*65536*2;
const navigationResident = navigation.files.reduce((sum, file) => sum + file.decoded, 0);
// the movers view module's memory (behaviour/movers.as, its pages twice: the client lane's image and its rewind copy)
const viewMemory = movers.pages * 65536 * 2;
const budgets = { ...base.budgets, sim: { resident: navigationResident+courseMemory, compressed: navigation.files.reduce((sum, file) => sum + file.compressed, 0)+courseBytes }, library: { compressed: charged.reduce((sum, file) => sum + file.compressed, 0), resident: charged.reduce((sum, file) => sum + file.decoded + file.gpu, 0) + viewMemory } };
// parseShardfile admits each link against the format's PortalLink schema (strict nodes, bound links, the walked route)
return parseShardfile({ ...base, plumbing, budgets, navigation: navigation.navigation, critical: navigation.critical,
  serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + navigationResident+courseMemory },
  files: [...world.shardfile.files, ...navigation.files, ...heldGraphFiles.files].sort((a, b) => a.hash.localeCompare(b.hash)), tiles: world.shardfile.tiles, library: [...library],
  accent: 'iris', runtime: { kind: 'client-plan', binds: ['props', 'items', 'ledger', 'modes'], cost: NINE_DRAGON_RUNTIME_COST }, audio: ND_AUDIO, modes: NINE_MODES, items: NINE_ITEMS, ledger: NINE_LEDGER, spawn: { x: 0.95, y: 125, z: 7.5, yaw: -12 * (Math.PI / 180) },
  entryways: portalEntries, directors: [portalStages],
  // the look.materials graphs (data/lookGraphs.json: the sky, the Well's silk sheets, the steam), lent by plugin.ts
  look: { ...base.look, materials: { ...base.look.materials, ...Object.fromEntries(Object.entries({ ...lookGraphs, ...presentationGraphs, ...architectureGraphs(), 'nine-streaks': streakGraph(), 'nine-halo': haloGraph(), 'nine-filament': filamentGraph(), ...burstGraphs() }).map(([id, graph]) => [id, { family: 'graph' as const, graph }])), ...heldGraphFiles.materials } },
  props: { ...world.props, wholeLibrary: world.shardfile.library, colliders: portalFloors } });
}

