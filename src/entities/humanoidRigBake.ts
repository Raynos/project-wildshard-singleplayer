/**
 * humanoidRigBake — OFFLINE: skins a generated humanoid hull (an image-to-3D figure in an A-pose) to a procedural humanoid
 * skeleton, so the species' own bones and poses drive it (NALATI-MERGE D1: the Golden King, species/goldenKing.ts).
 * The quadruped bake (creatureRigBake.ts) seeds its weights from the posed procedural mesh; a humanoid's arms hang at
 * another angle in every generation, so this one weights by the skeleton's own segments instead — main's way for the
 * Drowned Captain (species/captainMesh.ts: every vertex rides its nearest bone segment), plus:
 *
 *   1. fit      the hull's height to the procedural mesh's, centred over the feet;
 *   2. arms     each arm measured on the hull (the hand = the farthest point out at hand height) and the rig's arm chain
 *               swung about its shoulder onto it, so the labels follow the hull's own arm;
 *   3. label    every vertex one bone: the crown above `crownY`, the cloak behind `capeZ` (off the arms), the head above
 *               the neck, an arm / a leg by its nearest segment when it is close to it, else the torso bone at its height;
 *   4. smooth   Laplacian passes over the welded surface (uv seams joined) blur the labels into soft joints;
 *   5. unpose   the arms swung back to the rig's rest (the same linear blend skinning the game runs), so the bind pose
 *               is the skeleton's and the species' poses start from its hanging arms;
 *   6. keep the top 4 influences, normalised; normals turned with their vertices.
 * Not imported by the game; scripts/nalati-rig-bake.mjs runs it in a headless page and writes the rigged GLB.
 */
import * as THREE from 'three';
import type { BoneDef } from './species/registry';

export interface HumanoidBakeOptions {
  /** per side: [shoulder, elbow, hand] bone names */
  arms: readonly (readonly [string, string, string])[];
  /** per side: [hip, knee, foot] */
  legs: readonly (readonly [string, string, string])[];
  /** the torso chain, bottom → top (the first is the root) */
  torso: readonly string[];
  head: string;
  /** a hat bone: every vertex above `crownY` (fitted metres) */
  crown?: string;
  crownY?: number;
  /** a cloak bone: every vertex behind z = `capeZ`, within |x| < `capeX`, below `capeTopY`, not on an arm */
  cape?: string;
  capeZ?: number;
  capeX?: number;
  capeTopY?: number;
  /** an arm / leg label only this close to its segment (m; default 0.14 / 0.16) */
  armR?: number;
  legR?: number;
  /** Laplacian passes (default 4) */
  smooth?: number;
  /** 'height' (default): the hull's height = the procedural mesh's; 'neck': the hull's neck (its narrowest cross-section
   *  in the upper body, 55–82 % of its height) lands on the rig's neck (the head bone − 4 cm) — a hat of another height
   *  (the Golden King's tall cap) can't then shrink or stretch the body; a number: the hull's top lands at that y (m),
   *  measured per hull (a gold collar can hide the neck) */
  fit?: 'height' | 'neck' | number;
}

