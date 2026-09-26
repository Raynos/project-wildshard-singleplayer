// Red paper lanterns on strings across a street. One instanced draw for every lantern (body, lacquer caps and tassel
// are one merged geometry, told apart by `aPart`), one draw for every cable (a ribbon of constant pixel width, the
// ruled ink line). The paper glows: hot orange where you look through it at the candle, deep cinnabar at the rim,
// bamboo ribs as dark lines. The glow goes into alpha (the bloom weight) and into `emitters` for the reflections.
import {
  BufferGeometry, Color, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, LatheGeometry, Matrix4, Mesh, Quaternion, ShaderMaterial,
  Uint32BufferAttribute, Vector2, Vector3,
} from 'three';
import { FOG, NOISE } from './glsl';
import { type Emitter, type LabShared, NEON, lin } from './shared';

export interface LanternString {
  a: Vector3;
  b: Vector3;
  /** sag at the middle, metres */
  sag: number;
  count: number;
  /** drop from the cable to the lantern's top */
  drop?: number;
  scale?: number;
}

function lanternGeometry(): BufferGeometry {
  const pts: Vector2[] = [];
  const R = 0.27, H = 0.24;
  for (let i = 0; i <= 14; i++) {
    const t = -1 + (2 * i) / 14;
    const y = t * H;
    const r = Math.max(0.1, R * Math.sqrt(Math.max(0, 1 - t * t * 0.86)));
    pts.push(new Vector2(r, y));
  }
  const parts: { g: BufferGeometry; part: number }[] = [{ g: new LatheGeometry(pts, 18), part: 0 }];
  const cap = (y0: number, y1: number, r: number): BufferGeometry => new LatheGeometry([new Vector2(0, y0), new Vector2(r, y0), new Vector2(r, y1), new Vector2(0, y1)], 12);
  parts.push({ g: cap(H - 0.01, H + 0.05, 0.105), part: 1 });
  parts.push({ g: cap(-H - 0.05, -H + 0.01, 0.105), part: 1 });
  // the tassel: a thin tapering skirt under the bottom cap
  parts.push({ g: new LatheGeometry([new Vector2(0.012, -H - 0.05), new Vector2(0.03, -H - 0.2), new Vector2(0.04, -H - 0.36), new Vector2(0, -H - 0.36)], 8), part: 2 });
  const pos: number[] = [], nrm: number[] = [], part: number[] = [], idx: number[] = [];
  let base = 0;
  for (const { g, part: p } of parts) {
    const gp = g.getAttribute('position');
    const gn = g.getAttribute('normal');
    for (let i = 0; i < gp.count; i++) {
      pos.push(gp.getX(i), gp.getY(i), gp.getZ(i));
      nrm.push(gn.getX(i), gn.getY(i), gn.getZ(i));
      part.push(p);
    }
    const gi = g.getIndex();
    if (gi !== null) for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + base);
    else for (let i = 0; i < gp.count; i++) idx.push(i + base);
    base += gp.count;
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  out.setAttribute('aPart', new Float32BufferAttribute(part, 1));
  out.setIndex(new Uint32BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

const VS_LANTERN = /* glsl */ `
attribute float aPart;
attribute float aSeed;
uniform float uTime;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vWorld;
varying float vPart;
varying float vSeed;
void main() {
  vLocal = position; vPart = aPart; vSeed = aSeed;
  // a slow sway about the hanging point (0.3 m above the centre)
  float a = sin(uTime * 0.9 + aSeed * 6.28) * 0.05;
  vec3 p = position - vec3(0.0, 0.3, 0.0);
  p = vec3(p.x, p.y * cos(a) - p.z * sin(a), p.y * sin(a) + p.z * cos(a)) + vec3(0.0, 0.3, 0.0);
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FS_LANTERN = /* glsl */ `
${NOISE}
${FOG}
uniform float uTime;
uniform vec3 uHot;
uniform vec3 uRim;
uniform vec3 uCapCol;
uniform vec3 uTassel;
uniform float uGain;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vWorld;
varying float vPart;
varying float vSeed;
void main() {
  vec3 V = normalize(uCam - vWorld);
  float ndv = abs(dot(normalize(vN), V));
  float f = fogAmt(vWorld);
  vec3 col;
  float bw = 0.0;
  if (vPart < 0.5) {
    float ang = atan(vLocal.z, vLocal.x);
    float rib = abs(fract(ang / 6.2832 * 16.0) - 0.5) / 16.0 * 6.2832 * length(vLocal.xz);
    float fw = max(fwidth(rib), 1e-5);
    float ribs = 1.0 - smoothstep(0.0045, 0.0045 + fw * 1.5, rib);
    ribs *= 1.0 - smoothstep(0.004, 0.012, fw);
    float band = smoothstep(0.17, 0.2, abs(vLocal.y));
    float candle = pow(clamp(ndv, 0.0, 1.0), 2.2) * (0.6 + 0.4 * (1.0 - abs(vLocal.y) / 0.25));
    float fl = 0.93 + 0.07 * sin(uTime * 11.0 + vSeed * 40.0) * sin(uTime * 7.3 + vSeed * 13.0);
    vec3 E = mix(uRim, uHot, candle) * uGain * fl;
    // the candle itself, seen through the paper: a small warm-gold hot spot
    E += vec3(1.0, 0.62, 0.3) * pow(clamp(ndv, 0.0, 1.0), 7.0) * (1.0 - abs(vLocal.y) / 0.25) * uGain * 0.55 * fl;
    E *= 1.0 - 0.7 * ribs;
    E = mix(E, uRim * uGain * 0.25, band * 0.8);
    col = E * (1.0 - f * 0.5);
    bw = (1.0 - 0.5 * ribs) * (1.0 - f * 0.5);
  } else if (vPart < 1.5) {
    vec3 c = uCapCol * (0.35 + 0.65 * pow(1.0 - ndv, 2.0));
    col = mix(c, fogCol(vWorld), f);
  } else {
    col = mix(uTassel * (0.6 + 0.4 * ndv), fogCol(vWorld), f);
  }
  gl_FragColor = vec4(col, bw);
}
`;

// ── cables: ribbons of constant pixel width (the ruled ink line) ──
const VS_CABLE = /* glsl */ `
attribute vec3 aA;
attribute vec3 aB;
attribute vec2 aCorner;
uniform vec2 uRes;
uniform float uPx;
varying vec3 vWorld;
void main() {
  vec4 ca = projectionMatrix * viewMatrix * vec4(aA, 1.0);
  vec4 cb = projectionMatrix * viewMatrix * vec4(aB, 1.0);
  vec2 sa = ca.xy / ca.w, sb = cb.xy / cb.w;
  vec2 dir = normalize((sb - sa) * uRes + 1e-6);
  vec2 nrm = vec2(-dir.y, dir.x) / uRes * uPx;
  vec4 cp = mix(ca, cb, aCorner.y);
  cp.xy += nrm * aCorner.x * cp.w;
  vWorld = mix(aA, aB, aCorner.y);
  gl_Position = cp;
}
`;
const FS_CABLE = /* glsl */ `
${NOISE}
${FOG}
uniform vec3 uInk;
varying vec3 vWorld;
void main() {
  float f = fogAmt(vWorld);
  gl_FragColor = vec4(mix(uInk, fogCol(vWorld), f), 0.0);
}
`;

export class Cables {
  private readonly a: number[] = [];
  private readonly b: number[] = [];
  private readonly corner: number[] = [];
  private readonly idx: number[] = [];
  private n = 0;

  seg(p: Vector3, q: Vector3): void {
    const i = this.n;
    for (const [cx, cy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]] as const) {
      this.a.push(p.x, p.y, p.z);
      this.b.push(q.x, q.y, q.z);
      this.corner.push(cx, cy);
      this.n++;
    }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  build(shared: LabShared, px: number): Mesh {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.a, 3));
    g.setAttribute('aA', new Float32BufferAttribute(this.a, 3));
    g.setAttribute('aB', new Float32BufferAttribute(this.b, 3));
    g.setAttribute('aCorner', new Float32BufferAttribute(this.corner, 2));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    const u = shared.u;
    const mat = new ShaderMaterial({
      uniforms: { uRes: u.uRes, uPx: { value: px }, uCam: u.uCam, uFogCol: u.uFogCol, uFogTop: u.uFogTop, uFog: u.uFog, uInk: { value: lin(0x16171b) } },
      vertexShader: VS_CABLE, fragmentShader: FS_CABLE,
    });
    const m = new Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }
}

export class Lanterns {
  readonly emitters: Emitter[] = [];
  private readonly mats: Matrix4[] = [];
  private readonly seeds: number[] = [];
  readonly material: ShaderMaterial;

  constructor(private readonly shared: LabShared, readonly cables: Cables) {
    const u = shared.u;
    this.material = new ShaderMaterial({
      uniforms: {
        uTime: u.uTime, uCam: u.uCam, uFogCol: u.uFogCol, uFogTop: u.uFogTop, uFog: u.uFog,
        uHot: { value: lin(0xff6a3c) }, uRim: { value: lin(0x9a0e0a) }, uCapCol: { value: lin(0x3a2a18) }, uTassel: { value: lin(0xb3241a) },
        uGain: { value: 1.5 },
      },
      vertexShader: VS_LANTERN, fragmentShader: FS_LANTERN,
    });
  }

  /** one lantern hanging with its top at `top` */
  hang(top: Vector3, scale = 1, drop = 0): void {
    const c = top.clone();
    c.y -= drop + 0.3 * scale;
    this.mats.push(new Matrix4().compose(c, new Quaternion(), new Vector3(scale, scale, scale)));
    this.seeds.push((this.mats.length * 0.618) % 1);
    if (drop > 0.01) this.cables.seg(top, new Vector3(top.x, top.y - drop, top.z));
    this.emitters.push({ at: c, color: lin(NEON.lantern), w: 0.5 * scale, h: 0.5 * scale, power: 0.9, spill: 0.35 * scale });
  }

  /** a catenary-ish cable from a to b with `count` lanterns hung along it */
  string(s: LanternString): void {
    const pts: Vector3[] = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = new Vector3().lerpVectors(s.a, s.b, t);
      p.y -= s.sag * 4 * t * (1 - t);
      pts.push(p);
    }
    for (let i = 0; i < N; i++) {
      const p = pts[i], q = pts[i + 1];
      if (p !== undefined && q !== undefined) this.cables.seg(p, q);
    }
    for (let k = 0; k < s.count; k++) {
      const t = (k + 0.5) / s.count;
      const p = new Vector3().lerpVectors(s.a, s.b, t);
      p.y -= s.sag * 4 * t * (1 - t);
      this.hang(p, s.scale ?? 1, s.drop ?? 0.18);
    }
  }

  build(): InstancedMesh {
    const g = lanternGeometry();
    g.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(this.seeds), 1));
    const m = new InstancedMesh(g, this.material, this.mats.length);
    this.mats.forEach((mm, i) => { m.setMatrixAt(i, mm); });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    void this.shared;
    void Color;
    return m;
  }
}
