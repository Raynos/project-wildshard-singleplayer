// E323: a tap in the World Explorer on an object several models are drawn into (a Nine Dragon kit, a Nalati place's
// painted mesh) picks a model only where one of its copies stands. A bare wall picks nothing — it used to pick the
// nearest copy, metres away — and the shared object is raycast once per tap, not once per model drawn into it.
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry } from '../src/world/registry';
import { defineModel, modelContext } from '../src/models/model';
import { CLAIM_MARGIN, claimCopy, place } from '../src/models/place';
import { pickTarget, type SelectTarget } from '../src/explore/pick';

const ctx = modelContext(null);
const mat = new THREE.MeshBasicMaterial();
const lamp = defineModel({ id: 'shared/test-pick-lamp', name: 'Lamp', category: 'props', pipeline: 'code', file: 'test/select-pick.test.ts', defaults: {}, build: () => [{ geometry: new THREE.BoxGeometry(1, 1, 1), material: mat }] });
const sign = defineModel({ id: 'shared/test-pick-sign', name: 'Sign', category: 'props', pipeline: 'code', file: 'test/select-pick.test.ts', defaults: {}, build: () => [{ geometry: new THREE.BoxGeometry(1, 1, 1), material: mat }] });

/** a 40 m wall (the kit: one mesh) with two lamps and a sign drawn into it, 1 m boxes on its face (z = 0) */
function kit(): { reg: WorldRegistry; wall: THREE.Mesh; targets: SelectTarget[] } {
  const reg = new WorldRegistry();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 1).translate(0, 5, -0.5), mat);
  wall.updateMatrixWorld(true);
  const boxes = (xs: number[]): Float32Array => Float32Array.from(xs.flatMap((x) => [x - 0.5, 4.5, -0.5, x + 0.5, 5.5, 0.5]));
  place(lamp, [{ x: -10, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }], { ctx, draw: 'instanced', registry: reg, drawnInto: { object: wall, boxes: boxes([-10, 10]) } });
  place(sign, [{ x: 0, y: 5, z: 0 }], { ctx, draw: 'single', registry: reg, drawnInto: { object: wall, boxes: boxes([0]) } });
  const targets = reg.picks.map((p): SelectTarget => ({ object: p.object, entry: p.entry, ...(p.boxAt ? { boxAt: p.boxAt } : {}), ...(p.claim ? { claim: p.claim } : {}) }));
  return { reg, wall, targets };
}

/** a ray from 20 m in front of the wall, straight at (x, y) on it */
const at = (x: number, y: number): THREE.Raycaster => new THREE.Raycaster(new THREE.Vector3(x, y, 20), new THREE.Vector3(0, 0, -1));

describe('a tap on a kit several models are drawn into (E323)', () => {
  it('a drawn-into copy claims only the points on it (a small margin round its box)', () => {
    const { reg } = kit();
    const claim = reg.picks.find((p) => p.entry === lamp.id)?.claim;
    expect(claim).toBeDefined();
    expect(claim?.(new THREE.Vector3(10.2, 5, 0.5))?.getCenter(new THREE.Vector3()).x).toBeCloseTo(10, 6);
    expect(claim?.(new THREE.Vector3(10.5 + CLAIM_MARGIN * 0.9, 5, 0))).not.toBeNull();
    expect(claim?.(new THREE.Vector3(12, 5, 0))).toBeNull(); // 1.5 m from the lamp: the wall's
    // a model's own mesh (not drawn into anything) keeps every hit: no claim
    const own = place(lamp, [{ x: 0, y: 0, z: 30 }], { ctx, draw: 'instanced', registry: reg });
    expect(reg.picks.find((p) => p.object === own.object)?.claim).toBeUndefined();
    expect(claimCopy(own, new THREE.Vector3(0, 0, 30))).not.toBeNull();
  });

  it('picks the copy under the finger, and nothing on a bare stretch of wall', () => {
    const { targets } = kit();
    expect(pickTarget(at(10, 5), targets)?.target.entry).toBe(lamp.id);
    expect(pickTarget(at(0.3, 5.2), targets)?.target.entry).toBe(sign.id);
    expect(pickTarget(at(4, 5), targets)).toBeNull(); // bare wall, 4 m from the sign: not the sign (the nearest copy)
    expect(pickTarget(at(0, 9), targets)).toBeNull();
    expect(pickTarget(at(100, 5), targets)).toBeNull(); // off the wall
    const box = pickTarget(at(-10, 5), targets)?.box;
    expect(box?.getCenter(new THREE.Vector3()).x).toBeCloseTo(-10, 6); // boxed on that copy, not the whole wall
  });

  it('raycasts the shared object once per tap, however many models are drawn into it', () => {
    const { targets } = kit();
    const ray = at(10, 5);
    const spy = vi.spyOn(ray, 'intersectObject');
    pickTarget(ray, targets);
    expect(targets).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a nearer object wins; a plain target (its own mesh) takes any hit on it; a hidden one is skipped', () => {
    const { targets } = kit();
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 1).translate(4, 5, 3), mat);
    post.updateMatrixWorld(true);
    const all: SelectTarget[] = [...targets, { object: post, entry: 'post' }];
    expect(pickTarget(at(4, 5), all)?.target.entry).toBe('post');
    post.visible = false;
    expect(pickTarget(at(4, 5), all)).toBeNull();
  });
});
