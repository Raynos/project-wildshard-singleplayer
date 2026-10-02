import { CapsuleGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

export function gloveHand(armDir: Vector3): Group {
  const group = new Group(); group.name = 'far.fan.hand';
  const leather = new MeshStandardMaterial({ color: 0x4a2f22, roughness: 0.62, metalness: 0.05 });
  const tooled = new MeshStandardMaterial({ color: 0x7a5236, roughness: 0.7, metalness: 0.05 });
  const bronze = new MeshStandardMaterial({ color: 0xc09048, roughness: 0.35, metalness: 0.7, emissive: 0x2a1a08 });
  const linen = new MeshStandardMaterial({ color: 0xe9dfc8, roughness: 1, metalness: 0 });
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
  const sleeve = new Mesh(new CylinderGeometry(0.041, 0.056, 0.34, 14), linen); sleeve.position.y = 0.3; arm.add(sleeve);
  for (const y of [0.17, 0.215, 0.26, 0.33]) {
    const band = new Mesh(new TorusGeometry(0.041 + (y - 0.13) * 0.044, 0.006, 5, 18), wrap); band.rotation.x = Math.PI / 2; band.rotation.z = 0.25; band.position.y = y; arm.add(band);
  }
  return group;
}
