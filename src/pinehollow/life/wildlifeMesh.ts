/**
 * The small wildlife of Pine Hollow (PINE-HOLLOW-REMASTER PH-M5) in ONE instanced draw: the raven, the great grey owl, the
 * pileated woodpecker and the snowshoe hare. Each is built here from ellipsoids, cones
 * and feather sheets at its real size (forward = +z, up = +y), smooth-shaded, PBR (per-vertex roughness: a raven's glossy
 * black, an owl's matte down), vertex-coloured with feather / fur mottling — no textures. All four models live in one
 * geometry; an instance draws only its own kind (the others collapse to a point in the vertex shader), so the whole
 * menagerie is one draw call and one program, parked in the scene before the boot's precompile.
 *
 *   const mesh = new WildlifeMesh(sky, 24);
 *   scene.add(mesh.mesh);
 *   mesh.begin();          // each frame: then
 *   mesh.add(pose);        // per live instance (a WildPose: kind, place, the part angles) — packed at the front
 *   mesh.commit();         // draws exactly those (mesh.count)
 *
 * Per vertex: position, normal, colour, the part's pivot, and two packed vec4s — (part, kind, roughness, emissive) and (the
 * atlas uv, textured?, pose variant). The parts move in the vertex shader from two per-instance vec4s: birds (flap, fold, head yaw, head pitch) + (kind, leg
 * tuck, –, –); the hare (hind legs, fore legs, head pitch, ears back) + (kind, head yaw, –, –). Normals turn with their part.
 * No shadow is cast (a bird-sized caster would add the cascades' draws); the forest's shadows fall on them.
 */
import * as THREE from 'three';
import { attachFogUniforms } from '../../world/Atmosphere';
import type { Sky } from '../../world/Sky';
import type { BirdMesh, BirdSet } from './birdModels';

export const KIND = { raven: 0, owl: 1, woodpecker: 2, hare: 4 } as const;
export type WildKind = (typeof KIND)[keyof typeof KIND];

/** vertex part ids (aPart): what the vertex shader turns */
const P = { body: 0, wingL: 1, wingR: 2, head: 3, legs: 4, tail: 5, hBody: 10, hHead: 11, hEars: 12, hHind: 13, hFore: 14 } as const;
/** the hare's neck: its ears turn with the head about this point */
const HARE_NECK: V3 = [0, 0.235, 0.15];

type V3 = readonly [number, number, number];
type Paint = (p: V3, n: V3) => THREE.Color;

/** one instance's pose for `WildlifeMesh.write` */
export interface WildPose {
  kind: WildKind;
  x: number; y: number; z: number;
  /** heading (forward = (sin yaw, cos yaw)), nose-up pitch, bank */
  yaw: number; pitch: number; roll: number;
  scale: number;
  /** birds: flap (+ = up), fold 0 spread → 1 folded, head yaw, head pitch (+ = down); hare: hind, fore, head pitch, ears back */
  a0: number; a1: number; a2: number; a3: number;
  /** birds: leg tuck (0 down → 1 tucked); hare: head yaw */
  b1: number;
  /** birds: the body's nose-up pitch the head turns against (its yaw axis stays world-vertical: an upright owl, a woodpecker on a trunk) */
  b2: number;
}
export const newPose = (kind: WildKind): WildPose => ({ kind, x: 0, y: -999, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, a0: 0, a1: 0, a2: 0, a3: 0, b1: 0, b2: 0 });

// ─────────────── the geometry builder ───────────────
const _c = new THREE.Color();
/** a hash in 0..1 of a point (the mottling) */
const hash3 = (x: number, y: number, z: number): number => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

