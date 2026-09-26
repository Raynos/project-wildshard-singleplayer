// Lab P9 "grapple" (E169): the mono-filament. A verlet rope pinned at both ends (the muzzle and the claw's eyelet),
// stepped at a fixed 240 Hz so a capture is deterministic, drawn as ONE screen-space ribbon: a hot white-cyan core of a
// constant pixel width inside a soft cyan halo (HDR, so the bloom soaks it into the silk), a tension pulse that runs
// back down the line when the talons bite, and a faint energy crawl along it.
//   slack > 1 → the line sags and whips (paying out in flight, the reel-back after a miss); slack → 1 → taut.
import {
  BufferAttribute, BufferGeometry, Color, CustomBlending, DoubleSide, Mesh, OneFactor, ShaderMaterial, Vector2, type Vector3,
  ZeroFactor,
} from 'three';

export class Rope {
  readonly n: number;
  readonly p: Float32Array;
  private readonly q: Float32Array;
  private live = false;
  /** how long the line is allowed to be, as a factor of the anchor distance */
  slack = 1.1;
  gravity = 9.8;
  damping = 0.985;
  /** 0..1: how stiffly the first nodes leave the muzzle (the line is fed out under tension, it never droops there) */
  feed = 0.6;

  constructor(n = 44) {
    this.n = n;
    this.p = new Float32Array(n * 3);
    this.q = new Float32Array(n * 3);
  }

  get active(): boolean { return this.live; }

  /** lay the rope out straight from a to b (the moment the claw leaves the muzzle) */
  reset(a: Vector3, b: Vector3): void {
    for (let i = 0; i < this.n; i++) {
      const t = i / (this.n - 1);
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
      this.p[i * 3] = this.q[i * 3] = x;
      this.p[i * 3 + 1] = this.q[i * 3 + 1] = y;
      this.p[i * 3 + 2] = this.q[i * 3 + 2] = z;
    }
    this.live = true;
  }

  off(): void { this.live = false; }

  /** one fixed step: integrate, then satisfy the segment lengths with both ends pinned */
  step(dt: number, a: Vector3, b: Vector3): void {
    if (!this.live) return;
    const n = this.n, p = this.p, q = this.q;
    const g = this.gravity * dt * dt;
    for (let i = 1; i < n - 1; i++) {
      const k = i * 3;
      for (let c = 0; c < 3; c++) {
        const x = p[k + c] ?? 0, px = q[k + c] ?? 0;
        q[k + c] = x;
        p[k + c] = x + (x - px) * this.damping - (c === 1 ? g : 0);
      }
    }
    const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const seg = (dist * Math.max(this.slack, 1.0)) / (n - 1);
    for (let it = 0; it < 24; it++) {
      p[0] = a.x; p[1] = a.y; p[2] = a.z;
      const e = (n - 1) * 3;
      p[e] = b.x; p[e + 1] = b.y; p[e + 2] = b.z;
      for (let i = 0; i < n - 1; i++) {
        const k0 = i * 3, k1 = k0 + 3;
        const dx = (p[k1] ?? 0) - (p[k0] ?? 0), dy = (p[k1 + 1] ?? 0) - (p[k0 + 1] ?? 0), dz = (p[k1 + 2] ?? 0) - (p[k0 + 2] ?? 0);
        const d = Math.hypot(dx, dy, dz);
        if (d < 1e-6) continue;
        // a rope only resists stretching
        if (d <= seg) continue;
        const f = (d - seg) / d;
        const w0 = i === 0 ? 0 : 0.5, w1 = i + 1 === n - 1 ? 0 : 0.5;
        const s0 = w0 + w1 > 0 ? w0 / (w0 + w1) : 0, s1 = w0 + w1 > 0 ? w1 / (w0 + w1) : 0;
        p[k0] = (p[k0] ?? 0) + dx * f * s0; p[k0 + 1] = (p[k0 + 1] ?? 0) + dy * f * s0; p[k0 + 2] = (p[k0 + 2] ?? 0) + dz * f * s0;
        p[k1] = (p[k1] ?? 0) - dx * f * s1; p[k1 + 1] = (p[k1 + 1] ?? 0) - dy * f * s1; p[k1 + 2] = (p[k1 + 2] ?? 0) - dz * f * s1;
      }
    }
    p[0] = a.x; p[1] = a.y; p[2] = a.z;
    const e = (n - 1) * 3;
    p[e] = b.x; p[e + 1] = b.y; p[e + 2] = b.z;
    // the feed: the first k nodes leave the muzzle in a straight run toward node k
    const k = 7;
    if (this.feed > 0) {
      const kx = p[k * 3] ?? 0, ky = p[k * 3 + 1] ?? 0, kz = p[k * 3 + 2] ?? 0;
      for (let i = 1; i < k; i++) {
        const t = i / k, w = this.feed * (1 - t);
        const o = i * 3;
        p[o] = (p[o] ?? 0) + (a.x + (kx - a.x) * t - (p[o] ?? 0)) * w;
        p[o + 1] = (p[o + 1] ?? 0) + (a.y + (ky - a.y) * t - (p[o + 1] ?? 0)) * w;
        p[o + 2] = (p[o + 2] ?? 0) + (a.z + (kz - a.z) * t - (p[o + 2] ?? 0)) * w;
      }
    }
  }

