// E342: VIEW IN WORLD's eye. On Nine Dragon the old three-quarter framing stood the camera inside the stack, a metre from
// a wall or a pipe, and a tap at the centre picked the wall (6 / 20). The eye is now the old framing wherever it is clear,
// else the first clear one of the rings round the copy: no collider at the eye or on the line in, no other drawn-into
// copy's box in front.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadRapier } from '#engine/physics/rapier';
import { Physics } from '#engine/physics/Physics';
import { groups } from '#engine/physics/groups';
import { boxEntry, firstView, physicsClear, roundBlocker, viewCandidates } from '#engine/explore/viewPoint';
import { copyInTheWay, type SelectTarget } from '#engine/explore/pick';
import { WorldRegistry, type RegisteredPick } from '#engine/world/registry';
import { defineModel, modelContext } from '#engine/models/model';
import { place } from '#engine/models/place';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

/** a 1 m copy standing on the ground at the origin */
const copy = (): THREE.Box3 => new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
const centre = (b: THREE.Box3): THREE.Vector3 => b.getCenter(new THREE.Vector3());

/** a box collider: centre, half-extents */
function block(ph: Physics, c: THREE.Vector3, h: THREE.Vector3): void {
  ph.world.createCollider(ph.R.ColliderDesc.cuboid(h.x, h.y, h.z).setTranslation(c.x, c.y, c.z).setCollisionGroups(groups('WORLD')));
}

