/**
 * Gulls — a low-poly gull system for Driftwood Isle: ONE instanced draw call for every gull.
 * Faceted flat-shaded vertex-coloured geometry, no textures (the island style).
 *
 *   const gulls = new Gulls(sky).build({
 *     perches: [...pier.posts.map((p) => new Vector3(p.x, pier.deckY + 1.02, p.z)), ...Gulls.beachPerches(seed, 8)],
 *     centre: new Vector3(0, 0, -215), radius: 80,       // the wheeling flocks live over this circle (beach + lagoon)
 *   });
 *   scene.add(gulls.group);
 *   gulls.onCall = (pos) => audio.gullCallAt(pos, player.position, player.yaw);   // optional squawk hook
 *   game.onUpdate((dt) => gulls.update(dt, player.position));
 *
 * Behaviour: (a) perched gulls (posts, gunwale, rocks, sand) idle with head turns and the odd hop;
 * (b) wheeling gulls circle in 2–3 loose flocks on slow lissajous loops at 15–40 m, gliding with
 * flap bursts, banking into the turns; (c) a perched gull flushes with a flap burst when the player
 * comes within ~4 m, joins a flock and lands on a free perch 20–40 s later.
 *
 * Cost: ≤ 40 instances × ~80 tris, one InstancedMesh; the wings, head and legs are animated in the
 * vertex shader from a per-instance vec4 (flap, head yaw, wing fold, leg tuck). No per-frame allocations.
 */
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { CHUNK_HALF } from '../core/config';
import { heightAt, waterLevel, inChunk } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import type { Sky } from './Sky';

export interface GullsSpec {
  /** world positions a gull can stand on (feet); posts, gunwales, rock tops, sand */
  perches: THREE.Vector3[];
  /** the wheeling flocks circle inside this circle (xz; y ignored) */
  centre: THREE.Vector3;
  radius: number;
  /** total gulls (≤ 40); default 36 — never more than perches + 16 */
  count?: number;
  /** flush distance, metres; default 4 */
  flushRadius?: number;
  seed?: number;
}

const C = {
  white: new THREE.Color('#f3f3ef'),
  belly: new THREE.Color('#ffffff'),
  grey: new THREE.Color('#b4bac0'),
  greyDark: new THREE.Color('#9aa1a8'),
  tip: new THREE.Color('#2b2e33'),
  beak: new THREE.Color('#e9a23b'),
  leg: new THREE.Color('#e08a3a'),
  eye: new THREE.Color('#1a1a1a'),
};

/** vertex part ids (aPart): what the vertex shader rotates */
const PART = { body: 0, wingL: 1, wingR: 2, head: 3, legL: 4, legR: 5 } as const;
/** pivots, gull-local (forward = +z, up = +y, right = +x) — mirrored in the shader */
const SHOULDER_X = 0.06, SHOULDER_Y = 0.045, ELBOW_X = 0.36, NECK = [0, 0.05, 0.15], HIP = [0, -0.06, 0.0];

const enum S { Perched, Hop, Takeoff, Wheel, Landing }

interface Flock { cx: number; cz: number; r: number; alt: number; w: number; p1: number; p2: number; p3: number; p4: number }

interface Gull {
  state: S;
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number;
  flap: number; fold: number; head: number; legs: number;
  perch: number;            // index into perches, or -1
  flock: number;            // index into flocks
  phase: number; scale: number; altOff: number;   // wheel path individuality
  t: number;                // state timer
  dur: number;              // state duration
  timer: number;            // wheel: seconds until it looks for a perch; perched: until next hop / head turn
  flush: number;            // personal flush distance
  // flap burst machinery
  flapT: number; burst: number; glide: number;
  // head turn
  headFrom: number; headTo: number; headT: number; headDur: number;
  // takeoff / landing bezier
  ax: number; ay: number; az: number;   // start
  bx: number; by: number; bz: number;   // control
  tx: number; ty: number; tz: number;   // target (landing); takeoff targets the moving path
  yaw0: number;
}

