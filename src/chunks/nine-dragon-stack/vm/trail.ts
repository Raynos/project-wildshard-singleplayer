// The slash trail, 飞白 "flying white" (lab P8 "viewmodel", E169). Driftwood's sword ribbon (src/player/Sword.ts
// buildTrail / trailSample / trailRebuild) is the base: a ring of blade samples (an inner point on the blade and the tip),
// each gap subdivided on a Catmull-Rom curve so a fast slash reads as an arc, alpha by age. What is new is the brush:
//   - the ribbon is a dry-brush stroke: parallel hair streaks along the motion (fine noise across the ribbon), gaps that
//     open as the brush runs dry toward the tail (the threshold rises with age), a ragged inner edge, a loaded tip edge;
//   - two looks on one program: `ink` (ink-indigo pigment with the paper showing through the streaks, and a thin neon
//     thread on the leading tip edge) and `light` (pale silk-white streaks, additive, cyan core) — uMode;
//   - the blending never touches the target's alpha (the clean room keeps inverse depth there): CustomBlending with the
//     alpha factors Zero / One.
import {
  AddEquation, BufferAttribute, BufferGeometry, Color, CustomBlending, DoubleSide, DynamicDrawUsage, Mesh, OneFactor, OneMinusSrcAlphaFactor,
  ShaderMaterial, Sphere, SrcAlphaFactor, Vector3, ZeroFactor,
} from 'three';

const SAMPLES = 28;
const SUB = 4;

