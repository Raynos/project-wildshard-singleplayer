import * as THREE from 'three';
import { readSourceModel, skinnedGlb } from '@wildshard/sdk/bake/skinned';

/** Offline hull fitting. The page owns only the existing legBones/legPose clock. */
interface NpcRigProfile { id: string; lantern: boolean }
const smoothstep = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const LEG_BONE_NAMES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'clavicleR', 'shoulderR', 'twistR', 'elbowR', 'handR',
  'clavicleL', 'shoulderL', 'twistL', 'elbowL', 'handL',
  'thighR', 'shinR', 'footR', 'thighL', 'shinL', 'footL',
] as const;
export const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 8, 2, 10, 11, 12, 13, 0, 15, 16, 0, 18, 19];
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
  /** E350 F-X3: the arm-to-coat web triangles split into a sleeve copy and a coat copy (`split`), the long ones kept on the coat only */
  webs: { split: number; coatOnly: number };
}

/**
 * The hang B is bound in (A's idle arms, npcModels.ts `pose`: each shoulder lowered from the A-pose about z, the elbows a
 * little bent), right then left. B pre-poses the mesh into it with A's own weights and binds there, so an idle B is A's
 * idle exactly and every arm rotation is measured from the hang: only a raise stretches what the shoulder blend spreads.
 */
const HANG = [
  { sh: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.42)), el: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0, 0)) },
  { sh: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.42 * 0.9)), el: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0)) },
] as const;

/** Offline fitting steps, consumed synchronously by the author bake. */
type Steps<T> = Generator<undefined, T, undefined>;
/** Run the complete author recipe. */
function runSteps<T>(steps: Steps<T>): T {
  for (;;) { const r = steps.next(); if (r.done === true) return r.value; }
}

const median = (a: number[], d: number): number => { if (a.length === 0) return d; const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? d; };

/**
 * Blur the dense weights (NB per vertex) along the surface where `zone(i)` > 0: vertices welded by position (the generated
 * meshes split them at UV seams), then Jacobi steps toward the neighbours' mean. The surface carries the blend, air does
 * not: the armpit's crease, where the column test put one vertex on the arm and its neighbour on the chest, becomes a ramp
 * across the connected skin while the arm and the coat below it (apart in the A-pose) stay apart.
 */
function* diffuse(g: THREE.BufferGeometry, dense: Float32Array, zone: (i: number) => number, weld: number, channels: readonly number[], steps = 40): Steps<void> {
  const P = g.getAttribute('position'), n = P.count, idx = g.getIndex();
  if (!idx) return;
  const zi = new Float32Array(n);
  for (let i = 0; i < n; i++) { zi[i] = zone(i); if ((i & 1023) === 1023) yield; }
  // the active vertices: every corner of a triangle that touches the zone (the zone's own and the ring it reads)
  const active = new Uint8Array(n);
  for (let f = 0; f + 2 < idx.count; f += 3) {
    const a = idx.getX(f), b = idx.getX(f + 1), c = idx.getX(f + 2);
    if ((zi[a] ?? 0) > 0 || (zi[b] ?? 0) > 0 || (zi[c] ?? 0) > 0) { active[a] = 1; active[b] = 1; active[c] = 1; }
    if (f % 6144 === 0) yield;
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
    if ((i & 511) === 511) yield;
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
    if (f % 3072 === 0) yield;
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
    yield;
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
    if ((i & 1023) === 1023) yield;
  }
}

const FORE_R = [J.twR, J.elR, J.haR] as const, FORE_L = [J.twL, J.elL, J.haL] as const;
const BODY = [J.hips, J.spine, J.chest, J.thR, J.knR, J.ftR, J.thL, J.knL, J.ftL] as const;