/** the model is built at ~0.65 m wingspan; instances are scaled up so a gull reads against a post at a distance (the mockups' chunky birds) */
const GULL_SCALE = 1.3, FOOT = 0.17 * GULL_SCALE;
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _m = new THREE.Matrix4(), _quat = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(GULL_SCALE, GULL_SCALE, GULL_SCALE);

export class Gulls {
  group = new THREE.Group();
  mesh!: THREE.InstancedMesh;
  count = 0;
  /** a gull squawked at `pos` — wire to `audio.gullCallAt(pos, player.position, player.yaw)` */
  onCall?: (pos: THREE.Vector3) => void;
  private gulls: Gull[] = [];
  private flocks: Flock[] = [];
  private perches: THREE.Vector3[] = [];
  private perchYaw: number[] = [];
  private occupied: Int8Array = new Int8Array(0);
  private anim!: THREE.InstancedBufferAttribute;
  private rng = new Rng(0x9011);
  private time = 0;
  private callTimer = 6;
  private flushR = 4;
  private uniforms = { uTime: { value: 0 } };

  constructor(private sky: Sky) {}

  /** Sand perches: spots on the beach just above the water line, away from the pier corridors. */
  static beachPerches(seed: number, count = 8, near?: { x: number; z: number; r: number }): THREE.Vector3[] {
    const rng = new Rng(seed ^ 0x6011), wl = waterLevel();
    const out: THREE.Vector3[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 200) {
      const x = near ? near.x + rng.range(-near.r, near.r) : rng.range(-CHUNK_HALF + 30, CHUNK_HALF - 30);
      const z = near ? near.z + rng.range(-near.r, near.r) : rng.range(-CHUNK_HALF + 30, CHUNK_HALF - 30);
      if (!inChunk(x, z, 25)) continue;
      const h = heightAt(x, z) - wl;
      if (h < 0.15 || h > 1.2) continue;                                   // the wet sand band
      if (Math.abs(x) < 8 && Math.abs(z) > 150) continue;                  // N/S pier corridors
      if (Math.abs(z) < 8 && Math.abs(x) > 150) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue;
      out.push(new THREE.Vector3(x, h + wl, z));
    }
    return out;
  }

  build(spec: GullsSpec) {
    this.rng = new Rng((spec.seed ?? 0x5ea1) ^ 0x9011);
    const rng = this.rng;
    this.flushR = spec.flushRadius ?? 4;
    this.perches = spec.perches;
    this.perchYaw = spec.perches.map(() => rng.range(0, Math.PI * 2));
    this.occupied = new Int8Array(spec.perches.length);
    const n = Math.min(40, spec.count ?? 36, spec.perches.length + 16);
    this.count = n;

    // ── the flocks: three loose loops inside the circle ──
    const R = spec.radius, cx = spec.centre.x, cz = spec.centre.z;
    const offs = [[0, 0], [-0.5, 0.35], [0.55, -0.25]];
    for (let i = 0; i < 3; i++) {
      const r = R * rng.range(0.32, 0.48), w = rng.range(9, 11) / r; // ~10 m/s around the loop
      this.flocks.push({ cx: cx + offs[i][0] * R, cz: cz + offs[i][1] * R, r, alt: rng.range(18, 30), w: w * (i % 2 ? -1 : 1), p1: rng.range(0, 6.28), p2: rng.range(0, 6.28), p3: rng.range(0, 6.28), p4: rng.range(0, 6.28) });
    }

    // ── the gulls: ~60 % perched, the rest wheeling ──
    const perched = Math.min(spec.perches.length, Math.round(n * 0.6));
    const order = spec.perches.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
    for (let i = 0; i < n; i++) {
      const g: Gull = {
        state: S.Wheel, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, flap: 0.12, fold: 0, head: 0, legs: 1,
        perch: -1, flock: i % 3, phase: rng.range(0, 6.28), scale: rng.range(0.75, 1.2), altOff: rng.range(-4, 8),
        t: 0, dur: 1, timer: rng.range(20, 40), flush: this.flushR * rng.range(0.8, 1.25),
        flapT: 0, burst: 0, glide: rng.range(1, 4),
        headFrom: 0, headTo: 0, headT: 1, headDur: 1,
        ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, tx: 0, ty: 0, tz: 0, yaw0: 0,
      };
      if (i < perched) this.perchOn(g, order[i]);
      else { g.t = rng.range(0, 100); this.wheelPos(g, this.time, _p); g.x = _p.x; g.y = _p.y; g.z = _p.z; }
      this.gulls.push(g);
    }

    this.buildMesh(n);
    for (let i = 0; i < n; i++) this.writeInstance(i);
    this.mesh.instanceMatrix.needsUpdate = true; this.anim.needsUpdate = true;
    return this;
  }

