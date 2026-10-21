import { DRIFTWOOD_FEATS } from './questInventory';
import { CAPTAIN_FIELDS } from './captainFields';
import LOOT from '../data/loot.generated.json' with { type: 'json' };
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import questRows from '../data/questRows.generated.json' with { type: 'json' };
import { DRIFTWOOD_LEDGER } from './ledger';
import DRIFTWOOD_SWORDS from '../data/items.generated.json' with { type: 'json' };
import { DRIFTWOOD_SPAWNS } from './spawns';
import { NPC_FOCUS_PROGRAMS } from './npcFocusPrograms';
import AUDIO from '../data/audio.generated.json' with { type: 'json' };
import { DRIFTWOOD_EDGE_HEIGHTS } from './edges';
import DRIFTWOOD_RUNTIME_COST from '../data/runtimeCost.json' with { type: 'json' };
import { DECLARED_SEA, WORLD_DROP } from './sea';
import { ENTRY_LANDINGS } from './entryLandings';
import navigation from '../data/navigation.generated.json' with { type: 'json' };
import fixed from '../data/fixedTiles.generated.json' with { type: 'json' };
import lookGraphs from '../data/lookMaterials.generated.json' with { type: 'json' };
import skyChannels from '../data/skyChannels.generated.json' with { type: 'json' };
import captainCoat from '../data/captainCoat.json' with { type: 'json' };


// SF46 step 1: content and the existing look stay in the declared trusted entry until the grid-ready bake lands.
// SF46 edges (G93 / G99 / G164): the four 8 m midpoint entryways (`emptyShardfile`'s, the engine's ENTRY_WIDTH) stand on
// Driftwood's real boundary rows (./data/edges.ts, the authored bake's) lowered with the whole world by WORLD_DROP; across
// each 8 m opening (and the sample either side its interpolation reads) the row is the platform's entry socket at road
// height, which the pier / jetty's sea-end ramp meets 15 m in (world/sea.ts).
// G164 bumps the revision (council C3-R2-C3): the world's basis moved 0.8 m, so a revision-1 continuation restores through the
// logical migration (progress, flags, quests and creature health kept; held / pending actions dropped; the player starts at
// the spawn), never the exact path and never a refusal (test/shards/driftwood-isle/g164-saves.test.ts).
const base = emptyShardfile({ slug: 'driftwood-isle', name: 'Driftwood Isle', author: 'Wildshard', revision: 2, seed: 0x5ea1 });
const opening = Math.max(...base.entryways.map((row) => row.width)) / 2;
const lowered = (heights: readonly number[]): number[] => {
  const stride = 500 / (heights.length - 1);
  return heights.map((h, i) => (Math.abs(-250 + i * stride) <= opening + stride ? 0 : h - WORLD_DROP));
};
const row = (authored: readonly number[]): { heights: number[]; colours: [number, number, number][]; roadHeight: 0 } => {
  const heights = lowered(authored);
  return { heights, colours: heights.map((): [number, number, number] => [0.5, 0.5, 0.5]), roadHeight: 0 };
};
const simulationFiles = [...navigation.files, ...fixed.files.filter(file => fixed.critical.includes(file.hash))];
// G7: the Drowned Captain's painted coat, an admitted look texture his graph samples by hash (generators/bake-captain-coat.mjs)
const coat = captainCoat.file;
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({
  ...base,state:{...base.state,shared:CAPTAIN_FIELDS}, rows: { ...base.rows, loot: [LOOT] },
  sim: { ...base.sim, scripts: [] },
  navigation: navigation.navigation, files: [...navigation.files, ...fixed.files, coat], critical: [...navigation.critical, ...fixed.critical],
  tiles: fixed.tiles, terrain: fixed.terrain, library: [...fixed.library, coat.hash],
  serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + 6*65536 + simulationFiles.reduce((sum, file) => sum + file.decoded, 0) },
  budgets: { ...base.budgets, library: { resident: fixed.libraryCost.resident + coat.decoded + coat.gpu, compressed: fixed.libraryCost.compressed + coat.compressed }, sim: { resident: 6*65536 + simulationFiles.reduce((sum, file) => sum + file.decoded + file.gpu, 0),
    compressed: simulationFiles.reduce((sum, file) => sum + file.compressed, 0) } },
  accent: 'marigold',
  // the material graphs the runtime draws its own meshes in (runtime/hybrid.ts): the cove's cascade, the castaway's smoke, the shrine's fireflies, the lagoon's reef, the cove's pools, the gulls, the creatures, the baked cove's terrain and props;
  // the faceted sky's dome and cumulus (compiled by the sky backdrop before the world stage, game/looks/toonSky.ts; its frame is the `driftwood.sky` channel group);
  // the faceted ground and its slab, and the low-poly kit's variants (compiled by the look's prepareWorld before the ground builds, game/looks/toonLook.ts)
  // the castaway arms, their swords and their swimming (compiled by the kit hook, runtime/hybrid.ts)
  // W2c: every graph arrives as build-time JSON (generators/lookMaterials.ts → data/lookMaterials.generated.json)
  look: { ...base.look, materials: { ...base.look.materials, ...Object.fromEntries(Object.entries(lookGraphs).map(([id, graph]) => [id, { family: 'graph' as const, graph }])) },
    samplers: { [coat.hash]: { wrap: 'repeat' } } },
  runtime: { entry: 'runtime/hybrid.ts', cost: DRIFTWOOD_RUNTIME_COST, binds: ['state', 'quests', 'ledger', 'items', 'spawns', 'modes', 'props', 'terrain', 'movers', 'loot', 'clientChannels'], spawns: DRIFTWOOD_SPAWNS },
  clientChannels: [...skyChannels.clientChannels, ...NPC_FOCUS_PROGRAMS],
  quests: { ...questRows.quests, achievements: DRIFTWOOD_FEATS }, questHost: questRows.host, questNpcs: questRows.npcs, ledger: DRIFTWOOD_LEDGER, items: DRIFTWOOD_SWORDS,
  edge: { north: row(DRIFTWOOD_EDGE_HEIGHTS.north), east: row(DRIFTWOOD_EDGE_HEIGHTS.east), south: row(DRIFTWOOD_EDGE_HEIGHTS.south), west: row(DRIFTWOOD_EDGE_HEIGHTS.west) },
  audio: AUDIO.audio,
  // G164 (SHARDFILE.md socketOverWater): every entry meets the road over the lowered sea. The sea row clips the four 8 × 15 m
  // sockets dry (dryEntries) and the four declared landings (top y = 0, the full 8 m across each socket's shard-side edge;
  // G170: the inner ends of the asphalt road decks) prove the walk off the socket. The trusted runtime consumes both rows itself (world/sea.ts, world/build.ts).
  entryways: base.entryways.map(({ edge, at, width }) => ({ edge, at, width, kind: 'socketOverWater' as const })),
  water: [{ ...DECLARED_SEA, dryEntries: [...DECLARED_SEA.dryEntries] }],
  props: { ...fixed.props,
    colliders: ENTRY_LANDINGS.map((landing) => ({ id: `landing.${landing.edge}`, panel: null, initialActive: true, shapes: [{ ...landing.box }] })) },
  spawn: { x: 0, y: 1.2, z: -194, yaw: Math.PI },
});
