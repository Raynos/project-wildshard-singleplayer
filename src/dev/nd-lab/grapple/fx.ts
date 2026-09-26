// Lab P9 "grapple" (E169): the one-shot effects. All deterministic in (time since the event, seed), so a frame strip
// and a video capture show the same thing.
//  - Sparks: a burst of hot streaks (head → tail a few ms back along the ballistic path), screen-space widened quads,
//    additive HDR white-gold → ember orange. One draw.
//  - Flash: a camera-facing star (hot core, six sharp rays, a shock ring), additive HDR. The muzzle flash (viewmodel
//    scene) and the bite flash at the hook (world scene) are two of them.
import { BufferAttribute, BufferGeometry, Color, CustomBlending, DoubleSide, Mesh, OneFactor, ShaderMaterial, Vector2, Vector3, ZeroFactor } from 'three';

const ADD = { side: DoubleSide, transparent: true, depthWrite: false, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor } as const;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VS_SPARK = /* glsl */ `
attribute vec3 aOther;
attribute vec3 aSide;
uniform vec2 uRes;
uniform float uPx;
varying float vHeat;
varying float vAcross;
void main() {
  vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 o = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
  vec2 d = o.xy / max(o.w, 1e-3) - c.xy / max(c.w, 1e-3);
  vec2 dir = normalize(d * uRes + vec2(1e-4, 0.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  float px = uPx * (0.6 + 0.8 * aSide.z);
  c.xy += nrm * aSide.x * px / uRes * c.w;
  // stretch the head a hair past its point so a short streak still reads as a dot
  c.xy -= dir * aSide.y * px / uRes * c.w;
  vHeat = aSide.z;
  vAcross = aSide.x;
  gl_Position = c;
}
`;
const FS_SPARK = /* glsl */ `
uniform float uI;
varying float vHeat;
varying float vAcross;
void main() {
  float a = 1.0 - abs(vAcross);
  vec3 hot = mix(vec3(1.0, 0.36, 0.08), vec3(1.0, 0.92, 0.7), vHeat);
  gl_FragColor = vec4(hot * a * uI * (1.0 + 3.0 * vHeat), 0.0);
}
`;

export class Sparks {
  readonly mesh: Mesh;
  readonly u = { uRes: { value: new Vector2(1, 1) }, uPx: { value: 3.0 }, uI: { value: 1 } };
  private readonly n: number;
  private readonly v0: Float32Array;
  private readonly life: Float32Array;
  private readonly pos: Float32Array;
  private readonly other: Float32Array;
  private readonly side: Float32Array;

