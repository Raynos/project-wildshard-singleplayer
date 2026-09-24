import * as THREE from 'three';
import { CHUNK_DEPTH } from '../core/config';
import { Noise2D } from '../core/noise';
import { attachFogUniforms } from './Atmosphere';
import type { Sky } from './Sky';
import { getActiveChunk } from '../chunks/registry';

/**
 * The far light, shared by every ring and the cloud sea: the fixed skies keep these values; Pine Hollow's day / night clock
 * (PineDayNight.ts) turns them with the hour (uniform objects, so no program changes).
 */
export const horizonLight = {
  uHazeCol: { value: new THREE.Color(0.5, 0.58, 0.74) },
  uSeaSky: { value: new THREE.Color(0.55, 0.62, 0.75) },
  uSeaSun: { value: new THREE.Color(1.0, 0.75, 0.45) },
  uSeaSunDir: { value: new THREE.Vector3(0, 1, 0) },
};

/**
 * What lies beyond the chunk: a sea of clouds far below the slab (the Wildshard grid hangs in
 * the sky) and three rings of mountain ridges on the horizon, drawn as fogged silhouettes.
 * All of it moves with the camera on XZ so it never parallaxes wrong up close.
 * Over an open-water shard (`ChunkDef.ocean`) the ridges become a scatter of distant rocky islets
 * and sea stacks (most of each ring is gated below the sea) and there is no cloud sea — the
 * Ocean surface runs to the horizon instead.
 */
export class Horizon {
  group = new THREE.Group();
  private cloudSea!: THREE.Mesh;
  private cloudU = { uTime: { value: 0 } };

  constructor(private sky: Sky) {}

  build(): this {
    const ocean = Boolean(getActiveChunk().ocean);
    this.buildRidges(ocean);
    if (!ocean) this.buildCloudSea();
    return this;
  }