class Builder {
  readonly pos: number[] = []; readonly nor: number[] = []; readonly col: number[] = []; readonly idx: number[] = [];
  readonly part: number[] = []; readonly kind: number[] = []; readonly pivot: number[] = []; readonly rough: number[] = []; readonly emis: number[] = [];
  /** the atlas: uv, the texture's weight (1 = a modelled bird, 0 = vertex colour only) and the pose variant (−1 = every
   *  pose, 0 = perched / folded, 1 = flying) */
  readonly uv: number[] = []; readonly tex: number[] = []; readonly variant: number[] = [];
  k = 0;
  vert(p: V3, n: V3, c: THREE.Color, part: number, pivot: V3, rough: number, emis: number, uv: readonly [number, number] = [0, 0], tex = 0, variant = -1): number {
    this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(c.r, c.g, c.b);
    this.part.push(part); this.kind.push(this.k); this.pivot.push(pivot[0], pivot[1], pivot[2]); this.rough.push(rough); this.emis.push(emis);
    this.uv.push(uv[0], uv[1]); this.tex.push(tex); this.variant.push(variant);
    return this.pos.length / 3 - 1;
  }

  /**
   * An ellipsoid at `c` with radii `r`, turned by `rot` (x, y, z radians, applied z → y → x… as three's Euler XYZ), its
   * radius along its own z scaled by `taper(u)` (u −1 tail → +1 nose). Smooth normals from the ellipsoid's gradient.
   */
  blob(c: V3, r: V3, paint: Paint, part: number, pivot: V3, o: { rough?: number; emis?: number; rot?: V3; taper?: (u: number) => number; w?: number; h?: number } = {}): void {
    const w = o.w ?? 12, h = o.h ?? 8, rough = o.rough ?? 0.75, emis = o.emis ?? 0;
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rot?.[0] ?? 0, o.rot?.[1] ?? 0, o.rot?.[2] ?? 0));
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const base = this.pos.length / 3;
    for (let j = 0; j <= h; j++) {
      const th = (j / h) * Math.PI; // 0 = the nose (+z) … π = the tail
      const u = Math.cos(th), s = Math.sin(th);
      const t = o.taper ? o.taper(u) : 1;
      for (let i = 0; i <= w; i++) {
        const ph = (i / w) * Math.PI * 2;
        const ex = Math.cos(ph) * s, ey = Math.sin(ph) * s, ez = u;
        v.set(ex * r[0] * t, ey * r[1] * t, ez * r[2]).applyMatrix4(m);
        n.set(ex / r[0], ey / r[1], ez / r[2]).applyMatrix3(nm).normalize();
        const p: V3 = [v.x + c[0], v.y + c[1], v.z + c[2]];
        this.vert(p, [n.x, n.y, n.z], paint(p, [n.x, n.y, n.z]), part, pivot, rough, emis);
      }
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const a = base + j * (w + 1) + i, b = a + 1, d = a + (w + 1), e = d + 1;
      this.idx.push(a, d, b, b, d, e);
    }
  }

  /** a cone from a ring at `base` (radius `rad`, facing `tip`) to `tip` — beaks, crests, claws */
  cone(base: V3, tip: V3, rad: number, paint: Paint, part: number, pivot: V3, rough = 0.5, segs = 6): void {
    const ax = new THREE.Vector3(tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]);
    const len = ax.length(); ax.normalize();
    const up = Math.abs(ax.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const e1 = new THREE.Vector3().crossVectors(ax, up).normalize(), e2 = new THREE.Vector3().crossVectors(ax, e1);
    const tipI = this.vert(tip, [ax.x, ax.y, ax.z], paint(tip, [ax.x, ax.y, ax.z]), part, pivot, rough, 0);
    const ring: number[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const p: V3 = [base[0] + (e1.x * ca + e2.x * sa) * rad, base[1] + (e1.y * ca + e2.y * sa) * rad, base[2] + (e1.z * ca + e2.z * sa) * rad];
      const nn = new THREE.Vector3(e1.x * ca + e2.x * sa, e1.y * ca + e2.y * sa, e1.z * ca + e2.z * sa).multiplyScalar(len).addScaledVector(ax, rad).normalize();
      ring.push(this.vert(p, [nn.x, nn.y, nn.z], paint(p, [nn.x, nn.y, nn.z]), part, pivot, rough, 0));
    }
    for (let i = 0; i < segs; i++) { const a = ring[i], b = ring[(i + 1) % segs]; if (a !== undefined && b !== undefined) this.idx.push(a, b, tipI); }
  }

  /** a flat sheet (a fan over the convex outline `pts`, normal `n`): wings, tails, feet — drawn double-sided */
  sheet(pts: readonly V3[], n: V3, paint: Paint, part: number, pivot: V3, rough = 0.8): void {
    const first = pts[0];
    if (first === undefined) return;
    const ids = pts.map((p) => this.vert(p, n, paint(p, n), part, pivot, rough, 0));
    for (let i = 1; i + 1 < ids.length; i++) { const a = ids[0], b = ids[i], c = ids[i + 1]; if (a !== undefined && b !== undefined && c !== undefined) this.idx.push(a, b, c); }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(this.pivot, 3));
    // the scalars packed into two vec4s (WebGL's 16 attribute slots: the instance matrix takes four of them)
    const n = this.part.length, info = new Float32Array(n * 4), tex = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      info[i * 4] = this.part[i] ?? 0; info[i * 4 + 1] = this.kind[i] ?? 0; info[i * 4 + 2] = this.rough[i] ?? 0.8; info[i * 4 + 3] = this.emis[i] ?? 0;
      tex[i * 4] = this.uv[i * 2] ?? 0; tex[i * 4 + 1] = this.uv[i * 2 + 1] ?? 0; tex[i * 4 + 2] = this.tex[i] ?? 0; tex[i * 4 + 3] = this.variant[i] ?? -1;
    }
    g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
    g.setAttribute('aTexV', new THREE.BufferAttribute(tex, 4));
    g.setIndex(this.idx);
    return g;
  }
}