export interface HumanoidBakeReport {
  verts: number; welded: number; height: number; scale: number;
  labels: Record<string, number>;
  arms: Record<string, { deg: number }>;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Vector3();
const segDist = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number => {
  _a.subVectors(b, a); _b.subVectors(p, a);
  const t = Math.max(0, Math.min(1, _b.dot(_a) / Math.max(1e-9, _a.lengthSq())));
  return _c.copy(a).addScaledVector(_a, t).distanceTo(p);
};

/**
 * Skin `hull` (position / normal / uv / index; +z forward, +y up) to `bones` whose procedural mesh is `proc` (its height
 * sets the fit). Returns the hull in the skeleton's rest pose with skinIndex / skinWeight (indices into `bones`).
 */
export function bakeHumanoidRig(proc: THREE.BufferGeometry, hull: THREE.BufferGeometry, bones: readonly BoneDef[], opts: HumanoidBakeOptions): { geometry: THREE.BufferGeometry; bones: BoneDef[]; report: HumanoidBakeReport } {
  const idx = new Map(bones.map((b, i) => [b.name, i] as const));
  const bi = (name: string): number => { const i = idx.get(name); if (i === undefined) throw new Error(`humanoid bake: no bone ${name}`); return i; };
  const J = bones.map((b) => new THREE.Vector3(b.pos[0], b.pos[1], b.pos[2]));
  const joint = (name: string): THREE.Vector3 => J[bi(name)] ?? new THREE.Vector3();
  // ── 1: fit ──
  proc.computeBoundingBox();
  const hP = (proc.boundingBox?.max.y ?? 1) - Math.min(0, proc.boundingBox?.min.y ?? 0);
  const g = hull.clone();
  g.computeBoundingBox();
  const hb = g.boundingBox ?? new THREE.Box3();
  const hc = hb.getCenter(new THREE.Vector3());
  g.translate(-hc.x, -hb.min.y, -hc.z);
  const hH = Math.max(1e-6, hb.max.y - hb.min.y);
  let k = typeof opts.fit === 'number' ? opts.fit / hH : hP / hH;
  if (opts.fit === 'neck') {
    const gp = g.getAttribute('position');
    let neckY = 0, best = Infinity;
    for (let y = hH * 0.55; y <= hH * 0.82; y += hH * 0.004) {
      let w = 0;
      for (let i = 0; i < gp.count; i++) { const vy = gp.getY(i), vx = gp.getX(i); if (Math.abs(vy - y) < hH * 0.005 && Math.abs(vx) < hH * 0.1) w = Math.max(w, Math.abs(vx)); }
      if (w > 0 && w < best) { best = w; neckY = y; }
    }
    if (neckY > 0) k = (joint(opts.head).y - 0.04) / neckY;
  }
  g.scale(k, k, k);
  const pos = g.getAttribute('position'), nrm = g.getAttribute('normal'), n = pos.count;
  const P = (i: number, out: THREE.Vector3): THREE.Vector3 => out.set(pos.getX(i), pos.getY(i), pos.getZ(i));
  // ── 2: each arm onto the hull's arm: the hand = the farthest point out on that side, between the hip and the chest ──
  const armRot = new Map<number, THREE.Quaternion>();   // side → rest-to-hull rotation about the shoulder
  const armPosed: { sh: THREE.Vector3; el: THREE.Vector3; hand: THREE.Vector3 }[] = [];
  const report: HumanoidBakeReport = { verts: n, welded: 0, height: hP, scale: k, labels: {}, arms: {} };
  opts.arms.forEach(([shN, elN, handN], side) => {
    const sh = joint(shN), el = joint(elN), hand = joint(handN);
    const sx = Math.sign(sh.x) || 1;
    let best = -Infinity; const found = new THREE.Vector3().copy(hand);
    for (let i = 0; i < n; i++) {
      P(i, _p);
      if (Math.sign(_p.x) !== sx || _p.y > sh.y - 0.1 || _p.y < hand.y - 0.35) continue;
      const out = Math.abs(_p.x) + Math.max(0, _p.z) * 0.2;
      if (out > best) { best = out; found.copy(_p); }
    }
    // the reach from the shoulder: the rig's arm length along the hull's arm direction (the farthest point may be a
    // sword tip or a sleeve — only its direction is used)
    const from = new THREE.Vector3().subVectors(hand, sh).normalize();
    const to = new THREE.Vector3().subVectors(found, sh).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(from, to);
    armRot.set(side, q);
    armPosed.push({ sh: sh.clone(), el: el.clone().sub(sh).applyQuaternion(q).add(sh), hand: hand.clone().sub(sh).applyQuaternion(q).add(sh) });
    report.arms[shN] = { deg: Math.round(THREE.MathUtils.radToDeg(from.angleTo(to)) * 10) / 10 };
  });
  // ── 3: labels ──
  const armR = opts.armR ?? 0.14, legR = opts.legR ?? 0.16;
  const head = bi(opts.head), neckY = joint(opts.head).y - 0.02;
  const torso = opts.torso.map(bi);
  const label = new Int32Array(n);
  const count: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    P(i, _p);
    let L: number;
    if (opts.crown !== undefined && _p.y > (opts.crownY ?? Infinity)) L = bi(opts.crown);
    else {
      // the nearest arm / leg segment, if close
      let bestD = Infinity, bestB = -1;
      opts.arms.forEach(([shN, elN, handN], side) => {
        const a = armPosed[side];
        if (!a || Math.sign(_p.x) !== (Math.sign(a.sh.x) || 1) || Math.abs(_p.x) < Math.abs(a.sh.x) * 0.75) return;
        const d1 = segDist(_p, a.sh, a.el), d2 = segDist(_p, a.el, a.hand), d3 = _p.distanceTo(a.hand);
        if (d1 < bestD && d1 < armR) { bestD = d1; bestB = bi(shN); }
        if (d2 < bestD && d2 < armR) { bestD = d2; bestB = bi(elN); }
        if (d3 < bestD && d3 < armR * 1.8) { bestD = d3; bestB = bi(handN); }  // the hand and what it holds
      });
      const onArm = bestB >= 0;
      if (!onArm && opts.cape !== undefined && _p.z < (opts.capeZ ?? -Infinity) && Math.abs(_p.x) < (opts.capeX ?? 0) && _p.y < (opts.capeTopY ?? 0)) L = bi(opts.cape);
      else if (onArm) L = bestB;
      else if (_p.y > neckY) L = head;
      else {
        for (const [hipN, kneeN, footN] of opts.legs) {
          const hip = joint(hipN), knee = joint(kneeN), foot = joint(footN);
          if (Math.sign(_p.x) !== (Math.sign(hip.x) || 1) || _p.y > hip.y) continue;
          const d1 = segDist(_p, hip, knee), d2 = segDist(_p, knee, foot);
          if (d1 < bestD && d1 < legR) { bestD = d1; bestB = bi(hipN); }
          // below the knee nothing but the leg hangs: a wider reach (a boot heel, a greave's flare)
          if (d2 < bestD && d2 < (_p.y < knee.y ? legR * 2 : legR)) { bestD = d2; bestB = _p.y < foot.y + 0.06 ? bi(footN) : bi(kneeN); }
        }
        if (bestB >= 0) L = bestB;
        else {
          // the torso bone whose joint is nearest below the vertex (body · spine · chest)
          L = torso[0] ?? 0;
          for (const t of torso) if ((J[t]?.y ?? 0) <= _p.y + 0.04) L = t;
        }
      }
    }
    label[i] = L;
    const nm = bones[L]?.name ?? '?';
    count[nm] = (count[nm] ?? 0) + 1;
  }
  report.labels = count;
  // ── 4: smooth over the welded surface ──
  const weldOf = new Int32Array(n), keyMap = new Map<string, number>();
  let nw = 0;
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
    let w = keyMap.get(key);
    if (w === undefined) { w = nw++; keyMap.set(key, w); }
    weldOf[i] = w;
  }
  report.welded = nw;
  const nB = bones.length;
  const index = g.getIndex();
  const tri = index ? index.count / 3 : n / 3;
  const vi = (t: number, c: number): number => (index ? index.getX(t * 3 + c) : t * 3 + c);
  const adj: number[][] = Array.from({ length: nw }, () => []);
  for (let t = 0; t < tri; t++) {
    const a = weldOf[vi(t, 0)] ?? 0, b = weldOf[vi(t, 1)] ?? 0, c = weldOf[vi(t, 2)] ?? 0;
    adj[a]?.push(b, c); adj[b]?.push(a, c); adj[c]?.push(a, b);
  }
  // what the hand holds (the akinakes): grown from the hand's vertices along the surface, while it stays out at the
  // side (no nearer the midline than the hand less 12 cm), in front of the cloak and within reach of the hand
  const wLabel = new Int32Array(nw).fill(-1), wPos: THREE.Vector3[] = Array.from({ length: nw }, () => new THREE.Vector3());
  for (let i = 0; i < n; i++) { const w = weldOf[i] ?? 0; if ((wLabel[w] ?? -1) < 0) { wLabel[w] = label[i] ?? 0; P(i, wPos[w] ?? new THREE.Vector3()); } }
  const armBones = new Set(opts.arms.flatMap((a) => a.map(bi)));
  let held = 0;
  opts.arms.forEach((chain, side) => {
    const handN = chain[2];
    const hbone = bi(handN), hand = armPosed[side]?.hand ?? joint(handN);
    const queue: number[] = [];
    for (let w = 0; w < nw; w++) if (wLabel[w] === hbone) queue.push(w);
    while (queue.length > 0) {
      const w = queue.pop() ?? 0;
      for (const j of adj[w] ?? []) {
        const lj = wLabel[j] ?? -1, p = wPos[j];
        if (lj === hbone || armBones.has(lj) || !p) continue;
        if (Math.abs(p.x) < Math.abs(hand.x) - 0.12 || p.z < -0.12 || p.distanceTo(hand) > 0.8) continue;
        wLabel[j] = hbone; held++; queue.push(j);
      }
    }
  });
  report.labels['held'] = held;
  let W = new Float32Array(nw * nB);
  for (let i = 0; i < n; i++) { const w = weldOf[i] ?? 0; const l = wLabel[w] ?? -1; W[w * nB + (armBones.has(l) ? l : (label[i] ?? 0))] = 1; }
  for (let w = 0; w < nw; w++) {   // a welded vertex seen with several labels: split evenly
    let sum = 0;
    for (let b = 0; b < nB; b++) sum += W[w * nB + b] ?? 0;
    if (sum > 1) for (let b = 0; b < nB; b++) W[w * nB + b] = (W[w * nB + b] ?? 0) / sum;
  }
  // the crown and the cape keep hard edges (a bone scaled to nothing takes exactly its own vertices away)
  const hard = new Set([opts.crown, opts.cape].filter((x): x is string => x !== undefined).map(bi));
  for (let pass = 0; pass < (opts.smooth ?? 4); pass++) {
    const next = W.slice();
    for (let w = 0; w < nw; w++) {
      const nb = adj[w];
      if (!nb || nb.length === 0) continue;
      let own = -1;
      for (const h of hard) if ((W[w * nB + h] ?? 0) > 0.99) own = h;
      if (own >= 0) continue;
      for (let b = 0; b < nB; b++) {
        if (hard.has(b)) continue;
        let s = W[w * nB + b] ?? 0;
        for (const j of nb) s += W[j * nB + b] ?? 0;
        next[w * nB + b] = s / (nb.length + 1);
      }
    }
    W = next;
  }
  // ── 5: unpose the arms (LBS with each arm bone turned back by its side's rotation) + 6: top 4 ──
  const inv = new Map<number, THREE.Quaternion>();
  const pivot = new Map<number, THREE.Vector3>();
  opts.arms.forEach(([shN, elN, handN], side) => {
    const q = armRot.get(side)?.clone().invert() ?? new THREE.Quaternion();
    for (const nm of [shN, elN, handN]) { inv.set(bi(nm), q); pivot.set(bi(nm), joint(shN)); }
  });
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  const order: number[] = [];
  const acc = new THREE.Vector3(), accN = new THREE.Vector3(), tp = new THREE.Vector3(), tn = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const w = weldOf[i] ?? 0;
    P(i, _p); nv.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    acc.set(0, 0, 0); accN.set(0, 0, 0);
    let tot = 0;
    for (let b = 0; b < nB; b++) {
      const wt = W[w * nB + b] ?? 0;
      if (wt <= 0) continue;
      const q = inv.get(b), pv = pivot.get(b);
      if (q && pv) { tp.copy(_p).sub(pv).applyQuaternion(q).add(pv); tn.copy(nv).applyQuaternion(q); } else { tp.copy(_p); tn.copy(nv); }
      acc.addScaledVector(tp, wt); accN.addScaledVector(tn, wt); tot += wt;
    }
    if (tot > 0) { acc.multiplyScalar(1 / tot); pos.setXYZ(i, acc.x, acc.y, acc.z); accN.normalize(); nrm.setXYZ(i, accN.x, accN.y, accN.z); }
    order.length = 0;
    for (let b = 0; b < nB; b++) if ((W[w * nB + b] ?? 0) > 1e-4) order.push(b);
    order.sort((a, b) => (W[w * nB + b] ?? 0) - (W[w * nB + a] ?? 0));
    let sum = 0;
    for (let c = 0; c < 4 && c < order.length; c++) sum += W[w * nB + (order[c] ?? 0)] ?? 0;
    if (sum <= 0) { skinIndex[i * 4] = torso[0] ?? 0; skinWeight[i * 4] = 1; continue; }
    for (let c = 0; c < 4 && c < order.length; c++) { const b = order[c] ?? 0; skinIndex[i * 4 + c] = b; skinWeight[i * 4 + c] = (W[w * nB + b] ?? 0) / sum; }
  }
  pos.needsUpdate = true; nrm.needsUpdate = true;
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return { geometry: g, bones: bones.map((b) => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] })), report };
}
