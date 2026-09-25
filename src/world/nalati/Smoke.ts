/**
 * Smoke — every chimney / cook-fire plume on the Nalati POIs in ONE mesh (one draw call, zero per-frame CPU work but
 * one uniform): soft painterly puffs that rise, swell, lean downwind and fade. Each puff is a camera-facing quad whose
 * whole life is computed in the vertex shader from its emitter + seed and `uTime`.
 *
 *   const smoke = new Smoke();
 *   smoke.emitter(v3(x, y, z), { puffs: 14, rise: 9, size: [0.4, 3.2] });
 *   scene.add(smoke.build(sky));  game.onUpdate((dt) => smoke.update(dt));
 */
import * as THREE from 'three';
import { painterlyUniforms } from '../painterly';
import type { Sky } from '../Sky';

interface Emitter { x: number; y: number; z: number; puffs: number; rise: number; s0: number; s1: number; life: number; dense: number }

export class Smoke {
  mesh: THREE.Mesh | null = null;
  private emitters: Emitter[] = [];
  private mat: THREE.ShaderMaterial | null = null;
  private uTime = { value: 0 };

  emitter(p: THREE.Vector3, o: { puffs?: number; rise?: number; size?: [number, number]; life?: number; density?: number } = {}): void {
    const size = o.size ?? [0.35, 2.8];
    this.emitters.push({ x: p.x, y: p.y, z: p.z, puffs: o.puffs ?? 12, rise: o.rise ?? 8, s0: size[0], s1: size[1], life: o.life ?? 9, dense: o.density ?? 0.5 });
  }

  get count(): number { return this.emitters.length; }

  build(sky: Sky): THREE.Mesh {
    const corner: number[] = [], em: number[] = [], seed: number[] = [], cfg: number[] = [], index: number[] = [];
    let v = 0, s = 12345;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const box = new THREE.Box3();
    for (const e of this.emitters) {
      box.expandByPoint(new THREE.Vector3(e.x, e.y, e.z));
      box.expandByPoint(new THREE.Vector3(e.x, e.y + e.rise + e.s1, e.z));
      for (let i = 0; i < e.puffs; i++) {
        const sd = [rnd(), rnd(), rnd(), i / e.puffs + rnd() * 0.3 / e.puffs];
        for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const) {
          corner.push(cx, cy, 0); em.push(e.x, e.y, e.z); seed.push(...sd); cfg.push(e.rise, e.s0, e.s1, e.life);
        }
        index.push(v, v + 1, v + 2, v, v + 2, v + 3);
        v += 4;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(corner, 3));
    geo.setAttribute('emitter', new THREE.Float32BufferAttribute(em, 3));
    geo.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4));
    geo.setAttribute('cfg', new THREE.Float32BufferAttribute(cfg, 4));
    geo.setIndex(index);
    const sphere = new THREE.Sphere(); box.getBoundingSphere(sphere); sphere.radius += 12;
    geo.boundingSphere = sphere;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: this.uTime,
        uWind: painterlyUniforms.uPWind,
        uSunDir: painterlyUniforms.uPSunDir,
        uSunCol: { value: sky.sunColor.clone() },
        uShade: painterlyUniforms.uPShade,
      },
      transparent: true, depthWrite: false, fog: true,
      vertexShader: /* glsl */`
        attribute vec3 emitter; attribute vec4 seed; attribute vec4 cfg;
        uniform float uTime; uniform vec3 uWind; uniform vec3 uSunDir;
        varying vec2 vUv; varying float vAge; varying float vLit; varying vec4 vSeed;
        #include <fog_pars_vertex>
        void main() {
          float life = cfg.w;
          float age = fract(uTime / life + seed.w);
          vAge = age; vSeed = seed; vUv = position.xy + 0.5;
          // a plume, not a string of puffs: every puff follows the same bent path (rise slowing, the wind taking it
          // more and more), with only a slow shared meander and a little per-puff spread that grows with age
          vec3 wind = vec3(uWind.x, 0.0, uWind.y) * (0.7 + 0.5 * uWind.z);
          vec3 transformed = emitter;
          transformed.y += cfg.x * (1.0 - pow(1.0 - age, 1.8));
          transformed += wind * pow(age, 1.6) * cfg.x * 0.42;
          float meander = sin(uTime * 0.35 + emitter.x * 0.7) * 0.6 + sin(uTime * 0.21 + emitter.z) * 0.4;
          transformed.x += meander * 0.5 * age * age + (seed.x - 0.5) * 1.1 * age;
          transformed.z += meander * 0.3 * age * age + (seed.y - 0.5) * 1.1 * age;
          float size = mix(cfg.y, cfg.z, pow(age, 0.6)) * (0.85 + 0.3 * seed.y);
          vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
          float rot = seed.x * 6.28 + age * (seed.y - 0.5) * 2.5;
          vec2 q = position.xy * size;
          mvPosition.xy += vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
          vec3 sunV = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          vLit = dot(normalize(position.xy), sunV.xy);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunCol; uniform vec3 uShade;
        varying vec2 vUv; varying float vAge; varying float vLit; varying vec4 vSeed;
        #include <fog_pars_fragment>
        void main() {
          vec2 d = vUv - 0.5;
          // three overlapping soft lobes → a painted cloud-puff silhouette
          // one soft gaussian lobe (no hard silhouette: overlapping puffs melt into a continuous plume)
          float r2 = dot(d, d) * 4.0;
          float m = exp(-r2 * 3.2) * (0.85 + 0.15 * sin(vSeed.z * 20.0 + d.x * 6.0));
          float fade = smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.25, 1.0, vAge));
          float a = m * fade * 0.24;
          if (a < 0.004) discard;
          // painted light: a warm lit side, a cool sky-tinted shade side, two soft bands
          float lit = smoothstep(-0.2, 0.35, vLit * 0.5 + (m - 0.5) * 0.6);
          vec3 base = vec3(0.86, 0.85, 0.84);
          vec3 col = mix(base * (uShade * 2.2 + 0.45), base * uSunCol * 0.55 + 0.25, lit);
          gl_FragColor = vec4(col * (0.9 + 0.2 * (1.0 - vAge)), a);
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 3;
    return this.mesh;
  }

  update(dt: number): void { this.uTime.value += dt; }
}