/** a paint of `hex`, mottled ±`m` by position (feathers / fur), darker toward the back when `back` > 0 */
function mottle(hex: string, m = 0.12, freq = 60, back = 0): Paint {
  const base = new THREE.Color(hex);
  return (p, n) => {
    const k = 1 - m + 2 * m * hash3(Math.floor(p[0] * freq), Math.floor(p[1] * freq), Math.floor(p[2] * freq)) - back * Math.max(0, n[1]) * 0.35;
    return _c.copy(base).multiplyScalar(k).clone();
  };
}
const flat = (hex: string): Paint => { const c = new THREE.Color(hex); return () => c.clone(); };

/**
 * A wing of `side` (+1 right, −1 left): a feather sheet from the shoulder out to the wrist, then the slotted primaries
 * (`fingers` slim feathers fanned at the tip — the raven's and the owl's fingered silhouette). `span` from the shoulder,
 * `chord` at the root. Its pivot is the shoulder.
 */
function wing(b: Builder, side: number, shoulder: V3, span: number, chord: number, fingers: number, paint: Paint, rough: number): void {
  const part = side < 0 ? P.wingL : P.wingR;
  const [sx, sy, sz] = shoulder, X = (d: number): number => sx + side * d;
  const up: V3 = [0, 1, 0];
  // the arm: root chord → the wrist (0.55 span), a slight forward lead at the wrist
  const wr = span * 0.55, wc = chord * 0.8;
  b.sheet([[X(0), sy, sz + chord * 0.45], [X(wr), sy + 0.01, sz + chord * 0.35], [X(wr), sy + 0.01, sz - wc + chord * 0.35], [X(0), sy, sz - chord * 0.55]], up, paint, part, shoulder, rough);
  // the hand: wrist → the tip
  const hc = wc * 0.9;
  b.sheet([[X(wr), sy + 0.01, sz + chord * 0.35], [X(span * 0.8), sy + 0.005, sz + chord * 0.1], [X(span * 0.8), sy + 0.005, sz + chord * 0.1 - hc * 0.8], [X(wr), sy + 0.01, sz - wc + chord * 0.35]], up, paint, part, shoulder, rough);
  // the primaries: slim feathers fanned from the hand's outer edge
  for (let f = 0; f < fingers; f++) {
    const u = fingers === 1 ? 0.5 : f / (fingers - 1);
    const rootZ = sz + chord * 0.1 - hc * 0.8 * u, ang = (0.35 - u * 0.7) * 0.6;
    const len = span * (0.24 - Math.abs(u - 0.35) * 0.08), wdt = chord * 0.09;
    const tx = X(span * 0.8) + side * Math.cos(ang) * len, tz = rootZ + Math.sin(ang) * len;
    b.sheet([[X(span * 0.8), sy + 0.005, rootZ + wdt], [tx, sy, tz + wdt * 0.3], [tx, sy, tz - wdt * 0.3], [X(span * 0.8), sy + 0.005, rootZ - wdt]], up, paint, part, shoulder, rough);
  }
}