describe("VIEW IN WORLD's eye (E342)", () => {
  it('tries the old framing first: heading 0.7 rad, 2.2 r out and 0.9 r up, r at least 3 m', () => {
    const b = copy(), eyes = viewCandidates(b), look = centre(b);
    expect(eyes).toHaveLength(96);
    const old = look.clone().add(new THREE.Vector3(Math.sin(0.7) * 3 * 2.2, 3 * 0.9, Math.cos(0.7) * 3 * 2.2));
    expect(eyes[0]?.distanceTo(old)).toBeLessThan(1e-9);
    // a big copy's rings scale with it; no eye stands in (or within a metre of) the copy's box
    const big = new THREE.Box3(new THREE.Vector3(-8, 0, -6), new THREE.Vector3(8, 14, 6));
    const r = big.getBoundingSphere(new THREE.Sphere()).radius;
    for (const eye of viewCandidates(big)) expect(eye.distanceTo(centre(big))).toBeGreaterThanOrEqual(r + 1 - 1e-9);
    for (const eye of eyes) expect(boxEntry(eye, look, b)).toBeGreaterThan(0.5);
  });

  it('keeps the first eye that passes, in order (skipping the one it stands on)', () => {
    const eyes = viewCandidates(copy());
    expect(firstView(eyes, () => true)).toBe(0);
    expect(firstView(eyes, (_, i) => i >= 5)).toBe(5);
    expect(firstView(eyes, () => true, Number.POSITIVE_INFINITY, 0)).toBe(1);
    expect(firstView(eyes, () => false)).toBe(-1);
  });

  it('a wall between the old eye and the copy, or the eye inside a block, fails; the copy\'s own collider does not', async () => {
    const R = await rapier();
    const b = copy(), look = centre(b), eyes = viewCandidates(b);
    const old = eyes[0] ?? look;
    const open = new Physics(R);
    block(open, look, new THREE.Vector3(0.45, 0.5, 0.45)); // the copy's own collider, inside its box
    open.step();
    expect(physicsClear(open, old, look, b)).toBe(true);
    // a wall across the line in, halfway
    const walled = new Physics(R);
    block(walled, look, new THREE.Vector3(0.45, 0.5, 0.45));
    block(walled, old.clone().lerp(look, 0.5), new THREE.Vector3(1.5, 3, 1.5));
    walled.step();
    expect(physicsClear(walled, old, look, b)).toBe(false);
    // the other side of the copy is clear: the ring moves round to it
    const i = firstView(eyes, (eye) => physicsClear(walled, eye, look, b));
    expect(i).toBeGreaterThan(0);
    // an eye inside a block (the stack's floor slab above), or 20 cm from a wall face, fails
    const slab = new Physics(R);
    block(slab, old, new THREE.Vector3(3, 0.3, 3));
    block(slab, eyes[1]?.clone().add(new THREE.Vector3(0.2 + 0.1, 0, 0)) ?? look, new THREE.Vector3(0.1, 3, 3));
    slab.step();
    expect(physicsClear(slab, old, look, b)).toBe(false);
    expect(physicsClear(slab, eyes[1] ?? look, look, b)).toBe(false);
  });

  it('another drawn-into copy in front of the framed one, or round the eye, is in the way; one holding the copy is not', () => {
    const reg = new WorldRegistry(), ctx = modelContext(null), mat = new THREE.MeshBasicMaterial();
    const kit = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 1).translate(0, 5, -20), mat);
    kit.updateMatrixWorld(true);
    const def = (id: string) => defineModel({ id: `shared/test-view-${id}`, name: id, category: 'props', pipeline: 'code', file: 'test/explore-view-point.test.ts', defaults: {}, build: () => [{ geometry: new THREE.BoxGeometry(1, 1, 1), material: mat }] });
    // a sign 4 m out along +z of the framed stool (at the origin), a booth round the stool, a pipe round (0, 1, 8)
    place(def('stool'), [{ x: 0, y: 0.5, z: 0 }], { ctx, draw: 'single', registry: reg, drawnInto: { object: kit, boxes: Float32Array.from([-0.5, 0, -0.5, 0.5, 1, 0.5]) } });
    place(def('sign'), [{ x: 0, y: 0.5, z: 4 }], { ctx, draw: 'single', registry: reg, drawnInto: { object: kit, boxes: Float32Array.from([-1, 0, 3.8, 1, 2, 4.2]) } });
    place(def('booth'), [{ x: 0, y: 1, z: 0 }], { ctx, draw: 'single', registry: reg, drawnInto: { object: kit, boxes: Float32Array.from([-2, 0, -2, 2, 3, 2]) } });
    place(def('pipe'), [{ x: 0, y: 1, z: 8 }], { ctx, draw: 'single', registry: reg, drawnInto: { object: kit, boxes: Float32Array.from([-9, 0.5, 7.5, -8, 1.5, 8.5]) } });
    const targets = reg.picks.map((p: RegisteredPick): SelectTarget => {
      const t: SelectTarget = { object: p.object, entry: p.entry };
      if (p.claim) t.claim = p.claim;
      if (p.boxHit) t.boxHit = p.boxHit;
      return t;
    });
    const look = new THREE.Vector3(0, 0.5, 0), stool = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    const way = (eye: THREE.Vector3): boolean => {
      const ray = new THREE.Ray(eye.clone(), look.clone().sub(eye).normalize());
      return copyInTheWay(ray, boxEntry(eye, look, stool) - 0.05, look, targets);
    };
    expect(way(new THREE.Vector3(0, 0.5, 7))).toBe(true); // the sign is in front
    expect(way(new THREE.Vector3(7, 0.5, 0))).toBe(false); // from the side: only the booth, which holds the stool
    expect(way(new THREE.Vector3(-8.5, 1, 8))).toBe(true); // the eye stands in the pipe
  });
  it('E345: the landed search looks round what the centre hit — a canopy over the copy puts the low eyes from under its far edge first', () => {
    const b = copy(), eyes = viewCandidates(b), look = centre(b);
    // the landed eye (the old framing) hit a canopy 2 m over the copy, a metre toward that eye
    const landed = eyes[0] ?? look;
    const flat = new THREE.Vector3(landed.x - look.x, 0, landed.z - look.z).normalize();
    const canopy = look.clone().addScaledVector(flat, 1).add(new THREE.Vector3(0, 2, 0));
    const order = roundBlocker(eyes.map((_, i) => i).slice(1), eyes, look, canopy);
    expect(order).toHaveLength(eyes.length - 1);
    const first = eyes[order[0] ?? 0] ?? look, last = eyes[order[order.length - 1] ?? 0] ?? look;
    expect(first.y - look.y).toBeLessThan(landed.y - look.y); // under the canopy's line
    expect(new THREE.Vector3(first.x - look.x, 0, first.z - look.z).dot(flat)).toBeLessThan(0); // from its far side
    expect(last.y).toBeGreaterThan(first.y);
    expect(roundBlocker([3, 1, 2], eyes, look, look.clone().add(new THREE.Vector3(0, 0, 0.001)))).toHaveLength(3);
  });
});
