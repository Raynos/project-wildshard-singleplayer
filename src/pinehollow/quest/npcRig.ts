/**
 * E322 F-M3 — the Pine Hollow people's second rig (Debug ▸ Creatures & NPCs ▸ NPC rig = B; A = npcModels.ts's upper-body
 * rig, today's). Built at load from the hull like A, so it rigs every face variant (E304: the faces only change the head
 * above the neck). What B adds:
 *
 *   legs      a thigh → shin → foot chain per side, placed on the legs' own centre lines (the generated people stand ~2–3 cm
 *             off x = 0, and their A-pose legs ~0.07 H apart). Weighted by height (the pelvis blends hips → thigh from 0.52 H
 *             down to 0.40 H, the knee and the ankle blend over ±0.035 H / 0.035 H), split by side with a blend band round
 *             the legs' midline that widens up the thigh (0.015 H at the shin → 0.05 H at the crotch: a long coat's front
 *             panel rides both legs), the foot on its own bone below the ankle.
 *   shoulder  a clavicle (chest → clavicle → shoulder → twist → elbow → hand) protracts and lifts with a forward raise (15 % /
 *             12 % of it, + 30 % of a point's yaw); the deltoid cap — the torso side of the shoulder, which A left 100 % on
 *             the chest while the arm under it rose — is weighted by its distance from the joint (the shoulder 50 % at the
 *             joint → 0 at 0.10 H, the clavicle 50 % → 0 at 0.16 H), the arm root the same 50 / 50 so the two meet; an
 *             upper-arm twist bone takes half of the raise's twist about the arm (a swing-twist split). Then the girdle's
 *             weights (spine, chest, clavicles, shoulders, twists) are blurred along the welded surface within 0.18 H of
 *             either joint (`diffuse`): A's worst stretch was the armpit's crease, where the air-gap test put one vertex on
 *             the arm and its neighbour on the chest. Measured on Hale's point (test/pine-npc-rig.test.ts), the edges round
 *             the shoulder: A p99 2.5–6.3×, worst 10–19× · B p99 1.4–2.2×, worst 3.3–6.5×.
 *   clips     A's idle / talk / point, the same poses (the shoulder's Euler split over clavicle · shoulder · twist), plus a
 *             walk: a phase machine per foot (stance 60 % of a 1.0 s cycle, the ball of the foot planted, the heel lifting
 *             before toe-off, a swing arc 0.04 H high), two-bone IK per leg solved in the hips' frame (so the idle weight
 *             shift and the walk's hip roll / yaw never slide a foot), the hips' bob of the compass gait (≈ 0.02 H), the
 *             torso's counter-twist and the arms' counter-swing. The root travels at `walkSpeed`; `walkCycle` metres of
 *             travel = one cycle of `phase`. Measured (test/pine-npc-rig.test.ts): the planted ball's slide ≤ 0.01 H.
 *
 * Also: the ranger's lantern is found under his right hand (|x − hand.x| < 0.08 H), not by "anything left of the torso"
 * as in A, which also caught the outside of his right shin.
 */
import * as THREE from 'three';
import type { NpcKind } from '../../chunks/pine-hollow/models/people';
import { mapSlot } from '../../core/shardState';

export const LEG_BONE_NAMES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'clavicleR', 'shoulderR', 'twistR', 'elbowR', 'handR',
  'clavicleL', 'shoulderL', 'twistL', 'elbowL', 'handL',
  'thighR', 'shinR', 'footR', 'thighL', 'shinL', 'footL',
] as const;
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 8, 2, 10, 11, 12, 13, 0, 15, 16, 0, 18, 19];
const J = {
  hips: 0, spine: 1, chest: 2, neck: 3, head: 4,
  clR: 5, shR: 6, twR: 7, elR: 8, haR: 9, clL: 10, shL: 11, twL: 12, elL: 13, haL: 14,
  thR: 15, knR: 16, ftR: 17, thL: 18, knL: 19, ftL: 20,
} as const;
const NB = LEG_BONE_NAMES.length;

/** the walk: one cycle's length (s), the stance share of it, a planted foot's hip-relative travel per stance (× H) */
export const WALK = { cycle: 1.0, stance: 0.6, stride: 0.24, lift: 0.04, heel: 0.35, rise: 0.01, sink: 0.022, arm: 0.3 } as const;