function legs(b: Builder, hip: V3, len: number, paint: Paint): void {
  for (const s of [-1, 1]) {
    const top: V3 = [hip[0] + s * 0.025, hip[1], hip[2]], foot: V3 = [hip[0] + s * 0.03, hip[1] - len, hip[2] + 0.01];
    b.cone(top, foot, 0.009, paint, P.legs, hip, 0.6, 4);
    b.sheet([[foot[0] - 0.02, foot[1], foot[2] + 0.04], [foot[0] + 0.02, foot[1], foot[2] + 0.04], [foot[0], foot[1], foot[2] - 0.02]], [0, 1, 0], paint, P.legs, hip, 0.6);
  }
}

// ─────────────── the four models ───────────────
function raven(b: Builder): void {
  b.k = KIND.raven;
  const black = mottle('#1b1c22', 0.1, 70), gloss = 0.6, neck: V3 = [0, 0.05, 0.14];
  b.blob([0, 0, 0], [0.085, 0.085, 0.19], black, P.body, [0, 0, 0], { rough: gloss, taper: (u) => 0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - (u - 0.25) ** 2)) });
  b.blob([0, 0.055, 0.2], [0.055, 0.058, 0.072], black, P.head, neck, { rough: gloss });
  b.blob([0, 0.02, 0.15], [0.05, 0.06, 0.05], black, P.head, neck, { rough: 0.5 }); // the shaggy throat
  b.cone([0, 0.052, 0.255], [0, 0.03, 0.345], 0.021, flat('#101014'), P.head, neck, 0.35);
  // the wedge tail (the raven's tell against a crow's fan)
  b.sheet([[-0.035, 0.012, -0.16], [0.035, 0.012, -0.16], [0.085, 0.004, -0.39], [0, 0.0, -0.44], [-0.085, 0.004, -0.39]], [0, 1, 0], black, P.tail, [0, 0, -0.16], gloss);
  for (const s of [-1, 1]) wing(b, s, [s * 0.055, 0.04, 0.02], 0.56, 0.3, 5, black, 0.82);
  legs(b, [0, -0.06, 0.0], 0.12, flat('#15151a'));
}

function owl(b: Builder): void {
  b.k = KIND.owl;
  const grey = mottle('#6d665c', 0.18, 45, 0.6), neck: V3 = [0, 0.06, 0.2];
  const barred: Paint = (p, n) => { const c = grey(p, n); return c.multiplyScalar(0.82 + 0.18 * Math.sin(p[2] * 70 + p[0] * 20)); };
  b.blob([0, 0, 0], [0.14, 0.13, 0.25], barred, P.body, [0, 0, 0], { rough: 0.9, taper: (u) => 0.8 + 0.2 * Math.sqrt(Math.max(0, 1 - u * u)) });
  // the great round head, its pale facial disc ringed in dark concentric bars, set looking along +z
  const hc: V3 = [0, 0.07, 0.3];
  const disc: Paint = (p, n) => {
    if (n[2] < 0.35) return grey(p, n);
    const d = Math.hypot(p[0] - hc[0], p[1] - hc[1]);
    const ring = 0.75 + 0.25 * Math.cos(d * 95);
    return new THREE.Color('#a8a196').multiplyScalar(ring * (d > 0.1 ? 0.55 : 1));
  };
  b.blob(hc, [0.125, 0.12, 0.1], disc, P.head, neck, { rough: 0.95, w: 14, h: 10 });
  for (const s of [-1, 1]) b.blob([s * 0.036, 0.085, 0.395], [0.017, 0.017, 0.008], flat('#e2b41c'), P.head, neck, { rough: 0.2, emis: 1, w: 8, h: 5 });
  for (const s of [-1, 1]) b.blob([s * 0.036, 0.085, 0.399], [0.007, 0.007, 0.006], flat('#050505'), P.head, neck, { rough: 0.1, w: 6, h: 4 });
  b.cone([0, 0.06, 0.39], [0, 0.035, 0.415], 0.011, flat('#d9c23a'), P.head, neck, 0.4, 5);
  b.sheet([[-0.06, 0.02, -0.2], [0.06, 0.02, -0.2], [0.08, 0.015, -0.4], [0, 0.015, -0.42], [-0.08, 0.015, -0.4]], [0, 1, 0], barred, P.tail, [0, 0, -0.2], 0.9);
  for (const s of [-1, 1]) wing(b, s, [s * 0.1, 0.05, 0.04], 0.64, 0.36, 5, barred, 0.9);
  legs(b, [0, -0.08, 0.02], 0.09, mottle('#8b8478', 0.1));
}

