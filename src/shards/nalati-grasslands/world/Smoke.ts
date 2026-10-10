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
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { SMOKE_GLSL } from '../data/smokeGlsl';

/** the GLSL below is data (data/smokeGlsl.ts); `@{name}` splices the fragments this module passes */
const SMOKE_GLSL_FAMILY = new ShaderFamily(SMOKE_GLSL, {});

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
      vertexShader: SMOKE_GLSL_FAMILY.glsl(SMOKE_GLSL.vertexShader),
      fragmentShader: SMOKE_GLSL_FAMILY.glsl(SMOKE_GLSL.fragmentShader),
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 3;
    return this.mesh;
  }

  update(dt: number): void { this.uTime.value += dt; }
}
