/**
 * The stylized sky of the low-poly shard (Driftwood Isle — DRIFTWOOD-REMASTER L2, the user's pick D2: "stylized gradient
 * sky + faceted cumulus replaces the photoreal HDRI"). Sky.ts builds it instead of the HDRI when `style === 'lowpoly'`.
 *
 *   const s = new StylizedSky(sunDir).build();   // s.dome follows the camera (Game.ts moves `sky.clouds`, which is the dome)
 *   s.envScene                                   // a copy of the dome at the origin for PMREMGenerator.fromScene (IBL specular)
 *   s.update(dt)                                 // cloud drift
 *   s.u.*                                        // colours DayNight blends (zenith, horizon, sun, cloud lit / shade, night)
 *
 * - **dome**: one back-faced sphere, unlit: a saturated zenith → pale horizon gradient, a sun glow, a thin bright band on
 *   the horizon, stars at night. Fogless; renderOrder −20.
 * - **cumulus**: one merged mesh of faceted puffs (icosahedra, flattened bases) on a ring 700–1500 m out, drawn flat-
 *   shaded and unlit in its own shader — a two-band sun ramp (white lit / lavender shade), a silver-lining fresnel on the
 *   rims when the sun is behind them, darker bellies, and a fade into the horizon colour at the bottom. Transparent so
 *   it is drawn after the world (depth-tested against it) and before the planet (Sky.ts renderOrder −12/−11), which
 *   therefore sits crisp IN FRONT of the clouds, as in the mockups. One draw call, ~13 k triangles, slow drift.
 */
import * as THREE from 'three';
import { Rng } from '../core/rng';

/** the sky's day palette (linear, pre-tonemap); DayNight lerps these per preset */
export interface SkyPalette {
  zenith: THREE.Color; horizon: THREE.Color; below: THREE.Color; sunGlow: THREE.Color;
  cloudLit: THREE.Color; cloudShade: THREE.Color; night: number;
}

export const MIDDAY_SKY: SkyPalette = {
  zenith: new THREE.Color(0.055, 0.2, 0.78),
  horizon: new THREE.Color(0.36, 0.7, 1.0),
  below: new THREE.Color(0.22, 0.46, 0.72),
  sunGlow: new THREE.Color(1.0, 0.88, 0.62),
  cloudLit: new THREE.Color(1.25, 1.22, 1.16),
  cloudShade: new THREE.Color(0.52, 0.6, 0.92),
  night: 0,
};

export class StylizedSky {
  dome!: THREE.Mesh;
  clouds!: THREE.Mesh;
  envScene = new THREE.Scene();
  readonly u = {
    uZenith: { value: MIDDAY_SKY.zenith.clone() },
    uHorizon: { value: MIDDAY_SKY.horizon.clone() },
    uBelow: { value: MIDDAY_SKY.below.clone() },
    uSunGlow: { value: MIDDAY_SKY.sunGlow.clone() },
    uCloudLit: { value: MIDDAY_SKY.cloudLit.clone() },
    uCloudShade: { value: MIDDAY_SKY.cloudShade.clone() },
    uNight: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uTime: { value: 0 },
  };

  constructor(sunDir: THREE.Vector3) { this.u.uSunDir.value.copy(sunDir); }

  /** set every palette colour from a preset (DayNight blends two presets into a scratch palette first) */
  setPalette(p: SkyPalette): void {
    this.u.uZenith.value.copy(p.zenith); this.u.uHorizon.value.copy(p.horizon); this.u.uBelow.value.copy(p.below);
    this.u.uSunGlow.value.copy(p.sunGlow); this.u.uCloudLit.value.copy(p.cloudLit); this.u.uCloudShade.value.copy(p.cloudShade);
    this.u.uNight.value = p.night;
  }

