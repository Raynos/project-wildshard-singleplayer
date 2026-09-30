/**
 * E322 F-M5 (Debug ▸ Creatures & NPCs ▸ Bird fix = B): the two generated-bird shapes the round-16 meshes got wrong,
 * corrected on the vertices at load (birdModels.ts calls these before it tells the parts; the normals are rebuilt after):
 *
 *   inflateBody(pos, side)             the flying owl: its body came back a bas-relief (flat side-on); the belly and the
 *                                      back are pushed out to an ellipsoid between the wing roots, the head, and the tail
 *   clingPose(pos, side, pitch)        the perched woodpecker: it stood on the bark on straight legs, its tail in the air;
 *                                      in the frame its perch puts it in (the trunk a vertical plane in front of its belly)
 *                                      the body leans back to the bark, the legs fold up under the breast onto the bark,
 *                                      the tail bends down until its tip props on the bark
 *
 * Pure geometry on a flat xyz array (no three.js loader): scripts/img2mesh/birds/birds_fix_preview.mjs runs them in Node.
 */
import * as THREE from 'three';

type V3 = readonly [number, number, number];
/** the sidecar fields these read (birds.json, per mesh) */
export interface FixSide {
  bodyHalfWidth: number; neck: V3; feetY: number;
  tailRoot?: V3; tailAxis?: V3; beakTip?: V3; tailTip?: V3;
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * The flying owl's body, given volume: a smooth displacement field over the body between the tail root and the neck,
 * inboard of the wing roots — every vertex on the underside moves down, every vertex on the back up, by a paraboloid bump
 * (deepest mid-body, nothing at the wing roots / the head / the tail), so the belly fills out like a great grey owl's fluffed
 * breast and the flanks stretch to join it. Additive, not a clamp: the 900-triangle shell is sparse, and pushing single
 * vertices out to a surface raised spikes. `nor`: the generated normals (which side of the shell a vertex is on).
 */
export function inflateBody(pos: Float32Array, nor: Float32Array, s: FixSide, o: { down?: number; up?: number } = {}): void {
  const n = pos.length / 3, bhw = s.bodyHalfWidth;
  const tailZ = s.tailRoot?.[2] ?? -0.15, neckZ = s.neck[2];
  const zc = (tailZ + neckZ) / 2 - 0.01, rz = (neckZ - tailZ) / 2 + 0.07, rx = bhw * 0.8;
  const down = o.down ?? 0.13, up = o.up ?? 0.04;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] ?? 0, z = pos[i * 3 + 2] ?? 0;
    const e = 1 - (x / rx) ** 4 - ((z - zc) / rz) ** 2;   // x⁴: a round-bottomed belly, not a keel
    if (e <= 0) continue;
    const g = e * e * (3 - 2 * e);   // smooth at its rim: no crease where the field starts
    const ny = nor[i * 3 + 1] ?? 0;
    const dy = up * g * smooth(-0.1, 0.5, ny) - down * g * smooth(-0.1, 0.5, -ny);
    pos[i * 3 + 1] = (pos[i * 3 + 1] ?? 0) + dy;
  }
}

/**
 * The perched woodpecker, clinging. `pos` is in the pose frame (the model levelled, feet down, beak +z: birdModels.ts),
 * which its perch pitches nose-up by `pitch` on a trunk whose bark is the plane `bark` metres in front of the pose point
 * (life/index.ts: the spot is `sec.r + 0.05` out from the trunk's axis). Returns the rigid move applied to the whole bird
 * (the neck and shoulder pivots take it too); the legs and the tail then bend on top of it.
 */