  // ─────────────── geometry: one faceted gull ───────────────
  private buildMesh(n: number) {
    const pos: number[] = [], col: number[] = [], part: number[] = [];
    const rng = new Rng(0x9011);
    const tri = (a: number[], b: number[], c: number[], colour: THREE.Color, p: number, jitter = 0.05) => {
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      const k = 1 - jitter + rng.next() * jitter * 2;
      for (let i = 0; i < 3; i++) { col.push(colour.r * k, colour.g * k, colour.b * k); part.push(p); }
    };
    const quad = (a: number[], b: number[], c: number[], d: number[], colour: THREE.Color, p: number, jitter = 0.05) => { tri(a, b, c, colour, p, jitter); tri(a, c, d, colour, p, jitter); };

    // body: a lofted 6-sided fuselage, tail point → 3 rings → nose point. Grey back, white flanks / belly.
    const rings: { z: number; rx: number; ry: number; y: number }[] = [
      { z: -0.17, rx: 0.05, ry: 0.035, y: 0.02 }, { z: -0.02, rx: 0.1, ry: 0.09, y: 0.0 }, { z: 0.11, rx: 0.085, ry: 0.08, y: 0.005 },
    ];
    const sides = 6;
    const ringPt = (r: { z: number; rx: number; ry: number; y: number }, k: number) => { const a = (k / sides) * Math.PI * 2 + Math.PI / 6; return [Math.cos(a) * r.rx, r.y + Math.sin(a) * r.ry, r.z]; };
    const bodyCol = (k: number) => { const a = (k + 0.5) / sides * Math.PI * 2 + Math.PI / 6; return Math.sin(a) > 0.35 ? C.grey : Math.sin(a) < -0.5 ? C.belly : C.white; };
    const tail = [0, 0.03, -0.31], nose = [0, 0.03, 0.2];
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      tri(tail, ringPt(rings[0], k1), ringPt(rings[0], k), bodyCol(k), PART.body);
      for (let r = 0; r < rings.length - 1; r++) quad(ringPt(rings[r], k), ringPt(rings[r], k1), ringPt(rings[r + 1], k1), ringPt(rings[r + 1], k), bodyCol(k), PART.body);
      tri(ringPt(rings[2], k), ringPt(rings[2], k1), nose, bodyCol(k), PART.body);
    }
    // tail fan: a flat wedge behind the tail point
    quad([-0.07, 0.03, -0.36], [0.07, 0.03, -0.36], [0.04, 0.03, -0.2], [-0.04, 0.03, -0.2], C.white, PART.body);
    // head: an icosahedron on the neck, a black eye-facet either side, a wedge beak
    {
      const g = new THREE.IcosahedronGeometry(0.058, 0);
      const p = g.attributes.position as THREE.BufferAttribute;
      const hc = [0, 0.11, 0.2];
      for (let i = 0; i < p.count; i += 3) {
        const a = [p.getX(i) + hc[0], p.getY(i) * 0.9 + hc[1], p.getZ(i) * 1.1 + hc[2]];
        const b = [p.getX(i + 1) + hc[0], p.getY(i + 1) * 0.9 + hc[1], p.getZ(i + 1) * 1.1 + hc[2]];
        const c = [p.getX(i + 2) + hc[0], p.getY(i + 2) * 0.9 + hc[1], p.getZ(i + 2) * 1.1 + hc[2]];
        const mx = (a[0] + b[0] + c[0]) / 3 - hc[0], mz = (a[2] + b[2] + c[2]) / 3 - hc[2], my = (a[1] + b[1] + c[1]) / 3 - hc[1];
        const eye = Math.abs(mx) > 0.035 && mz > 0.015 && my > -0.01 && my < 0.04;
        tri(a, b, c, eye ? C.eye : C.white, PART.head, 0.04);
      }
      const bb = [0, 0.1, 0.245], bt = [0, 0.085, 0.345];
      tri([-0.018, bb[1] + 0.012, bb[2]], [0.018, bb[1] + 0.012, bb[2]], bt, C.beak, PART.head, 0.02);
      tri([0.018, bb[1] + 0.012, bb[2]], [0.0, bb[1] - 0.02, bb[2]], bt, C.beak, PART.head, 0.02);
      tri([0.0, bb[1] - 0.02, bb[2]], [-0.018, bb[1] + 0.012, bb[2]], bt, C.beak, PART.head, 0.02);
    }
    // wings: inner panel shoulder→elbow, outer panel elbow→hand, black tip; swept back toward the tip
    for (const side of [-1, 1]) {
      const p = side < 0 ? PART.wingL : PART.wingR;
      const sx = SHOULDER_X * side, ex = ELBOW_X * side, hx = 0.56 * side, tx = 0.72 * side, y = SHOULDER_Y;
      // broad chunky wings (the mockups' birds): a 0.26 chord at the root, the hand swept back to a 0.1 tip
      quad([sx, y, -0.14], [sx, y, 0.12], [ex, y + 0.01, 0.1], [ex, y + 0.01, -0.12], C.grey, p, 0.04);
      quad([ex, y + 0.01, -0.12], [ex, y + 0.01, 0.1], [hx, y + 0.005, 0.04], [hx, y + 0.005, -0.15], C.greyDark, p, 0.04);
      quad([hx, y + 0.005, -0.15], [hx, y + 0.005, 0.04], [tx, y, -0.08], [tx, y, -0.18], C.tip, p, 0.06);
    }
    // legs: two orange sticks from the hip; the feet a small wedge
    for (const side of [-1, 1]) {
      const p = side < 0 ? PART.legL : PART.legR, x = 0.03 * side;
      quad([x - 0.008, -0.05, 0.0], [x + 0.008, -0.05, 0.0], [x + 0.008, -0.17, 0.01], [x - 0.008, -0.17, 0.01], C.leg, p, 0.03);
      tri([x - 0.03, -0.17, 0.05], [x + 0.03, -0.17, 0.05], [x, -0.17, -0.02], C.leg, p, 0.03);
    }

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.anim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAnim', this.anim);
    // the whole area (the bounding sphere is only used for culling the one mesh; the flocks roam ~100 m)
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 20, 0), 400);

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', /* glsl */`#include <common>
          attribute float aPart; attribute vec4 aAnim;
          mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }`)
        .replace('#include <begin_vertex>', /* glsl */`
          vec3 transformed = vec3( position );
          {
            float part = aPart;
            float flap = aAnim.x, headYaw = aAnim.y, fold = aAnim.z, tuck = aAnim.w;
            if (part == 1.0 || part == 2.0) {
              // wing: shorten + sweep back along the flank when perched (tuck 0), fold the hand about the elbow,
              // swing the whole wing about the shoulder (flap, about +z), then sweep about the shoulder (about +y)
              float side = part == 1.0 ? -1.0 : 1.0;
              bool hand = abs(position.x) > ${ELBOW_X.toFixed(3)} - 0.001;
              vec2 e = vec2(${ELBOW_X.toFixed(3)} * side, ${(SHOULDER_Y + 0.01).toFixed(3)});
              vec2 s = vec2(${SHOULDER_X.toFixed(3)} * side, ${SHOULDER_Y.toFixed(3)});
              vec2 xy = transformed.xy;
              float k = 1.0 - 0.45 * (1.0 - tuck);
              xy.x = (xy.x - s.x) * k + s.x; e.x = (e.x - s.x) * k + s.x;
              if (hand) xy = rot2(-fold * side) * (xy - e) + e;
              xy = rot2(flap * side) * (xy - s) + s;
              transformed.xy = xy;
              float sw = (1.0 - tuck) * 1.25;
              vec2 sz = vec2(s.x, 0.02);
              transformed.xz = rot2(-sw * side) * (transformed.xz - sz) + sz;
            } else if (part == 3.0) {
              // head: turn about the neck (y axis)
              vec2 n = vec2(${NECK[0].toFixed(3)}, ${NECK[2].toFixed(3)});
              transformed.xz = rot2(headYaw) * (transformed.xz - n) + n;
            } else if (part >= 4.0) {
              // legs: tuck back under the tail in flight (about the hip, x axis)
              vec2 h = vec2(${HIP[1].toFixed(3)}, ${HIP[2].toFixed(3)});
              transformed.yz = rot2(-tuck * 1.35) * (transformed.yz - h) + h;
            }
          }`);
    };
    mat.customProgramCacheKey = () => 'gulls-anim';
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.group.add(this.mesh);
  }

  // ─────────────── behaviour ───────────────
  private perchOn(g: Gull, perch: number) {
    const p = this.perches[perch];
    this.occupied[perch] = 1;
    g.perch = perch; g.state = S.Perched;
    g.x = p.x; g.y = p.y + FOOT; g.z = p.z;
    g.yaw = this.perchYaw[perch]; g.pitch = 0; g.roll = 0;
    g.flap = -0.3; g.fold = 0.2; g.legs = 0; g.head = 0;
    g.t = 0; g.timer = this.rng.range(1.5, 5);
    g.headFrom = g.headTo = 0; g.headT = 1; g.headDur = 1;
  }

  /** the wheel path of gull g at time t (flock loop + the gull's own phase / scale / altitude) */
  private wheelPos(g: Gull, t: number, out: THREE.Vector3) {
    const f = this.flocks[g.flock];
    const a = f.w * t + g.phase, r = f.r * g.scale;
    out.x = f.cx + r * (Math.sin(a + f.p1) + 0.22 * Math.sin(2 * a + f.p2));
    out.z = f.cz + r * 0.85 * (Math.cos(a + f.p1) + 0.18 * Math.cos(3 * a + f.p3));
    out.y = f.alt + g.altOff + 3.5 * Math.sin(0.45 * a + f.p4) + 1.2 * Math.sin(1.7 * a + g.phase);
    return out;
  }

  private freePerch(g: Gull, player: THREE.Vector3): number {
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < this.perches.length; i++) {
      if (this.occupied[i]) continue;
      const p = this.perches[i];
      if (Math.hypot(p.x - player.x, p.z - player.z) < 10) continue;   // not right beside the player: it would flush again at once
      const score = Math.hypot(p.x - g.x, p.z - g.z) * (0.5 + this.rng.next());
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  private flapBurst(g: Gull, dt: number, flying: boolean) {
    // flap bursts: `burst` beats of ~0.28 s, then a glide of `glide` seconds with the wings in a shallow V
    if (g.burst > 0) {
      g.flapT += dt * 3.6 * Math.PI * 2;
      g.flap = Math.sin(g.flapT) * 0.75;
      g.fold = Math.max(0, -Math.sin(g.flapT - 0.6)) * 0.5;
      if (g.flapT >= Math.PI * 2) { g.flapT -= Math.PI * 2; g.burst--; if (g.burst === 0) g.glide = flying ? this.rng.range(1.5, 5) : 0; }
    } else {
      g.flap += (0.14 - g.flap) * Math.min(1, dt * 6);
      g.fold += (0.12 - g.fold) * Math.min(1, dt * 6);
      g.glide -= dt;
      if (g.glide <= 0) { g.burst = this.rng.int(2, 6); g.flapT = 0; }
    }
  }

  private headTurn(g: Gull, dt: number) {
    g.headT += dt / g.headDur;
    if (g.headT >= 1) {
      g.head = g.headTo;
      if (this.rng.next() < dt * 0.9) { g.headFrom = g.head; g.headTo = this.rng.range(-1.1, 1.1); g.headT = 0; g.headDur = this.rng.range(0.25, 0.5); }
    } else {
      const u = g.headT, e = u * u * (3 - 2 * u);
      g.head = g.headFrom + (g.headTo - g.headFrom) * e;
    }
  }

  private startTakeoff(g: Gull, player: THREE.Vector3) {
    if (g.perch >= 0) this.occupied[g.perch] = 0;
    g.perch = -1;
    // away from the player, up and out
    let ax = g.x - player.x, az = g.z - player.z;
    const d = Math.hypot(ax, az) || 1; ax /= d; az /= d;
    g.ax = g.x; g.ay = g.y; g.az = g.z;
    g.bx = g.x + ax * 5; g.by = g.y + 3.5; g.bz = g.z + az * 5;
    g.flock = this.rng.int(0, 2); g.phase = this.rng.range(0, 6.28);
    g.state = S.Takeoff; g.t = 0; g.dur = 2.6; g.legs = 0;
    g.burst = 8; g.flapT = 0;
    g.timer = this.rng.range(20, 40);
    this.onCall?.(_q.set(g.x, g.y, g.z));
  }

  private startLanding(g: Gull, perch: number) {
    const p = this.perches[perch];
    this.occupied[perch] = 1; g.perch = perch;
    g.ax = g.x; g.ay = g.y; g.az = g.z;
    g.tx = p.x; g.ty = p.y + FOOT; g.tz = p.z;
    const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz, g.ty - g.y);
    // come in along the current heading, high, and drop onto the perch from above
    g.bx = g.x + Math.sin(g.yaw) * d * 0.45; g.bz = g.z + Math.cos(g.yaw) * d * 0.45; g.by = Math.max(g.y, g.ty + 4) + d * 0.08;
    g.state = S.Landing; g.t = 0; g.dur = Math.max(2.5, d / 9);
    g.burst = 0; g.glide = 0.5;
  }

  /** quadratic bezier a → b → c at u, into out */
  private bez(g: Gull, cx: number, cy: number, cz: number, u: number, out: THREE.Vector3) {
    const v = 1 - u, w0 = v * v, w1 = 2 * v * u, w2 = u * u;
    out.x = g.ax * w0 + g.bx * w1 + cx * w2;
    out.y = g.ay * w0 + g.by * w1 + cy * w2;
    out.z = g.az * w0 + g.bz * w1 + cz * w2;
    return out;
  }

  private face(g: Gull, dx: number, dy: number, dz: number, dt: number, bankK: number) {
    const dh = Math.hypot(dx, dz);
    if (dh < 1e-4) return;
    const yaw = Math.atan2(dx, dz);
    let dyaw = yaw - g.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    g.yaw += dyaw;
    const pitch = Math.atan2(dy, dh);
    g.pitch += (pitch * 0.7 - g.pitch) * Math.min(1, dt * 4);
    const roll = THREE.MathUtils.clamp((dyaw / Math.max(dt, 1e-3)) * bankK, -0.75, 0.75);
    g.roll += (roll - g.roll) * Math.min(1, dt * 2.5);
  }

  update(dt: number, player: THREE.Vector3) {
    if (dt <= 0) return;
    this.time += dt; this.uniforms.uTime.value = this.time;
    const t = this.time;
    let flying = 0;
    for (let i = 0; i < this.gulls.length; i++) {
      const g = this.gulls[i];
      switch (g.state) {
        case S.Perched: {
          const d = Math.hypot(g.x - player.x, g.z - player.z);
          if (d < g.flush && g.t > 0.6) { this.startTakeoff(g, player); break; }
          g.t += dt;
          this.headTurn(g, dt);
          g.flap += (-0.3 - g.flap) * Math.min(1, dt * 5); g.fold += (0.2 - g.fold) * Math.min(1, dt * 5);
          g.timer -= dt;
          if (g.timer <= 0) {
            g.timer = this.rng.range(3, 9);
            if (this.rng.next() < 0.5) { g.state = S.Hop; g.t = 0; g.dur = 0.36; g.yaw0 = g.yaw; g.ay = g.y; g.head = g.headTo = g.headFrom = 0; g.headT = 1; g.bx = this.rng.range(-0.9, 0.9); }
          }
          break;
        }
        case S.Hop: {
          g.t += dt;
          const u = Math.min(1, g.t / g.dur), s = Math.sin(u * Math.PI);
          g.y = g.ay + s * 0.14;
          g.yaw = g.yaw0 + g.bx * u;
          g.flap = -0.3 + s * 0.8; g.fold = 0.2; g.legs = s * 0.5;
          if (u >= 1) { g.state = S.Perched; g.y = g.ay; }
          break;
        }
        case S.Takeoff: {
          g.t += dt;
          const u = Math.min(1, g.t / g.dur), e = u * u * (3 - 2 * u);
          this.wheelPos(g, t, _q);
          this.bez(g, _q.x, _q.y, _q.z, e, _p);
          this.face(g, _p.x - g.x, _p.y - g.y, _p.z - g.z, dt, 0.35);
          g.x = _p.x; g.y = _p.y; g.z = _p.z;
          g.legs += (1 - g.legs) * Math.min(1, dt * 2);
          this.flapBurst(g, dt, true);
          if (u >= 1) { g.state = S.Wheel; g.glide = 0; }
          flying++;
          break;
        }
        case S.Wheel: {
          this.wheelPos(g, t, _p);
          this.face(g, _p.x - g.x, _p.y - g.y, _p.z - g.z, dt, 0.9);
          g.x = _p.x; g.y = _p.y; g.z = _p.z;
          g.legs = 1;
          this.flapBurst(g, dt, true);
          g.timer -= dt;
          if (g.timer <= 0) {
            const p = this.freePerch(g, player);
            if (p >= 0) this.startLanding(g, p); else g.timer = 5;
          }
          flying++;
          break;
        }
        case S.Landing: {
          g.t += dt;
          const u = Math.min(1, g.t / g.dur), e = u < 0.5 ? 2 * u * u : 1 - (2 * (1 - u) * (1 - u)) * 0.85 - 0.15 * (1 - u); // ease-in, then a steady glide down
          this.bez(g, g.tx, g.ty, g.tz, e, _p);
          this.face(g, _p.x - g.x, _p.y - g.y, _p.z - g.z, dt, 0.5);
          g.x = _p.x; g.y = _p.y; g.z = _p.z;
          if (u > 0.82) { // the flare: legs down, pitch up, a last flap burst
            g.legs += (0 - g.legs) * Math.min(1, dt * 4);
            g.pitch += (0.45 - g.pitch) * Math.min(1, dt * 3);
            if (g.burst === 0 && g.glide > 0.2) { g.burst = 3; g.flapT = 0; }
          }
          this.flapBurst(g, dt, true);
          if (u >= 1) { this.perchOn(g, g.perch); g.roll = 0; }
          flying++;
          break;
        }
      }
      this.writeInstance(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.anim.needsUpdate = true;
    // the odd squawk: a wheeling gull if any, else a perched one
    this.callTimer -= dt;
    if (this.callTimer <= 0) {
      this.callTimer = this.rng.range(5, 12);
      const k = this.rng.int(0, this.gulls.length - 1);
      let g = this.gulls[k];
      if (flying > 0 && g.state === S.Perched) { for (let j = 0; j < this.gulls.length; j++) { const h = this.gulls[(k + j) % this.gulls.length]; if (h.state === S.Wheel) { g = h; break; } } }
      this.onCall?.(_q.set(g.x, g.y, g.z));
    }
  }

  private writeInstance(i: number) {
    const g = this.gulls[i];
    _e.set(-g.pitch, g.yaw, g.roll, 'YXZ');
    _quat.setFromEuler(_e);
    _p.set(g.x, g.y, g.z);
    _m.compose(_p, _quat, _s);
    this.mesh.setMatrixAt(i, _m);
    const a = this.anim.array as Float32Array;
    a[i * 4] = g.flap; a[i * 4 + 1] = g.head; a[i * 4 + 2] = g.fold; a[i * 4 + 3] = g.legs;
  }
}
