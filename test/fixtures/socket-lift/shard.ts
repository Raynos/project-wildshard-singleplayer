import { emptyShardfile } from '../../../src/sdk/author';
import { parseShardfile } from '../../../src/game/shardfile/schema';
import { assetCost } from '../../../src/game/shardfile/assets';
import { parseMovers } from '../../../src/game/shardfile/movers';
import { parseSocketLift } from '../../../src/game/shardfile/socketLift';

/** A disconnected island and real lift; no hidden flat world can make a refused ride pass. */
export function liftShard(bytes: Uint8Array, hash: string) {
  const shard = emptyShardfile({ slug: 'lift-proof', revision: 1, name: 'Lift proof', author: 'Platform fixture', seed: 1 });
  const lift = parseSocketLift({ mover: 'entry.lift', gate: 'entry.gate', roadStop: [0, 0, 230], topStop: [0, 25, 205], route: [[0, 25, 205], [0, 25, 195]], rideTicks: 610 });
  shard.entryways = shard.entryways.map(entry => entry.edge === 'north' ? { ...entry, kind: 'socketLift', lift } : entry);
  shard.spawn = { x: 0, y: 25, z: 195, yaw: 0 };
  shard.sim.scripts = [hash]; shard.critical = [hash];
  shard.files = [{ hash, kind: 'wasm', critical: true, compressed: bytes.length, ...assetCost('wasm', bytes), dependencies: [] }];
  shard.budgets.sim = { resident: 1_000_000, compressed: bytes.length };
  shard.movers = parseMovers([{ id: 'entry.lift', entity: 1001, module: hash, kind: 'platform', at: { x: 0, y: 0, z: 230 }, euler: { x: 0, y: 0, z: 0 }, enabled: true,
    boxes: [{ x: 0, y: -0.25, z: 0, hx: 4, hy: 0.25, hz: 5, rot: { x: 0, y: 0, z: 0, w: 1 } }], input: [0, 0, 230, 0, 25, 205, 10, 0],
  }, { id: 'entry.gate', entity: 1002, module: hash, kind: 'platform', at: { x: 0, y: 1, z: 235 }, euler: { x: 0, y: 0, z: 0 }, enabled: false,
    boxes: [{ x: 0, y: 0, z: 0, hx: 4, hy: 1, hz: 0.1, rot: { x: 0, y: 0, z: 0, w: 1 } }], input: [0, 1, 235, 0, 1, 235, 10, 1],
  }]);
  const floor = (id: string, x: number, y: number, z: number, hx: number, hz: number) => ({ id, panel: null, initialActive: true,
    shapes: [{ kind: 'box', x, y: y - 0.25, z, hx, hy: 0.25, hz }] });
  shard.props = parseShardfile({ ...shard, props: { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [],
    colliders: [floor('island', 0, 25, 192.5, 5, 7.5), floor('east-road', 224.2, 0, 0, 25.35, 4),
      floor('west-road', -224.2, 0, 0, 25.35, 4), floor('south-road', 0, 0, -224.2, 4, 25.35)],
  } }).props;
  return parseShardfile(shard);
}