  constructor(n = 56, seed = 11) {
    this.n = n;
    const r = rng(seed);
    this.v0 = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // a cone around +z (the local burst direction), wide
      const th = r() * Math.PI * 2, cz = 0.15 + r() * 0.85, sz = Math.sqrt(1 - cz * cz);
      const sp = 2.5 + r() * 7.5;
      this.v0[i * 3] = Math.cos(th) * sz * sp;
      this.v0[i * 3 + 1] = Math.sin(th) * sz * sp + 1.5;
      this.v0[i * 3 + 2] = cz * sp;
      this.life[i] = 0.18 + r() * 0.42;
    }
    const g = new BufferGeometry();
    this.pos = new Float32Array(n * 4 * 3);
    this.other = new Float32Array(n * 4 * 3);
    this.side = new Float32Array(n * 4 * 3);
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('aOther', new BufferAttribute(this.other, 3));
    g.setAttribute('aSide', new BufferAttribute(this.side, 3));
    g.setIndex(idx);
    this.mesh = new Mesh(g, new ShaderMaterial({ uniforms: this.u, vertexShader: VS_SPARK, fragmentShader: FS_SPARK, ...ADD }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
  }

  /** the burst `t` seconds after it fired at `o`, its local +z along `dir` (world) */
  update(t: number, o: Vector3, dir: Vector3, scale = 1): void {
    if (t < 0 || t > 0.7) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    // a basis around dir
    const z = dir.clone().normalize();
    const x = new Vector3(0, 1, 0).cross(z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize();
    const y = z.clone().cross(x);
    const at = (i: number, tt: number, out: Vector3): Vector3 => {
      const vx = this.v0[i * 3] ?? 0, vy = this.v0[i * 3 + 1] ?? 0, vz = this.v0[i * 3 + 2] ?? 0;
      // drag: distance ~ v (1 - e^-kt) / k
      const k = 3.0;
      const f = (1 - Math.exp(-k * tt)) / k;
      out.copy(o).addScaledVector(x, vx * f * scale).addScaledVector(y, vy * f * scale).addScaledVector(z, vz * f * scale);
      out.y -= 4.9 * tt * tt * scale;
      return out;
    };
    const h = new Vector3(), tl = new Vector3();
    for (let i = 0; i < this.n; i++) {
      const L = this.life[i] ?? 0.3;
      const alive = t < L;
      const heat = alive ? 1 - t / L : 0;
      at(i, t, h);
      at(i, Math.max(0, t - 0.03), tl);
      for (let k = 0; k < 4; k++) {
        const o3 = (i * 4 + k) * 3;
        const head = k < 2;
        const p = head ? h : tl, q = head ? tl : h;
        this.pos[o3] = p.x; this.pos[o3 + 1] = p.y; this.pos[o3 + 2] = p.z;
        this.other[o3] = q.x; this.other[o3 + 1] = q.y; this.other[o3 + 2] = q.z;
        this.side[o3] = k === 0 || k === 3 ? -1 : 1;
        this.side[o3 + 1] = head ? -0.5 : 0.5;
        this.side[o3 + 2] = alive ? heat : -10;
      }
    }
    // dead sparks collapse (a zero-width quad)
    for (let i = 0; i < this.side.length; i += 3) if ((this.side[i + 2] ?? 0) < -1) { this.side[i] = 0; this.side[i + 2] = 0; }
    const g = this.mesh.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('aOther').needsUpdate = true;
    g.getAttribute('aSide').needsUpdate = true;
  }
}

const VS_FLASH = /* glsl */ `
attribute vec2 aCorner;
uniform float uSize;
uniform float uRot;
varying vec2 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float c = cos(uRot), s = sin(uRot);
  vec2 k = vec2(c * aCorner.x - s * aCorner.y, s * aCorner.x + c * aCorner.y);
  mv.xy += k * uSize;
  vP = aCorner;
  gl_Position = projectionMatrix * mv;
}
`;
const FS_FLASH = /* glsl */ `
uniform float uI;
uniform float uRing;
uniform vec3 uCol;
varying vec2 vP;
void main() {
  float r = length(vP);
  float a = atan(vP.y, vP.x);
  float core = exp(-r * r * 60.0) * 3.0 + exp(-r * r * 9.0) * 0.6;
  float rays = pow(abs(cos(a * 3.0)), 60.0) * exp(-r * 3.2) * 1.4 + pow(abs(cos(a * 3.0 + 1.047)), 90.0) * exp(-r * 5.0) * 0.6;
  float ring = exp(-pow((r - uRing) / 0.03, 2.0)) * (1.0 - uRing) * 1.2;
  vec3 col = mix(uCol, vec3(1.0), clamp(core * 0.5, 0.0, 1.0)) * (core + rays + ring) * uI;
  gl_FragColor = vec4(col * smoothstep(1.0, 0.8, r), 0.0);
}
`;

export class Flash {
  readonly mesh: Mesh;
  readonly u = { uSize: { value: 0.1 }, uRot: { value: 0 }, uI: { value: 0 }, uRing: { value: 0.2 }, uCol: { value: new Color(0.3, 0.9, 1.0) } };

  constructor(col: Color) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
    g.setAttribute('aCorner', new BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.u.uCol.value.copy(col);
    this.mesh = new Mesh(g, new ShaderMaterial({ uniforms: this.u, vertexShader: VS_FLASH, fragmentShader: FS_FLASH, ...ADD, depthTest: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    this.mesh.visible = false;
  }

  /** k = 0..1 progress of the flash (0 = the bang), `size` metres */
  set(k: number, size: number, rot: number): void {
    if (k < 0 || k >= 1) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const fall = (1 - k) ** 2.2;
    this.u.uI.value = fall * 2.2;
    this.u.uSize.value = size * (0.7 + 0.5 * k);
    this.u.uRing.value = 0.15 + 0.8 * k;
    this.u.uRot.value = rot;
  }
}
