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
import { TIER } from '../core/tier';

const PHONE = TIER === 'phone';

/** GLSL (every pow() base here is clamped: a base a hair below 0 is NaN, and the desktop bloom smears one NaN over the whole frame): 3D value noise + a 3-octave fbm (the cloud, the veins, the flames, the smoke share it) */
export const TITAN_NOISE_GLSL = /* glsl */`
float tH3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tN3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tH3(i), tH3(i + vec3(1, 0, 0)), f.x), mix(tH3(i + vec3(0, 1, 0)), tH3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(tH3(i + vec3(0, 0, 1)), tH3(i + vec3(1, 0, 1)), f.x), mix(tH3(i + vec3(0, 1, 1)), tH3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float tF3(vec3 p) { return tN3(p) * 0.55 + tN3(p * 2.13 + 7.1) * 0.3 + tN3(p * 4.37 - 3.3) * 0.15; }
`;

/** the body's cloud program: call inside the puff material's onBeforeCompile, after the chained base hook */
export function patchTitanCloud(sh: { vertexShader: string; fragmentShader: string }): void {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\nuniform float uT;\nvarying vec3 vGW;\nvarying vec3 vGN;\n${TITAN_NOISE_GLSL}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float gph = dot(instanceMatrix[3].xyz, vec3(0.13, 0.071, 0.113));
      #else
        float gph = 0.0;
      #endif
      // cauliflower: lumps of 3D noise on the unit puff, slowly boiling, and a slow churn on top
      float cn = tF3(position * 2.2 + vec3(gph * 3.1, uT * 0.12 + gph, 0.0));
      transformed += normal * ((cn - 0.5) * 0.55 + 0.1 * sin(uT * 1.1 + gph + position.y * 2.7 + position.x * 1.9));`)
    .replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vGW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vGN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
      #else
        vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vGN = normalize(mat3(modelMatrix) * normal);
      #endif`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uT; uniform vec3 uHeart; uniform float uGlow; uniform float uFlash; uniform float uAlpha; uniform vec3 uFogC; uniform float uFog;
      varying vec3 vGW;
      varying vec3 vGN;
      ${TITAN_NOISE_GLSL}`)
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      // a dithered fade (his pale kneel, his dissolve into rain): opaque and depth-correct, no sorting
      if (uAlpha < 0.995 && fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > uAlpha) discard;`)
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      vec3 gN = normalize(vGN);
      vec3 gV = normalize(cameraPosition - vGW);
      // the cumulus's own lumps: the normal bumped by world noise (continuous across the puffs)
      vec3 bp = vGW * 0.38 + vec3(0.0, uT * 0.05, 0.0);
      float b0 = tF3(bp);
      vec3 grad = vec3(tF3(bp + vec3(0.15, 0.0, 0.0)) - b0, tF3(bp + vec3(0.0, 0.15, 0.0)) - b0, tF3(bp + vec3(0.0, 0.0, 0.15)) - b0) / 0.15;
      gN = normalize(gN - (grad - gN * dot(grad, gN)) * 0.42 + vec3(0.0, 1e-4, 0.0));
      float up = 0.5 + 0.5 * dot(gN, normalize(vec3(-0.3, 0.88, 0.35)));
      float cav = smoothstep(0.22, 0.72, b0);
      float rim = pow(clamp(1.0 - dot(gN, gV), 0.0, 1.0), 3.0);
      vec3 alb = gl_FragColor.rgb;   // per puff: how exposed it is (the core of him is dark)
      // storm cumulus: near-black crevices, a slate body, silver-lit crowns
      vec3 cloud = alb * mix(vec3(0.045, 0.05, 0.08), vec3(0.24, 0.26, 0.33), smoothstep(0.05, 0.95, up));
      cloud += alb * vec3(0.55, 0.58, 0.68) * pow(max(up - 0.62, 0.0) / 0.38, 2.0);
      cloud *= mix(0.72, 1.06, cav);
      cloud += vec3(0.32, 0.37, 0.52) * rim * 0.2;
      // the heart: a spiral of blue-violet light through the cloud round it
      vec3 hd3 = vGW - uHeart; float hd = length(hd3);
      float spiral = 0.5 + 0.5 * sin(atan(hd3.y, hd3.x + 1e-3) * 2.0 + hd * 0.22 - uT * 2.4);
      float inner = exp(-hd / 7.0) * uGlow * mix(0.4, 1.6, spiral);
      cloud += vec3(0.42, 0.48, 1.55) * inner * 0.9;
      // lightning veins: ridged world noise, crawling; patches flicker on and off, all of them blaze on a flash
      vec3 vp = vGW * 0.05 + vec3(0.0, -uT * 0.07, uT * 0.03);
      float rn = abs(tN3(vp + (tN3(vp * 3.1 + 5.0) - 0.5) * 0.35) - 0.5);
      float vein = 1.0 - smoothstep(0.006, 0.028, rn);
      float patchV = smoothstep(0.4, 0.62, tN3(vGW * 0.022 + vec3(floor(uT * 6.0) * 0.37)));
      float vk = vein * (patchV * 0.9 + inner * 1.4 + uFlash * 1.6);
      cloud += vec3(0.8, 0.9, 2.6) * vk;
      cloud += vec3(0.3, 0.34, 0.6) * uFlash * (0.25 + up * 0.5);
      // a cumulus edge is thin vapour: the silhouette melts into the storm sky behind it (soft, no hard ball outlines)
      // (the outermost rim is stippled away — a fuzzy vapour edge, still opaque and unsorted — and greys toward the sky)
      float edge = 1.0 - max(dot(normalize(vGN), gV), 0.0);
      if (smoothstep(0.62, 0.97, edge) > fract(sin(dot(floor(gl_FragCoord.xy), vec2(41.37, 17.91))) * 43758.5453)) discard;
      gl_FragColor.rgb = mix(cloud, uFogC * 0.8, clamp(uFog + edge * edge * 0.3, 0.0, 1.0));`);
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

const FLAME_VS = /* glsl */`
${TITAN_NOISE_GLSL}
attribute float aH; attribute float aS;
uniform float uT; uniform vec2 uWind;
varying float vH; varying float vHeat; varying vec3 vN; varying vec3 vW; varying float vSeed;
void main() {
  // per instance (instanceColor): r = heat 0..1, g = the front (1 = the downwind edge), b = seed
  float heat = instanceColor.r, seed = instanceColor.b + aS;
  vec3 p = position;
  float y01 = aH;
  // lick: the radius breathes with noise running up the tongue; the tip sways and leans downwind
  float lick = tN3(vec3(p.x * 1.3 + seed * 9.0, p.y * 1.4 - uT * 5.5, p.z * 1.3));
  p.xz *= 0.7 + 0.6 * lick;
  p.y *= 0.8 + 0.35 * sin(uT * 8.0 + seed * 17.0) * y01 + 0.2 * lick;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  float s = length(instanceMatrix[1].xyz);
  wp.xz += (uWind * (0.9 + 0.5 * instanceColor.g) + vec2(sin(uT * 6.3 + seed * 11.0), cos(uT * 5.1 + seed * 7.0)) * 0.35) * y01 * y01 * s * 1.6;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vW = wp.xyz;
  vH = y01; vHeat = heat; vSeed = seed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FLAME_FS = /* glsl */`
${TITAN_NOISE_GLSL}
uniform float uT;
varying float vH; varying float vHeat; varying vec3 vN; varying vec3 vW; varying float vSeed;
void main() {
  // a volume, not a card: dense where you look through the middle, gone at the silhouette (per pixel — no facets);
  // tongues of flame: noise rushing up through it, tearing the top into licks
  float edge = clamp(abs(dot(normalize(vN), normalize(cameraPosition - vW))), 0.0, 1.0);
  float body = edge * edge;
  float n = tF3(vec3(vW.x * 1.4 + vSeed * 7.0, vW.y * 0.9 - uT * 3.6, vW.z * 1.4));
  float tongue = smoothstep(0.34, 0.66, n + (1.0 - vH) * 0.42 - vH * 0.3);
  float a = body * tongue * (1.0 - smoothstep(0.55, 1.0, vH)) * (0.35 + 0.65 * vHeat);
  vec3 hot = vec3(3.2, 2.4, 1.2), mid = vec3(3.0, 1.1, 0.2), cool = vec3(1.4, 0.24, 0.04);
  vec3 c = mix(mix(hot, mid, smoothstep(0.0, 0.35, vH)), cool, smoothstep(0.35, 0.9, vH));
  gl_FragColor = vec4(c * a, 1.0);
}`;

const SMOKE_VS = /* glsl */`
${TITAN_NOISE_GLSL}
uniform float uT;
varying vec3 vN; varying vec3 vW; varying vec3 vI;
void main() {
  // per instance (instanceColor): r = age 0..1, g = fire glow, b = seed
  vI = instanceColor;
  vec3 p = position;
  float n = tF3(p * 1.5 + vec3(instanceColor.b * 13.0, uT * 0.25, 0.0));
  p += normal * (n - 0.5) * 0.7;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SMOKE_FS = /* glsl */`
${TITAN_NOISE_GLSL}
uniform vec3 uFogC; uniform float uT; uniform float uFlash;
varying vec3 vN; varying vec3 vW; varying vec3 vI;
void main() {
  float age = vI.r;
  // fade in fast, thin out slowly: dithered (opaque, depth-correct, no sorting)
  float lump = tF3(vW * 0.35 + vec3(0.0, -uT * 0.3, 0.0));
  vec3 n = normalize(vN);
  // a soft volume: thick through the middle, thin at the silhouette, lumpy
  float thick = pow(clamp(abs(dot(n, normalize(cameraPosition - vW))), 0.0, 1.0), 0.8);
  float alpha = smoothstep(0.0, 0.08, age) * pow(clamp(1.0 - age, 0.0, 1.0), 1.2) * thick * (0.7 + 0.8 * lump);
  float up = 0.5 + 0.5 * n.y;
  // soot-dark while young, greying as it thins; the fire under it lights its belly orange
  vec3 c = mix(vec3(0.03, 0.028, 0.026), vec3(0.2, 0.2, 0.22), smoothstep(0.1, 0.8, age)) * mix(0.55, 1.25, up) * mix(0.7, 1.15, lump);
  c += vec3(1.6, 0.55, 0.12) * vI.g * pow(clamp(1.0 - up, 0.0, 1.0), 2.0) * (1.0 - smoothstep(0.0, 0.3, age)) * 0.45;
  c += vec3(0.3, 0.34, 0.55) * uFlash * up * 0.4;
  c = mix(c, uFogC, smoothstep(0.3, 1.0, age) * 0.45);
  gl_FragColor = vec4(c, clamp(alpha, 0.0, 0.92));
}`;

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
    p.on = true; p.x = x + (Math.random() - 0.5) * 2; p.y = y + 1.2; p.z = z + (Math.random() - 0.5) * 2;
    p.vx = (Math.random() - 0.5) * 0.6; p.vz = (Math.random() - 0.5) * 0.6; p.vy = 3.2 + Math.random() * 2;
    p.age = 0; p.life = 5 + Math.random() * 3.5; p.r0 = 1.1 + Math.random() * 0.8; p.r1 = (5 + Math.random() * 4) * (0.7 + 0.4 * strength);
    p.glow = strength; p.seed = Math.random();
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