export interface LegBuilt {
  geometry: THREE.BufferGeometry;
  /** every bone's rest point (mesh space), LEG_BONE_NAMES order */
  rest: THREE.Vector3[];
  height: number;
  /** the floor (the model's lowest y) */
  y0: number;
  lantern: THREE.Vector3 | null;
  /** the ball of each foot at rest (mesh space): right, left — the walk's planted point */
  ball: [THREE.Vector3, THREE.Vector3];
  /** m/s at which the walk's planted feet stay put */
  walkSpeed: number;
  /** metres of travel per walk cycle */
  walkCycle: number;
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const median = (a: number[], d: number): number => { if (a.length === 0) return d; const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? d; };

/**
 * Blur the dense weights (NB per vertex) along the surface where `zone(i)` > 0: vertices welded by position (the generated
 * meshes split them at UV seams), then Jacobi steps toward the neighbours' mean. The surface carries the blend, air does
 * not: the armpit's crease, where the column test put one vertex on the arm and its neighbour on the chest, becomes a ramp
 * across the connected skin while the arm and the coat below it (apart in the A-pose) stay apart.
 */
function diffuse(g: THREE.BufferGeometry, dense: Float32Array, zone: (i: number) => number, weld: number, channels: readonly number[], steps = 40): void {
  const P = g.getAttribute('position'), n = P.count, idx = g.getIndex();
  if (!idx) return;
  const zi = new Float32Array(n);
  for (let i = 0; i < n; i++) zi[i] = zone(i);
  // the active vertices: every corner of a triangle that touches the zone (the zone's own and the ring it reads)
  const active = new Uint8Array(n);
  for (let f = 0; f + 2 < idx.count; f += 3) {
    const a = idx.getX(f), b = idx.getX(f + 1), c = idx.getX(f + 2);
    if ((zi[a] ?? 0) > 0 || (zi[b] ?? 0) > 0 || (zi[c] ?? 0) > 0) { active[a] = 1; active[b] = 1; active[c] = 1; }
  }
  // weld the active ones by position (the generated meshes split vertices at UV seams)
  const key = new Map<string, number>(), rep = new Int32Array(n).fill(-1), members: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (!active[i]) continue;
    const k = `${Math.round(P.getX(i) / weld)},${Math.round(P.getY(i) / weld)},${Math.round(P.getZ(i) / weld)}`;
    let r = key.get(k);
    if (r === undefined) { r = members.length; key.set(k, r); members.push([]); }
    rep[i] = r;
    members[r]?.push(i);
  }
  const m = members.length, C = channels.length;
  // the welded vertices' blurred channels (the mean of their copies), their zone, their neighbours
  const W = new Float32Array(m * C), z = new Float32Array(m);
  members.forEach((list, r) => {
    for (const i of list) { z[r] = Math.max(z[r] ?? 0, zi[i] ?? 0); channels.forEach((ch, c) => { W[r * C + c] = (W[r * C + c] ?? 0) + (dense[i * NB + ch] ?? 0) / list.length; }); }
  });
  const nb: number[][] = Array.from({ length: m }, () => []);
  const link = (a: number, b: number): void => { if (a < 0 || b < 0 || a === b) return; const la = nb[a]; if (la && !la.includes(b)) la.push(b); const lb = nb[b]; if (lb && !lb.includes(a)) lb.push(a); };
  for (let f = 0; f + 2 < idx.count; f += 3) {
    const a = rep[idx.getX(f)] ?? -1, b = rep[idx.getX(f + 1)] ?? -1, c = rep[idx.getX(f + 2)] ?? -1;
    link(a, b); link(b, c); link(a, c);
  }
  // the moving vertices' neighbour lists, flattened (CSR)
  const moving: number[] = [];
  for (let r = 0; r < m; r++) if ((z[r] ?? 0) > 0 && (nb[r]?.length ?? 0) > 0) moving.push(r);
  const M = moving.length, start = new Int32Array(M + 1), rate = new Float32Array(M);
  moving.forEach((r, k) => { start[k + 1] = (start[k] ?? 0) + (nb[r]?.length ?? 0); rate[k] = 0.5 * (z[r] ?? 0); });
  const flat = new Int32Array(start[M] ?? 0);
  moving.forEach((r, k) => { flat.set(nb[r] ?? [], start[k] ?? 0); });
  let cur = W, next = new Float32Array(W);
  for (let it = 0; it < steps; it++) {
    for (let k = 0; k < M; k++) {
      const r = moving[k] ?? 0, s0 = start[k] ?? 0, s1 = start[k + 1] ?? 0, zr = rate[k] ?? 0, inv = 1 / (s1 - s0);
      for (let c = 0; c < C; c++) {
        let acc = 0;
        for (let e = s0; e < s1; e++) acc += cur[(flat[e] ?? 0) * C + c] ?? 0;
        const own = cur[r * C + c] ?? 0;
        next[r * C + c] = own + zr * (acc * inv - own);
      }
    }
    const t = cur; cur = next; next = t;
    for (const r of moving) for (let c = 0; c < C; c++) next[r * C + c] = cur[r * C + c] ?? 0;
  }
  // every other bone keeps its share, the blurred ones fill the rest in their blurred proportions
  const inSet = new Uint8Array(NB);
  for (const ch of channels) inSet[ch] = 1;
  for (let i = 0; i < n; i++) {
    const r = rep[i] ?? -1;
    if (r < 0 || (z[r] ?? 0) <= 0) continue;
    const o = i * NB;
    let fixed = 0, blurred = 0;
    for (let j = 0; j < NB; j++) if (!inSet[j]) fixed += dense[o + j] ?? 0;
    for (let c = 0; c < C; c++) blurred += cur[r * C + c] ?? 0;
    if (blurred <= 1e-6) continue;
    const k = Math.max(0, 1 - fixed) / blurred;
    channels.forEach((ch, c) => { dense[o + ch] = (cur[r * C + c] ?? 0) * k; });
  }
}

