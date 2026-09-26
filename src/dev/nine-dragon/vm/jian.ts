// Copied from the viewmodel lab (src/dev/nd-lab/viewmodel/jian.ts, round-9-lab-viewmodel) into the clean room.
// The Neon Jian as geometry (lab P8 "viewmodel", E169): the blade, its neon edges, the heat-shimmer halo, the grip with
// a real cord wrap, the collar, the brass ring and the pommel. The dragon-head guard is a GLB (blender/guard.py).
//
// JIAN-local frame (SPEC.md, the same as lab P4 and the clean room's weapon.ts): the grip axis is +y; the blade runs up
// +y from the guard (y ≈ 0) to the tip (TIP_Y); its edges are ±x, its flats face ±z (+z toward the eye).
import {
  AddEquation, BufferGeometry, Color, CustomBlending, DoubleSide, Float32BufferAttribute, OneFactor, ShaderMaterial, Uint32BufferAttribute, Vector2, Vector3, ZeroFactor,
} from 'three';
import { CLS, E, type Geo, type Look, curve, v3 } from './geo';

/** the blade's measures (m) */
export const JIAN = {
  /** blade root (just above the dragon's crown) */
  root: 0.05,
  len: 0.76,
  /** half width at the root and where the tip's ogive starts */
  hw0: 0.022,
  hw1: 0.0165,
  /** the ogive tip length */
  tip: 0.085,
  thick: 0.0058,
  /** the neon edge band as a share of the half width */
  glow: 0.15,
  /** the neon's emission (HDR; the bloom threshold is 1) */
  emit: 1.5,
} as const;
export const TIP_Y = JIAN.root + JIAN.len;

const L = {
  glow: { cls: CLS.glow, emit: JIAN.emit } as Look,
  bevel: { cls: CLS.bevel, line: 0 } as Look,
  steel: { cls: CLS.steel, line: 1, edges: E.none } as Look,
  etched: { cls: CLS.steel, line: -1 } as Look,
  brass: { cls: CLS.brass, line: 1, edges: E.v0 | E.v1 } as Look,
  brassDark: { cls: CLS.brassDark, line: 1, edges: E.v0 | E.v1 } as Look,
  lacquer: { cls: CLS.lacquer } as Look,
  cord: { cls: CLS.leather } as Look,
  silk: { cls: CLS.silk } as Look,
};

/** half width along the blade: linear taper, then an ogive into the point */
function halfWidth(y: number): number {
  const { root, len, hw0, hw1, tip } = JIAN;
  const yT = root + len - tip;
  if (y <= yT) return hw0 + (hw1 - hw0) * ((y - root) / (yT - root));
  const u = Math.min(1, (y - yT) / tip);
  // a pointed tip with a slight belly (a jian's 劍尖), not a round spatula
  return hw1 * Math.max(0, 1 - u) ** 0.72;
}

/**
 * The blade: per side a section edge → neon band → bevel → flat → shallow fuller → ridge, flat-shaded facets (built
 * steel), ruled creases between the facets; the flats and the fuller carry the etch (uv.x across the blade, uv.y root →
 * tip). Rows are denser near the tip so the ogive is smooth.
 */
