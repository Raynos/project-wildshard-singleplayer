import { bindRig, type RigContract } from '@wildshard/engine/anim/rig';
/**
 * E322 F-M3 — the Pine Hollow people's rig (Jake picked B; A, the upper-body-only rig that was in npcModels.ts, went with
 * its Debug row — git 4da54ccc has it). Built at load from the hull like A was, so any head grafted above the neck
 * (E304) rigs the same. What B adds over A:
 *
 *   legs      a thigh → shin → foot chain per side, placed on the legs' own centre lines (the generated people stand ~2–3 cm
 *             off x = 0, and their A-pose legs ~0.07 H apart). Weighted by height (the pelvis blends hips → thigh from 0.52 H
 *             down to 0.40 H, the knee and the ankle blend over ±0.035 H / 0.035 H), split by side with a blend band round
 *             the legs' midline that widens up the thigh (0.015 H at the shin → 0.05 H at the crotch: a long coat's front
 *             panel rides both legs), the foot on its own bone below the ankle.
 *   shoulder  A's arm (its air-gap test and weight bands), split: a clavicle (chest → clavicle → shoulder → twist → elbow →
 *             hand) that protracts and lifts with a forward raise (15 % / 12 % of it, + 30 % of a point's yaw), an upper-arm
 *             twist bone taking half a raise's twist about the arm (a swing-twist split), the deltoid cap above the armpit
 *             weighted by its distance from the joint (A left it 100 % on the chest). Then B is BOUND IN A's HANG (`HANG`:
 *             the mesh pre-posed into A's idle with A's own weights), so an idle B is A's idle, and the girdle's weights
 *             (spine, chest, clavicles, shoulders, twists) are blurred along the welded surface within 0.18 H of either
 *             joint (`diffuse`), across the armpit. A's stretch on a raise was the armpit's crease: one vertex on the arm,
 *             its neighbour on the chest. (Blurring in the A-pose bind instead spread the web between arm and coat into a
 *             grey membrane as the arms lowered to hang: hence the hang bind.) Measured (test/shards/pine-hollow/pine-npc-rig.test.ts), the
 *             edges within 0.2 H of the shoulders on Hale's point: A p99 2.4–5.5×, worst 16–25× · B p99 1.5–2.1×, worst
 *             5.6–13×; B's idle moves no edge there past 1.6×.
 *   clips     A's idle / talk / point, the same poses (A's shoulder Euler measured from the hang, split over clavicle ·
 *             shoulder · twist; A's elbow bend conjugated into the hung frame), plus a
 *             walk: a phase machine per foot (stance 60 % of a 1.0 s cycle, the ball of the foot planted, the heel lifting
 *             before toe-off, a swing arc 0.04 H high), two-bone IK per leg solved in the hips' frame (so the idle weight
 *             shift and the walk's hip roll / yaw never slide a foot), the hips' bob of the compass gait (≈ 0.02 H), the
 *             torso's counter-twist and the arms' counter-swing. The root travels at `walkSpeed`; `walkCycle` metres of
 *             travel = one cycle of `phase`. Measured (test/shards/pine-hollow/pine-npc-rig.test.ts): the planted ball's slide ≤ 0.01 H.
 *
 * E350 F-X3, the webs: the generator fused each hanging forearm (and Hale's lantern) to the coat; rigLegs splits those
 * triangles at the seam (`splitWebs`), so Hale's point no longer drags a grey sheet from his sleeve to his coat.
 *
 * Also: the ranger's lantern is found under his right hand (|x − hand.x| < 0.08 H), not by "anything left of the torso"
 * as in A, which also caught the outside of his right shin.
 */
import * as THREE from 'three';
import { smoothstep } from '@wildshard/engine/core/noise';
/** Authored hull traits; the seed rig contains no shard names or model paths. */
export interface NpcRigProfile { id: string; lantern: boolean }

/** Authored pivot and skinned models share the NPC row lifecycle; their pose driver stays with the content. */
export interface NpcModel {
  readonly group: THREE.Group;
  update: (dt: number, t: number, player: THREE.Vector3) => void;
}
export interface NpcFace<M extends NpcModel> {
  load: () => Promise<THREE.BufferGeometry | null>;
  target: (model: M) => THREE.Mesh;
}
export interface NpcRow<M extends NpcModel, Args> {
  id: string;
  model: (args: Args) => M;
  idle: string;
  rig: RigContract;
  near: number;
  visible?: (model: M, near: boolean) => void;
  face?: NpcFace<M>;
}