function woodpecker(b: Builder): void {
  b.k = KIND.woodpecker;
  const black = mottle('#16161a', 0.08, 70), neck: V3 = [0, 0.04, 0.11];
  b.blob([0, 0, 0], [0.058, 0.06, 0.15], black, P.body, [0, 0, 0], { rough: 0.55 });
  // the head: black, a white stripe from the bill down the neck, the red crest swept back
  const face: Paint = (p, n) => (Math.abs(n[0]) > 0.55 && p[1] < 0.075 && p[1] > 0.035 ? new THREE.Color('#e8e4da') : p[1] > 0.078 ? new THREE.Color('#b8231b') : black(p, n));
  b.blob([0, 0.05, 0.16], [0.042, 0.045, 0.055], face, P.head, neck, { rough: 0.5 });
  b.cone([0, 0.085, 0.16], [0, 0.1, 0.1], 0.032, flat('#c0261d'), P.head, neck, 0.5);
  b.cone([0, 0.05, 0.205], [0, 0.045, 0.28], 0.012, flat('#4a4a4e'), P.head, neck, 0.35);
  b.blob([0, 0.005, 0.1], [0.04, 0.035, 0.05], (p, n) => (Math.abs(n[0]) > 0.6 ? new THREE.Color('#e8e4da') : black(p, n)), P.head, neck, { rough: 0.6 });
  // the stiff pointed tail it props itself on the trunk with
  b.sheet([[-0.03, 0.01, -0.12], [0.03, 0.01, -0.12], [0.02, 0, -0.29], [0, 0, -0.31], [-0.02, 0, -0.29]], [0, 1, 0], black, P.tail, [0, 0, -0.12], 0.55);
  for (const s of [-1, 1]) wing(b, s, [s * 0.04, 0.03, 0.02], 0.34, 0.2, 4, black, 0.85);
  legs(b, [0, -0.045, 0.02], 0.07, flat('#3c3c40'));
}