  /** a copy of the node positions (for a restart point) */
  save(): { p: Float32Array; q: Float32Array; live: boolean } { return { p: this.p.slice(), q: this.q.slice(), live: this.live }; }
  load(s: { p: Float32Array; q: Float32Array; live: boolean }): void { this.p.set(s.p); this.q.set(s.q); this.live = s.live; }
}

const VS = /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute vec2 aSide;
uniform vec2 uRes;
uniform float uCorePx;
uniform float uHaloPx;
varying vec2 vUv;
void main() {
  vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 cp = projectionMatrix * modelViewMatrix * vec4(aPrev, 1.0);
  vec4 cn = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);
  // keep the ribbon in front of the near plane
  float w = max(c.w, 1e-3);
  vec2 s = c.xy / w * uRes;
  vec2 sp = cp.xy / max(cp.w, 1e-3) * uRes;
  vec2 sn = cn.xy / max(cn.w, 1e-3) * uRes;
  vec2 dir = normalize((sn - sp) + vec2(1e-5, 0.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  float half_ = uCorePx * 0.5 + uHaloPx;
  c.xy += nrm * aSide.x * half_ * 2.0 / uRes * w;
  vUv = vec2(aSide.y, aSide.x * half_);
  gl_Position = c;
}
`;
const FS = /* glsl */ `
uniform float uCorePx;
uniform float uHaloPx;
uniform float uI;
uniform float uPulse;
uniform float uLen;
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uHalo;
varying vec2 vUv;
void main() {
  float s = vUv.x;
  float px = abs(vUv.y);
  float core = clamp(uCorePx * 0.5 + 0.7 - px, 0.0, 1.0);
  float halo = exp(-pow(px / max(uHaloPx * 0.45, 0.5), 2.0));
  float crawl = 0.85 + 0.3 * smoothstep(0.4, 1.0, sin(s * uLen * 6.0 - uTime * 38.0));
  float pulse = exp(-pow((s - uPulse) / 0.05, 2.0)) * 3.5;
  vec3 col = (uCore * core * 2.4 + uHalo * halo * 0.8) * uI * (crawl + pulse);
  gl_FragColor = vec4(col, 0.0);
}
`;

/** the ribbon that draws a Rope (node positions pushed every frame) */
export class Filament {
  readonly mesh: Mesh;
  readonly u = {
    uRes: { value: new Vector2(1, 1) },
    uCorePx: { value: 3.0 },
    uHaloPx: { value: 16 },
    uI: { value: 1 },
    uPulse: { value: -1 },
    uLen: { value: 10 },
    uTime: { value: 0 },
    uCore: { value: new Color(0.6, 0.97, 1.0) },
    uHalo: { value: new Color(0.12, 0.8, 1.0) },
  };
  private readonly pos: Float32Array;
  private readonly prev: Float32Array;
  private readonly next: Float32Array;
  private readonly n: number;

  constructor(n: number) {
    this.n = n;
    const g = new BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    this.prev = new Float32Array(n * 2 * 3);
    this.next = new Float32Array(n * 2 * 3);
    const side = new Float32Array(n * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      side[i * 4] = -1; side[i * 4 + 1] = i / (n - 1);
      side[i * 4 + 2] = 1; side[i * 4 + 3] = i / (n - 1);
      if (i < n - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('aPrev', new BufferAttribute(this.prev, 3));
    g.setAttribute('aNext', new BufferAttribute(this.next, 3));
    g.setAttribute('aSide', new BufferAttribute(side, 2));
    g.setIndex(idx);
    const m = new ShaderMaterial({
      uniforms: this.u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: true, side: DoubleSide,
      blending: CustomBlending, blendSrc: OneFactor, blendDst: OneFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
    });
    this.mesh = new Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  /** push the rope's nodes into the ribbon */
  update(r: Rope): void {
    const n = this.n, p = r.p;
    let len = 0;
    for (let i = 0; i < n; i++) {
      const ip = Math.max(0, i - 1), inx = Math.min(n - 1, i + 1);
      for (let s = 0; s < 2; s++) {
        const o = (i * 2 + s) * 3;
        for (let c = 0; c < 3; c++) {
          this.pos[o + c] = p[i * 3 + c] ?? 0;
          this.prev[o + c] = p[ip * 3 + c] ?? 0;
          this.next[o + c] = p[inx * 3 + c] ?? 0;
        }
      }
      if (i > 0) len += Math.hypot((p[i * 3] ?? 0) - (p[ip * 3] ?? 0), (p[i * 3 + 1] ?? 0) - (p[ip * 3 + 1] ?? 0), (p[i * 3 + 2] ?? 0) - (p[ip * 3 + 2] ?? 0));
    }
    this.u.uLen.value = len;
    const g = this.mesh.geometry;
    for (const k of ['position', 'aPrev', 'aNext'] as const) {
      const at = g.getAttribute(k);
      at.needsUpdate = true;
    }
  }
}