/** The draw cut runs before the pose, so a hidden counter and its figure freeze together. */
export class NpcRig<M extends NpcModel, Args> {
  readonly model: M;
  private readonly row: NpcRow<M, Args>;
  private live = true;
  constructor(row: NpcRow<M, Args>, args: Args) {
    this.row = row;
    this.model = row.model(args);
    bindRig(this.model.group, [], row.rig, { skeleton: row.rig.skeleton, procedural: row.rig.clips });
    const face = row.face;
    if (face !== undefined) void face.load().then((geometry) => {
      if (geometry === null) return null;
      if (!this.live) { geometry.dispose(); return null; }
      const head = face.target(this.model);
      head.geometry.dispose(); head.geometry = geometry;
      return geometry;
    });
  }
  update(dt: number, t: number, player: THREE.Vector3): void {
    if (!this.live) return;
    const p = this.model.group.position;
    const near = Math.hypot(player.x - p.x, player.z - p.z) < this.row.near;
    this.row.visible?.(this.model, near);
    if (near) this.model.update(dt, t, player);
  }
  /** Prevent a pending face load from writing into an evicted scene. Resources belong to the scene scope. */
  dispose(): void { this.live = false; }
}

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
function splitWebs(g: THREE.BufferGeometry, si: Uint16Array, sw: Float32Array, shoulders: readonly THREE.Vector3[], H: number): { split: number; coatOnly: number } {
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
    }
  }
  g.setIndex(out);
  return { split, coatOnly };
}

/** place the bones by the A-pose's proportions and weight every vertex (see the header); pure — the test runs it in Node */
export function rigLegs(profile: NpcRigProfile, source: THREE.BufferGeometry): LegBuilt {
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
  const fR = far(-1), fL = far(1), sR = shoulder(-1), sL = shoulder(1);
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
    }
    P.needsUpdate = true;
    if (N) N.needsUpdate = true;
  }
  diffuse(g, dense, (i) => {
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
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  const webs = splitWebs(g, si, sw, [sR, sL], H);
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 0.5;
  const walkSpeed = (WALK.stride * H) / (WALK.stance * WALK.cycle);
  return { geometry: g, rest, height: H, y0, lantern, ball: [legR.ball, legL.ball], walkSpeed, walkCycle: walkSpeed * WALK.cycle, webs };
}

const built = new Map<string, LegBuilt>();
/** rigLegs, once per person per shard visit */
export function legRigOf(profile: NpcRigProfile, source: THREE.BufferGeometry): LegBuilt {
  let b = built.get(profile.id);
  if (!b) { b = rigLegs(profile, source); built.set(profile.id, b); }
  return b;
}

/** the rig's bones at rest (LEG_BONE_NAMES order), parented, the root first */
export function legBones(b: LegBuilt): THREE.Bone[] {
  const bones = LEG_BONE_NAMES.map((name) => { const bone = new THREE.Bone(); bone.name = name; return bone; });
  bones.forEach((bone, i) => {
    const pi = PARENT[i] ?? -1, r = b.rest[i] ?? new THREE.Vector3();
    const pr = pi >= 0 ? b.rest[pi] ?? new THREE.Vector3() : new THREE.Vector3();
    bone.position.copy(r).sub(pr);
    if (pi >= 0) bones[pi]?.add(bone);
  });
  const root = bones[0];
  if (root === undefined) throw new Error('[anim] NPC rig has no root');
  bindRig(root, [], { skeleton: 'npc.legs.v1', clips: [], sockets: LEG_BONE_NAMES }, { skeleton: 'npc.legs.v1' });
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
    return { z: s / 2 - s * u, y: 0, pitch: WALK.heel * smoothstep(0.7, 1, u), stance: true };
  }
  const u = (p - WALK.stance) / (1 - WALK.stance);
  return { z: -s / 2 + s * smoothstep(0, 1, u), y: WALK.lift * Math.sin(Math.PI * u), pitch: WALK.heel * (1 - smoothstep(0, 0.55, u)), stance: false };
}

/** the pose function over `bones` (legBones' order) for `b` */
export function legPose(bones: THREE.Bone[], b: LegBuilt): (i: LegPoseIn) => void {
  const bn = (j: number): THREE.Bone => bones[j] ?? new THREE.Bone();
  const H = b.height, rest = b.rest;
  const r = (j: number): THREE.Vector3 => rest[j] ?? new THREE.Vector3();
  // per side: the arm's twist axis (shoulder → elbow, the shoulder's frame = mesh frame at rest), the leg's lengths and bend axis
  const arms = [J.clR, J.clL].map((cl, k) => {
    const hg = HANG[k] ?? HANG[0];
    return { cl, axis: r(cl + 3).clone().sub(r(cl + 1)).normalize(), hangInv: hg.sh.clone().invert(), hang: hg.sh.clone(), elRestInv: hg.el.clone().invert() };
  });
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
    // A's absolute arm rotation (from the A-pose), measured from the hang B is bound in
    const Q = _q.setFromEuler(_e.set(ex, ey, ez)).multiply(a.hangInv);
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
    // the elbow: A's bend, conjugated into the hung frame (hang · bend · rest bend⁻¹ · hang⁻¹)
    bn(a.cl + 3).quaternion.copy(a.hang).multiply(_q2.setFromEuler(_e.set(elbow, 0, 0))).multiply(a.elRestInv).multiply(a.hangInv);
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