function hare(b: Builder): void {
  b.k = KIND.hare;
  // a snowshoe hare in its summer coat: agouti brown-grey, a darker back, a buff belly, pale feet, dark-tipped ears
  const fur = mottle('#6f5a47', 0.22, 110, 1.2), belly = mottle('#a89c88', 0.12, 90), pale = mottle('#85776a', 0.12, 90);
  const coat: Paint = (p, n) => (n[1] < -0.6 ? belly(p, n) : fur(p, n));
  const face: Paint = (p, n) => (n[2] > 0.55 && p[1] < 0.27 ? mottle('#8c7661', 0.12, 110)(p, n) : coat(p, n));
  const head: V3 = HARE_NECK;
  b.blob([0, 0.165, -0.03], [0.092, 0.1, 0.2], coat, P.hBody, [0, 0, 0], { rough: 0.95, taper: (u) => 0.8 + 0.2 * Math.sqrt(Math.max(0, 1 - (u + 0.3) ** 2)) });
  b.blob([0, 0.16, 0.11], [0.068, 0.08, 0.075], coat, P.hBody, [0, 0, 0], { rough: 0.95 });
  b.blob([0, 0.262, 0.195], [0.047, 0.052, 0.072], face, P.hHead, head, { rough: 0.95, rot: [0.3, 0, 0] });
  for (const s of [-1, 1]) b.blob([s * 0.039, 0.278, 0.218], [0.008, 0.01, 0.009], flat('#2a1a0c'), P.hHead, head, { rough: 0.1, w: 8, h: 5 });
  b.blob([0, 0.24, 0.262], [0.011, 0.009, 0.007], flat('#5e4640'), P.hHead, head, { rough: 0.5, w: 6, h: 4 });
  // the ears: long, dark-tipped, up and a little back; they lie flat on a run
  const ear: Paint = (p, n) => (p[1] > 0.41 ? new THREE.Color('#1e1813') : n[2] > 0.35 ? new THREE.Color('#9a8270') : fur(p, n));
  for (const s of [-1, 1]) b.blob([s * 0.03, 0.36, 0.165], [0.017, 0.078, 0.028], ear, P.hEars, [s * 0.025, 0.295, 0.185], { rough: 0.95, rot: [-0.35, 0, s * -0.12], w: 8, h: 6 });
  b.blob([0, 0.19, -0.215], [0.024, 0.024, 0.02], flat('#cfc6b6'), P.hBody, [0, 0, 0], { rough: 1, w: 8, h: 5 });
  for (const s of [-1, 1]) {
    const hip: V3 = [s * 0.062, 0.16, -0.085];
    b.blob([s * 0.062, 0.12, -0.085], [0.04, 0.068, 0.095], coat, P.hHind, hip, { rough: 0.95 });
    b.blob([s * 0.06, 0.018, -0.035], [0.022, 0.016, 0.085], pale, P.hHind, hip, { rough: 1, w: 8, h: 5 });
    const sh: V3 = [s * 0.042, 0.15, 0.13];
    b.blob([s * 0.042, 0.085, 0.14], [0.021, 0.065, 0.024], coat, P.hFore, sh, { rough: 0.95, w: 8, h: 5 });
    b.blob([s * 0.042, 0.01, 0.158], [0.016, 0.01, 0.026], pale, P.hFore, sh, { rough: 1, w: 6, h: 4 });
  }
}

// ─────────────── a modelled bird (birdModels.ts) ───────────────
/**
 * One of the six generated bird meshes into the shared geometry: textured (its atlas tile), its vertices in the parts the
 * vertex shader turns (birdModels.ts tells them: flying, the wings flap about their shoulders; the head turns about the
 * neck; the rest is body).
 * The mesh arrives already in the pose frame the life code drives (birdModels.ts: the perched ones pre-tilted against
 * the pitch their perch gives them, the feet at the stand height).
 */
function modelled(b: Builder, m: BirdMesh): void {
  b.k = m.kind;
  const pos = m.geo.getAttribute('position'), nor = m.geo.getAttribute('normal'), uv = m.geo.getAttribute('uv');
  const white = new THREE.Color(1, 1, 1);
  const base = b.pos.length / 3;
  const PART = [P.body, P.wingL, P.wingR, P.head] as const, PIVOT: readonly V3[] = [[0, 0, 0], m.shoulderL, m.shoulderR, m.neck];
  for (let i = 0; i < pos.count; i++) {
    const p: V3 = [pos.getX(i), pos.getY(i), pos.getZ(i)], n: V3 = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    const k = m.parts[i] ?? 0, part = PART[k] ?? P.body, pivot = PIVOT[k] ?? [0, 0, 0];
    b.vert(p, n, white, part, pivot, m.rough, m.eyes && part === P.head ? 1 : 0, [uv.getX(i), uv.getY(i)], 1, m.fly ? 1 : 0);
  }
  const idx = m.geo.getIndex();
  if (idx) for (let i = 0; i < idx.count; i++) b.idx.push(base + idx.getX(i));
  else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
}

// ─────────────── the mesh ───────────────
const VERT_HEAD = /* glsl */`#include <common>
attribute vec3 aPivot; attribute vec4 aInfo; attribute vec4 aTexV;   // (part, kind, roughness, emissive), (uv, textured, pose)
attribute vec4 aAnim; attribute vec4 aAnim2;
varying float vWlRough; varying float vWlEmis; varying vec2 vWlUv; varying float vWlTex;
vec3 wlPos;
vec3 wlRx(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
vec3 wlRy(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
vec3 wlRz(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
vec3 wlRot(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }`;

