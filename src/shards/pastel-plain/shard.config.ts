import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import terrain from './data/terrain.json' with { type: 'json' };
import door from './behaviour/door.json' with { type: 'json' };
import props from './data/props.json' with { type: 'json' };
import { PASTEL_HOOKS, PASTEL_STATE } from './behaviour/hooks';
import { PASTEL_ROWS } from './data/rows';
import { PASTEL_PLUMBING } from './data/plumbing';
import { PASTEL_UI } from './data/ui';
import { PASTEL_LOOK } from './data/look';
import { PASTEL_WATER } from './data/water';
import { CREATURES } from './data/creatures';
import { ENCOUNTERS } from './data/encounters';
import { ADVENTURE } from './quests/adventure';
import { PASTEL_LEDGER } from './data/ledger';
import { PASTEL_AUDIO } from './data/audio';
import { SPAWN } from './data/spawn';
import { ITEMS } from './data/items';
import { PASTEL_TARGETS } from './data/targets';
import { PASTEL_SKIN_COST, PASTEL_SKIN_FILES, PASTEL_SKIN_LIBRARY, PASTEL_SKIN_LOOKS } from './data/skins';
import { CLIENT_IDLE_BYTES, CLIENT_IDLE_HASH, CLIENT_IDLE_RESIDENT, PASTEL_CLIENT_SCRIPTS } from './data/clientScripts';

const base = emptyShardfile({ slug: 'pastel-plain', name: 'Pastel Plain', author: 'Wildshard', revision: 1, seed: 357 });
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
export default parseShardfile({ ...base, accent: 'lime',
  budgets: { library: { resident: 100_000 + PASTEL_SKIN_COST.resident + CLIENT_IDLE_RESIDENT + 2_633_280, compressed: 100_000 + CLIENT_IDLE_BYTES + PASTEL_SKIN_COST.compressed }, sim: { resident: 16_000_000, compressed: 2_000_000 }, overlap: 0 },
  serverBudget: { ...base.serverBudget, tickMicros: 5_000, memory: 16_000_000 },
  look: PASTEL_LOOK, spawn: SPAWN, rows: { ...PASTEL_ROWS, looks: PASTEL_SKIN_LOOKS }, plumbing: PASTEL_PLUMBING, ui: PASTEL_UI,
  terrain: terrain.terrain, tiles, files: [...terrain.files, ...props.files, ...PASTEL_SKIN_FILES, script, itemScript, clientScript], edge: terrain.edge,
  library: [...props.library, ...PASTEL_SKIN_LIBRARY, CLIENT_IDLE_HASH], far: props.far, props: props.props, items: ITEMS, targets: PASTEL_TARGETS, clientScripts: PASTEL_CLIENT_SCRIPTS,
  critical: [...terrain.critical, door.hash, itemModule], water: PASTEL_WATER, creatures: CREATURES, encounters: ENCOUNTERS,
  quests: ADVENTURE, ledger: PASTEL_LEDGER, audio: PASTEL_AUDIO, state: PASTEL_STATE, hooks: PASTEL_HOOKS,
  sim: { ...base.sim, scriptTickDivisor: 1, scripts: [door.hash, itemModule], bindings: [{ module: door.hash, entity: playerHandle, actorId: 'actor.player', kind: 'server' }] },
});
