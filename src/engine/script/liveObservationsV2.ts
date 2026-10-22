/** Native H4 capture at an existing decision slot. No clock, cache, RNG, body
 * update or guest call lives here: later slots see earlier committed effects. */
import type { SimHost } from '../sim';
import type { Navmesh } from '../physics/navmesh';
import { lineOfSight } from '../physics/query';
import type { V2BindingInput,V2PlayerInput } from './observationsV2';

export interface V2NativeObservationRow extends Omit<V2BindingInput,'sample' | 'observed'> {
  /** Only ids resolved by this native host. A handle cannot name another world. */
  readonly observed: ReadonlyMap<number,string>;
  readonly target: number;
  readonly ground: boolean;
  readonly sight: boolean;
  /** Null omits navigation; zero requests the original zero-radius query. */
  readonly walkRadius: number | null;
}
type NativeHost = Pick<SimHost,'scope' | 'state' | 'entities' | 'player' | 'physics' | 'groundHeightAt'>;
type Pose = NonNullable<V2BindingInput['sample']['pose']>;
interface Body { readonly pose: Pose; readonly hpShare: number }
function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Non-finite native observation');return value;
}
function health(value: number | undefined,max: number | undefined): number {
  if (value === undefined || max === undefined || !Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || value < 0 || value > max) throw new Error('Invalid native observed health');return value/max;
}
function pose(position: Readonly<{ x: number; y: number; z: number }>,yaw: number): Pose {
  return { x: finite(position.x),y: finite(position.y),z: finite(position.z),yaw: finite(yaw) };
}
/** Capture just this phase's declared actors and standard native queries. The
 * caller keeps domain columns (weather, mount, law modes) at their ORIGINAL
 * observation slots. Feed the result to prepareV2Observations before entering
 * Wasm; that writer copies numeric columns and inboxes for an unchanged retry.
 * Scope/actor admission happens for the whole batch before any physics query.
 * No renderer singleton or fallback terrain is consulted. */
export function captureNativeV2Observations(host: NativeHost,rows: readonly V2NativeObservationRow[],navigation: Pick<Navmesh,'closestWalkable'> | null): {
  readonly bindings: readonly V2BindingInput[]; readonly players: readonly V2PlayerInput[];
} {
  if (host.scope.disposed || host.scope.disposing || rows.length > 64 || !Number.isSafeInteger(host.state.tick) || host.state.tick < 0) throw new Error('Invalid native observation phase');
  const atTick = host.state.tick, bodies = new Map<string,Body>(), playerHandles = new Set<number>();
  const body = (id: string): Body => {
    const old = bodies.get(id);if (old !== undefined) return old;
    let result: Body;
    if (id === host.player.id) {
      const player = host.player, attributes = player.health.attributes;
      result = { pose: pose(player.position,player.yaw),hpShare: health(attributes.health,attributes.maxHealth) };
    } else {
      const actor = host.entities.get(id);
      if (actor === undefined || actor.entityId !== id) throw new Error('Unowned native observation actor');
      result = { pose: pose(actor.position,actor.yaw),hpShare: health(actor.hp,actor.maxHp) };
    }
    bodies.set(id,result);return result;
  };
  const prepared = rows.map(row => {
    if (row.observed.size > 256 || new Set(row.observed.values()).size !== row.observed.size || row.currentTick !== atTick
      || (row.walkRadius !== null && (!Number.isFinite(row.walkRadius) || row.walkRadius < 0 || row.walkRadius > 5 || navigation === null))) throw new Error('Invalid native observation declaration');
    for (const [handle,id] of row.observed) {
      if (!Number.isInteger(handle) || handle < 1 || handle > 0x7fffffff || id.length === 0) throw new Error('Invalid native observed identity');
      body(id);
    }
    const resolve = (handle: number): Body | undefined => {
      if (handle === 0) return undefined;
      const id = row.observed.get(handle);if (id === undefined) throw new Error('Unobserved native body');return body(id);
    };
    if (row.player !== 0) {
      if (row.observed.get(row.player) !== host.player.id) throw new Error('Unowned native observed player');playerHandles.add(row.player);
    }
    const self = resolve(row.self), target = resolve(row.target);
    if ((row.ground || row.sight || row.walkRadius !== null) && self === undefined) throw new Error('Native standard query requires self');
    if (row.sight && target === undefined) throw new Error('Native sight requires a target');
    return { row,self,target };
  });
  if (playerHandles.size > 1) throw new Error('Native player has multiple handles');
  const bindings = prepared.map(({ row,self,target }): V2BindingInput => {
    const sample: V2BindingInput['sample'] = { atTick,target: row.target,
      ...(self === undefined ? {} : { pose: self.pose,hpShare: self.hpShare }),
      ...(row.ground && self !== undefined ? { groundY: finite(host.groundHeightAt(self.pose.x,self.pose.z)) } : {}),
      ...(row.sight && self !== undefined && target !== undefined ? { lineOfSight: lineOfSight(host.physics,self.pose,target.pose) } : {}),
    };
    const point = row.walkRadius === null || self === undefined ? null : navigation?.closestWalkable(self.pose,row.walkRadius);
    const { observed,ground: _ground,sight: _sight,walkRadius: _radius,target: _target,...input } = row;
    return Object.assign(input,{ observed: new Set(observed.keys()),sample: point === null || point === undefined ? sample : Object.assign(sample,{ walk: { x: finite(point.x),z: finite(point.z) } }) });
  });
  const players = [...playerHandles].map((handle): V2PlayerInput => {
    const player = body(host.player.id);return { identity: host.player.id,handle,atTick,pose: player.pose,hpShare: player.hpShare };
  });
  return { bindings,players };
}