/**
 * E350 F-X3: split the webs. The generator fused each hanging forearm (and Hale's lantern, under his right hand) to the
 * coat beside it: triangles with one corner on the forearm chain (twist · elbow · hand) and another on the body (hips ·
 * spine · chest · legs). A raise (Hale's point) pulled them into a grey sheet 0.4–1.3 m long from the sleeve to the coat.
 *
 * A thin web (every edge under WEB_SPLIT, the sleeve against the coat: 6–14 cm) is split in two at the seam: one copy rides
 * the arm (its other corners duplicated with the weights of the forearm vertex nearest each), one stays on the coat (its
 * other corners duplicated with the nearest body vertex's). In the hang both copies lie exactly where the web was, so standing looks as it did; raised,
 * the sleeve keeps its side of the seam and the coat keeps its own — nothing spans the air, and neither side opens a hole.
 * A long web (an edge past WEB_SPLIT: the lantern's, strung 0.2–0.4 m to the coat and the shin) keeps only its coat copy
 * — an arm copy would hang off the lantern as a fin, and dropping it opened a notch in the coat's side — so standing still
 * draws every triangle it drew, and a raise takes nothing with the lantern. Triangles within 0.14 H of a shoulder are the
 * armpit's crease, which the girdle blend (`diffuse`) carries: they stay. Returns the triangles split and kept coat-only.
 * Measured (scripts/e350-hale-web.mjs, test/shards/pine-hollow/pine-npc-rig.test.ts): Hale's point had 92–137 triangles stretched past
 * 0.3 m and 2.5× (worst edge 1.4 m); now none, on both tiers.
 */
const WEB_SPLIT = 0.2;
function* splitWebs(g: THREE.BufferGeometry, si: Uint16Array, sw: Float32Array, shoulders: readonly THREE.Vector3[], H: number): Steps<{ split: number; coatOnly: number }> {
  const idx = g.getIndex();
  if (!idx) return { split: 0, coatOnly: 0 };
  const P = g.getAttribute('position'), n = P.count;
  const share = (i: number, set: readonly number[]): number => { let s = 0; for (let k = 0; k < 4; k++) if (set.includes(si[i * 4 + k] ?? -1)) s += sw[i * 4 + k] ?? 0; return s; };
  // 1 the right forearm, 2 the left, 3 the body, 0 neither (the shoulders, the neck, the head); `fs` the forearm share
  const cls = new Uint8Array(n), fs = new Float32Array(n), bs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = share(i, FORE_R), l = share(i, FORE_L);
    fs[i] = Math.max(r, l); bs[i] = share(i, BODY);
    cls[i] = r >= 0.5 ? 1 : l >= 0.5 ? 2 : (bs[i] ?? 0) >= 0.5 && r < 0.05 && l < 0.05 ? 3 : 0;
    if ((i & 1023) === 1023) yield;
  }
  const at = (i: number): THREE.Vector3 => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
  const near = (i: number): boolean => shoulders.some((s) => at(i).distanceTo(s) < 0.14 * H);
  const out: number[] = [];
  // duplicated corners: (vertex, the corner whose weights it takes) → the new vertex
  const dup = new Map<string, number>(), from: number[] = [], weightsOf: number[] = [];
  // the nearest vertex of class `c` (brute force: a few hundred corners over ≤ 15 k vertices, once per person)
  const nearest = new Map<string, number>();
  const nearestOf = (v: number, c: number): number => {
    const k = `${v}:${c}`, hit = nearest.get(k);
    if (hit !== undefined) return hit;
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    let best = v, bd = Infinity;
    for (let i = 0; i < n; i++) { if (cls[i] !== c) continue; const d = (P.getX(i) - x) ** 2 + (P.getY(i) - y) ** 2 + (P.getZ(i) - z) ** 2; if (d < bd) { bd = d; best = i; } }
    nearest.set(k, best);
    return best;
  };
  const twin = (v: number, src: number): number => {
    const k = `${v}:${src}`;
    let d = dup.get(k);
    if (d === undefined) { d = n + from.length; dup.set(k, d); from.push(v); weightsOf.push(src); }
    return d;
  };
  let split = 0, coatOnly = 0;
  for (let f = 0; f + 2 < idx.count; f += 3) {
    // a step every 16 triangles: a web's corners each scan every vertex for their nearest (`nearestOf`)
    if (f % 48 === 0) yield;
    const t = [idx.getX(f), idx.getX(f + 1), idx.getX(f + 2)];
    const fore = t.some((i) => cls[i] === 1 || cls[i] === 2), body = t.some((i) => cls[i] === 3);
    if (!fore || !body || t.every(near)) { out.push(...t); continue; }
    let long = 0;
    for (let e = 0; e < 3; e++) long = Math.max(long, at(t[e] ?? 0).distanceTo(at(t[(e + 1) % 3] ?? 0)));
    // the arm's corner (the most forearm) and the body's (the most body): each copy takes one's weights for the other side
    const arm = t.map((i) => cls[i] ?? 0).find((c) => c === 1 || c === 2) ?? 1;
    // the coat's copy: every corner not on the body takes the nearest body vertex's weights (the coat right there)
    const coat = t.map((i) => (cls[i] === 3 ? i : twin(i, nearestOf(i, 3))));
    if (long > WEB_SPLIT * (H / 1.8)) { out.push(...coat); coatOnly++; continue; }
    // the sleeve's copy: every corner not on this forearm takes the nearest forearm vertex's weights
    out.push(...t.map((i) => (cls[i] === arm ? i : twin(i, nearestOf(i, arm)))), ...coat);
    split++;
  }
  if (split === 0 && coatOnly === 0) return { split, coatOnly };
  if (from.length > 0) {
    // every attribute grows by the twins: their own vertex's position / normal / uv, the source corner's skin
    for (const name of Object.keys(g.attributes)) {
      const a = g.getAttribute(name), k = a.itemSize, m = n + from.length;
      const skin = name === 'skinIndex' || name === 'skinWeight';
      const arr = name === 'skinIndex' ? new Uint16Array(m * k) : new Float32Array(m * k);
      for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) arr[i * k + j] = a.getComponent(i, j);
      from.forEach((v, q) => { const s = skin ? weightsOf[q] ?? v : v; for (let j = 0; j < k; j++) arr[(n + q) * k + j] = a.getComponent(s, j); });
      g.setAttribute(name, new THREE.BufferAttribute(arr, k));
      yield;
    }
  }
  g.setIndex(out);
  return { split, coatOnly };
}