const VERT_ANIM = /* glsl */`
vec3 objectNormal = vec3( normal );
{
  vec3 p = position, n = objectNormal, pv = aPivot;
  float part = aInfo.x, aKind = aInfo.y, aVar = aTexV.w;
  vWlRough = aInfo.z; vWlEmis = aInfo.w; vWlUv = aTexV.xy; vWlTex = aTexV.z;
  if (part == 1.0 || part == 2.0) {
    // a wing: shortened as it folds, flapped about the body axis at the shoulder; folding also stands its chord on edge
    // (leading edge up) and sweeps it back, so a folded wing lies flat along the flank over the tail, not out like a plate
    float side = part == 1.0 ? -1.0 : 1.0, fold = aAnim.y, shut = smoothstep(0.4, 1.0, fold);
    vec3 q = p - pv;
    q.x *= 1.0 - 0.42 * fold; q.z *= 1.0 - 0.5 * shut;
    q = wlRz(q, aAnim.x * side); n = wlRz(n, aAnim.x * side);
    q = wlRx(q, -1.35 * shut); n = wlRx(n, -1.35 * shut);
    float sw = fold * 1.5 * side;
    q = wlRy(q, sw); n = wlRy(n, sw);
    q.x += side * 0.45 * abs(pv.x) * shut;
    p = q + pv;
  } else if (part == 3.0) {
    // the head: pitched (+ = down) about the neck, then turned about the world's vertical (the body may be upright)
    vec3 q = wlRx(p - pv, aAnim.w); n = wlRx(n, aAnim.w);
    vec3 up = vec3(0.0, cos(aAnim2.z), sin(aAnim2.z));
    q = wlRot(q, up, aAnim.z); n = wlRot(n, up, aAnim.z);
    p = q + pv;
  } else if (part == 4.0) {
    float a = aAnim2.y * 1.4;
    p = wlRx(p - pv, a) + pv; n = wlRx(n, a);
  } else if (part == 13.0 || part == 14.0) {
    float a = part == 13.0 ? aAnim.x : aAnim.y;
    p = wlRx(p - pv, a) + pv; n = wlRx(n, a);
  } else if (part == 11.0 || part == 12.0) {
    if (part == 12.0) { p = wlRx(p - pv, -aAnim.w) + pv; n = wlRx(n, -aAnim.w); }
    vec3 hn = vec3(${HARE_NECK.map((v) => v.toFixed(3)).join(', ')});
    vec3 q = wlRy(p - hn, aAnim2.y); n = wlRy(n, aAnim2.y);
    q = wlRx(q, aAnim.z); n = wlRx(n, aAnim.z);
    p = q + hn;
  }
  // another kind's vertex collapses to a point: this instance draws only its own model (and, for a modelled bird, only
  // its pose: perched or flying, aAnim2.w)
  if (abs(aKind - aAnim2.x) > 0.5 || (aVar > -0.5 && abs(aVar - aAnim2.w) > 0.5)) p = vec3(0.0);
  wlPos = p; objectNormal = n;
}`;

export class WildlifeMesh {
  readonly mesh: THREE.InstancedMesh;
  /** the owl's eye-shine (0 by day → 1 at night) */
  readonly glow = { value: 0 };
  private readonly anim: THREE.InstancedBufferAttribute;
  private readonly anim2: THREE.InstancedBufferAttribute;
  private readonly m = new THREE.Matrix4(); private readonly q = new THREE.Quaternion(); private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3(); private readonly s = new THREE.Vector3();
  private n = 0;
  private static readonly ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  /** the modelled birds' atlas (a white texel until `useBirds`) */
  private readonly atlas: { value: THREE.Texture };

