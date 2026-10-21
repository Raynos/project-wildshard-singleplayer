import { BARREL_BODY, BARREL_HALF } from '@wildshard/engine/world/interact/barrel';
import { NATIVE_BARRELS, NATIVE_FLOORS, NATIVE_PLATES, NATIVE_WATER } from './nativeQuestProps';

/**
 * G566: the tide barrel's never-jam watch (PHYSICS P7-L1) as Driftwood AS (behaviour/barrels.as) over declared body ops,
 * from the same native prop rows the kit law read: its home, leash, the tide plates, the sea and the captured cave floors.
 */
const zero = '0'.repeat(64);
const [barrel] = NATIVE_BARRELS, [plateA, plateB] = NATIVE_PLATES;
if (barrel === undefined || plateA === undefined || plateB === undefined || NATIVE_BARRELS.length !== 1 || NATIVE_PLATES.length !== 2
  || plateA.when !== undefined || plateB.when !== undefined) throw new Error('The barrel watch expects one barrel and two unconditional tide plates');

/** The barrel's declared body: the kit's dynamic cylinder, lifted onto its home, upright at its authored yaw. */
export const BARREL_BODIES = { bodies: [{ id: 'barrel', kind: 'prop', shape: BARREL_BODY.shape, material: BARREL_BODY.material, density: BARREL_BODY.density,
  friction: BARREL_BODY.friction, angularDamping: BARREL_BODY.angularDamping, rolling: BARREL_BODY.rolling, keep: BARREL_BODY.keep, owner: barrel.owner,
  at: { x: barrel.home.x, y: barrel.home.y + BARREL_HALF + 0.01, z: barrel.home.z }, yaw: barrel.yaw }],
  colliders: [], floors: NATIVE_FLOORS };

export const BARREL_DECISION = [{ id: 'driftwood.barrels', abi: '1.0', side: 'sim', module: `blobs/wasm/${zero}.wasm`, source: 'behaviour/barrels.as',
  binding: { shard: true }, pages: 1, onFail: 'hold', tick: 10, on: ['start', 'tick'],
  reads: ['bodyX', 'bodyY', 'bodyZ', 'bodyAlive', 'x', 'y', 'z', 'playerIntent', 'declaredFloor'], commands: ['body.spawn', 'body.teleport'],
  bodies: { barrel: 'barrel' },
  params: { homeX: barrel.home.x, homeY: barrel.home.y, homeZ: barrel.home.z, leash: barrel.leash, water: NATIVE_WATER,
    plateAX: plateA.at.x, plateAY: plateA.at.y, plateAZ: plateA.at.z, plateASize: plateA.size,
    plateBX: plateB.at.x, plateBY: plateB.at.y, plateBZ: plateB.at.z, plateBSize: plateB.size },
  timers: [], stateVersion: 1, state: ['lost', 'wedge', 'fromX', 'fromY', 'fromZ', 'lastTick'].map(name => ({ name, type: 'f64', default: 0, scope: 'binding' })),
}] as const;