const VS = /* glsl */ `
attribute vec2 aUv;
attribute float aAge;
varying vec2 vUv;
varying float vAge;
void main() { vUv = aUv; vAge = aAge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FS = /* glsl */ `
uniform float uMode;
uniform vec3 uInk;
uniform vec3 uLight;
uniform vec3 uNeon;
uniform float uAlpha;
uniform float uSeed;
varying vec2 vUv;
varying float vAge;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // vUv.x across the ribbon: 0 inner edge → 1 tip edge; vUv.y along the stroke in metres from its start; vAge 0 new → 1 gone
  float x = vUv.x, s = vUv.y;
  float age = clamp(vAge, 0.0, 1.0);
  // hair streaks: fine noise across, stretched along the stroke (the bristles), two octaves
  float hair = vn(vec2(x * 46.0 + uSeed, s * 3.0)) * 0.65 + vn(vec2(x * 130.0 + uSeed * 1.7, s * 7.0)) * 0.35;
  // the brush runs dry toward the tail and toward the inner edge
  float dry = mix(0.18, 0.78, age) + (1.0 - x) * 0.28;
  float body = smoothstep(dry - 0.08, dry + 0.08, hair);
  // a ragged inner edge that eats in with age, a loaded tip edge
  float inner = smoothstep(age * 0.55, age * 0.55 + 0.25 + 0.2 * vn(vec2(s * 9.0, uSeed)), x);
  float tipEdge = smoothstep(0.86, 0.97, x) * (1.0 - smoothstep(0.985, 1.0, x));
  float fade = (1.0 - age) * (1.0 - age);
  float a = body * inner * fade * uAlpha;
  if (uMode < 0.5) {
    // ink: pigment where the hair holds ink, the neon thread on the tip edge
    vec3 c = mix(uInk, uInk * 1.8, hair * 0.5);
    float neon = tipEdge * (1.0 - age) * 1.2;
    gl_FragColor = vec4(mix(c, uNeon * 3.0, clamp(neon, 0.0, 1.0)), clamp(max(min(a * 1.6, 0.92), neon), 0.0, 1.0));
  } else {
    // light: pale streaks, additive, a cyan core on the tip edge
    vec3 c = uLight * a * 0.9 + uNeon * tipEdge * fade * 2.2;
    gl_FragColor = vec4(c, 1.0);
  }
}
`;

export type TrailLook = 'ink' | 'light';

export class Trail {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly A = new Float32Array(SAMPLES * 3);
  private readonly B = new Float32Array(SAMPLES * 3);
  private readonly T = new Float32Array(SAMPLES).fill(-1);
  private head = 0;
  private n = 0;
  private time = 0;
  private life = 0.32;
  private readonly pos: BufferAttribute;
  private readonly uv: BufferAttribute;
  private readonly age: BufferAttribute;

  constructor() {
    const quads = (SAMPLES - 1) * SUB;
    const g = new BufferGeometry();
    this.pos = new BufferAttribute(new Float32Array(quads * 6 * 3), 3);
    this.uv = new BufferAttribute(new Float32Array(quads * 6 * 2), 2);
    this.age = new BufferAttribute(new Float32Array(quads * 6), 1);
    for (const a of [this.pos, this.uv, this.age]) a.setUsage(DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('aUv', this.uv);
    g.setAttribute('aAge', this.age);
    g.boundingSphere = new Sphere(new Vector3(), 1e6);
    g.setDrawRange(0, 0);
    this.mat = new ShaderMaterial({
      uniforms: {
        uMode: { value: 0 }, uInk: { value: new Color(0x252c4a) }, uLight: { value: new Color(0xe9f2ff) }, uNeon: { value: new Color(0x9fe9ff) },
        uAlpha: { value: 0.9 }, uSeed: { value: 0 },
      },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.setLook('light');
    this.mesh = new Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }

  setLook(look: TrailLook): void {
    const m = this.mat;
    m.blending = CustomBlending;
    m.blendEquation = AddEquation;
    m.blendEquationAlpha = AddEquation;
    m.blendSrcAlpha = ZeroFactor;
    m.blendDstAlpha = OneFactor;
    if (look === 'ink') {
      m.blendSrc = SrcAlphaFactor;
      m.blendDst = OneMinusSrcAlphaFactor;
    } else {
      m.blendSrc = OneFactor;
      m.blendDst = OneFactor;
    }
    const mode = m.uniforms['uMode'];
    if (mode !== undefined) mode.value = look === 'ink' ? 0 : 1;
    m.needsUpdate = true;
  }

  /** start a new stroke (a new swing): clears the ring, sets the sample life (s) */
  begin(life: number, seed: number): void {
    this.n = 0;
    this.life = life;
    const s = this.mat.uniforms['uSeed'];
    if (s !== undefined) s.value = seed;
  }

  /** a blade sample (vm scene space): the inner point and the tip */
  sample(inner: Vector3, tip: Vector3): void {
    if (this.n > 0) {
      const l = (this.head - 1 + SAMPLES) % SAMPLES;
      const dx = tip.x - (this.B[l * 3] ?? 0), dy = tip.y - (this.B[l * 3 + 1] ?? 0), dz = tip.z - (this.B[l * 3 + 2] ?? 0);
      if (dx * dx + dy * dy + dz * dz < 1e-6) return;
    }
    const i = this.head;
    this.head = (this.head + 1) % SAMPLES;
    this.n = Math.min(SAMPLES, this.n + 1);
    this.A.set([inner.x, inner.y, inner.z], i * 3);
    this.B.set([tip.x, tip.y, tip.z], i * 3);
    this.T[i] = this.time;
  }

  private idx(k: number): number { const c = k < 0 ? 0 : k >= this.n ? this.n - 1 : k; return (this.head - this.n + c + SAMPLES) % SAMPLES; }

  private cr(src: Float32Array, k: number, u: number, out: Vector3): Vector3 {
    const i0 = this.idx(k - 1) * 3, i1 = this.idx(k) * 3, i2 = this.idx(k + 1) * 3, i3 = this.idx(k + 2) * 3;
    const u2 = u * u, u3 = u2 * u;
    const b0 = -0.5 * u3 + u2 - 0.5 * u, b1 = 1.5 * u3 - 2.5 * u2 + 1, b2 = -1.5 * u3 + 2 * u2 + 0.5 * u, b3 = 0.5 * u3 - 0.5 * u2;
    return out.set(
      (src[i0] ?? 0) * b0 + (src[i1] ?? 0) * b1 + (src[i2] ?? 0) * b2 + (src[i3] ?? 0) * b3,
      (src[i0 + 1] ?? 0) * b0 + (src[i1 + 1] ?? 0) * b1 + (src[i2 + 1] ?? 0) * b2 + (src[i3 + 1] ?? 0) * b3,
      (src[i0 + 2] ?? 0) * b0 + (src[i1 + 2] ?? 0) * b1 + (src[i2 + 2] ?? 0) * b2 + (src[i3 + 2] ?? 0) * b3,
    );
  }

  /** advance the clock and rebuild the ribbon */
  update(dt: number): void {
    this.time += dt;
    const P = this.pos.array as Float32Array, U = this.uv.array as Float32Array, G = this.age.array as Float32Array;
    const a0 = new Vector3(), b0 = new Vector3(), a1 = new Vector3(), b1 = new Vector3();
    let q = 0, live = 0, dist = 0;
    for (let k = 0; k < this.n - 1; k++) {
      const t0 = this.T[this.idx(k)] ?? 0, t1 = this.T[this.idx(k + 1)] ?? 0;
      const g0 = Math.min(1, (this.time - t0) / this.life), g1 = Math.min(1, (this.time - t1) / this.life);
      if (g0 >= 1 && g1 >= 1) continue;
      live++;
      for (let s = 0; s < SUB; s++) {
        const u0 = s / SUB, u1 = (s + 1) / SUB;
        this.cr(this.A, k, u0, a0); this.cr(this.B, k, u0, b0);
        this.cr(this.A, k, u1, a1); this.cr(this.B, k, u1, b1);
        const ga = g0 + (g1 - g0) * u0, gb = g0 + (g1 - g0) * u1;
        const d0 = dist, d1 = dist + b0.distanceTo(b1);
        dist = d1;
        const o = q * 18, ou = q * 12, oa = q * 6;
        const put = (j: number, p: Vector3, x: number, y: number, age: number): void => {
          P[o + j * 3] = p.x; P[o + j * 3 + 1] = p.y; P[o + j * 3 + 2] = p.z;
          U[ou + j * 2] = x; U[ou + j * 2 + 1] = y;
          G[oa + j] = age;
        };
        put(0, a0, 0, d0, ga); put(1, b0, 1, d0, ga); put(2, b1, 1, d1, gb);
        put(3, a0, 0, d0, ga); put(4, b1, 1, d1, gb); put(5, a1, 0, d1, gb);
        q++;
      }
    }
    this.mesh.geometry.setDrawRange(0, q * 6);
    this.mesh.visible = live > 0;
    if (live > 0) { this.pos.needsUpdate = true; this.uv.needsUpdate = true; this.age.needsUpdate = true; }
  }
}