/** place the bones by the A-pose's proportions and weight every vertex (see the header); pure — the test runs it in Node */
export function rigLegs(kind: NpcKind, source: THREE.BufferGeometry): LegBuilt {
  const g = source.clone();
  g.computeBoundingBox();
  const bb = g.boundingBox ?? new THREE.Box3();
  const y0 = bb.min.y, H = bb.max.y - bb.min.y;
  const P = g.getAttribute('position'), n = P.count;
  const X = (i: number): number => P.getX(i), Y = (i: number): number => P.getY(i) - y0, Z = (i: number): number => P.getZ(i);

  // ── the legs' centre lines: the two sides' medians in bands above the ankle and at the knee ──
  const band = (lo: number, hi: number): number[] => { const out: number[] = []; for (let i = 0; i < n; i++) { const y = Y(i); if (y >= lo * H && y < hi * H) out.push(i); } return out; };
  const low = band(0.07, 0.18);
  let xm = 0;
  { let mn = Infinity, mx = -Infinity; for (const i of low) { mn = Math.min(mn, X(i)); mx = Math.max(mx, X(i)); } if (Number.isFinite(mn)) xm = (mn + mx) / 2; }
  const sideMed = (idx: number[], s: number, get: (i: number) => number, d: number): number => median(idx.filter((i) => (X(i) - xm) * s > 0.01 * H && Math.abs(X(i) - xm) < 0.16 * H).map(get), d);
  xm = (sideMed(low, 1, X, xm + 0.07 * H) + sideMed(low, -1, X, xm - 0.07 * H)) / 2;
  const knees = band(0.21, 0.29), ankles = band(0.07, 0.13), soles = band(0, 0.035);
  const hipY = 0.49 * H, kneeY = 0.265 * H, ankleY = 0.05 * H;
  const leg = (s: number): { hip: THREE.Vector3; knee: THREE.Vector3; ankle: THREE.Vector3; ball: THREE.Vector3 } => {
    const kx = sideMed(knees, s, X, xm + s * 0.07 * H), ax = sideMed(ankles, s, X, xm + s * 0.07 * H);
    const kz = sideMed(knees, s, Z, 0), az = sideMed(ankles, s, Z, 0);
    const hip = new THREE.Vector3(xm + (kx - xm) * 0.9, y0 + hipY, kz);
    const ankle = new THREE.Vector3(ax, y0 + ankleY, az);
    // the knee on the hip → ankle line (a straight rest leg: the IK's law of cosines is exact)
    const knee = hip.clone().lerp(ankle, (hipY - kneeY) / (hipY - ankleY));
    let toe = az + 0.06 * H;
    { let best = -Infinity; for (const i of soles) if ((X(i) - xm) * s > 0.005 * H && Z(i) > best) best = Z(i); if (Number.isFinite(best)) toe = best; }
    const ball = new THREE.Vector3(ax, y0 + 0.012 * H, az + Math.max(0.02 * H, (toe - az) * 0.7));
    return { hip, knee, ankle, ball };
  };
  const legR = leg(-1), legL = leg(1);

  // ── the torso and the arms (A's measure, about the torso's own midline) ──
  const chestBand = band(0.66, 0.8);
  const xt = median(chestBand.map(X), 0), zc = median(chestBand.map(Z), 0);
  const tw: number[] = [];
  for (let i = 0; i < n; i++) if (Math.abs(Y(i) - 0.7 * H) < 0.03 * H) tw.push(Math.abs(X(i) - xt));
  const torsoW = Math.max(0.1 * H, median(tw, 0.1 * H) * 1.05);
  const shY = 0.815 * H, shX = torsoW * 0.95, waist = 0.5 * H;
  const side = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const x = X(i) - xt, y = Y(i);
    const col = torsoW * (1.05 + 0.25 * smooth(shY, 0.6 * H, y));
    if (y > waist * 0.55 && y < shY + 0.04 * H && Math.abs(x) > col) side[i] = x < 0 ? -1 : 1;
  }
  const shoulder = (s: number): THREE.Vector3 => new THREE.Vector3(xt + s * shX, y0 + shY, zc);
  const far = (s: number): THREE.Vector3 => {
    const sh = shoulder(s), best = new THREE.Vector3(xt + s * (shX + 0.1 * H), y0 + 0.45 * H, zc);
    let bd = 0;
    for (let i = 0; i < n; i++) {
      if (side[i] !== s) continue;
      const d = (P.getX(i) - sh.x) ** 2 + (P.getY(i) - sh.y) ** 2 + (P.getZ(i) - sh.z) ** 2;
      if (d > bd) { bd = d; best.set(P.getX(i), P.getY(i), P.getZ(i)); }
    }
    const v = best.clone().sub(sh);
    return v.length() > 0.4 * H ? sh.clone().addScaledVector(v.normalize(), 0.36 * H) : best;
  };
  const fR = far(-1), fL = far(1), sR = shoulder(-1), sL = shoulder(1);
  // a lantern vertex (the ranger's): under the right hand, clear of the leg
  const lanternOf = (i: number): boolean => kind === 'ranger' && Y(i) > 0.12 * H && P.getY(i) < fR.y && Math.abs(X(i) - fR.x) < 0.08 * H && X(i) < legR.hip.x - 0.07 * H;
  let lantern: THREE.Vector3 | null = null;
  if (kind === 'ranger') {
    let lo = Infinity;
    for (let i = 0; i < n; i++) if (lanternOf(i) && P.getY(i) < lo) lo = P.getY(i);
    if (Number.isFinite(lo)) lantern = new THREE.Vector3(fR.x, (lo + fR.y) * 0.5, fR.z);
  }
  // an arm vertex must also lie near its arm (A's column test alone took a flared coat hem for the arm)
  const segT = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number => {
    const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z;
    return Math.min(1, Math.max(0, ((p.x - a.x) * bx + (p.y - a.y) * by + (p.z - a.z) * bz) / Math.max(1e-9, bx * bx + by * by + bz * bz)));
  };
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const s = side[i] ?? 0;
    if (s === 0) continue;
    p.set(P.getX(i), P.getY(i), P.getZ(i));
    const a = s < 0 ? sR : sL, b = s < 0 ? fR : fL;
    q.copy(a).lerp(b, segT(p, a, b));
    if (p.distanceTo(q) > 0.085 * H) side[i] = 0;
  }

  const rest: THREE.Vector3[] = [
    new THREE.Vector3(xm, y0 + 0.53 * H, zc), new THREE.Vector3(xt, y0 + 0.62 * H, zc), new THREE.Vector3(xt, y0 + 0.72 * H, zc),
    new THREE.Vector3(xt, y0 + 0.84 * H, zc), new THREE.Vector3(xt, y0 + 0.88 * H, zc),
    new THREE.Vector3(xt - 0.025 * H, y0 + shY - 0.015 * H, zc), sR, sR.clone().lerp(fR, 0.22), sR.clone().lerp(fR, 0.45), sR.clone().lerp(fR, 0.78),
    new THREE.Vector3(xt + 0.025 * H, y0 + shY - 0.015 * H, zc), sL, sL.clone().lerp(fL, 0.22), sL.clone().lerp(fL, 0.45), sL.clone().lerp(fL, 0.78),
    legR.hip, legR.knee, legR.ankle, legL.hip, legL.knee, legL.ankle,
  ];

  // ── the weights: dense per vertex, then the four largest, renormalised ──
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const w = new Float32Array(NB);
  const torso = (y: number, k: number): void => {
    if (k <= 0) return;
    const add = (a: number, b: number, t: number): void => { w[a] = (w[a] ?? 0) + k * (1 - t); w[b] = (w[b] ?? 0) + k * t; };
    if (y < 0.5 * H) add(J.hips, J.spine, 0);
    else if (y < 0.64 * H) add(J.hips, J.spine, smooth(0.5 * H, 0.64 * H, y));
    else if (y < 0.76 * H) add(J.spine, J.chest, smooth(0.64 * H, 0.76 * H, y));
    else if (y < 0.86 * H) add(J.chest, J.neck, smooth(0.8 * H, 0.86 * H, y));
    else add(J.neck, J.head, smooth(0.86 * H, 0.89 * H, y));
  };
  const legChain = (y: number, k: number, th: number, kn: number, ft: number): void => {
    if (k <= 0) return;
    const sk = smooth(kneeY + 0.035 * H, kneeY - 0.035 * H, y), fk = smooth(ankleY + 0.02 * H, ankleY - 0.015 * H, y);
    w[th] = (w[th] ?? 0) + k * (1 - sk); w[kn] = (w[kn] ?? 0) + k * sk * (1 - fk); w[ft] = (w[ft] ?? 0) + k * sk * fk;
  };
  const arm = (t: number, s: number): void => {
    const cl = s < 0 ? J.clR : J.clL, sh = cl + 1, tw2 = cl + 2, el = cl + 3, ha = cl + 4;
    const chain = 0.5 + 0.5 * smooth(0, 0.16, t);
    const kT = smooth(0.1, 0.4, t), kE = smooth(0.38, 0.52, t), kH = smooth(0.74, 0.84, t);
    const up = chain * (1 - kE), lo = chain * kE;
    w[cl] = (w[cl] ?? 0) + 1 - chain;
    w[sh] = (w[sh] ?? 0) + up * (1 - kT); w[tw2] = (w[tw2] ?? 0) + up * kT;
    w[el] = (w[el] ?? 0) + lo * (1 - kH); w[ha] = (w[ha] ?? 0) + lo * kH;
  };
  const dense = new Float32Array(n * NB);
  for (let i = 0; i < n; i++) {
    w.fill(0);
    p.set(P.getX(i), P.getY(i), P.getZ(i));
    const y = p.y - y0, s = side[i] ?? 0;
    if (lanternOf(i)) w[J.haR] = 1;
    else if (s !== 0) {
      const a = s < 0 ? sR : sL, b = s < 0 ? fR : fL;
      arm(kind === 'ranger' && s < 0 && p.y < b.y ? 1 : segT(p, a, b), s);
    } else {
      const legK = 1 - smooth(0.4 * H, 0.52 * H, y);
      torso(y, 1 - legK);
      if (legK > 0) {
        const bw = 0.015 * H + 0.035 * H * smooth(0.2 * H, 0.46 * H, y), sl = smooth(-bw, bw, p.x - xm);
        legChain(y, legK * sl, J.thL, J.knL, J.ftL);
        legChain(y, legK * (1 - sl), J.thR, J.knR, J.ftR);
      }
      // the deltoid cap: the torso round a shoulder joint follows it part way
      if (y > shY - 0.2 * H) {
        const r = p.x < xt ? -1 : 1, jt = r < 0 ? sR : sL, d = p.distanceTo(jt);
        const wS = 0.5 * (1 - smooth(0.02 * H, 0.1 * H, d)), wC = 0.5 * (1 - smooth(0.05 * H, 0.16 * H, d)), keep = 1 - wS - wC;
        if (keep < 1) {
          for (let j = 0; j < NB; j++) w[j] = (w[j] ?? 0) * keep;
          const cl = r < 0 ? J.clR : J.clL;
          w[cl] = (w[cl] ?? 0) + wC; w[cl + 1] = (w[cl + 1] ?? 0) + wS;
        }
      }
    }
    dense.set(w, i * NB);
  }
  diffuse(g, dense, (i) => {
    p.set(P.getX(i), P.getY(i), P.getZ(i));
    return 1 - smooth(0.12 * H, 0.18 * H, Math.min(p.distanceTo(sR), p.distanceTo(sL)));
  }, 1e-4 * H, [J.spine, J.chest, J.clR, J.shR, J.twR, J.clL, J.shL, J.twL], 60);
  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    const o = i * NB;
    order.length = 0;
    for (let j = 0; j < NB; j++) if ((dense[o + j] ?? 0) > 1e-4) order.push(j);
    order.sort((a, b) => (dense[o + b] ?? 0) - (dense[o + a] ?? 0));
    let sum = 0;
    for (let k = 0; k < 4 && k < order.length; k++) sum += dense[o + (order[k] ?? 0)] ?? 0;
    if (sum <= 0) { si[i * 4] = J.hips; sw[i * 4] = 1; continue; }
    for (let k = 0; k < 4 && k < order.length; k++) { const j = order[k] ?? 0; si[i * 4 + k] = j; sw[i * 4 + k] = (dense[o + j] ?? 0) / sum; }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 0.5;
  const walkSpeed = (WALK.stride * H) / (WALK.stance * WALK.cycle);
  return { geometry: g, rest, height: H, y0, lantern, ball: [legR.ball, legL.ball], walkSpeed, walkCycle: walkSpeed * WALK.cycle };
}

