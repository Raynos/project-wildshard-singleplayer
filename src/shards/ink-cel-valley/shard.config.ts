import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import terrain from './data/terrain.json' with { type: 'json' };
import door from './behaviour/door.json' with { type: 'json' };
import props from './data/props.json' with { type: 'json' };
import { INK_HOOKS, INK_STATE } from './behaviour/hooks';
import { INK_ROWS } from './data/rows';
import { INK_PLUMBING } from './data/plumbing';
import { INK_UI } from './data/ui';
import { INK_LOOK } from './data/look';
import { INK_WATER } from './data/water';
import { CREATURES } from './data/creatures';
import { ENCOUNTERS } from './data/encounters';
import { ADVENTURE } from './quests/adventure';
import { INK_LEDGER } from './data/ledger';
import { INK_AUDIO } from './data/audio';
import { SPAWN } from './data/spawn';
import { ITEMS } from './data/items';
import { INK_TARGETS } from './data/targets';
import { INK_SKIN_COST, INK_SKIN_FILES, INK_SKIN_LIBRARY, INK_SKIN_LOOKS } from './data/skins';
import { CLIENT_IDLE_BYTES, CLIENT_IDLE_HASH, CLIENT_IDLE_RESIDENT, INK_CLIENT_SCRIPTS } from './data/clientScripts';

const base = emptyShardfile({ slug: 'ink-cel-valley', name: 'Ink & Cel Valley', author: 'Wildshard', revision: 1, seed: 357 });
const playerHandle = 1106943697; // fnv1a32('actor.player') & 0x7fffffff; admission compares this with the session map.
const script = { hash: door.hash, kind: 'wasm', compressed: door.compressed, decoded: door.compressed, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true };
const itemModule = '7035c479edde46ee0baf713fce437fe21e7b61967154f36b5f1126708b2bfaa7';
const itemScript = { ...script, hash: itemModule, compressed: 740, decoded: 740 };
const clientScript = { ...script, hash: CLIENT_IDLE_HASH, compressed: CLIENT_IDLE_BYTES, decoded: CLIENT_IDLE_BYTES, critical: false };
const tiles = terrain.tiles.map((tile) => {
  const addition = props.tiles.find((row) => row.lod === tile.lod && row.x === tile.x && row.z === tile.z);
  if (addition === undefined) return tile;
  return { ...tile, files: [...tile.files, ...addition.files],
    bounds: { min: tile.bounds.min.map((value, axis) => Math.min(value, addition.bounds.min[axis] ?? value)), max: tile.bounds.max.map((value, axis) => Math.max(value, addition.bounds.max[axis] ?? value)) },
    compressed: tile.compressed + addition.compressed, decoded: tile.decoded + addition.decoded, gpu: tile.gpu + addition.gpu, triangles: tile.triangles + addition.triangles, draws: tile.draws + addition.draws };
});
// This declaration is the live source; the manifest supplies only picker metadata.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base, accent: 'ember',
  budgets: { library: { resident: 100_000 + INK_SKIN_COST.resident + CLIENT_IDLE_RESIDENT + 2_633_280, compressed: 100_000 + CLIENT_IDLE_BYTES + INK_SKIN_COST.compressed }, sim: { resident: 16_000_000, compressed: 2_000_000 }, overlap: 0 },
  serverBudget: { ...base.serverBudget, tickMicros: 5_000, memory: 16_000_000 },
  look: INK_LOOK, spawn: SPAWN, rows: { ...INK_ROWS, looks: INK_SKIN_LOOKS }, plumbing: INK_PLUMBING, ui: INK_UI,
  terrain: terrain.terrain, tiles, files: [...terrain.files, ...props.files, ...INK_SKIN_FILES, script, itemScript, clientScript], edge: terrain.edge,
  library: [...props.library, ...INK_SKIN_LIBRARY, CLIENT_IDLE_HASH], far: props.far, props: props.props, items: ITEMS, targets: INK_TARGETS, clientScripts: INK_CLIENT_SCRIPTS,
  critical: [...terrain.critical, door.hash, itemModule], water: INK_WATER, creatures: CREATURES, encounters: ENCOUNTERS,
  quests: ADVENTURE, ledger: INK_LEDGER, audio: INK_AUDIO, state: INK_STATE, hooks: INK_HOOKS,
  sim: { ...base.sim, scriptTickDivisor: 1, scripts: [door.hash, itemModule], bindings: [{ module: door.hash, entity: playerHandle, actorId: 'actor.player', kind: 'server' }] },
});