export function buildBlade(g: Geo): void {
  const { root, len, thick, glow } = JIAN;
  const rows: number[] = [];
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    rows.push(root + len * (1 - (1 - t) ** 1.6));
  }
  // section (x as a share of the half width, z as a share of the thickness), from the edge to the ridge
  const sec: readonly (readonly [number, number])[] = [
    [1, 0], [1 - glow, 0.16], [0.8, 0.42], [0.44, 0.7], [0.3, 0.6], [0.16, 0.72], [0, 1],
  ];
  const looks: Look[] = [L.glow, L.bevel, L.etched, L.etched, L.etched, L.etched];
  for (let i = 0; i < rows.length - 1; i++) {
    const ya = rows[i] ?? root, yb = rows[i + 1] ?? root;
    const ha = halfWidth(ya), hb = halfWidth(yb);
    // the thickness thins toward the tip too
    const ta = thick * (0.55 + 0.45 * Math.min(1, halfWidth(ya) / JIAN.hw1)), tb = thick * (0.55 + 0.45 * Math.min(1, halfWidth(yb) / JIAN.hw1));
    for (const sz of [1, -1]) {
      for (const sx of [1, -1]) {
        for (let k = 0; k < sec.length - 1; k++) {
          const s0 = sec[k] ?? [0, 0], s1 = sec[k + 1] ?? [0, 0];
          const a0 = v3(sx * s0[0] * ha, ya, sz * s0[1] * ta), a1 = v3(sx * s1[0] * ha, ya, sz * s1[1] * ta);
          const b0 = v3(sx * s0[0] * hb, yb, sz * s0[1] * tb), b1 = v3(sx * s1[0] * hb, yb, sz * s1[1] * tb);
          const look = looks[k] ?? L.steel;
          const nrm = new Vector3().subVectors(b0, a0).cross(new Vector3().subVectors(a1, a0)).normalize();
          if (nrm.z * sz < 0 || (Math.abs(nrm.z) < 1e-4 && nrm.x * sx < 0)) nrm.negate();
          // uv: x across the whole blade (0 at −x edge, 1 at +x), y root → tip; aFace for ruled facet borders
          const ux = (x: number): number => 0.5 + (0.5 * x) / Math.max(JIAN.hw0, 1e-5);
          const al = (y: number): number => (y - root) / len;
          const w = Math.abs(s1[0] - s0[0]) * ha;
          const face = (y: number, u: number): readonly [number, number, number, number] => [u * w, y - root, w, len];
          const va = g.vert(a0, nrm, ux(a0.x), al(ya), look, face(ya, 0));
          const vb = g.vert(a1, nrm, ux(a1.x), al(ya), look, face(ya, 1));
          const vc = g.vert(b1, nrm, ux(b1.x), al(yb), look, face(yb, 1));
          const vd = g.vert(b0, nrm, ux(b0.x), al(yb), look, face(yb, 0));
          const flip = nrm.dot(new Vector3().subVectors(a1, a0).cross(new Vector3().subVectors(b0, a0))) < 0;
          if (flip) { g.tri(va, vb, vc); g.tri(va, vc, vd); } else { g.tri(va, vc, vb); g.tri(va, vd, vc); }
        }
      }
    }
  }
  // the ridge line: a hair of bright steel down each flat's crown (the mockups' centre highlight)
  for (const sz of [1, -1]) {
    const path: Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const y = root + 0.012 + (len - 0.03) * (i / 20);
      path.push(v3(0, y, sz * thick * (0.55 + 0.45 * Math.min(1, halfWidth(y) / JIAN.hw1))));
    }
    g.sweep(path, (t) => 0.0007 * (1 - t * 0.6), 4, { cls: CLS.bevel }, { flat: 0.5, up: v3(0, 0, 1) });
  }
}

/** the blade's two edge lines (JIAN-local), for the halo, the spill and the trail */
export function edgeLine(sx: number, n: number): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const y = JIAN.root + JIAN.len * (1 - (1 - i / n) ** 1.3);
    out.push(v3(sx * halfWidth(y), y, 0));
  }
  return out;
}

/** where the grip's lacquer ends and the pommel starts (18 cm of grip: the hand closes on −0.12 … −0.21) */
export const GRIP_END = -0.238;

/** the grip: lacquer core, a crossed cord wrap (two helix families over the core), collar, silk band, ring, pommel */
export function buildGrip(g: Geo): void {
  const y0 = -0.064, y1 = GRIP_END;
  const core = (t: number): number => 0.0156 + 0.0016 * Math.sin(t * Math.PI);
  g.sweep(curve([v3(0, y0, 0), v3(0, (y0 + y1) / 2, 0), v3(0, y1, 0)], 12), (t) => core(t), 20, L.lacquer);
  // the cord wrap: 2 × 3 flat cords, 7 turns, crossing into small diamonds of lacquer
  const turns = 7;
  for (const dir of [1, -1]) {
    for (const ph of [0, 1 / 3, 2 / 3]) {
      const path: Vector3[] = [];
      const radial: Vector3[] = [];
      for (let i = 0; i <= 160; i++) {
        const t = i / 160;
        const y = y0 - 0.006 - (y0 - y1 - 0.012) * t;
        const a = (ph + dir * turns * t) * Math.PI * 2;
        const r = core(t) + 0.0009;
        path.push(v3(Math.cos(a) * r, y, Math.sin(a) * r));
        radial.push(v3(Math.cos(a), 0, Math.sin(a)));
      }
      g.sweep(path, () => 0.0026, 6, L.cord, { flat: 0.38, upAt: (i) => radial[i] ?? v3(1, 0, 0) });
    }
  }
  // collar under the guard: brass, a red silk band, brass
  g.lathe(0, -0.034, 0, [[0.012, 0], [0.0195, 0.002], [0.0205, 0.006], [0.0195, 0.01], [0.018, 0.012]], 24, L.brass);
  g.sweep([v3(0, -0.036, 0), v3(0, -0.05, 0)], () => 0.0186, 24, L.silk);
  g.lathe(0, -0.066, 0, [[0.0172, 0], [0.0192, 0.002], [0.0198, 0.008], [0.0192, 0.014], [0.0172, 0.016]], 24, L.brass);
  // the brass ring a third of the way down, with a medallion on the eye's side
  g.lathe(0, -0.108, 0, [[0.0178, 0], [0.0196, 0.0015], [0.02, 0.005], [0.0196, 0.0085], [0.0178, 0.01]], 24, L.brass);
  g.ellipsoid(v3(0, -0.103, 0.0198), v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1), 0.0068, 0.0068, 0.0026, { cls: CLS.brass }, undefined, 14);
  // the pommel: a ferrule, a bulb, a cap, and the ring the tassel cord would take
  const pb = GRIP_END - 0.04;
  g.lathe(0, pb, 0, [[0.004, 0], [0.01, 0.003], [0.0145, 0.01], [0.016, 0.018], [0.0148, 0.027], [0.0138, 0.032], [0.0142, 0.037], [0.0136, 0.04]], 24, L.brass);
  g.sweep(curve([v3(0, pb - 0.002, 0.0), v3(0, pb - 0.009, 0.007), v3(0, pb - 0.014, 0), v3(0, pb - 0.009, -0.007), v3(0, pb - 0.002, 0)], 6), () => 0.0019, 8, { cls: CLS.brassDark });
}

