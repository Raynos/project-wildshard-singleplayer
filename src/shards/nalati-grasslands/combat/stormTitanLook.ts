import { app } from '@wildshard/engine/app/runtime';
import { TIER } from '@wildshard/engine/core/tier';

/**
 * The Storm Titan's look (NALATI.md B14 "look is a first pass"; mockups art/nalati-grasslands/round-3/2-storm-titan/):
 * a towering giant of DARK cumulus with lightning veins crawling over him and a glowing spiral heart, and the phase-3
 * grass fire as rolling flame fronts under columns of smoke. Visuals only — stormTitan.ts keeps every rule of the fight.
 *
 *   patchTitanCloud(shader)   the body's cloud program (on its MeshBasic puffs, chained after Atmosphere's hook): the unit
 *                             puff is displaced into cauliflower lumps by 3D noise, its normal bumped by world noise, lit
 *                             as a storm cloud (near-black crevices, slate body, silver crowns), the heart's spiral glow
 *                             in the cloud round it, and lightning veins — ridged world noise, flickering in patches,
 *                             blazing on his flashes
 *   GrassFireFx               the fire: per burning cell a cluster of three 3D flame tongues (lathed shells, additive,
 *                             soft at the silhouette like a volume, licking and leaning downwind; the downwind front
 *                             stands tallest), and a pool of rising smoke puffs (real meshes, soft transparent volumes,
 *                             lit orange from below while young, drifting and swelling downwind)
 *
 * No billboards: the tongues and the smoke are 3D meshes seen from any side (the user's look rule 1).
 */
import * as THREE from 'three';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { STORM_TITAN_GLSL } from '../data/stormTitanGlsl';

/** the GLSL below is data (data/stormTitanGlsl.ts); `@{name}` splices the fragments this module passes */
const STORM_TITAN_GLSL_FAMILY = new ShaderFamily(STORM_TITAN_GLSL, {});


const PHONE = TIER === 'phone';

/** GLSL (every pow() base here is clamped: a base a hair below 0 is NaN, and the desktop bloom smears one NaN over the whole frame): 3D value noise + a 3-octave fbm (the cloud, the veins, the flames, the smoke share it) */
export const TITAN_NOISE_GLSL = STORM_TITAN_GLSL_FAMILY.glsl(STORM_TITAN_GLSL.TITAN_NOISE_GLSL);

/** the body's cloud program: call inside the puff material's onBeforeCompile, after the chained base hook */
export function patchTitanCloud(sh: { vertexShader: string; fragmentShader: string }): void {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\nuniform float uT;\nvarying vec3 vGW;\nvarying vec3 vGN;\n${TITAN_NOISE_GLSL}`)
    .replace('#include <begin_vertex>', STORM_TITAN_GLSL_FAMILY.glsl(STORM_TITAN_GLSL.beginVertex))
    .replace('#include <project_vertex>', STORM_TITAN_GLSL_FAMILY.glsl(STORM_TITAN_GLSL.projectVertex));
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', STORM_TITAN_GLSL_FAMILY.glsl(STORM_TITAN_GLSL.fragmentCommon))
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      // a dithered fade (his pale kneel, his dissolve into rain): opaque and depth-correct, no sorting
      if (uAlpha < 0.995 && fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > uAlpha) discard;`)
    .replace('#include <dithering_fragment>', STORM_TITAN_GLSL_FAMILY.glsl(STORM_TITAN_GLSL.ditheringFragment));
}

// ── the grass fire ──────────────────────────────────────────────────────────────────────────────────────────────────

