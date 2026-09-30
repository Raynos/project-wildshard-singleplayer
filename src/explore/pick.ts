/**
 * What a tap in the World Explorer picks (E323; src/explore/Select.ts draws the selection). Pure: no DOM, so
 * test/select-pick.test.ts runs it.
 *
 *   const hit = pickTarget(raycaster, targets);   // { target, point, box } | null
 *
 * Each object is raycast once per tap, however many targets share it (a Nine Dragon kit carries seven models' copies:
 * it was raycast seven times). The nearest surface hit is what the finger touched. On that object a target with `claim`
 * takes the hit only where one of its copies stands (the smallest copy box holding the point wins), a target without one
 * takes any hit on its object, and a hit nobody claims picks nothing: a bare facade or Well wall belongs to the world,
 * never to a baked piece metres away (the nearest copy used to win with no containment check).
 */
import * as THREE from 'three';

/** something a tap can hit: an object (or a batch mesh) and how it maps to a catalog entry + a box */
export interface SelectTarget {
  object: THREE.Object3D;
  /** the catalog entry this hit opens (by id) */
  entry: string;
  /** the selection box for a hit at `point` (batches: the one member under the tap); default = the object's box */
  boxAt?: (point: THREE.Vector3) => THREE.Box3;
  /** drawn into a shared object: the copy under `point`, or null when the point is on none of this entry's copies */
  claim?: (point: THREE.Vector3) => THREE.Box3 | null;
  label?: (point: THREE.Vector3) => string;
}

export interface Picked {
  readonly target: SelectTarget;
  readonly point: THREE.Vector3;
  readonly box: THREE.Box3;
}

/** shown: it and every parent visible */
function shown(o: THREE.Object3D): boolean {
  for (let a: THREE.Object3D | null = o; a; a = a.parent) if (!a.visible) return false;
  return true;
}

const _size = new THREE.Vector3();
const volume = (b: THREE.Box3): number => { b.getSize(_size); return _size.x * _size.y * _size.z; };

/** the target under the ray, or null (nothing hit, or a surface no target claims) */
export function pickTarget(ray: THREE.Raycaster, targets: readonly SelectTarget[]): Picked | null {
  const byObject = new Map<THREE.Object3D, SelectTarget[]>();
  for (const t of targets) {
    const list = byObject.get(t.object);
    if (list) list.push(t); else byObject.set(t.object, [t]);
  }
  let near: { object: THREE.Object3D; point: THREE.Vector3; d: number } | null = null;
  for (const object of byObject.keys()) {
    if (!shown(object)) continue;
    const hit = ray.intersectObject(object, true)[0];
    if (hit && (!near || hit.distance < near.d)) near = { object, point: hit.point.clone(), d: hit.distance };
  }
  if (!near) return null;
  const { point } = near;
  let claimed: Picked | null = null, plain: Picked | null = null;
  for (const t of byObject.get(near.object) ?? []) {
    if (t.claim) {
      const box = t.claim(point);
      if (box && (!claimed || volume(box) < volume(claimed.box))) claimed = { target: t, point, box };
    } else plain ??= { target: t, point, box: t.boxAt ? t.boxAt(point) : new THREE.Box3().setFromObject(t.object) };
  }
  return claimed ?? plain;
}
