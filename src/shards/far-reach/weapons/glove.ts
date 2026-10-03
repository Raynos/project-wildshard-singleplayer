import { CapsuleGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skyHd } from '../world/meshes';

/**
 * The fan hand (loop 5; mockup C's "target C", council R1C-14 / R1B-8 / R1A-6): a right hand in a dark leather glove
 * closed round the fan's grip, four three-jointed fingers curled across the front of the grip and the thumb laid over
 * them, the knuckles at the back; a tooled leather bracer with two rings of bronze studs; and a cream linen sleeve bound
 * with dark wraps, running back toward the camera's lower right. It replaces the engine's shared lumpy fist and the plain
 * cylinders.
 *
 * Local frame: the grip's axis is +Y through the origin (the fan above, the hand at y 0); the fan faces +Z (the camera).
 * `armDir` is the forearm's direction from the wrist toward the camera.
 */
export const GLOVE = { grip: 0.017, finger: 0.0105, spacing: 0.021 } as const;

const capsuleBetween = (a: Vector3, b: Vector3, r: number): BufferGeometry => {
  const d = b.clone().sub(a), len = d.length(), g = new CapsuleGeometry(r, Math.max(0.0005, len), 3, 8);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z); return g;
};

/** The forearm's direction from the wrist toward the camera (fan space): out to the frame's right edge. */
export const ARM_DIR = new Vector3(0.85, -0.42, 0.8);

export function gloveHand(armDir: Vector3 = ARM_DIR): Group {
  const group = new Group(); group.name = 'far.fan.hand';
  const leather = new MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.62, metalness: 0.05 });
  const tooled = new MeshStandardMaterial({ color: 0x5e4028, roughness: 0.7, metalness: 0.05 });
  const bronze = new MeshStandardMaterial({ color: 0xc09048, roughness: 0.35, metalness: 0.7, emissive: 0x2a1a08 });
  const wrap = new MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95, metalness: 0 });
  // the fingers: index at the top, little finger lowest; each curls from the knuckle (back, +x−z) round the front (+z)
  // to its tip pressed on the far side of the grip (−x)
  const R = GLOVE.grip + GLOVE.finger * 0.95, parts: BufferGeometry[] = [];
  for (let f = 0; f < 4; f++) {
    const y = -f * GLOVE.spacing, r = GLOVE.finger * (1 - f * 0.07), reach = 1 - f * 0.08;
    const at = (deg: number, rr = R): Vector3 => { const a = (deg * Math.PI) / 180; return new Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr); };
    const knuckle = at(-35, R + 0.012), p1 = at(30), p2 = at(100), tip = at(100 + 70 * reach);
    parts.push(capsuleBetween(knuckle, p1, r), capsuleBetween(p1, p2, r * 0.95), capsuleBetween(p2, tip, r * 0.88));
  }
  // the palm and the back of the hand: a rounded block behind the grip, the knuckle ridge on its front edge
  const palm = new SphereGeometry(1, 12, 10); palm.scale(0.03, 0.048, 0.024); palm.translate(0.034, -0.032, -0.012); parts.push(palm);
  // the thumb: from the palm's heel round over the index and middle fingers
  const t0 = new Vector3(0.03, -0.07, 0.016), t1 = new Vector3(0.016, -0.03, 0.03), t2 = new Vector3(-0.004, -0.008, 0.032);
  parts.push(capsuleBetween(t0, t1, 0.012), capsuleBetween(t1, t2, 0.0105));
  // the wrist, out of the palm toward the arm
  const wrist0 = new Vector3(0.04, -0.07, -0.004), dir = armDir.clone().normalize();
  parts.push(capsuleBetween(wrist0, wrist0.clone().addScaledVector(dir, 0.05), 0.026));
  group.add(new Mesh(mergeGeometries(parts.map((g) => g.toNonIndexed())), leather));
  for (const g of parts) g.dispose();
  // the bracer and the sleeve, along the arm
  const arm = new Group(); arm.position.copy(wrist0).addScaledVector(dir, 0.045); arm.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir); group.add(arm);
  const bracer = new Mesh(new CylinderGeometry(0.031, 0.037, 0.13, 14), tooled); bracer.position.y = 0.065; arm.add(bracer);
  for (const [y, rr] of [[0.016, 0.0318], [0.114, 0.0365]] as const) {
    const band = new Mesh(new TorusGeometry(rr, 0.0035, 5, 18), leather); band.rotation.x = Math.PI / 2; band.position.y = y; arm.add(band);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4, stud = new Mesh(new SphereGeometry(0.0042, 6, 5), bronze);
      stud.position.set(Math.cos(a) * (rr + 0.001), y + 0.012, Math.sin(a) * (rr + 0.001)); arm.add(stud);
    }
  }
  // the sleeve (council round 2: "a plain cream tube"): loose linen in soft folds, the fold valleys shaded, a woven
  // teal-and-gold border at the cuff end
  const sleeveGeo = new CylinderGeometry(0.041, 0.058, 0.34, 20, 10), sp = sleeveGeo.getAttribute('position'), sc: number[] = [];
  const cream = new Color(0xece2cc), shadow = new Color(0xb9ab92), teal = new Color(0x2f8a8c), gold = new Color(0xc79a4a), out = new Color();
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), a = Math.atan2(z, x), fold = Math.sin(a * 5 + y * 14) * 0.5 + 0.5;
    const k = 1 + 0.09 * fold; sp.setXYZ(i, x * k, y, z * k);
    out.copy(cream).lerp(shadow, (1 - fold) * 0.55);
    const t = (y + 0.17) / 0.34;
    if (t > 0.04 && t < 0.1) out.copy(teal); else if (t >= 0.1 && t < 0.13) out.copy(gold);
    sc.push(out.r, out.g, out.b);
  }
  sleeveGeo.setAttribute('color', new Float32BufferAttribute(sc, 3)); sleeveGeo.computeVertexNormals();
  const sleeve = new Mesh(sleeveGeo, new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); sleeve.position.y = 0.3; arm.add(sleeve);
  for (const y of [0.17, 0.215, 0.26, 0.33]) {
    const band = new Mesh(new TorusGeometry(0.041 + (y - 0.13) * 0.044, 0.006, 5, 18), wrap); band.rotation.x = Math.PI / 2; band.rotation.z = 0.25; band.position.y = y; arm.add(band);
  }
  return group;
}

