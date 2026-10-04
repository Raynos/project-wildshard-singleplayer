// E323: a tap in the World Explorer on an object several models are drawn into (a Nine Dragon kit, a Nalati place's
// painted mesh) picks a model only where one of its copies stands. A bare wall picks nothing — it used to pick the
// nearest copy, metres away — and the shared object is raycast once per tap, not once per model drawn into it.
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry, type RegisteredPick } from '../src/engine/world/registry';
import { defineModel, modelContext } from '../src/engine/models/model';
import { CLAIM_MARGIN, claimCopy, place } from '../src/engine/models/place';
import { MIN_PICK, pickTarget, type SelectTarget } from '../src/engine/explore/pick';

const ctx = modelContext(null);
const mat = new THREE.MeshBasicMaterial();
const lamp = defineModel({ id: 'shared/test-pick-lamp', name: 'Lamp', category: 'props', pipeline: 'code', file: 'test/select-pick.test.ts', defaults: {}, build: () => [{ geometry: new THREE.BoxGeometry(1, 1, 1), material: mat }] });
const sign = defineModel({ id: 'shared/test-pick-sign', name: 'Sign', category: 'props', pipeline: 'code', file: 'test/select-pick.test.ts', defaults: {}, build: () => [{ geometry: new THREE.BoxGeometry(1, 1, 1), material: mat }] });

/** a registered pick as Explore hands it to Select (Explore.ts selectTargets) */
function asTarget(p: RegisteredPick): SelectTarget {
  const t: SelectTarget = { object: p.object, entry: p.entry };
  if (p.boxAt) t.boxAt = p.boxAt;
  if (p.claim) t.claim = p.claim;
  if (p.boxHit) t.boxHit = p.boxHit;
  return t;
}

/** a 40 m wall (the kit: one mesh) with two lamps and a sign drawn into it, 1 m boxes on its face (z = 0) */
function kit(): { reg: WorldRegistry; wall: THREE.Mesh; targets: SelectTarget[] } {
  const reg = new WorldRegistry();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 1).translate(0, 5, -0.5), mat);
  wall.updateMatrixWorld(true);
  const boxes = (xs: number[]): Float32Array => Float32Array.from(xs.flatMap((x) => [x - 0.5, 4.5, -0.5, x + 0.5, 5.5, 0.5]));
  place(lamp, [{ x: -10, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }], { ctx, draw: 'instanced', registry: reg, drawnInto: { object: wall, boxes: boxes([-10, 10]) } });
  place(sign, [{ x: 0, y: 5, z: 0 }], { ctx, draw: 'single', registry: reg, drawnInto: { object: wall, boxes: boxes([0]) } });
  const targets = reg.picks.map(asTarget);
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

  it('a tap through a copy\'s open shape (its box, in front of the wall it lands on) is that copy\'s; a box behind the wall is not', () => {
    const { reg, wall } = kit();
    const post = defineModel({ id: 'shared/test-pick-post', name: 'Post', category: 'props', pipeline: 'code', file: 'test/select-pick.test.ts', defaults: {}, build: () => [{ geometry: new THREE.BoxGeometry(1, 1, 1), material: mat }] });
    // a table drawn into the wall's kit 1–3 m in front of it (its legs: nothing of it under the tap), and one behind
    place(post, [{ x: 4.5, y: 1.5, z: 2 }, { x: 14.5, y: 1.5, z: -4 }], { ctx, draw: 'single', registry: reg,
      drawnInto: { object: wall, boxes: Float32Array.from([4, 0, 1, 5, 3, 3, 14, 0, -5, 15, 3, -3]) } });
    const targets = reg.picks.map(asTarget);
    const hit = pickTarget(at(4.5, 1.5), targets);
    expect(hit?.target.entry).toBe(post.id);
    expect(hit?.point.z).toBeCloseTo(3, 6); // where the ray entered its box
    expect(pickTarget(at(14.5, 1.5), targets)).toBeNull(); // behind the wall: the wall's
    expect(pickTarget(at(10, 5), targets)?.target.entry).toBe(lamp.id); // a surface a copy claims still wins
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

describe('E345: a nested target and a small copy', () => {
  it('a target drawn inside another target\'s object (a cabin\'s root holds its fire pit) is the one hit, whichever registered first', () => {
    const reg = new WorldRegistry();
    // the cabin: its root holds its walls and its fire pit out front; its copy box covers the yard the pit stands in
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6).translate(0, 2, -6), mat));
    const pit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8).translate(0, 0.2, 2), mat);
    root.add(pit);
    root.updateMatrixWorld(true);
    place(lamp, [{ x: 0, y: 0, z: -3 }], { ctx, draw: 'merged', registry: reg, drawnInto: { object: root, boxes: Float32Array.from([-3, 0, -9, 3, 4, 3.5]) } });
    place(sign, [{ x: 0, y: 0, z: 2 }], { ctx, draw: 'single', registry: reg, drawnInto: { object: pit, boxes: Float32Array.from([-0.9, 0, 1.1, 0.9, 0.4, 2.9]) } });
    const targets = reg.picks.map(asTarget);
    expect(targets.map((t) => t.entry)).toEqual([lamp.id, sign.id]); // the cabin first, as Pine Hollow registers them
    const down = (x: number, z: number): THREE.Raycaster => new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
    expect(pickTarget(down(0.3, 2.2), targets)?.target.entry).toBe(sign.id); // on the pit: the pit
    expect(pickTarget(down(0, -6), targets)?.target.entry).toBe(lamp.id); // on the walls: the cabin
  });

  it('a copy under MIN_PICK takes a tap whose ray passes through its box in front of the surface; a bigger one does not', () => {
    const { reg, targets } = kit();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 8).translate(0, -0.5, 0), mat);
    roof.updateMatrixWorld(true);
    const batch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05).translate(20, 0, 20), mat); // the pickups' batch, far off
    batch.updateMatrixWorld(true);
    const flint = defineModel({ id: 'shared/test-pick-flint', name: 'Flint', category: 'props', pipeline: 'code', file: 'test/select-pick.test.ts', defaults: {}, build: () => [{ geometry: new THREE.BoxGeometry(0.1, 0.05, 0.1), material: mat }] });
    // a 0.5 m pick box on the roof (at the origin) and a 1.2 m one 3 m off, both drawn into the batch; the roof is a model of its own
    place(flint, [{ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }], { ctx, draw: 'single', registry: reg,
      drawnInto: { object: batch, boxes: Float32Array.from([-0.25, 0, -0.25, 0.25, 0.5, 0.25, 2.4, 0, -0.6, 3.6, 1.2, 0.6]) } });
    const all: SelectTarget[] = [...reg.picks.map(asTarget), { object: roof, entry: 'roof' }];
    expect(targets.length).toBeLessThan(all.length);
    const ray = (x: number, z: number): THREE.Raycaster => new THREE.Raycaster(new THREE.Vector3(x - 2, 8, z), new THREE.Vector3(2, -8, 0).normalize());
    expect(MIN_PICK).toBeGreaterThanOrEqual(0.5);
    expect(pickTarget(ray(0.1, 0.05), all)?.target.entry).toBe(flint.id); // lands on the roof beside it: through its box first
    expect(pickTarget(ray(3.1, 0.05), all)?.target.entry).toBe('roof'); // a 1.2 m box is no small copy: the roof's
    expect(pickTarget(ray(1.5, 0.05), all)?.target.entry).toBe('roof');
  });
});
