import { NINE_DRAGON_RUNTIME_COST } from './data/runtimeCost';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { ND_AUDIO } from './data/audio';
import { portalLinks, type ShardEdge } from './world/portalPlan';
import { portalFloorRows } from './world/entries';

// The trusted runtime preserves today's fragment geometry; audio is selected by its declared section.
// G224 (Jake): Nine Dragon's four road-height decks each carry a portal to Lantern Square, and the square's one portal out
// sends you back to the deck you came in by. Each entry is a `portalLink` (SF8c, src/game/shardfile/portalLink.ts): the
// road portal on its deck, the square's arrival, the square's exit bound back to that road, and the walked route between
// (world/portalPlan.ts `portalLinks`). The floors they bind are this file's `props.colliders` (entries.ts
// `portalFloorRows`: each whole deck, `deck.<edge>`, and the square's slab, `square`), the very boxes the trusted runtime
// installs under those ids (world/install.ts), so its ride (world/portalRide.ts) is the format's checked transfer.
const base = emptyShardfile({ slug: 'nine-dragon-stack', name: 'Nine Dragon Stack', author: 'Wildshard', revision: 1, seed: 0x9d2a });
// parseShardfile admits each link against the format's PortalLink schema (strict nodes, bound links, the walked route)
const links = new Map(portalLinks().map((row) => [row.edge, row.portal]));
const portalOf = (edge: ShardEdge): ReturnType<typeof portalLinks>[number]['portal'] => { const portal = links.get(edge); if (portal === undefined) throw new Error(`Nine Dragon declares no portal on its ${edge} edge`); return portal; };
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base,
  accent: 'iris', runtime: { entry: 'runtime/index.ts', cost: NINE_DRAGON_RUNTIME_COST }, audio: ND_AUDIO, spawn: { x: 0.95, y: 125, z: 7.5, yaw: -12 * (Math.PI / 180) },
  entryways: base.entryways.map((row) => ({ edge: row.edge, at: row.at, width: row.width, kind: 'portalLink' as const, portal: portalOf(row.edge) })),
  props: { version: 1, family: 'toon', tiles: [], panels: [], models: [], far: null, textures: [], colliders: portalFloorRows() } });