  private buildRidges(ocean: boolean) {
    const noise = new Noise2D(777);
    const rings = ocean
      ? [
        // islets: low, sparse, greenish-grey rock; the gate keeps ~80 % of each ring under the sea
        { r: 1300, h: 90, base: -60, seg: 720, col: new THREE.Color(0.16, 0.19, 0.17), snow: 2, haze: 0.18, gate: 0.66 },
        { r: 2300, h: 140, base: -80, seg: 720, col: new THREE.Color(0.18, 0.22, 0.22), snow: 2, haze: 0.34, gate: 0.63 },
        { r: 3600, h: 200, base: -110, seg: 540, col: new THREE.Color(0.2, 0.25, 0.27), snow: 2, haze: 0.5, gate: 0.68 },
      ]
      : [
        { r: 1500, h: 150, base: -120, seg: 720, col: new THREE.Color(0.075, 0.09, 0.12), snow: 0.72, haze: 0.12, gate: -1 },
        { r: 2600, h: 330, base: -170, seg: 720, col: new THREE.Color(0.1, 0.12, 0.17), snow: 0.66, haze: 0.3, gate: -1 },
        { r: 4200, h: 560, base: -230, seg: 540, col: new THREE.Color(0.13, 0.16, 0.22), snow: 0.6, haze: 0.48, gate: -1 },
      ];
    rings.forEach((ring, ri) => {
      // a ring-shaped strip: bottom edge below the horizon, top edge = ridge line
      const geo = new THREE.BufferGeometry();
      const pos: number[] = [], col: number[] = [], idx: number[] = [], nrm: number[] = [];
      const profile: number[] = [];
      for (let i = 0; i <= ring.seg; i++) {
        const a = (i / ring.seg) * Math.PI * 2;
        const cx = Math.cos(a), sz = Math.sin(a);
        // ridged multifractal along the circle for sharp peaks + a slow massif envelope
        let h = 0, amp = 1, f = 3 + ri * 1.5, norm = 0;
        for (let o = 0; o < 6; o++) { const nv = 1 - Math.abs(noise.get(cx * f + ri * 9.1, sz * f + ri * 3.7)); h += nv * nv * amp; norm += amp; amp *= 0.5; f *= 2.1; }
        h /= norm;
        const massif = noise.get(cx * 1.3 + ri * 4, sz * 1.3) * 0.5 + 0.5;
        // islets: a slow gate noise decides where an island breaks the surface at all
        const gate = ring.gate < 0 ? 1 : THREE.MathUtils.smoothstep(noise.get(cx * 5.0 + ri * 11.3, sz * 5.0 + 5.1) * 0.5 + 0.5, ring.gate, ring.gate + 0.2);
        profile.push(h * (0.45 + massif * 0.9) * gate);
      }
      const maxH = Math.max(...profile);
      for (let i = 0; i <= ring.seg; i++) {
        const a = (i / ring.seg) * Math.PI * 2;
        const x = Math.cos(a) * ring.r, z = Math.sin(a) * ring.r;
        const h = profile[i] ?? 0;
        const peak = ring.gate < 0 ? ring.base + ring.h * (0.25 + h) : h > 0.001 ? 4 + ring.h * h : ring.base;
        pos.push(x, ring.base - 600, z, x, peak, z);
        // slope-facing normal from the neighbouring peaks so the sun side reads lighter
        const hl = profile[(i + ring.seg - 1) % ring.seg] ?? 0, hr = profile[(i + 1) % ring.seg] ?? 0;
        const tilt = (hl - hr) * ring.seg * 0.03;
        const nx = -Math.cos(a) + Math.sin(a) * tilt, nz = -Math.sin(a) - Math.cos(a) * tilt;
        nrm.push(nx, 0.2, nz, nx, 0.5, nz);
        const snow = THREE.MathUtils.smoothstep(h / maxH, ring.snow, ring.snow + 0.18) * 0.8;
        const c = ring.col;
        col.push(c.r * 1.6, c.g * 1.6, c.b * 1.7, c.r + snow * 0.5, c.g + snow * 0.48, c.b + snow * 0.42);
      }
      for (let i = 0; i < ring.seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      mat.onBeforeCompile = (shader) => {
        attachFogUniforms(shader);
        shader.uniforms['uHaze'] = { value: ring.haze }; // per ring as a uniform, so the three rings share one program
        if (!ocean) shader.uniforms['uHazeCol'] = horizonLight.uHazeCol; // the open-water shard's source stays byte-for-byte (its constant haze)
        // aerial perspective: far ranges dissolve into a cool blue haze, warmer toward the sun
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', ocean ? '#include <common>\nuniform float uHaze;' : '#include <common>\nuniform float uHaze; uniform vec3 uHazeCol;')
          .replace('#include <fog_fragment>', `
          {
            vec3 ray = normalize(vFogWorldPos - cameraPosition);
            float sunAmt = max(dot(ray, fogSunDir), 0.0);
            vec3 hazeCol = mix(${ocean ? 'vec3(0.5, 0.58, 0.74)' : 'uHazeCol'}, fogSunColor * 0.9, pow(sunAmt, 3.0) * 0.7);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeCol, uHaze);
          }`);
      };
      mat.name = `ridge${ri}`;
      mat.customProgramCacheKey = () => 'ridge';
      this.sky.setupMaterial(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
    });
  }

  private buildCloudSea() {
    const size = 12000;
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const tex = cloudNoise();
    horizonLight.uSeaSunDir.value.copy(this.sky.sunDir);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.cloudU, tNoise: { value: tex }, uSun: horizonLight.uSeaSunDir, uSunColor: horizonLight.uSeaSun, uSky: horizonLight.uSeaSky },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vW;
        void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tNoise; uniform float uTime; uniform vec3 uSun; uniform vec3 uSunColor; uniform vec3 uSky;
        varying vec3 vW;
        void main() {
          vec2 p = vW.xz * 0.00035 + vec2(uTime * 0.0006, uTime * 0.0003);
          float a = texture2D(tNoise, p).r;
          float b = texture2D(tNoise, p * 3.7 + 0.3).r;
          float c = texture2D(tNoise, p * 11.0 - 0.2).r;
          float d = a * 0.6 + b * 0.28 + c * 0.12;
          float cover = smoothstep(0.42, 0.7, d);
          // fake lighting: sun-facing slopes of the noise field catch the low sun
          float dx = texture2D(tNoise, p + vec2(0.004, 0.0)).r - a;
          float lit = clamp(0.5 + dx * 40.0 * uSun.x, 0.0, 1.0);
          vec3 col = mix(uSky * 0.8, mix(vec3(0.72, 0.74, 0.8), uSunColor * 1.2, lit), cover);
          float dist = length(vW.xz - cameraPosition.xz);
          float fade = smoothstep(9000.0, 2000.0, dist);
          gl_FragColor = vec4(col, (0.55 + 0.45 * cover) * fade);
        }`,
    });
    this.cloudSea = new THREE.Mesh(geo, mat);
    this.cloudSea.position.y = -CHUNK_DEPTH - 140;
    this.cloudSea.frustumCulled = false;
    this.cloudSea.renderOrder = -5;
    this.group.add(this.cloudSea);
  }

  update(dt: number, camera: THREE.Camera): void {
    this.cloudU.uTime.value += dt;
    this.group.position.x = camera.position.x;
    this.group.position.z = camera.position.z;
  }
}

function cloudNoise() {
  const N = 256;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  if (!g) throw new Error('[horizon] no 2d canvas context');
  const img = g.createImageData(N, N);
  const n = new Noise2D(31);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // tileable by sampling on a torus
    const u = (x / N) * Math.PI * 2, v = (y / N) * Math.PI * 2;
    const px = Math.cos(u) * 2, py = Math.sin(u) * 2, pz = Math.cos(v) * 2, pw = Math.sin(v) * 2;
    let s = 0, amp = 0.5;
    for (let o = 0; o < 4; o++) { s += (n.get(px * 2 ** o + pz * 1.3 * 2 ** o, py * 2 ** o + pw * 0.7 * 2 ** o) * 0.5 + 0.5) * amp; amp *= 0.5; }
    const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = s * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