  build(): this {
    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uBelow; uniform vec3 uSunGlow; uniform vec3 uSunDir; uniform float uNight;
        varying vec3 vDir;
        float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.75, h), 0.62));
          col = mix(col, uBelow, smoothstep(0.0, -0.08, h));
          col += uHorizon * 0.18 * smoothstep(0.06, 0.0, abs(h - 0.01));          // a thin bright band on the horizon
          float s = max(dot(d, uSunDir), 0.0);
          col += uSunGlow * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6) * (1.0 - uNight * 0.7);
          if (uNight > 0.0 && h > 0.0) {                                             // stars: a hashed cell grid, twinkle-free
            vec3 c = floor(d * 180.0);
            float st = step(0.9965, h31(c)) * smoothstep(0.02, 0.25, h);
            col += vec3(0.9, 0.95, 1.1) * st * uNight * 1.6;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(2200, 48, 24), domeMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -20;
    this.envScene.add(new THREE.Mesh(this.dome.geometry, domeMat));

    this.clouds = new THREE.Mesh(buildCumulus(0xc10d), new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        uniform float uTime;
        varying vec3 vN; varying vec3 vW; varying float vBelly;
        attribute float belly;
        void main() {
          // slow drift: the whole ring turns about the camera (a full turn in ~3 h)
          float a = uTime * 0.0006; float c = cos(a), s = sin(a);
          vec3 p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
          vN = vec3(c * normal.x - s * normal.z, normal.y, s * normal.x + c * normal.z);
          vBelly = belly;
          vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform vec3 uHorizon; uniform vec3 uSunGlow; uniform float uNight;
        varying vec3 vN; varying vec3 vW; varying float vBelly;
        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          float NdL = dot(N, uSunDir);
          float lit = smoothstep(-0.05, 0.2, NdL) * (0.82 + 0.18 * NdL);
          vec3 col = mix(uCloudShade, uCloudLit, lit);
          col = mix(col, uCloudShade * 0.82, vBelly * 0.55);                         // darker, flatter bellies
          // silver lining: rims facing away from the eye glow when the sun sits behind the cloud
          float fres = pow(1.0 - abs(dot(N, V)), 2.5);
          float behind = pow(max(dot(-V, uSunDir), 0.0), 3.0);
          col += uSunGlow * fres * (0.25 + 1.6 * behind);
          // the lowest puffs melt into the horizon haze
          vec3 dir = normalize(vW - cameraPosition);
          col = mix(col, uHorizon, smoothstep(0.1, 0.0, dir.y) * 0.7);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -15;
    this.dome.add(this.clouds);
    return this;
  }

  update(dt: number): void { this.u.uTime.value += dt; }
}

/**
 * The cumulus ring: ~26 clusters of 5–11 icosahedron puffs each, bigger and lower toward the horizon, bases cut flat.
 * Non-indexed with flat normals, plus a `belly` attribute (1 on the underside) for the darker bases.
 */
function buildCumulus(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const pos: number[] = [], nrm: number[] = [], belly: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const clusters = 22;
  for (let k = 0; k < clusters; k++) {
    const az = (k / clusters) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const dist = rng.range(900, 1700);
    const elev = rng.range(0.05, 0.22) * (k % 3 === 0 ? 1.9 : 1);                // a few ride high in the sky
    const baseY = Math.tan(elev) * dist * 0.75;
    const cx = Math.cos(az) * dist, cz = Math.sin(az) * dist;
    const tx = -Math.sin(az), tz = Math.cos(az);                                    // along the ring (the cluster spreads sideways)
    const size = rng.range(1.1, 2.1) * (dist / 1000);
    const puffs = rng.int(6, 12);
    for (let i = 0; i < puffs; i++) {
      const along = rng.range(-1, 1) * 110 * size;
      const mid = 1 - Math.abs(along) / (170 * size);                              // the middle puffs are the big, tall ones
      const r = rng.range(26, 58) * size * mid;
      const px = cx + tx * along + rng.range(-20, 20) * size, pz = cz + tz * along + rng.range(-20, 20) * size;
      const py = baseY + r * rng.range(0.35, 0.8) + mid * mid * rng.range(0, 55) * size;   // towers
      const g = new THREE.IcosahedronGeometry(Math.max(8, r), 1);
      const ps = g.getAttribute('position');
      for (let v = 0; v < ps.count; v++) {
        let x = ps.getX(v), y = ps.getY(v), z = ps.getZ(v);
        const kk = 1 + (Math.sin(x * 0.13 + i) * Math.cos(z * 0.11 + k)) * 0.12;   // lumpy
        x *= kk * 1.15; y *= kk * 0.8; z *= kk * 1.15;
        y = Math.max(y + py, baseY);                                                 // flat bases
        ps.setXYZ(v, x + px, y, z + pz);
      }
      const p = ps; // polyhedra are non-indexed already
      for (let f = 0; f < p.count; f += 3) {
        a.fromBufferAttribute(p, f); b.fromBufferAttribute(p, f + 1); c.fromBufferAttribute(p, f + 2);
        n.subVectors(c, b).cross(b.clone().sub(a)).normalize();
        if (n.lengthSq() < 0.5) continue;
        const bel = (a.y + b.y + c.y) / 3 < baseY + 2 ? 1 : 0;
        for (const q of [a, b, c]) { pos.push(q.x, q.y, q.z); nrm.push(-n.x, -n.y, -n.z); belly.push(bel); }
      }
      g.dispose();
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('belly', new THREE.Float32BufferAttribute(belly, 1));
  return geo;
}
