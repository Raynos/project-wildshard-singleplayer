/**
 * E322 F-M5 (Jake picked B; the unfixed birds and their Debug row are gone): the two generated-bird shapes the round-16 meshes got wrong,
 * corrected on the vertices at load (birdModels.ts calls these before it tells the parts; the normals are rebuilt after):
 *
 *   inflateBody(pos, side)             the flying owl: its body came back a bas-relief (flat side-on); the belly and the
 *                                      back are pushed out to an ellipsoid between the wing roots, the head, and the tail
 *   clingPose(pos, side, pitch)        the perched woodpecker: it stood on the bark on straight legs, its tail in the air;
 *                                      in the frame its perch puts it in (the trunk a vertical plane in front of its belly)
 *                                      the body lies along the bark, the generated legs go into the belly and new feet
 *                                      grip the bark (a short tarsus, four dark toes hooked in at the claws: `feet`, which
 *                                      birdModels.ts appends), the tail bends down until its tip braces on the bark
 *
 * Pure geometry on a flat xyz array (no three.js loader): scripts/img2mesh/birds/birds_fix_preview.mjs runs them in Node.
 */
import * as THREE from 'three';
import { smoothstep } from '@wildshard/engine/core/noise';

type V3 = readonly [number, number, number];
/** the sidecar fields these read (birds.json, per mesh) */
export interface FixSide {
  bodyHalfWidth: number; neck: V3; feetY: number;
  tailRoot?: V3; tailAxis?: V3; beakTip?: V3; tailTip?: V3;
}


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
    const dy = up * g * smoothstep(-0.1, 0.5, ny) - down * g * smoothstep(-0.1, 0.5, -ny);
    pos[i * 3 + 1] = (pos[i * 3 + 1] ?? 0) + dy;
  }
}

/** the clinging woodpecker's new feet (clingPose): in the pose frame, dark (every vertex on the old feet's own texel) */
export interface ClingFeet { pos: Float32Array; uv: Float32Array; idx: Uint32Array }

/** a tapered tube along `path` (world), appended to `P` / `I` — rings of `sides`, radius `rad[i]`, the last ring a point */
function tube(P: number[], I: number[], path: readonly THREE.Vector3[], rad: readonly number[], sides: number): void {
  const base = P.length / 3, T = new THREE.Vector3(), N1 = new THREE.Vector3(), N2 = new THREE.Vector3(), ref = new THREE.Vector3();
  const m = path.length;
  for (let i = 0; i < m; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(m - 1, i + 1)], c = path[i];
    if (!a || !b || !c) continue;
    T.subVectors(b, a).normalize();
    ref.set(0, 0, 1); if (Math.abs(T.z) > 0.9) ref.set(1, 0, 0);
    N1.crossVectors(T, ref).normalize(); N2.crossVectors(T, N1);
    const r = rad[i] ?? 0;
    for (let j = 0; j < sides; j++) {
      const t = (j / sides) * Math.PI * 2, cs = Math.cos(t) * r, sn = Math.sin(t) * r;
      P.push(c.x + N1.x * cs + N2.x * sn, c.y + N1.y * cs + N2.y * sn, c.z + N1.z * cs + N2.z * sn);
    }
  }
  // (a, b, c) with a→b round the ring and a→c along the path faces outward (smoothNormals' winding)
  for (let i = 0; i + 1 < m; i++) for (let j = 0; j < sides; j++) {
    const a = base + i * sides + j, b = base + i * sides + ((j + 1) % sides), c = a + sides, d = b + sides;
    I.push(a, b, c, b, d, c);
  }
}

/**
 * The perched woodpecker, clinging. `pos` is in the pose frame (the model levelled, feet down, beak +z: birdModels.ts),
 * which its perch pitches nose-up by `pitch` on a trunk whose bark is the plane `bark` metres in front of the pose point
 * (life/index.ts: the spot is `sec.r + 0.05` out from the trunk's axis). In that world frame (+y up, +z toward the trunk):
 *
 *  1. rigid: the body turned until its breast-and-belly line lies along the bark (the lean that leaves the least mean gap
 *     down the torso), then slid in until its nearest point is `gap` off the bark — belly to the trunk, head held off it;
 *  2. the generated legs (straight tarsi, flat plate feet — pressed onto the bark they read as a grey sliver, E322 F-M5
 *     round 2) are drawn into the body, and `feet` are built instead: per side a short tarsus from the lower belly to the
 *     bark and four toes splayed on it (two up, one out, one down-back), each arched off the bark and hooked into it at the
 *     tip — dark curved claws, on the old feet's own dark texel (`uv`, when given);
 *  3. the tail bent down from its root until its tip braces on the bark.
 *
 * Returns the rigid move applied to the whole bird (the neck and shoulder pivots take it) and the feet (pose frame).
 */