/** the blade clip: a brass sleeve over the blade's root with a point running up the blade (the ricasso cap) */
export function buildBladeClip(g: Geo): void {
  g.sweep(curve([v3(0, 0.07, 0), v3(0, 0.1, 0), v3(0, 0.135, 0)], 6), (t) => 0.024 * (1 - t) ** 1.25 + 0.003, 14, { cls: CLS.brass, line: 1, edges: E.none }, { flat: 0.4, up: v3(0, 0, 1), capStart: true });
}

// ── the heat-shimmer halo: a screen-space ribbon either side of each neon edge ──

const VS_HALO = /* glsl */ `
attribute vec3 aTan;
attribute vec2 aSide;
attribute float aOut;
uniform vec2 uRes;
uniform float uPx;
varying vec2 vS;
void main() {
  vec4 c0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(position + aTan * 0.01, 1.0);
  vec4 c2 = projectionMatrix * modelViewMatrix * vec4(position + vec3(aOut * 0.01, 0.0, 0.0), 1.0);
  vec2 s0 = c0.xy / c0.w, s1 = c1.xy / c1.w, s2 = c2.xy / c2.w;
  vec2 d = normalize((s1 - s0) * uRes + 1e-6);
  vec2 perp = vec2(-d.y, d.x);
  // the glow lives outside the blade: the side over the black body is a third as wide
  float outer = dot(perp * aSide.x, (s2 - s0) * uRes) > 0.0 ? 1.0 : 0.3;
  c0.xy += perp * aSide.x * uPx * outer * 2.0 / uRes * c0.w;
  vS = vec2(aSide.x, aSide.y);
  gl_Position = c0;
}
`;
const FS_HALO = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uGain;
varying vec2 vS;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // across: |vS.x| 0 at the edge → 1 at the ribbon's rim; along: vS.y in metres from the root
  float along = vS.y;
  // heat shimmer: the falloff's width and brightness waver along the edge, drifting toward the tip
  float n1 = vn(vec2(along * 90.0 - uTime * 3.1, vS.x * 1.5 + uTime * 0.7));
  float n2 = vn(vec2(along * 230.0 - uTime * 7.0, 3.0));
  float w = 0.55 + 0.45 * n1;
  float a = exp(-pow(abs(vS.x) / (0.35 * w + 0.12), 2.0) * 2.2);
  a *= 0.7 + 0.5 * n2;
  // fade in from the root, out at the very tip
  a *= smoothstep(0.0, 0.05, along) * (1.0 - smoothstep(0.7, 0.76, along));
  gl_FragColor = vec4(uColor * a * uGain, 1.0);
}
`;

/** the halo ribbons (JIAN-local): 2 edges × (n) segments × 2 sides; additive, no depth write */
export function buildHalo(n = 48): { geo: BufferGeometry; mat: ShaderMaterial } {
  const pos: number[] = [], tan: number[] = [], side: number[] = [], out: number[] = [], idx: number[] = [];
  let vi = 0;
  for (const sx of [1, -1]) {
    const pts = edgeLine(sx, n);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i] ?? v3(0, 0, 0);
      const q = pts[Math.min(pts.length - 1, i + 1)] ?? p, o = pts[Math.max(0, i - 1)] ?? p;
      const t = new Vector3().subVectors(q, o).normalize();
      for (const s of [-1, 1]) {
        pos.push(p.x, p.y, p.z);
        tan.push(t.x, t.y, t.z);
        side.push(s, p.y - JIAN.root);
        out.push(sx);
      }
      if (i < pts.length - 1) {
        const a = vi + i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    vi += pts.length * 2;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aTan', new Float32BufferAttribute(tan, 3));
  geo.setAttribute('aSide', new Float32BufferAttribute(side, 2));
  geo.setAttribute('aOut', new Float32BufferAttribute(out, 1));
  geo.setIndex(new Uint32BufferAttribute(idx, 1));
  const mat = new ShaderMaterial({
    uniforms: { uRes: { value: new Vector2(1, 1) }, uPx: { value: 14 }, uTime: { value: 0 }, uColor: { value: new Color(0x9fe9ff) }, uGain: { value: 1.0 } },
    vertexShader: VS_HALO,
    fragmentShader: FS_HALO,
    transparent: true,
    depthWrite: false,
    // additive colour; the target's alpha (the clean room's inverse depth, the lab's vm mask) is left alone
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    side: DoubleSide,
  });
  return { geo, mat };
}