const built = new Map<NpcKind, LegBuilt>();
/** rigLegs, once per person per shard visit */
export function legRigOf(kind: NpcKind, source: THREE.BufferGeometry): LegBuilt {
  let b = built.get(kind);
  if (!b) { b = rigLegs(kind, source); built.set(kind, b); }
  return b;
}
mapSlot('npcRig.built', built);

/** the rig's bones at rest (LEG_BONE_NAMES order), parented, the root first */
export function legBones(b: LegBuilt): THREE.Bone[] {
  const bones = LEG_BONE_NAMES.map((name) => { const bone = new THREE.Bone(); bone.name = name; return bone; });
  bones.forEach((bone, i) => {
    const pi = PARENT[i] ?? -1, r = b.rest[i] ?? new THREE.Vector3();
    const pr = pi >= 0 ? b.rest[pi] ?? new THREE.Vector3() : new THREE.Vector3();
    bone.position.copy(r).sub(pr);
    if (pi >= 0) bones[pi]?.add(bone);
  });
  return bones;
}

/** the pose's inputs (npcModels.ts NpcRig.pose): `walk` 0 … 1 blends the walk in, `phase` its cycle (0 … 1, wraps) */
export interface LegPoseIn { t: number; talk: number; point: number; pointYaw: number; look: number; walk: number; phase: number }

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _tw = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _d = new THREE.Vector3(), _ball = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hp = new THREE.Vector3();
const I = new THREE.Quaternion();
const X_AXIS = new THREE.Vector3(1, 0, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);

