/**
 * Pier — a low-poly wooden jetty on pilings (Driftwood Isle's south entry). Flat-shaded
 * vertex-coloured geometry, no textures; one mesh, one draw call.
 *
 *   const pier = new Pier(sky, { x: 0, z: -250, length: 60, width: 4, deckY: 1.8 }).build();
 *   scene.add(pier.group);
 *   player.colliders.push(...pier.colliders);              // posts + the raised mooring bollards
 *   player.platforms.push((x, z) => pier.floorHeightAt(x, z)); // the deck is walkable
 *   player.position.y = pier.deckY;                         // spawning on it: Player.spawn() uses the terrain height
 *
 * The pier runs from (x, z) toward +z (north) for `length` metres. `floorHeightAt` returns the
 * deck's top for any (x, z) over the deck, else undefined — same contract as `Cabins`.
 * `bollards` are the two tall rope-wrapped posts at the sea end (the sailboat moors to them);
 * `posts` every piling. `mooringsFor(x, z)` picks the bollard and the piling nearest a boat moored
 * alongside at (x, z) — pass it as `Boat.moorTo`.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider } from '../player/Player';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Sky } from './Sky';
import { heightAt, waterLevel } from './Heightfield';
import { boxDesc, type ColliderDesc } from './registry';
import { lowPolyMaterial } from './lowpolyKit';
import { patchSway } from './wind';

export interface PierSpec {
  x: number; z: number;
  /** metres along +z from (x, z) */
  length: number;
  /** deck width, metres */
  width: number;
  /** world y of the deck top */
  deckY: number;
  /** direction along the pier in radians about +y (0 = +z); the sea end is at (x, z) */
  rot?: number;
  /** how far below the deck the pilings reach (the sea floor is ~6 m down) */
  pileDepth?: number;
  /** run on past `length` over the shallows to the first dry sand, and step down onto it (the south pier, E43) */
  landing?: boolean;
}

const C = {
  plank: new THREE.Color('#9a7a56'),
  plankLight: new THREE.Color('#b08d64'),
  plankDark: new THREE.Color('#7c6244'),
  post: new THREE.Color('#6f5638'),
  postTop: new THREE.Color('#8a6d48'),
  rope: new THREE.Color('#d8c48a'),
  ropeDark: new THREE.Color('#b59e6a'),
  brass: new THREE.Color('#d9b45a'),
};

/**
 * The pier's pennant (E111). A swallowtail in the Lookout banner's blues with its white diamond. It flies downwind
 * (wind.ts leans everything toward (-0.55, 0.83)) and flutters in the shared wind.
 *
 * The cloth is one sheet of single-sided triangles on the kit's DoubleSide material. Its own mesh casts a shadow but
 * never receives one. The old flag was a front and a back triangle, coplanar, in the pier's shadow-receiving mesh. It
 * shadowed itself into dark triangular streaks, the same acne as the boat's sail (E110).
 */
const PENNANT = {
  length: 1.75, hoist: 0.72, cols: 7, rows: 4,
  /** the swallowtail's notch, as a share of the length at the centre line */
  notch: 0.3,
  /** where along the length the notch starts to pull the centre line back (E138: from the hoist, it bent every column
   *  line into a chevron, and the sleeve's edge read as a jagged seam across the cloth) */
  notchFrom: 0.4,
  blue: new THREE.Color('#2f5bd0'), dark: new THREE.Color('#1c3c96'), white: new THREE.Color('#e8f0ff'),
  /** downwind, unit xz (wind.ts WX / WZ) */
  dir: [-0.55, 0.83] as const,
};

/** a travelling ripple from the hoist to the fly, across the cloth. wind.ts's sway mostly leans along the wind, which is
 * along this flag, so on its own it would stretch the pennant rather than wave it */
function patchFlutter(shader: { vertexShader: string }): void {
  const [dx, dz] = PENNANT.dir, n = Math.hypot(dx, dz), sx = (-dz / n).toFixed(3), sz = (dx / n).toFixed(3);
  shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `{
    float fw = aSway.x;
    if (fw > 0.0) {
      float ripple = sin(uWindTime * 5.2 - fw * 7.0 + aSway.y) * 0.7 + sin(uWindTime * 8.3 - fw * 11.0) * 0.3;
      transformed += vec3(${sx}, 0.0, ${sz}) * ripple * 0.075 * fw * (0.45 + 0.55 * uGust);
    }
  }
  #include <project_vertex>`);
}

