import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { DRIFTWOOD_QUESTS } from './data/quests';
import { DRIFTWOOD_LEDGER } from './data/ledger';
import { DRIFTWOOD_SWORDS } from './data/items';
import { DRIFTWOOD_SPAWNS } from './data/spawns';
import { DRIFTWOOD_MODES } from './data/modes';
import { DRIFTWOOD_AUDIO } from './data/audio';
import { DRIFTWOOD_EDGE_HEIGHTS } from './data/edges';
import { DRIFTWOOD_RUNTIME_COST } from './data/runtimeCost';
import { DECLARED_SEA, WORLD_DROP } from './world/sea';
import { ENTRY_LANDINGS } from './data/entryLandings';
import navigation from './data/navigation.generated.json' with { type: 'json' };
import fixed from './data/fixedTiles.generated.json' with { type: 'json' };

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
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({
  ...base,
  navigation: navigation.navigation, files: [...navigation.files, ...fixed.files], critical: [...navigation.critical, ...fixed.critical],
  tiles: fixed.tiles, terrain: fixed.terrain, library: fixed.library,
  serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + simulationFiles.reduce((sum, file) => sum + file.decoded, 0) },
  budgets: { ...base.budgets, library: fixed.libraryCost, sim: { resident: simulationFiles.reduce((sum, file) => sum + file.decoded + file.gpu, 0),
    compressed: simulationFiles.reduce((sum, file) => sum + file.compressed, 0) } },
  accent: 'marigold',
  runtime: { entry: 'runtime/hybrid.ts', cost: DRIFTWOOD_RUNTIME_COST, binds: ['quests', 'ledger', 'items', 'spawns', 'modes', 'props', 'terrain'], spawns: DRIFTWOOD_SPAWNS },
  quests: DRIFTWOOD_QUESTS, ledger: DRIFTWOOD_LEDGER, items: DRIFTWOOD_SWORDS,
  edge: { north: row(DRIFTWOOD_EDGE_HEIGHTS.north), east: row(DRIFTWOOD_EDGE_HEIGHTS.east), south: row(DRIFTWOOD_EDGE_HEIGHTS.south), west: row(DRIFTWOOD_EDGE_HEIGHTS.west) },
  audio: DRIFTWOOD_AUDIO, modes: DRIFTWOOD_MODES,
  // G164 (SHARDFILE.md socketOverWater): every entry meets the road over the lowered sea. The sea row clips the four 8 × 15 m
  // sockets dry (dryEntries) and the four declared landings (top y = 0, the full 8 m across each socket's shard-side edge;
  // G170: the inner ends of the asphalt road decks) prove the walk off the socket. The trusted runtime consumes both rows itself (world/sea.ts, world/build.ts).
  entryways: base.entryways.map(({ edge, at, width }) => ({ edge, at, width, kind: 'socketOverWater' as const })),
  water: [{ ...DECLARED_SEA, dryEntries: [...DECLARED_SEA.dryEntries] }],
  props: { ...fixed.props,
    colliders: ENTRY_LANDINGS.map((landing) => ({ id: `landing.${landing.edge}`, panel: null, initialActive: true, shapes: [{ ...landing.box }] })) },
  spawn: { x: 0, y: 1.2, z: -194, yaw: Math.PI },
});