/**
 * The textured hero hand (E392/E399, art/far-reach/round-20-fan-hand/; top-10 row 3 rebuilt it as the layered glove,
 * art/far-reach/round-23-fan-glove/: a codex reference of mockup C's hand → Hunyuan3D-2 turbo shape + paint → weld,
 * simplify, 1024 WebP map, meshopt): a fingerless leather gauntlet with plates over the back of the hand and the knuckles,
 * closed round a short red-wrapped handle with bronze caps, a bracer of overlapping bronze-edged lames with two buckled
 * straps, a linen sleeve bound with cords. Null when the model did not load (the code hand above stands in).
 *
 * The file's frame: the handle upright at the −X end, the forearm level along +X, the fingers facing +Z. Placed here with the
 * handle's axis on the fan's grip axis (+Y) and its top cap at the pivot (y 0), the forearm turned `HERO_HAND.yaw` about
 * the grip toward the camera; `grip` is the handle's length below the pivot (where the tassel hangs).
 */
export const HERO_HAND = { handle: 0.16, yaw: -0.8, sleeve: 0.62, stretch: 2.4 } as const;
export function heroHand(): { readonly group: Group; readonly grip: number } | null {
  const made = skyHd('hand-hd'); if (made === null) return null;
  const g = made.geometry, p = g.getAttribute('position'); g.computeBoundingBox();
  const box = g.boundingBox; if (box === null) return null;
  // the handle stands above the fist: its top stub (the highest 6 %, at the −X end) gives its axis; it spans the full height
  const top = box.max.y, bottom = box.min.y, stub = top - (top - bottom) * 0.06, end = box.min.x + (box.max.x - box.min.x) * 0.25;
  let x = 0, z = 0, n = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) >= stub && p.getX(i) <= end) { x += p.getX(i); z += p.getZ(i); n++; }
  if (n === 0 || top <= bottom) { g.dispose(); return null; }
  // the sleeve past the bracer is drawn out (×`stretch`) so the forearm runs off the frame's edge instead of ending in view
  const cut = box.min.x + (box.max.x - box.min.x) * HERO_HAND.sleeve;
  for (let i = 0; i < p.count; i++) { const px = p.getX(i); if (px > cut) p.setX(i, cut + (px - cut) * HERO_HAND.stretch); }
  p.needsUpdate = true;
  const k = HERO_HAND.handle / (top - bottom);
  g.translate(-x / n, -top, -z / n); g.scale(k, k, k); g.rotateY(HERO_HAND.yaw); g.computeVertexNormals();
  const group = new Group(); group.name = 'far.fan.hand';
  group.add(new Mesh(g, new MeshStandardMaterial({ map: made.map, roughness: 0.78, metalness: 0 })));
  return { group, grip: HERO_HAND.handle };
}