let pennantDepth: THREE.MeshDepthMaterial | null = null;
function pennantDepthMaterial(): THREE.MeshDepthMaterial {
  if (pennantDepth) return pennantDepth;
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => { patchSway(sh); patchFlutter(sh); };
  m.customProgramCacheKey = () => 'pennant-depth';
  pennantDepth = m;
  return m;
}

/** the pennant's cloth, in world space: hoisted at (x, z) with its top edge at `yTop` */
function buildPennant(sky: Sky, x: number, z: number, yTop: number, rng: Rng): THREE.Mesh {
  const { length: L, hoist: H, cols, rows, notch, notchFrom } = PENNANT;
  const [dx, dz] = PENNANT.dir, dn = Math.hypot(dx, dz), ax = dx / dn, az = dz / dn, nx = -az, nz = ax;
  // (a along the length 0‥1, v down the hoist 0‥1, side offset off the cloth) → world xyz + the sway weight. The cloth's
  // grid passes u and lets the notch pull the centre of the fly end back; the sigil passes a directly, so it stays a diamond
  const P = (a: number, v: number, off = 0, u = a): { p: number[]; w: number } => {
    const half = (H / 2) * (1 - 0.5 * u);
    const y = yTop - H / 2 - 0.12 * u * u + (0.5 - v) * 2 * half;
    const s = Math.sin(a * Math.PI * 2 + 0.6) * 0.09 * a + Math.sin(v * Math.PI) * 0.02 * a + off;
    const d = 0.05 + a * L;
    return { p: [x + ax * d + nx * s, y, z + az * d + nz * s], w: 0.95 * a };
  };
  const pos: number[] = [], col: number[] = [], sway: number[] = [];
  const tri = (a: { p: number[]; w: number }, b: { p: number[]; w: number }, c: { p: number[]; w: number }, color: THREE.Color, jitter: number) => {
    const k = 1 - jitter + rng.next() * jitter * 2;
    for (const q of [a, b, c]) { pos.push(...q.p); col.push(color.r * k, color.g * k, color.b * k); sway.push(q.w, 0.9); }
  };
  // the cloth: a grid, the first column a darker sleeve round the pole
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const u0 = c / cols, u1 = (c + 1) / cols, v0 = r / rows, v1 = (r + 1) / rows, color = c === 0 ? PENNANT.dark : PENNANT.blue;
    // the notch pulls the fly end's centre back; the hoist half (the sleeve's edge, the diamond) keeps straight columns
    const G = (u: number, v: number) => P(u - notch * (1 - Math.abs(2 * v - 1)) * Math.max(0, (u - notchFrom) / (1 - notchFrom)), v, 0, u);
    tri(G(u0, v0), G(u0, v1), G(u1, v1), color, 0.04);
    tri(G(u0, v0), G(u1, v1), G(u1, v0), color, 0.04);
  }
  // the Wildshard sigil on both faces, a hair proud of the cloth: a white diamond round a dark one
  const uc = 0.27, vc = 0.5;
  for (const side of [-1, 1]) {
    for (const [du, dv, off, color] of [[0.085, 0.36, 0.028, PENNANT.white], [0.045, 0.19, 0.05, PENNANT.dark]] as const) {
      const o = side * off, m = P(uc, vc, o), tip = [P(uc, vc - dv, o), P(uc + du, vc, o), P(uc, vc + dv, o), P(uc - du, vc, o)];
      for (let i = 0; i < 4; i++) { const a = tip[i], b = tip[(i + 1) % 4]; if (a && b) tri(m, a, b, color, 0.02); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 2));
  g.computeBoundingSphere();
  const mat = lowPolyMaterial(sky, 'pennant', (m) => {
    const kit = m.onBeforeCompile.bind(m);
    m.onBeforeCompile = (sh, r) => { kit(sh, r); patchFlutter(sh); };
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'pier-pennant';
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.customDepthMaterial = pennantDepthMaterial();
  return mesh;
}

export class Pier {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  /** the sea-end pennant's cloth (the south pier only): its own mesh, casts but never receives shadows */
  pennant: THREE.Mesh | null = null;
  colliders: Collider[] = [];
  /** the two tall mooring posts at the sea end, world xz */
  bollards: { x: number; z: number }[] = [];
  /** every piling along the deck, world xz (mooring lines, gulls…) */
  posts: { x: number; z: number }[] = [];
  readonly deckY: number;
  private cos: number; private sin: number;

  constructor(private sky: Sky, private spec: PierSpec) {
    this.deckY = spec.deckY;
    const r = spec.rot ?? 0;
    this.cos = Math.cos(r); this.sin = Math.sin(r);
  }

  /** local (along, across) → world */
  private toWorld(along: number, across: number): [number, number] {
    return [this.spec.x + across * this.cos + along * this.sin, this.spec.z - across * this.sin + along * this.cos];
  }

  /** where the deck ends (≥ spec.length: the landing run), where it starts ramping down, and the sand it lands on */
  private run = { length: 0, rampFrom: 0, landY: 0 };

  build(): this {
    const { width, deckY } = this.spec;
    let length = this.spec.length;
    this.run = { length, rampFrom: length, landY: deckY };
    if (this.spec.landing) {
      // march on over the shallows to the first dry sand, then 5 m more: the last 6 m step down onto the beach
      const wl = waterLevel();
      let a = length;
      while (a < length + 80) { const [x, z] = this.toWorld(a, 0); if (heightAt(x, z) > wl + 0.1) break; a += 0.5; }
      const end = a + 4, [ex, ez] = this.toWorld(end, 0);
      this.run = { length: end, rampFrom: end - 5.5, landY: heightAt(ex, ez) + 0.12 };
      length = end;
    }
    const pileDepth = this.spec.pileDepth ?? 8;
    const rng = new Rng(SEED ^ 0x9e37);
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.08) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const nonIdx = g.index ? g.toNonIndexed() : g;
      const n = nonIdx.getAttribute('position').count;
      const c = new Float32Array(n * 3);
      // one shade per face (every 3 vertices) so the facets read
      for (let i = 0; i < n; i += 3) {
        const k = 1 - jitter + rng.next() * jitter * 2;
        for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; }
      }
      nonIdx.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(nonIdx);
    };
    const place = (g: THREE.BufferGeometry, along: number, across: number, y: number, rotY = 0) => {
      const [wx, wz] = this.toWorld(along, across);
      g.rotateY((this.spec.rot ?? 0) + rotY);
      g.translate(wx, y, wz);
      return g;
    };

    // ── deck planks across the pier, slightly uneven ──
    const plankW = 0.36, gap = 0.05, thick = 0.12;
    const bearerY = deckY - thick - 0.16;
    for (let a = 0; a < length; a += plankW + gap) {
      const w = width + 0.3 + rng.range(-0.06, 0.06);
      const g = new THREE.BoxGeometry(w, thick, plankW);
      const dy = rng.range(-0.015, 0.015), tilt = rng.range(-0.012, 0.012);
      g.rotateZ(tilt);
      const shade = rng.next();
      add(place(g, a + plankW / 2, rng.range(-0.03, 0.03), this.deckAt(a + plankW / 2) - thick / 2 + dy), shade < 0.2 ? C.plankDark : shade > 0.8 ? C.plankLight : C.plank, 0.06);
    }
    // ── two bearers (stringers) under the planks, full length ──
    const flat = this.run.rampFrom;
    for (const s of [-1, 1]) add(place(new THREE.BoxGeometry(0.22, 0.28, flat + 0.4), flat / 2, s * (width / 2 - 0.35), bearerY), C.plankDark, 0.05);
    if (length > flat + 0.1) {
      const drop = deckY - this.run.landY, len = Math.hypot(length - flat, drop), ang = Math.atan2(drop, length - flat);
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.22, 0.28, len); g.rotateX(ang);
        add(place(g, (flat + length) / 2, s * (width / 2 - 0.35), bearerY - drop / 2), C.plankDark, 0.05);
      }
    }

    // ── pilings every 3 m each side, cross braces, rope wraps at the top ──
    const postR = 0.17, postTop = deckY + 0.95;
    for (let a = 1.2; a < this.run.rampFrom; a += 3.0) {
      for (const s of [-1, 1]) {
        const across = s * (width / 2 + 0.1);
        const h = postTop - (deckY - pileDepth);
        const g = new THREE.CylinderGeometry(postR * 0.9, postR * 1.15, h, 7);
        g.rotateY(rng.range(0, Math.PI));
        add(place(g, a, across, (postTop + deckY - pileDepth) / 2, 0), C.post, 0.07);
        // cap
        add(place(new THREE.CylinderGeometry(postR * 0.95, postR * 0.95, 0.1, 7), a, across, postTop + 0.02), C.postTop, 0.05);
        // rope wrap: three short 8-sided bands just under the cap (a torus each was 100 tris; the pier is drawn twice with shadows)
        for (let r = 0; r < 3; r++) add(place(new THREE.CylinderGeometry(postR + 0.06, postR + 0.06, 0.08, 8), a, across, postTop - 0.16 - r * 0.1), r === 1 ? C.ropeDark : C.rope, 0.04);
        const [wx, wz] = this.toWorld(a, across);
        this.posts.push({ x: wx, z: wz });
        this.colliders.push({ x: wx, z: wz, hw: postR + 0.04, hd: postR + 0.04, rot: -(this.spec.rot ?? 0), yTop: postTop, yBottom: deckY - 1 });
      }
      // cross brace under the deck between the two posts
      const b = new THREE.BoxGeometry(width + 0.4, 0.12, 0.12);
      add(place(b, a, 0, bearerY - 0.3), C.plankDark, 0.05);
    }

    // ── mooring bollards at the sea end: two thicker, taller posts with a heavy rope wrap ──
    for (const s of [-1, 1]) {
      const across = s * (width / 2 + 0.25);
      const top = deckY + 1.35;
      const g = new THREE.CylinderGeometry(0.24, 0.28, top - (deckY - pileDepth), 8);
      add(place(g, 0.35, across, (top + deckY - pileDepth) / 2), C.post, 0.06);
      add(place(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 8), 0.35, across, top + 0.03), C.postTop, 0.05);
      for (let r = 0; r < 5; r++) add(place(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 8), 0.35, across, top - 0.22 - r * 0.11), r % 2 ? C.ropeDark : C.rope, 0.04);
      const [wx, wz] = this.toWorld(0.35, across);
      this.bollards.push({ x: wx, z: wz });
      this.colliders.push({ x: wx, z: wz, hw: 0.32, hd: 0.32, rot: -(this.spec.rot ?? 0), yTop: top, yBottom: deckY - 1 });
    }
    // ── the landing: two thick rope-wrapped posts where the deck meets the sand ──
    if (this.spec.landing) {
      for (const s of [-1, 1]) {
        const across = s * (width / 2 + 0.3), [wx, wz] = this.toWorld(length - 0.4, across), gy = heightAt(wx, wz), top = gy + 1.5;
        add(place(new THREE.CylinderGeometry(0.26, 0.3, top - gy + 1.2, 8), length - 0.4, across, (top + gy - 1.2) / 2), C.post, 0.06);
        add(place(new THREE.CylinderGeometry(0.29, 0.29, 0.12, 8), length - 0.4, across, top + 0.03), C.postTop, 0.05);
        for (let r = 0; r < 6; r++) add(place(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 8), length - 0.4, across, top - 0.25 - r * 0.11), r % 2 ? C.ropeDark : C.rope, 0.04);
        this.colliders.push({ x: wx, z: wz, hw: 0.34, hd: 0.34, rot: -(this.spec.rot ?? 0), yTop: top, yBottom: gy - 1 });
      }
      // a pennant on the sea-end bollard, so the pier end reads from the beach (E111): a taller pole with a brass finial
      // and two rope ties at the hoist; the cloth itself is its own swaying mesh (buildPennant, below)
      const px = -(width / 2 + 0.25), top = deckY + 1.35, poleH = 2.75;
      add(place(new THREE.CylinderGeometry(0.045, 0.055, poleH, 6), 0.35, px, top + poleH / 2), C.post, 0.04);
      add(place(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 6), 0.35, px, top + poleH + 0.02), C.postTop, 0.04);
      add(place(new THREE.OctahedronGeometry(0.085, 0).scale(1, 1.5, 1), 0.35, px, top + poleH + 0.16), C.brass, 0.1);
      const hoistTop = top + poleH - 0.12;
      for (const y of [hoistTop - 0.03, hoistTop - PENNANT.hoist + 0.03]) add(place(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 6), 0.35, px, y), C.rope, 0.04);
      const [hx, hz] = this.toWorld(0.35, px);
      this.pennant = buildPennant(this.sky, hx, hz, hoistTop, rng);
      this.group.add(this.pennant);
    }
    // ── the sea end: a low kick board so the deck reads as an end, not a cut ──
    add(place(new THREE.BoxGeometry(width + 0.3, 0.22, 0.14), 0.02, 0, deckY + 0.05), C.plankDark, 0.05);

    const geo = mergeGeometries(parts, false);
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    return this;
  }

  /** [bollard, piling] on the side of (x, z) for a boat moored alongside — bow line and stern line */
  mooringsFor(x: number, z: number, sternZ = z + 3): { x: number; z: number }[] {
    const side = (x - this.spec.x) * this.cos - (z - this.spec.z) * this.sin < 0 ? -1 : 1;
    const onSide = (p: { x: number; z: number }) => Math.sign((p.x - this.spec.x) * this.cos - (p.z - this.spec.z) * this.sin) === side;
    const bollard = this.bollards.find(onSide) ?? this.bollards[0];
    let post = this.posts[0], best = Infinity;
    for (const p of this.posts) { if (!onSide(p)) continue; const d = Math.hypot(p.x - x, p.z - sternZ); if (d < best) { best = d; post = p; } }
    if (!bollard || !post) throw new Error('Pier.mooringsFor(): build() first');
    return [bollard, post];
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its walls / posts (the legacy boxes) and every floor
   * `floorHeightAt` describes, as real geometry. src/physics/pieces.ts turns it into Rapier colliders.
   *
   * The flat deck is one slab (0.3 m: the planks and the bearers under them) over the region `floorHeightAt` covers;
   * the landing's step-down (the south pier, E43) is a real ramp — the planks the mesh draws follow one straight line
   * from the deck to the sand — so it is a thin box pitched to that line, plus the 0.2 m of flat sand-level deck past it.
   */
  colliderDescs(): ColliderDesc[] {
    const { width, deckY } = this.spec, yaw = this.spec.rot ?? 0, halfW = width / 2 + 0.25;
    const out: ColliderDesc[] = this.colliders.map((c) => boxDesc(c));
    // a box along the pier: `a0`‥`a1` metres from the sea end, top at `top`, `hy` half thick
    const slab = (a0: number, a1: number, top: number, hy: number): ColliderDesc => {
      const [x, z] = this.toWorld((a0 + a1) / 2, 0);
      return { kind: 'box', x, y: top - hy, z, hx: halfW, hy, hz: (a1 - a0) / 2, yaw };
    };
    const { length, rampFrom, landY } = this.run;
    const ramped = length > rampFrom + 0.1;
    out.push(slab(-0.2, ramped ? rampFrom : length + 0.2, deckY, 0.15));
    if (ramped) {
      // the ramp: its top face on the line (rampFrom, deckY) → (length, landY); pitched about the pier's across axis
      const run = length - rampFrom, drop = deckY - landY, pitch = Math.atan2(drop, run), half = Math.hypot(run, drop) / 2, hy = 0.1;
      const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2), sx = Math.sin(pitch / 2), cx = Math.cos(pitch / 2);
      // top-face centre, then down the box's own up axis ((0, cos, sin) in the pier's frame) by its half thickness
      const [tx, tz] = this.toWorld((rampFrom + length) / 2, 0), topY = (deckY + landY) / 2;
      const nAlong = Math.sin(pitch), nUp = Math.cos(pitch);
      out.push({
        kind: 'box', x: tx - hy * nAlong * this.sin, y: topY - hy * nUp, z: tz - hy * nAlong * this.cos, hx: halfW, hy, hz: half,
        rot: { x: cy * sx, y: sy * cx, z: -sy * sx, w: cy * cx },   // yaw ∘ pitch (the pitch in the pier's own frame)
      });
      out.push(slab(length, length + 0.2, landY, 0.1));
    }
    return out;
  }

  /** world y of the deck under (x, z), or undefined off the pier */
  floorHeightAt(x: number, z: number): number | undefined {
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const along = dx * this.sin + dz * this.cos, across = dx * this.cos - dz * this.sin;
    if (along < -0.2 || along > this.run.length + 0.2 || Math.abs(across) > this.spec.width / 2 + 0.25) return undefined;
    return this.deckAt(along);
  }

  /** the deck's top at `along` metres from the sea end: flat, then the landing's step-down onto the sand */
  private deckAt(along: number): number {
    if (along <= this.run.rampFrom) return this.deckY;
    const t = Math.min(1, (along - this.run.rampFrom) / Math.max(0.1, this.run.length - this.run.rampFrom));
    return this.deckY + (this.run.landY - this.deckY) * t;
  }
}
