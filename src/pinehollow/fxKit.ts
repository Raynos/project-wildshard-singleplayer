import * as THREE from 'three';
import { fxMaterial, FX, type FxMaterial } from '../world/fx';

/**
 * Pine Hollow's fight FX (PH-C2 / PH-C3), all on programs built at boot (a mid-fight compile is a multi-second hitch on
 * iOS): the shared FX program (src/world/fx.ts) for the puffs and the lantern fires, one small fog shader for the arena
 * wall. Everything is made once, parked invisible, and driven by uniforms.
 *
 *   Puffs     a pale shimmer sphere that swells and fades (the Ghost Stag's fade, a roar's breath) — a pool of 4
 *   FogWall   the Antler King's arena wall: an open cylinder of drifting fog at r ≈ 31 round the clearing
 *   flameCard two crossed cards of the FX flame (a fallen lantern burning on the ground)
 */

const _v = new THREE.Vector3();

/** a pool of expanding shimmer spheres (FX dome mode, additive) */
export class Puffs {
  private readonly items: { mesh: THREE.Mesh; mat: FxMaterial; t: number; life: number; r0: number; r1: number; a: number }[] = [];
  private next = 0;
  constructor(scene: THREE.Scene, color: THREE.ColorRepresentation, n = 4) {
    const g = new THREE.SphereGeometry(1, 20, 12);
    for (let i = 0; i < n; i++) {
      const mat = fxMaterial(FX.dome, color, 0);
      const mesh = new THREE.Mesh(g, mat);
      mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 28;
      scene.add(mesh);
      this.items.push({ mesh, mat, t: 0, life: 0, r0: 0.5, r1: 3, a: 1 });
    }
  }
  /** a puff at `at`, radius r0 → r1 over `life` s, peak alpha `a` */
  burst(at: THREE.Vector3, r0: number, r1: number, life = 0.7, a = 0.9): void {
    const it = this.items[this.next];
    if (it === undefined) return;
    this.next = (this.next + 1) % this.items.length;
    it.mesh.position.copy(at); it.t = 0; it.life = life; it.r0 = r0; it.r1 = r1; it.a = a;
    it.mesh.scale.setScalar(r0); it.mesh.visible = true;
  }
  update(dt: number, t: number): void {
    for (const it of this.items) {
      if (!it.mesh.visible) continue;
      it.t += dt;
      const k = Math.min(1, it.t / it.life);
      it.mesh.scale.setScalar(it.r0 + (it.r1 - it.r0) * (1 - (1 - k) * (1 - k)));
      it.mat.uniforms.uAlpha.value = it.a * (1 - k) * Math.min(1, it.t * 12);
      it.mat.uniforms.uTime.value = t;
      if (k >= 1) it.mesh.visible = false;
    }
  }
}

const FOG_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FOG_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uAlpha; uniform float uTime;
varying vec2 vUv;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n21(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vec2(vUv.x * 48.0 + uTime * 0.35, vUv.y * 4.0 - uTime * 0.18);
  float n = n21(p) * 0.6 + n21(p * 2.3 + 7.1) * 0.4;
  float a = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.25, vUv.y) * (0.55 + 0.45 * n);
  gl_FragColor = vec4(uColor * (0.85 + 0.3 * n), clamp(a * uAlpha, 0.0, 1.0));
}`;

/** the arena's fog wall: an open cylinder, drifting noise, thick at the foot, thin at the top */
export class FogWall {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial & { uniforms: { uColor: { value: THREE.Color }; uAlpha: { value: number }; uTime: { value: number } } };
  alpha = 0;
  constructor(scene: THREE.Scene, x: number, y: number, z: number, r: number, h: number) {
    const g = new THREE.CylinderGeometry(r, r * 1.04, h, 96, 1, true);
    g.translate(0, h / 2, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.2, 0.22, 0.26) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
      vertexShader: FOG_VERT, fragmentShader: FOG_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }) as FogWall['mat'];
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.position.set(x, y, z);
    this.mesh.visible = false; this.mesh.frustumCulled = false; this.mesh.renderOrder = 26;
    this.mesh.name = 'antler-king-fog-wall';
    scene.add(this.mesh);
  }
  /** `fog` = the scene fog's colour this frame (the wall is the same murk) */
  update(t: number, fog: THREE.Color | null): void {
    this.mat.uniforms.uAlpha.value = this.alpha;
    this.mat.uniforms.uTime.value = t;
    if (fog) this.mat.uniforms.uColor.value.copy(fog).multiplyScalar(1.15);
    this.mesh.visible = this.alpha > 0.01;
  }
}

/** two crossed cards of the FX flame, `w` wide and `h` tall, standing on their base (a fallen lantern's fire) */
export function flameCard(color: THREE.ColorRepresentation, w: number, h: number): { mesh: THREE.Mesh; mat: FxMaterial } {
  const a = new THREE.PlaneGeometry(w, h); a.translate(0, h / 2, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const P: number[] = [], U: number[] = [], N: number[] = [];
  for (const g of [a, b]) {
    const gi = g.toNonIndexed();
    const p = gi.getAttribute('position'), u = gi.getAttribute('uv'), n = gi.getAttribute('normal');
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); U.push(u.getX(i), u.getY(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  const mat = fxMaterial(FX.flame, color, 0);
  const mesh = new THREE.Mesh(g, mat);
  mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 27;
  return { mesh, mat };
}

/** the world position of `o` (a scratch vector: copy it if you keep it) */
export function worldPos(o: THREE.Object3D): THREE.Vector3 { return o.getWorldPosition(_v); }
