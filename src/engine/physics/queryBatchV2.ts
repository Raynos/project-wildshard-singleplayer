/** Native ABI-v2 query adapter. Called once by the afterBodies authority; it
 * lends existing worlds/navmeshes without creating bodies, stepping physics or
 * consulting an active page terrain. Contact remains in its 60 Hz owners. */
import type { Collider,Ball,Ray } from '@dimforge/rapier3d-simd';
import type { Physics } from './Physics';
import type { Navmesh } from './navmesh';
import { queryGroups,type GroupName } from './groups';
import { validateV2QueryRequest,type V2QueryRequest,type V2QueryAnswer } from '@wildshard/format/scriptQueriesV2';

export interface V2QueryWorld {
  readonly physics: Physics;
  readonly navmesh: Pick<Navmesh,'closestWalkable' | 'findPath'> | null;
  /** Current native observed identities, including all compound colliders. */
  readonly bodies: ReadonlyMap<string,readonly Collider[]>;
  readonly sees: readonly GroupName[];
  readonly as: GroupName;
}
const scratch = new WeakMap<Physics,{ readonly ray: Ray; readonly ball: Ball }>();

/** Module/binding maps are supplied by native admission, never selected by a
 * guest path. Different principals may observe different bodies in one world. */
export function resolvePhysicsQueriesV2(requests: readonly { readonly module: string; readonly request: V2QueryRequest }[],worlds: ReadonlyMap<string,ReadonlyMap<string,V2QueryWorld>>): readonly V2QueryAnswer[] {
  const indices = new Map<V2QueryWorld,ReadonlyMap<number,string>>();
  return requests.map(({ module: id,request }): V2QueryAnswer => {
    validateV2QueryRequest(request);const world = worlds.get(id)?.get(request.binding);if (world === undefined) return { status: 3 };
    const { physics,navmesh } = world, values = request.values;
    if (request.op === 4 || request.op === 5) {
      if (navmesh === null) return { status: 2 };
      const from = { x: values[0],y: values[1],z: values[2] };
      if (request.op === 4) {
        const point = navmesh.closestWalkable(from,values[3]);return point === null ? { status: 2 } : { status: 1,kind: 'walkable',point: [point.x,point.y,point.z] };
      }
      const points = navmesh.findPath(from,{ x: values[3],y: values[4],z: values[5] },values[6]);
      return points === null ? { status: 2 } : { status: 1,kind: 'path',points: points.map(point => [point.x,point.y,point.z]) };
    }
    // Rapier consumes f32. A finite f64 must not become infinity inside its
    // native API, nor may a positive overlap radius underflow to zero.
    if (!values.every(value => Number.isFinite(Math.fround(value))) || (request.op === 9 && Math.fround(values[3]) <= 0)) return { status: 3 };
    let bodies = indices.get(world);
    if (bodies === undefined) {
      const next = new Map<number,string>();
      for (const [identity,colliders] of world.bodies) {
        if (identity.length === 0) throw new Error('Empty v2 native body identity');
        for (const collider of colliders) {
          if (!collider.isValid() || physics.world.getCollider(collider.handle) !== collider) continue;
          const old = next.get(collider.handle);if (old !== undefined && old !== identity) throw new Error('Ambiguous v2 native body collider');next.set(collider.handle,identity);
        }
      }
      bodies = next;indices.set(world,bodies);
    }
    const excluded = new Set<number>();
    if (request.target !== null) {
      for (const [handle,identity] of bodies) if (identity === request.target) excluded.add(handle);
      if (excluded.size === 0) return { status: 2 };
    }
    let local = scratch.get(physics);
    if (local === undefined) { local = { ray: new physics.R.Ray({ x: 0,y: 0,z: 0 },{ x: 0,y: -1,z: 0 }),ball: new physics.R.Ball(1) };scratch.set(physics,local); }
    const flags = physics.R.QueryFilterFlags.EXCLUDE_SENSORS, groups = queryGroups(world.sees,world.as), include = (collider: Collider): boolean => !excluded.has(collider.handle);
    if (request.op === 8) {
      const ray = local.ray;ray.origin.x = values[0];ray.origin.y = values[1];ray.origin.z = values[2];ray.dir.x = values[3];ray.dir.y = values[4];ray.dir.z = values[5];
      const hit = physics.world.castRayAndGetNormal(ray,values[6],true,flags,groups,undefined,undefined,excluded.size === 0 ? undefined : include);
      if (hit === null) return { status: 1,kind: 'ray',hit: null };
      const distance = hit.timeOfImpact;
      return { status: 1,kind: 'ray',hit: { point: [values[0]+values[3]*distance,values[1]+values[4]*distance,values[2]+values[5]*distance],normal: [hit.normal.x,hit.normal.y,hit.normal.z],distance,body: bodies.get(hit.collider.handle) ?? null } };
    }
    local.ball.radius = values[3];const found = new Set<string>();
    physics.world.intersectionsWithShape({ x: values[0],y: values[1],z: values[2] },{ x: 0,y: 0,z: 0,w: 1 },local.ball,collider => {
      const identity = bodies.get(collider.handle);if (identity !== undefined) found.add(identity);return true;
    },flags,groups,undefined,undefined,excluded.size === 0 ? undefined : include);
    return { status: 1,kind: 'overlap',bodies: [...found].sort() };
  });
}