  constructor(sky: Sky, readonly capacity: number) {
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim.setUsage(THREE.DynamicDrawUsage);
    this.anim2 = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim2.setUsage(THREE.DynamicDrawUsage);
    const geo = this.build(null);
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.colorSpace = THREE.SRGBColorSpace; white.needsUpdate = true;
    this.atlas = { value: white };

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    const glow = this.glow, atlas = this.atlas;
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      shader.uniforms['uWlGlow'] = glow;
      shader.uniforms['uWlTex'] = atlas;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', VERT_HEAD)
        .replace('#include <beginnormal_vertex>', VERT_ANIM)
        .replace('#include <begin_vertex>', 'vec3 transformed = wlPos;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying float vWlRough; varying float vWlEmis; uniform float uWlGlow; varying vec2 vWlUv; varying float vWlTex; uniform sampler2D uWlTex;
// the owl's eyes in the atlas: its yellow irises (linear), where the eye-shine glows at night
float wlEye(vec3 t) { return smoothstep(0.3, 0.5, t.r) * smoothstep(0.18, 0.3, t.g) * (1.0 - smoothstep(0.2, 0.45, t.b / max(t.r, 1e-3))); }`)
        .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 wlTexel = vec3(1.0);\nif (vWlTex > 0.5) { wlTexel = texture2D(uWlTex, vWlUv).rgb; diffuseColor.rgb *= wlTexel; }')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vWlRough;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.22) * vWlEmis * uWlGlow * 1.4 * (vWlTex > 0.5 ? wlEye(wlTexel) : 1.0);');
    };
    mat.customProgramCacheKey = () => 'pine-wildlife';
    sky.setupMaterial(mat);
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.name = 'pine-wildlife';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    // parked at zero scale until the first frame packs the live ones (the boot's precompile sees a drawn instance)
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, WildlifeMesh.ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** the shared geometry: the hare (and, without `birds`, the procedural birds) + the modelled birds' two poses each */
  private build(birds: BirdSet | null): THREE.InstancedBufferGeometry {
    const b = new Builder();
    if (birds) { for (const m of birds.meshes) modelled(b, m); } else { raven(b); owl(b); woodpecker(b); }
    hare(b);
    const src = b.geometry();
    const geo = new THREE.InstancedBufferGeometry();
    for (const [k, v] of Object.entries(src.attributes)) geo.setAttribute(k, v);
    geo.setIndex(src.getIndex());
    geo.setAttribute('aAnim', this.anim); geo.setAttribute('aAnim2', this.anim2);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return geo;
  }

  /** the modelled birds (birdModels.ts) in place of the procedural ones: same draw, same program — a new geometry and the
   *  atlas bound to the sampler that was there from the start (uploaded now, not on the first frame that draws one) */
  useBirds(birds: BirdSet, renderer: THREE.WebGLRenderer): void {
    const old = this.mesh.geometry;
    this.mesh.geometry = this.build(birds);
    this.atlas.value = birds.atlas;
    renderer.initTexture(birds.atlas);
    old.dispose();
  }

  /** vertices in the shared geometry (all four models) */
  get vertexCount(): number { return this.mesh.geometry.getAttribute('position').count; }

  /** start a frame: no instance drawn until `add`ed */
  begin(): void { this.n = 0; }
  /** draw `w` this frame (the live instances are packed at the front: nothing parked costs a vertex) */
  add(w: WildPose): void {
    if (this.n >= this.capacity) return;
    const i = this.n++;
    this.e.set(-w.pitch, w.yaw, w.roll, 'YXZ');
    this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(w.x, w.y, w.z), this.q, this.s.setScalar(w.scale));
    this.mesh.setMatrixAt(i, this.m);
    const a = this.anim.array, b = this.anim2.array, k = i * 4;
    a[k] = w.a0; a[k + 1] = w.a1; a[k + 2] = w.a2; a[k + 3] = w.a3;
    // a modelled bird's pose: flying (legs tucked, or wings open on a hop) → the spread model, else the perched one
    b[k] = w.kind; b[k + 1] = w.b1; b[k + 2] = w.b2; b[k + 3] = w.b1 > 0.5 || w.a1 < 0.5 ? 1 : 0;
  }
  commit(): void { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.anim.needsUpdate = true; this.anim2.needsUpdate = true; }
}
