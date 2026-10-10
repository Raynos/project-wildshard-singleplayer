/**
 * Pine Hollow's procedural wildlife shapes (G285: an offline bake). Build-time only: `src/shards/pine-hollow/generators/bake-pine-wildlife.mjs` runs
 * `bakePineWildlife` and writes the raven's, the great grey owl's, the pileated woodpecker's and the snowshoe hare's
 * geometry (ellipsoids, cones and feather sheets at their real size, forward = +z, up = +y, smooth-shaded, per-vertex
 * roughness and feather / fur mottling) to `public/assets/pine-hollow/baked/wildlife.bin` (its 4-byte words in four lanes,
 * zlib) and its rows to `../data/wildlife.json`; the page reads them behind the loading screen (../models/wildlife.ts
 * `preloadPineWildlife`) and never runs this. test/shards/pine-hollow/wildlife-bake.test.ts is the stale gate.
 */
import * as THREE from 'three';
import { HARE_NECK, KIND, P, WILD_BAKE_KINDS, type V3, type WildKind, type WildRows } from '../models/wildlife';

type Paint = (p: V3, n: V3) => THREE.Color;

const _c = new THREE.Color();
/** a hash in 0..1 of a point (the mottling) */
const hash3 = (x: number, y: number, z: number): number => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

class Builder {
  readonly pos: number[] = []; readonly nor: number[] = []; readonly col: number[] = []; readonly idx: number[] = [];
  readonly part: number[] = []; readonly kind: number[] = []; readonly pivot: number[] = []; readonly rough: number[] = []; readonly emis: number[] = [];
  k = 0;
  vert(p: V3, n: V3, c: THREE.Color, part: number, pivot: V3, rough: number, emis: number): number {
    this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(c.r, c.g, c.b);
    this.part.push(part); this.kind.push(this.k); this.pivot.push(pivot[0], pivot[1], pivot[2]); this.rough.push(rough); this.emis.push(emis);
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

  /** this kind's blocks as the page reads them (../models/wildlife.ts `WILD_LAYOUT`): position, normal, colour, pivot (3 a
   *  vertex), the info and atlas vec4s (4 a vertex), as f32 words, then the triangles (local indices) as u32 words */
  words(): { vertices: number; indices: number; bin: Uint8Array } {
    const n = this.part.length, info: number[] = [], tex: number[] = [];
    for (let i = 0; i < n; i++) {
      info.push(this.part[i] ?? 0, this.kind[i] ?? 0, this.rough[i] ?? 0.8, this.emis[i] ?? 0);
      tex.push(0, 0, 0, -1); // no atlas (a modelled bird's alone), every pose
    }
    const floats = Float32Array.from([...this.pos, ...this.nor, ...this.col, ...this.pivot, ...info, ...tex]);
    const bin = new Uint8Array(floats.byteLength + this.idx.length * 4);
    bin.set(new Uint8Array(floats.buffer));
    bin.set(new Uint8Array(Uint32Array.from(this.idx).buffer), floats.byteLength);
    return { vertices: n, indices: this.idx.length, bin };
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

const MODELS: Readonly<Record<WildKind, (b: Builder) => void>> = { [KIND.raven]: raven, [KIND.owl]: owl, [KIND.woodpecker]: woodpecker, [KIND.hare]: hare };

/** The bake: each kind built on its own (local indices), its blocks one after another in `WILD_BAKE_KINDS` order. */
export function bakePineWildlife(): { rows: Omit<WildRows, 'bin' | 'bytes'>; bin: Uint8Array } {
  const parts: { kind: WildKind; vertices: number; indices: number; bin: Uint8Array }[] = [];
  for (const kind of WILD_BAKE_KINDS) { const b = new Builder(); MODELS[kind](b); const { vertices, indices, bin } = b.words(); parts.push({ kind, vertices, indices, bin }); }
  const bin = new Uint8Array(parts.reduce((n, p) => n + p.bin.length, 0));
  let at = 0;
  for (const p of parts) { bin.set(p.bin, at); at += p.bin.length; }
  return { rows: { kinds: parts.map(({ kind, vertices, indices }) => ({ kind, vertices, indices })) }, bin };
}
