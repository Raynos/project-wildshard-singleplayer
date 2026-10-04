import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import terrain from './data/terrain.json' with { type: 'json' };
import door from './behaviour/door.json' with { type: 'json' };
import props from './data/props.json' with { type: 'json' };
import { TEMPLATE_HOOKS, TEMPLATE_STATE } from './behaviour/hooks';
import { TEMPLATE_ROWS } from './data/rows';
import { TEMPLATE_PLUMBING } from './data/plumbing';
import { TEMPLATE_UI } from './data/ui';
import { TEMPLATE_LOOK } from './data/look';
import { TEMPLATE_WATER } from './data/water';
import { CREATURES } from './data/creatures';
import { ENCOUNTERS } from './data/encounters';
import { ADVENTURE } from './quests/adventure';
import { TEMPLATE_LEDGER } from './data/ledger';
import { TEMPLATE_AUDIO } from './data/audio';
import { SPAWN } from './data/spawn';
import { ITEMS } from './data/items';
import { TEMPLATE_TARGETS } from './data/targets';

const base = emptyShardfile({ slug: 'template', name: 'Template shard', author: 'Wildshard', revision: 1, seed: 357 });
const playerHandle = 1106943697; // fnv1a32('actor.player') & 0x7fffffff; admission compares this with the session map.
const script = { hash: door.hash, kind: 'wasm', compressed: door.compressed, decoded: door.compressed, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true };
const itemModule = '7035c479edde46ee0baf713fce437fe21e7b61967154f36b5f1126708b2bfaa7';
const itemScript = { ...script, hash: itemModule, compressed: 740, decoded: 740 };
const tiles = terrain.tiles.map((tile) => {
  const addition = props.tiles.find((row) => row.lod === tile.lod && row.x === tile.x && row.z === tile.z);
  if (addition === undefined) return tile;
  return { ...tile, files: [...tile.files, ...addition.files],
    bounds: { min: tile.bounds.min.map((value, axis) => Math.min(value, addition.bounds.min[axis] ?? value)), max: tile.bounds.max.map((value, axis) => Math.max(value, addition.bounds.max[axis] ?? value)) },
    compressed: tile.compressed + addition.compressed, decoded: tile.decoded + addition.decoded, gpu: tile.gpu + addition.gpu, triangles: tile.triangles + addition.triangles, draws: tile.draws + addition.draws };
});
// The legacy plugin remains the live source until SF16's final loader switch.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base,
  budgets: { library: { resident: 100_000, compressed: 100_000 }, sim: { resident: 16_000_000, compressed: 2_000_000 }, overlap: 0 },
  serverBudget: { ...base.serverBudget, memory: 16_000_000 },
  look: TEMPLATE_LOOK, spawn: SPAWN, rows: TEMPLATE_ROWS, plumbing: TEMPLATE_PLUMBING, ui: TEMPLATE_UI,
  terrain: terrain.terrain, tiles, files: [...terrain.files, ...props.files, script, itemScript], edge: terrain.edge,
  library: props.library, far: props.far, props: props.props, items: ITEMS, targets: TEMPLATE_TARGETS,
  critical: [...terrain.critical, door.hash, itemModule], water: TEMPLATE_WATER, creatures: CREATURES, encounters: ENCOUNTERS,
  quests: ADVENTURE, ledger: TEMPLATE_LEDGER, audio: TEMPLATE_AUDIO, state: TEMPLATE_STATE, hooks: TEMPLATE_HOOKS,
  sim: { ...base.sim, scriptTickDivisor: 1, scripts: [door.hash, itemModule], bindings: [{ module: door.hash, entity: playerHandle, actorId: 'actor.player', kind: 'server' }] },
});