/** place the bones by the A-pose's proportions and weight every vertex (see the header); pure — the test runs it in Node */
export function rigLegs(profile: NpcRigProfile, source: THREE.BufferGeometry): LegBuilt { return runSteps(rigSteps(profile, source)); }

/** Fit the original hung rest pose and the original weights offline. */
function* rigSteps(profile: NpcRigProfile, source: THREE.BufferGeometry): Steps<LegBuilt> {
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
  yield;

  // ── the torso and the arms (A's measure, about the torso's own midline) ──
  const chestBand = band(0.66, 0.8);
  const xt = 0, zc = median(chestBand.map(Z), 0);   // A's arms are measured about x = 0: B keeps them exactly
  const tw: number[] = [];
  for (let i = 0; i < n; i++) if (Math.abs(Y(i) - 0.7 * H) < 0.03 * H) tw.push(Math.abs(X(i) - xt));
  const torsoW = Math.max(0.1 * H, median(tw, 0.1 * H) * 1.05);
  const shY = 0.815 * H, shX = torsoW * 0.95, waist = 0.5 * H;
  const side = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const x = X(i) - xt, y = Y(i);
    const col = torsoW * (1.05 + 0.25 * smoothstep(shY, 0.6 * H, y));
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
  yield;
  const fR = far(-1), fL = far(1), sR = shoulder(-1), sL = shoulder(1);
  yield;
  // a lantern vertex (the ranger's): under the right hand and outside the coat — the lantern spans ~0.18–0.27 H left
  // of his right leg's line and the coat's edge ends at ~0.07 H, so the cut sits in the gap between them
  const lanternOf = (i: number): boolean => profile.lantern && Y(i) > 0.12 * H && P.getY(i) < fR.y && Math.abs(X(i) - fR.x) < 0.08 * H && X(i) < legR.hip.x - 0.085 * H;
  const isLantern = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (lanternOf(i)) isLantern[i] = 1;
  let lantern: THREE.Vector3 | null = null;
  if (profile.lantern) {
    let lo = Infinity;
    for (let i = 0; i < n; i++) if (isLantern[i] && P.getY(i) < lo) lo = P.getY(i);
    if (Number.isFinite(lo)) lantern = new THREE.Vector3(fR.x, (lo + fR.y) * 0.5, fR.z);
  }
  const segT = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number => {
    const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z;
    return Math.min(1, Math.max(0, ((p.x - a.x) * bx + (p.y - a.y) * by + (p.z - a.z) * bz) / Math.max(1e-9, bx * bx + by * by + bz * bz)));
  };
  const p = new THREE.Vector3();

  const rest: THREE.Vector3[] = [
    new THREE.Vector3(xm, y0 + 0.53 * H, zc), new THREE.Vector3(xt, y0 + 0.62 * H, zc), new THREE.Vector3(xt, y0 + 0.72 * H, zc),
    new THREE.Vector3(xt, y0 + 0.84 * H, zc), new THREE.Vector3(xt, y0 + 0.88 * H, zc),
    new THREE.Vector3(xt - 0.025 * H, y0 + shY - 0.015 * H, zc), sR.clone(), sR.clone().lerp(fR, 0.25), sR.clone().lerp(fR, 0.5), fR.clone(),
    new THREE.Vector3(xt + 0.025 * H, y0 + shY - 0.015 * H, zc), sL.clone(), sL.clone().lerp(fL, 0.25), sL.clone().lerp(fL, 0.5), fL.clone(),
    legR.hip, legR.knee, legR.ankle, legL.hip, legL.knee, legL.ankle,
  ];

  // ── the weights: dense per vertex, then the four largest, renormalised ──
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const w = new Float32Array(NB);
  const torso = (y: number, k: number): void => {
    if (k <= 0) return;
    const add = (a: number, b: number, t: number): void => { w[a] = (w[a] ?? 0) + k * (1 - t); w[b] = (w[b] ?? 0) + k * t; };
    if (y < 0.5 * H) add(J.hips, J.spine, 0);
    else if (y < 0.64 * H) add(J.hips, J.spine, smoothstep(0.5 * H, 0.64 * H, y));
    else if (y < 0.76 * H) add(J.spine, J.chest, smoothstep(0.64 * H, 0.76 * H, y));
    else if (y < 0.86 * H) add(J.chest, J.neck, smoothstep(0.8 * H, 0.86 * H, y));
    else add(J.neck, J.head, smoothstep(0.86 * H, 0.89 * H, y));
  };
  const legChain = (y: number, k: number, th: number, kn: number, ft: number): void => {
    if (k <= 0) return;
    const sk = smoothstep(kneeY + 0.035 * H, kneeY - 0.035 * H, y), fk = smoothstep(ankleY + 0.02 * H, ankleY - 0.015 * H, y);
    w[th] = (w[th] ?? 0) + k * (1 - sk); w[kn] = (w[kn] ?? 0) + k * sk * (1 - fk); w[ft] = (w[ft] ?? 0) + k * sk * fk;
  };
  // A's arm bands exactly (root chest → shoulder over t < 0.15, shoulder → elbow 0.35–0.6, elbow → hand 0.85–1), A's
  // shares split: the root's chest share half onto the clavicle, the upper arm's over shoulder → twist (0.1–0.35). With no
  // raise and no twist the split bones move as A's one bone does, so an idle / talking B is A's arm
  const arm = (t: number, s: number): void => {
    const cl = s < 0 ? J.clR : J.clL, sh = cl + 1, tw2 = cl + 2, el = cl + 3, ha = cl + 4;
    const add = (j: number, v: number): void => { w[j] = (w[j] ?? 0) + v; };
    if (t < 0.15) { const k = t / 0.15; add(J.chest, 0.5 * (1 - k)); add(cl, 0.5 * (1 - k)); add(sh, k); return; }
    if (t < 0.5) { const k = smoothstep(0.35, 0.6, t), kT = smoothstep(0.1, 0.35, t); add(sh, (1 - k) * (1 - kT)); add(tw2, (1 - k) * kT); add(el, k); return; }
    const k = smoothstep(0.85, 1, t); add(el, 1 - k); add(ha, k);
  };
  const dense = new Float32Array(n * NB);
  for (let i = 0; i < n; i++) {
    w.fill(0);
    p.set(P.getX(i), P.getY(i), P.getZ(i));
    const y = p.y - y0, s = side[i] ?? 0;
    if (isLantern[i]) w[J.haR] = 1;
    else if (s !== 0) {
      const a = s < 0 ? sR : sL, b = s < 0 ? fR : fL;
      arm(profile.lantern && s < 0 && p.y < b.y ? 1 : segT(p, a, b), s);
    } else {
      const legK = 1 - smoothstep(0.4 * H, 0.52 * H, y);
      torso(y, 1 - legK);
      if (legK > 0) {
        const bw = 0.015 * H + 0.035 * H * smoothstep(0.2 * H, 0.46 * H, y), sl = smoothstep(-bw, bw, p.x - xm);
        legChain(y, legK * sl, J.thL, J.knL, J.ftL);
        legChain(y, legK * (1 - sl), J.thR, J.knR, J.ftR);
      }
      // the deltoid cap: the torso round a shoulder joint follows it part way
      if (y > shY - 0.02 * H) {
        const r = p.x < xt ? -1 : 1, jt = r < 0 ? sR : sL, d = p.distanceTo(jt);
        const wS = 0.5 * (1 - smoothstep(0.02 * H, 0.1 * H, d)), wC = 0.5 * (1 - smoothstep(0.05 * H, 0.16 * H, d)), keep = 1 - wS - wC;
        if (keep < 1) {
          for (let j = 0; j < NB; j++) w[j] = (w[j] ?? 0) * keep;
          const cl = r < 0 ? J.clR : J.clL;
          w[cl] = (w[cl] ?? 0) + wC; w[cl + 1] = (w[cl + 1] ?? 0) + wS;
        }
      }
    }
    dense.set(w, i * NB);
    if ((i & 511) === 511) yield;
  }
  // ── into the hang: A's weights (the arm's hard cut, as today) carry the A-pose to A's idle; B binds there ──
  const aboutPoint = (q: THREE.Quaternion, o: THREE.Vector3): THREE.Matrix4 => new THREE.Matrix4().makeTranslation(o.x, o.y, o.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-o.x, -o.y, -o.z));
  const M = Array.from({ length: NB }, () => new THREE.Matrix4());
  const RQ = Array.from({ length: NB }, () => new THREE.Quaternion());
  HANG.forEach((hg, k) => {
    const cl = k === 0 ? J.clR : J.clL, sh = rest[cl + 1] ?? new THREE.Vector3(), el = rest[cl + 3] ?? new THREE.Vector3();
    const mSh = aboutPoint(hg.sh, sh), mFore = mSh.clone().multiply(aboutPoint(hg.el, el)), qFore = hg.sh.clone().multiply(hg.el);
    M[cl + 1]?.copy(mSh); M[cl + 2]?.copy(mSh); M[cl + 3]?.copy(mFore); M[cl + 4]?.copy(mFore);
    RQ[cl + 1]?.copy(hg.sh); RQ[cl + 2]?.copy(hg.sh); RQ[cl + 3]?.copy(qFore); RQ[cl + 4]?.copy(qFore);
    // the bones and the lantern go with their chain (the rest points below the shoulder, measured in the A-pose)
    for (const j of [cl + 2, cl + 3, cl + 4]) rest[j]?.applyMatrix4(M[j] ?? new THREE.Matrix4());
    if (k === 0 && lantern) lantern.applyMatrix4(mFore);
  });
  {
    const N = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const acc = new THREE.Vector3(), tmp = new THREE.Vector3(), nAcc = new THREE.Vector3(), src = new THREE.Vector3(), nSrc = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      src.set(P.getX(i), P.getY(i), P.getZ(i)); acc.set(0, 0, 0);
      if (N) { nSrc.set(N.getX(i), N.getY(i), N.getZ(i)); nAcc.set(0, 0, 0); }
      for (let j = 0; j < NB; j++) {
        const wj = dense[i * NB + j] ?? 0;
        if (wj <= 0) continue;
        acc.addScaledVector(tmp.copy(src).applyMatrix4(M[j] ?? new THREE.Matrix4()), wj);
        if (N) nAcc.addScaledVector(tmp.copy(nSrc).applyQuaternion(RQ[j] ?? new THREE.Quaternion()), wj);
      }
      P.setXYZ(i, acc.x, acc.y, acc.z);
      if (N) { nAcc.normalize(); N.setXYZ(i, nAcc.x, nAcc.y, nAcc.z); }
      if ((i & 511) === 511) yield;
    }
    P.needsUpdate = true;
    if (N) N.needsUpdate = true;
  }
  yield* diffuse(g, dense, (i) => {
    // the arm keeps its own chain, and so does the armpit: the generated meshes web the arm to the coat below the real
    // armpit, and a blend there turns the web into a grey membrane when the arms hang (A's hard cut hides it)
    if (isLantern[i]) return 0;
    p.set(P.getX(i), P.getY(i), P.getZ(i));
    return 1 - smoothstep(0.12 * H, 0.18 * H, Math.min(p.distanceTo(sR), p.distanceTo(sL)));
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
    if ((i & 511) === 511) yield;
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  const webs = yield* splitWebs(g, si, sw, [sR, sL], H);
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 0.5;
  const walkSpeed = (WALK.stride * H) / (WALK.stance * WALK.cycle);
  return { geometry: g, rest, height: H, y0, lantern, ball: [legR.ball, legL.ball], walkSpeed, walkCycle: walkSpeed * WALK.cycle, webs };
}


export interface BakedNpcSkin {
  readonly glb: Uint8Array;
  readonly geometry: THREE.BufferGeometry;
  readonly metadata: Omit<LegBuilt, 'geometry' | 'rest' | 'lantern' | 'ball'> & {
    readonly rest: [number, number, number][];
    readonly lantern: [number, number, number] | null;
    readonly ball: [number, number, number][];
  };
}
const isMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;

/** Decode the same source hull channels and world frame the page previously fitted. */
export async function bakeNpcSkin(bytes: Uint8Array, profile: NpcRigProfile): Promise<BakedNpcSkin> {
  const source = await readSourceModel(bytes);
  source.gltf.scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  source.gltf.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
  const mesh = meshes[0];
  if (mesh === undefined) throw new Error('NPC source has no hull');
  const geometry = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'uv'] as const) {
    if (!mesh.geometry.hasAttribute(key)) continue;
    const channel = mesh.geometry.getAttribute(key), out = new Float32Array(channel.count * channel.itemSize);
    for (let i = 0; i < channel.count; i++) for (let c = 0; c < channel.itemSize; c++) out[i * channel.itemSize + c] = channel.getComponent(i, c);
    geometry.setAttribute(key, new THREE.BufferAttribute(out, channel.itemSize));
  }
  const index = mesh.geometry.getIndex();
  if (index !== null) geometry.setIndex(Array.from(index.array));
  geometry.applyMatrix4(mesh.matrixWorld);
  const built = rigLegs(profile, geometry);
  const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!(sourceMaterial instanceof THREE.MeshStandardMaterial)) throw new Error('NPC source has no PBR material');
  const points = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];
  const metadata = { rest: built.rest.map(points), height: built.height, y0: built.y0,
    lantern: built.lantern === null ? null : points(built.lantern), ball: built.ball.map(points),
    walkSpeed: built.walkSpeed, walkCycle: built.walkCycle, webs: built.webs };
  const bones = LEG_BONE_NAMES.map((name, i) => ({ name, parent: LEG_BONE_NAMES[PARENT[i] ?? -1] ?? null, pos: points(built.rest[i] ?? new THREE.Vector3()) }));
  const { glb } = skinnedGlb({ name: profile.id, bones, parts: [{ geometry: built.geometry, material: sourceMaterial }], extras: metadata });
  geometry.dispose();
  return { glb, metadata, geometry: built.geometry };
}