/** a foot's planted-point target (hip-relative offsets, × H) and its toe-down pitch at `p` (0 … 1 of its own cycle) */
export function footPlan(p: number): { z: number; y: number; pitch: number; stance: boolean } {
  const s = WALK.stride;
  if (p < WALK.stance) {
    const u = p / WALK.stance;
    return { z: s / 2 - s * u, y: 0, pitch: WALK.heel * smooth(0.7, 1, u), stance: true };
  }
  const u = (p - WALK.stance) / (1 - WALK.stance);
  return { z: -s / 2 + s * smooth(0, 1, u), y: WALK.lift * Math.sin(Math.PI * u), pitch: WALK.heel * (1 - smooth(0, 0.55, u)), stance: false };
}

/** the pose function over `bones` (legBones' order) for `b` */
export function legPose(bones: THREE.Bone[], b: LegBuilt): (i: LegPoseIn) => void {
  const bn = (j: number): THREE.Bone => bones[j] ?? new THREE.Bone();
  const H = b.height, rest = b.rest;
  const r = (j: number): THREE.Vector3 => rest[j] ?? new THREE.Vector3();
  // per side: the arm's twist axis (shoulder → elbow, the shoulder's frame = mesh frame at rest), the leg's lengths and bend axis
  const arms = [J.clR, J.clL].map((cl) => ({ cl, axis: r(cl + 3).clone().sub(r(cl + 1)).normalize() }));
  const legs = [J.thR, J.thL].map((th, k) => {
    const hip = r(th), knee = r(th + 1), ankle = r(th + 2), ball = b.ball[k] ?? ankle;
    const dir = ankle.clone().sub(hip).normalize();
    return {
      th, hip, l1: knee.distanceTo(hip), l2: ankle.distanceTo(knee), thighV: knee.clone().sub(hip), shinV: ankle.clone().sub(knee),
      bend: new THREE.Vector3().crossVectors(Z_AXIS, dir).normalize(), ball, off: ball.clone().sub(ankle),
    };
  });
  const hips = bn(J.hips), spine = bn(J.spine), chest = bn(J.chest), neck = bn(J.neck), head = bn(J.head);
  const hipsRest = r(J.hips);

  const setArm = (k: number, ex: number, ey: number, ez: number, elbow: number): void => {
    const a = arms[k];
    if (!a) return;
    const Q = _q.setFromEuler(_e.set(ex, ey, ez));
    // the clavicle: a forward raise protracts and lifts it (≈ 15 % / 12 % of the raise), plus 30 % of a point's yaw;
    // the hang and a swing back leave it
    const s = k === 0 ? -1 : 1, up = Math.max(0, -ex);
    const C = _q2.setFromEuler(_e.set(0, -s * 0.15 * up + 0.3 * ey, s * 0.12 * up));
    bn(a.cl).quaternion.copy(C);
    // the shoulder: the rest, split swing · twist about the arm, half the twist left to the twist bone
    const S = _q3.copy(C).invert().multiply(Q);
    const dt = S.x * a.axis.x + S.y * a.axis.y + S.z * a.axis.z;
    _tw.set(a.axis.x * dt, a.axis.y * dt, a.axis.z * dt, S.w);
    if (_tw.lengthSq() < 1e-12) _tw.identity(); else _tw.normalize();
    const half = _q.slerpQuaternions(I, _tw, 0.5);
    const swing = S.multiply(_tw.clone().invert());
    bn(a.cl + 1).quaternion.copy(swing).multiply(half);
    bn(a.cl + 2).quaternion.copy(half);
    bn(a.cl + 3).quaternion.setFromEuler(_e.set(elbow, 0, 0));
    bn(a.cl + 4).quaternion.identity();
  };

  const bendQ = (axis: THREE.Vector3, angle: number, out: THREE.Quaternion): THREE.Quaternion => out.setFromAxisAngle(axis, angle);

  return (inp) => {
    const { t, talk, point, pointYaw, look } = inp;
    const k = Math.max(0, Math.min(1, inp.walk)), ph = ((inp.phase % 1) + 1) % 1;
    const breathe = Math.sin(t * 1.6), idle = 1 - k;
    const swingR = Math.cos(2 * Math.PI * (ph - 0.05));   // + = the right arm back (the right foot forward at phase 0)
    // the hips: A's weight shift at rest; walking, the compass gait's bob, a little roll to the stance leg and yaw with the stride
    const bob = k * H * (-WALK.sink + WALK.rise * Math.cos(4 * Math.PI * (ph - 0.3)));
    hips.position.set(hipsRest.x, hipsRest.y + bob, hipsRest.z);
    const hipYaw = k * 0.06 * Math.cos(2 * Math.PI * ph), hipRoll = idle * 0.012 * Math.sin(t * 0.35) + k * 0.03 * Math.sin(2 * Math.PI * ph);
    hips.rotation.set(0, hipYaw, hipRoll);
    spine.rotation.set(0.01 * breathe * idle + 0.04 * k, -hipYaw * 0.6, -0.01 * Math.sin(t * 0.35) * idle - hipRoll * 0.7);
    chest.rotation.set(-0.012 * breathe - 0.03 * talk * Math.max(0, Math.sin(t * 2.2)), -hipYaw * 0.9, 0);
    const nod = talk * 0.07 * Math.sin(t * 3.1) * Math.max(0, Math.sin(t * 0.9));
    neck.rotation.set(0.02 + nod * 0.5 - 0.02 * k, look * 0.45, 0);
    head.rotation.set(nod, look * 0.55, 0);
    // the arms: A's poses, plus the walk's counter-swing (the lantern arm swings less)
    const lower = 0.42, gest = talk * (1 - point);
    const g = gest * (0.5 + 0.5 * Math.sin(t * 2.4));
    const swR = k * WALK.arm * swingR * (b.lantern ? 0.45 : 1) * (1 - point), swL = -k * WALK.arm * swingR;
    setArm(1, -0.05 * breathe + swL, 0, -lower * 0.9, -0.12 - 0.05 * talk - k * (0.15 + 0.12 * Math.max(0, -swL / WALK.arm)));
    setArm(0, -0.25 * g - 1.35 * point + swR, -pointYaw * point, lower * (1 - point) * (1 - 0.4 * g), -0.15 - 0.9 * g - 0.1 * point - k * (0.15 + 0.12 * Math.max(0, -swR / WALK.arm)));
    // the legs: two-bone IK toward each foot's planted point, in the hips' frame
    _hq.copy(hips.quaternion); _hp.copy(hips.position);
    const hqInv = _q3.copy(_hq).invert();
    legs.forEach((L, side) => {
      const plan = footPlan(side === 0 ? ph : (ph + 0.5) % 1);
      const pitch = k * plan.pitch;
      _ball.copy(L.ball).add(_v.set(0, k * plan.y * H, k * plan.z * H));
      const ankle = _ball.sub(_v.copy(L.off).applyAxisAngle(X_AXIS, pitch));   // the ankle under the planted ball, the heel lifted by `pitch`
      _d.copy(ankle).sub(_hp).applyQuaternion(hqInv).sub(_v2.copy(L.hip).sub(hipsRest));   // hip → ankle, hips-local
      const reach = L.l1 + L.l2, dl = Math.max(0.3 * reach, Math.min(0.9995 * reach, _d.length()));
      const beta = Math.acos(Math.max(-1, Math.min(1, (L.l1 * L.l1 + dl * dl - L.l2 * L.l2) / (2 * L.l1 * dl))));
      const gamma = Math.PI - Math.acos(Math.max(-1, Math.min(1, (L.l1 * L.l1 + L.l2 * L.l2 - dl * dl) / (2 * L.l1 * L.l2))));
      const thighBend = bendQ(L.bend, -beta, new THREE.Quaternion()), shinQ = bendQ(L.bend, gamma, new THREE.Quaternion());
      const bent = _v.copy(L.shinV).applyQuaternion(shinQ).add(L.thighV).applyQuaternion(thighBend);
      const align = new THREE.Quaternion().setFromUnitVectors(bent.normalize(), _d.normalize());
      const thigh = bn(L.th), shin = bn(L.th + 1), foot = bn(L.th + 2);
      thigh.quaternion.copy(align).multiply(thighBend);
      shin.quaternion.copy(shinQ);
      // the foot: level in mesh space, pitched toe-down by the heel lift
      foot.quaternion.copy(_hq).multiply(thigh.quaternion).multiply(shinQ).invert().multiply(_q2.setFromAxisAngle(X_AXIS, pitch));
    });
  };
}