/** three tongues lathed round their own axes, clustered; attributes aH (0 root … 1 tip) and aS (the tongue's seed) */
function flameClusterGeometry(): THREE.BufferGeometry {
  const S = PHONE ? 8 : 12, R = PHONE ? 6 : 9;
  const tongues: [number, number, number, number][] = [[0, 0, 1.0, 1.0], [0.75, 0.35, 0.72, 0.8], [-0.55, -0.6, 0.6, 0.75]]; // x, z, height, width
  const pos: number[] = [], nrm: number[] = [], aH: number[] = [], aS: number[] = [], idx: number[] = [];
  tongues.forEach(([ox, oz, hh, ww], k) => {
    const base = pos.length / 3;
    for (let j = 0; j <= R; j++) {
      const v = j / R, y = v * 2.6 * hh;
      const r = (j === R ? 0 : 0.85 * ww * Math.sin(Math.PI * v ** 0.62) ** 0.85 + 0.02) * (1 - 0.15 * v);
      for (let i = 0; i < S; i++) {
        const a = (i / S) * Math.PI * 2;
        pos.push(ox + Math.cos(a) * r, y, oz + Math.sin(a) * r);
        nrm.push(Math.cos(a), 0.25, Math.sin(a));
        aH.push(v); aS.push(k * 0.37 + 0.11);
      }
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < S; i++) {
      const a = base + j * S + i, b = base + j * S + ((i + 1) % S), c = a + S, d = b + S;
      idx.push(a, c, b, b, c, d);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setIndex(idx);
  return g;
}

const FLAME_VS = STORM_TITAN_GLSL_FAMILY.glsl(STORM_TITAN_GLSL.FLAME_VS);

const FLAME_FS = STORM_TITAN_GLSL_FAMILY.glsl(STORM_TITAN_GLSL.FLAME_FS);

const SMOKE_VS = STORM_TITAN_GLSL_FAMILY.glsl(STORM_TITAN_GLSL.SMOKE_VS);

const SMOKE_FS = STORM_TITAN_GLSL_FAMILY.glsl(STORM_TITAN_GLSL.SMOKE_FS);

interface SmokeP { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; r0: number; r1: number; glow: number; seed: number; on: boolean }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _y = new THREE.Vector3(0, 1, 0);

/** the phase-3 fire's flames and smoke; the fight feeds it the burning cells each frame */
export class GrassFireFx {
  readonly flames: THREE.InstancedMesh;
  readonly smoke: THREE.InstancedMesh;
  private readonly flameUni = { uT: { value: 0 }, uWind: { value: new THREE.Vector2() } };
  private readonly smokeUni: { uT: { value: number }; uFogC: { value: THREE.Color }; uFlash: { value: number } };
  private readonly pool: SmokeP[] = [];
  private n = 0;
  private next = 0;

  constructor(scene: THREE.Scene, maxFlames: number, fogC: { value: THREE.Color }, flash: { value: number }) {
    const fm = new THREE.ShaderMaterial({
      uniforms: this.flameUni, vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    fm.name = 'titan-flame';
    this.flames = new THREE.InstancedMesh(flameClusterGeometry(), fm, maxFlames);
    this.flames.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxFlames * 3), 3);
    this.flames.frustumCulled = false; this.flames.count = 0; this.flames.renderOrder = 14; this.flames.name = 'titan-flames';
    scene.add(this.flames);
    const nSmoke = PHONE ? 90 : 200;
    this.smokeUni = { uT: { value: 0 }, uFogC: fogC, uFlash: flash };
    const sm = new THREE.ShaderMaterial({ uniforms: this.smokeUni, vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false });
    sm.name = 'titan-smoke';
    this.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, PHONE ? 1 : 2), sm, nSmoke);
    this.smoke.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nSmoke * 3), 3);
    this.smoke.frustumCulled = false; this.smoke.count = 0; this.smoke.name = 'titan-smoke';
    scene.add(this.smoke);
    for (let i = 0; i < nSmoke; i++) this.pool.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, r0: 1, r1: 1, glow: 0, seed: 0, on: false });
  }

  /** start a frame's flames */
  begin(): void { this.n = 0; }

  /** one burning cell's flame cluster: `heat` 0..1 (it rises, roars, dies to embers), `front` 1 on the downwind edge */
  flame(x: number, y: number, z: number, cell: number, heat: number, front: number, size: number): void {
    if (this.n >= this.flames.instanceMatrix.count) return;
    const k = size * (0.75 + 0.55 * front) * (0.55 + 0.45 * heat);
    _q.setFromAxisAngle(_y, cell * 0.7);
    _m.compose(_p.set(x, y, z), _q, _s.set(k * 1.25, k, k * 1.25));
    this.flames.setMatrixAt(this.n, _m);
    this.flames.setColorAt(this.n, _c.setRGB(heat, front, (cell * 0.618) % 1));
    this.n++;
  }

  end(): void {
    this.flames.count = this.n;
    this.flames.instanceMatrix.needsUpdate = true;
    if (this.flames.instanceColor) this.flames.instanceColor.needsUpdate = true;
  }

  /** a smoke puff leaves a burning cell */
  puff(x: number, y: number, z: number, strength: number): void {
    const p = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    if (!p) return;
    p.on = true; p.x = x + (app.rng.stream('cosmetic').next() - 0.5) * 2; p.y = y + 1.2; p.z = z + (app.rng.stream('cosmetic').next() - 0.5) * 2;
    p.vx = (app.rng.stream('cosmetic').next() - 0.5) * 0.6; p.vz = (app.rng.stream('cosmetic').next() - 0.5) * 0.6; p.vy = 3.2 + app.rng.stream('cosmetic').next() * 2;
    p.age = 0; p.life = 5 + app.rng.stream('cosmetic').next() * 3.5; p.r0 = 1.1 + app.rng.stream('cosmetic').next() * 0.8; p.r1 = (5 + app.rng.stream('cosmetic').next() * 4) * (0.7 + 0.4 * strength);
    p.glow = strength; p.seed = app.rng.stream('cosmetic').next();
  }

  update(dt: number, t: number, windX: number, windZ: number, windSpeed: number): void {
    this.flameUni.uT.value = t; this.smokeUni.uT.value = t;
    this.flameUni.uWind.value.set(windX, windZ).multiplyScalar(Math.min(0.5, 0.12 + 0.025 * windSpeed));
    let n = 0;
    for (const p of this.pool) {
      if (!p.on) continue;
      p.age += dt / p.life;
      if (p.age >= 1) { p.on = false; continue; }
      // it rises, slows, and the wind takes it (rolling downwind as a column)
      p.vy *= 1 - dt * 0.25;
      p.x += (p.vx + windX * windSpeed * 0.55 * p.age) * dt; p.z += (p.vz + windZ * windSpeed * 0.55 * p.age) * dt; p.y += p.vy * dt;
      const r = p.r0 + (p.r1 - p.r0) * Math.sqrt(p.age);
      _q.setFromAxisAngle(_y, p.seed * 6.28 + t * 0.2);
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(r, r * 0.85, r));
      this.smoke.setMatrixAt(n, _m);
      this.smoke.setColorAt(n, _c.setRGB(p.age, p.glow, p.seed));
      n++;
    }
    this.smoke.count = n;
    this.smoke.instanceMatrix.needsUpdate = true;
    if (this.smoke.instanceColor) this.smoke.instanceColor.needsUpdate = true;
  }

  /** the fire is out (the smoke already aloft keeps rising and thins) */
  out(): void { this.n = 0; this.flames.count = 0; }
  /** a reset: nothing burning, no smoke */
  clear(): void { this.out(); for (const p of this.pool) p.on = false; this.smoke.count = 0; }
}