export function clingPose(pos: Float32Array, s: FixSide, gen2pose: THREE.Matrix4, o: { pitch: number; bark?: number; gap?: number; uv?: Float32Array | null }): { move: THREE.Matrix4; feet: ClingFeet } {
  const n = pos.length / 3, bark = o.bark ?? 0.05, gap = o.gap ?? 0.004;
  // pose → the perch's world frame (+y up, +z toward the trunk; the bark the plane z = bark) and back
  const W = new THREE.Matrix4().makeRotationX(-o.pitch), Wi = new THREE.Matrix4().makeRotationX(o.pitch);
  const P = new THREE.Vector3();
  const tail = new Uint8Array(n), leg = new Uint8Array(n), head = new Uint8Array(n);
  // the parts, told in the generated frame (gen2pose⁻¹): the tail past its root plane, the legs below the belly, the head
  // above the neck
  const toGen = gen2pose.clone().invert();
  const tr = new THREE.Vector3(...(s.tailRoot ?? [0, -0.1, -0.1])), ta = new THREE.Vector3(...(s.tailAxis ?? [0, -0.63, -0.77])).normalize();
  const headY = s.neck[1] - 0.005;   // above the neck: the head (left out of the torso's profile)
  const legTop = s.feetY + 0.065;   // the belly's underside: the tarsi hang below it (wood_perch: feet −0.200, belly ≈ −0.13)
  const sTail = new Float32Array(n);
  let footUv = -1, footY = Infinity;
  for (let i = 0; i < n; i++) {
    P.set(pos[i * 3] ?? 0, pos[i * 3 + 1] ?? 0, pos[i * 3 + 2] ?? 0).applyMatrix4(toGen);
    const st = P.clone().sub(tr).dot(ta);
    // the feet reach back past the tail's root plane: below the belly and forward of the tail's underside (z > −0.1) is leg
    if (P.y < legTop && P.z > -0.1) { leg[i] = 1; if (P.y < footY) { footY = P.y; footUv = i; } } else if (st > 0) { tail[i] = 1; sTail[i] = st; } else if (P.y < legTop) leg[i] = 1; else if (P.y > headY) head[i] = 1;
  }
  // world
  const w = new Float32Array(pos.length);
  for (let i = 0; i < n; i++) { P.set(pos[i * 3] ?? 0, pos[i * 3 + 1] ?? 0, pos[i * 3 + 2] ?? 0).applyMatrix4(W); w[i * 3] = P.x; w[i * 3 + 1] = P.y; w[i * 3 + 2] = P.z; }
  // 1. rigid: the lean (about +x; + turns +y toward the bark) that lays the torso's front along the bark
  const bins = 24;
  let bestLean = 0, bestGap = Infinity;
  for (let lean = -0.4; lean <= 0.4001; lean += 0.01) {
    const c = Math.cos(lean), sn = Math.sin(lean);
    const prof = new Float32Array(bins).fill(-Infinity);
    let y0 = Infinity, y1 = -Infinity, front = -Infinity;
    const ys: number[] = [], zs: number[] = [];
    for (let i = 0; i < n; i++) {
      if (tail[i] === 1 || leg[i] === 1) continue;
      const y = w[i * 3 + 1] ?? 0, z = w[i * 3 + 2] ?? 0;
      const y2 = y * c - z * sn, z2 = y * sn + z * c;
      front = Math.max(front, z2);
      if (head[i] === 1) continue;
      ys.push(y2); zs.push(z2); y0 = Math.min(y0, y2); y1 = Math.max(y1, y2);
    }
    for (let k = 0; k < ys.length; k++) {
      const b = Math.min(bins - 1, Math.floor(((ys[k] ?? 0) - y0) / (y1 - y0 + 1e-6) * bins));
      prof[b] = Math.max(prof[b] ?? -Infinity, zs[k] ?? 0);
    }
    // the middle of the torso (its ends are the rump and the shoulders' round-off): the mean gap to the front
    let sum = 0, cnt = 0;
    for (let b = 3; b < bins - 3; b++) { const v = prof[b] ?? -Infinity; if (v > -Infinity) { sum += front - v; cnt++; } }
    const mean = cnt > 0 ? sum / cnt : Infinity;
    if (mean < bestGap - 1e-5) { bestGap = mean; bestLean = lean; }
  }
  const turn = new THREE.Matrix4().makeRotationX(bestLean);   // three: +a turns +y toward +z (the bark)
  let front = -Infinity;
  for (let i = 0; i < n; i++) {
    P.set(w[i * 3] ?? 0, w[i * 3 + 1] ?? 0, w[i * 3 + 2] ?? 0).applyMatrix4(turn);
    w[i * 3] = P.x; w[i * 3 + 1] = P.y; w[i * 3 + 2] = P.z;
    if (tail[i] === 0 && leg[i] === 0) front = Math.max(front, P.z);
  }
  const slide = bark - gap - front;
  for (let i = 0; i < n; i++) w[i * 3 + 2] = (w[i * 3 + 2] ?? 0) + slide;
  const rigid = new THREE.Matrix4().makeTranslation(0, 0, slide).multiply(turn);
  const toWorld = (g: readonly [number, number, number]): THREE.Vector3 => new THREE.Vector3(...g).applyMatrix4(gen2pose).applyMatrix4(W).applyMatrix4(rigid);
  // 2. the generated legs drawn into the belly (their faces collapse inside the body) …
  const inside = toWorld([0, s.feetY + 0.1, tr.z + 0.07]);
  for (let i = 0; i < n; i++) if (leg[i] === 1) { w[i * 3] = inside.x; w[i * 3 + 1] = inside.y; w[i * 3 + 2] = inside.z; }
  // … and the new feet: per side a tarsus from the lower belly to the bark, four toes on it hooked in at the tip
  const FP: number[] = [], FI: number[] = [];
  const TOES = [[0.3, 0.03], [-0.15, 0.027], [1.75, 0.024], [2.75, 0.02]] as const;   // (angle from straight up, outward +; length m)
  for (const side of [-1, 1]) {
    const hip = toWorld([side * 0.021, s.feetY + 0.08, tr.z + 0.075]);
    const foot = new THREE.Vector3(side * 0.03, hip.y + 0.01, bark - 0.0042);
    const tp: THREE.Vector3[] = [], trd: number[] = [];
    for (let k = 0; k <= 4; k++) { const f = k / 4; tp.push(hip.clone().lerp(foot, f)); trd.push(0.005 - 0.0012 * f); }
    tube(FP, FI, tp, trd, 6);
    for (const [ang, len] of TOES) {
      const dx = side * Math.sin(ang), dy = Math.cos(ang), path: THREE.Vector3[] = [], rd: number[] = [];
      for (let k = 0; k <= 8; k++) {
        const f = k / 8, r = 0.0032 * (1 - 0.85 * f);
        const off = r + 0.0035 * Math.sin(Math.PI * Math.min(1, f / 0.85)) - 0.0048 * smoothstep(0.7, 1, f);   // arched off the bark, the claw hooked into it
        path.push(new THREE.Vector3(foot.x + dx * len * f, foot.y + dy * len * f, bark - off));
        rd.push(k === 8 ? 0 : r);
      }
      tube(FP, FI, path, rd, 5);
    }
  }
  // 3. the tail, bent down (toward the bark) progressively from its root until its tip props on the bark
  const root = tr.clone().applyMatrix4(gen2pose).applyMatrix4(W).applyMatrix4(rigid);
  const tt = new THREE.Vector3(...(s.tailTip ?? [0, -0.2, -0.21])).applyMatrix4(gen2pose).applyMatrix4(W);
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
    const a = bend * smoothstep(0, sMax, sTail[i] ?? 0);
    const x = w[i * 3] ?? 0, y = (w[i * 3 + 1] ?? 0) - root.y, z = (w[i * 3 + 2] ?? 0) - root.z;
    // rotate (y, z) about the root by −a around x (y down → z toward the bark)
    const c = Math.cos(a), sn = Math.sin(a);
    const y2 = y * c + z * sn, z2 = -y * sn + z * c;
    w[i * 3] = x; w[i * 3 + 1] = root.y + y2; w[i * 3 + 2] = Math.min(root.z + z2, bark - 0.002);
  }
  // back to the pose frame
  for (let i = 0; i < n; i++) { P.set(w[i * 3] ?? 0, w[i * 3 + 1] ?? 0, w[i * 3 + 2] ?? 0).applyMatrix4(Wi); pos[i * 3] = P.x; pos[i * 3 + 1] = P.y; pos[i * 3 + 2] = P.z; }
  const fp = new Float32Array(FP.length);
  for (let i = 0; i < FP.length / 3; i++) { P.set(FP[i * 3] ?? 0, FP[i * 3 + 1] ?? 0, FP[i * 3 + 2] ?? 0).applyMatrix4(Wi); fp[i * 3] = P.x; fp[i * 3 + 1] = P.y; fp[i * 3 + 2] = P.z; }
  const fuv = new Float32Array((FP.length / 3) * 2);
  const u0 = footUv >= 0 && o.uv ? (o.uv[footUv * 2] ?? 0) : 0, v0 = footUv >= 0 && o.uv ? (o.uv[footUv * 2 + 1] ?? 0) : 0;
  for (let i = 0; i < fuv.length / 2; i++) { fuv[i * 2] = u0; fuv[i * 2 + 1] = v0; }
  return { move: Wi.clone().multiply(rigid).multiply(W), feet: { pos: fp, uv: fuv, idx: Uint32Array.from(FI) } };
}