export function clingPose(pos: Float32Array, s: FixSide, gen2pose: THREE.Matrix4, o: { pitch: number; bark?: number; lean?: number; gap?: number }): THREE.Matrix4 {
  const n = pos.length / 3, bark = o.bark ?? 0.05;
  // pose → the perch's world frame (+y up, +z toward the trunk; the bark the plane z = bark) and back
  const W = new THREE.Matrix4().makeRotationX(-o.pitch), Wi = new THREE.Matrix4().makeRotationX(o.pitch);
  const P = new THREE.Vector3();
  const tail = new Uint8Array(n), leg = new Uint8Array(n);
  // the parts, told in the generated frame (gen2pose⁻¹): the tail past its root plane, the legs below the belly
  const toGen = gen2pose.clone().invert();
  const tr = new THREE.Vector3(...(s.tailRoot ?? [0, -0.1, -0.1])), ta = new THREE.Vector3(...(s.tailAxis ?? [0, -0.63, -0.77])).normalize();
  const legTop = s.feetY + 0.065;   // the belly's underside: the tarsi hang below it (wood_perch: feet −0.200, belly ≈ −0.13)
  const sTail = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    P.set(pos[i * 3] ?? 0, pos[i * 3 + 1] ?? 0, pos[i * 3 + 2] ?? 0).applyMatrix4(toGen);
    const st = P.clone().sub(tr).dot(ta);
    if (st > 0) { tail[i] = 1; sTail[i] = st; } else if (P.y < legTop) leg[i] = 1;
  }
  // world
  const w = new Float32Array(pos.length);
  for (let i = 0; i < n; i++) { P.set(pos[i * 3] ?? 0, pos[i * 3 + 1] ?? 0, pos[i * 3 + 2] ?? 0).applyMatrix4(W); w[i * 3] = P.x; w[i * 3 + 1] = P.y; w[i * 3 + 2] = P.z; }
  // 1. rigid: lean the body back from its nose-into-the-trunk tilt to `lean` (head away from the bark), then slide it in
  //    until the breast is `gap` off the bark
  const beak = new THREE.Vector3(...(s.beakTip ?? [0, 0.07, 0.15])).applyMatrix4(gen2pose).applyMatrix4(W);
  const tt = new THREE.Vector3(...(s.tailTip ?? [0, -0.2, -0.21])).applyMatrix4(gen2pose).applyMatrix4(W);
  const axisAng = Math.atan2(beak.z - tt.z, beak.y - tt.y);          // the body axis's lean toward the trunk (+) from vertical
  const turn = new THREE.Matrix4().makeRotationX(-(axisAng + (o.lean ?? 0.06)));   // about +x (+y turns toward +z): minus leans it back
  let front = -Infinity;
  for (let i = 0; i < n; i++) {
    P.set(w[i * 3] ?? 0, w[i * 3 + 1] ?? 0, w[i * 3 + 2] ?? 0).applyMatrix4(turn);
    w[i * 3] = P.x; w[i * 3 + 1] = P.y; w[i * 3 + 2] = P.z;
    if (tail[i] === 0 && leg[i] === 0) front = Math.max(front, P.z);
  }
  const slide = bark - (o.gap ?? 0.012) - front;
  for (let i = 0; i < n; i++) w[i * 3 + 2] = (w[i * 3 + 2] ?? 0) + slide;
  const rigid = new THREE.Matrix4().makeTranslation(0, 0, slide).multiply(turn);
  // 2. the legs, folded up under the breast: turned about the hip (the tarsi's top, centre) until they lie along the
  //    bark with the feet up toward the chest, then pressed onto the bark
  const hip = new THREE.Vector3(0, s.feetY + 0.07, tr.z + 0.07).applyMatrix4(gen2pose).applyMatrix4(W).applyMatrix4(rigid);
  const fold = new THREE.Matrix4().makeTranslation(hip.x, hip.y, hip.z).multiply(new THREE.Matrix4().makeRotationX(-1.25)).multiply(new THREE.Matrix4().makeScale(1, 0.85, 0.85)).multiply(new THREE.Matrix4().makeTranslation(-hip.x, -hip.y, -hip.z));
  for (let i = 0; i < n; i++) {
    if (leg[i] === 0) continue;
    P.set(w[i * 3] ?? 0, w[i * 3 + 1] ?? 0, w[i * 3 + 2] ?? 0).applyMatrix4(fold);
    w[i * 3] = P.x; w[i * 3 + 1] = P.y; w[i * 3 + 2] = Math.min(P.z, bark - 0.002);
  }
  // 3. the tail, bent down (toward the bark) progressively from its root until its tip props on the bark
  const root = tr.clone().applyMatrix4(gen2pose).applyMatrix4(W).applyMatrix4(rigid);
  let sMax = 0;
  for (let i = 0; i < n; i++) if (tail[i] === 1) sMax = Math.max(sMax, sTail[i] ?? 0);
  const tip = tt.clone().applyMatrix4(rigid);
  // the angle that swings the tip (about the root, around x) onto the bark plane
  const ry = tip.y - root.y, rzz = tip.z - root.z, rr = Math.hypot(ry, rzz);
  const want = Math.asin(Math.min(1, Math.max(-1, (bark - 0.004 - root.z) / Math.max(1e-4, rr))));
  const have = Math.atan2(rzz, -ry);                                     // the tip's angle toward +z from straight down
  const bend = want - have;
  for (let i = 0; i < n; i++) {
    if (tail[i] === 0) continue;
    const a = bend * smooth(0, sMax, sTail[i] ?? 0);
    const x = w[i * 3] ?? 0, y = (w[i * 3 + 1] ?? 0) - root.y, z = (w[i * 3 + 2] ?? 0) - root.z;
    // rotate (y, z) about the root by −a around x (y down → z toward the bark)
    const c = Math.cos(a), sn = Math.sin(a);
    const y2 = y * c + z * sn, z2 = -y * sn + z * c;
    w[i * 3] = x; w[i * 3 + 1] = root.y + y2; w[i * 3 + 2] = Math.min(root.z + z2, bark - 0.002);
  }
  // back to the pose frame
  for (let i = 0; i < n; i++) { P.set(w[i * 3] ?? 0, w[i * 3 + 1] ?? 0, w[i * 3 + 2] ?? 0).applyMatrix4(Wi); pos[i * 3] = P.x; pos[i * 3 + 1] = P.y; pos[i * 3 + 2] = P.z; }
  return Wi.clone().multiply(rigid).multiply(W);
}
