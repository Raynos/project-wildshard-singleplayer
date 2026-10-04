import { app } from '@wildshard/engine/app/runtime';
import type { Game } from '@wildshard/engine/core/Game';
import { ParticlePool, pointScale } from '@wildshard/engine/fx/ParticlePool';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

import * as THREE from 'three';


export type FxRenderer = Pick<Game['renderer'], 'getDrawingBufferSize'>;

/**
 * Night FX — the particle systems the dusk and night enemies share (row B11): one pooled `THREE.Points` each (the one
 * `ParticlePool`, E357 X5), one draw call, no per-frame allocation.
 *
 *   const fx = new NightParticles(scene, 'debris')   // soil clumps, stone chips, dust — normal blending, lit by `light`
 *   const fx = new NightParticles(scene, 'mist')     // cyan ghost mist, embers — additive, self-lit
 *   fx.emit(x, y, z, vx, vy, vz, life, size, r, g, b, flags)   // one particle (FLAG_GRAVITY / FLAG_BOUNCE / FLAG_GROW / FLAG_RISE)
 *   fx.burst(center, n, speed, up, ...)             // a spray
 *   fx.light = 0..1                                  // debris only: the scene's light level (dim at dusk / night)
 *   fx.update(dt, renderer, camera)
 */

export const FLAG_GRAVITY = 1, FLAG_BOUNCE = 2, FLAG_GROW = 4, FLAG_RISE = 8;
const MAX = 900;

export class NightParticles {
  readonly points: THREE.Points;
  /** 0..1, the debris' light (the painterly world dims at dusk; unlit points would glow otherwise) */
  light = 1;
  private readonly pool: ParticlePool<'aSize' | 'aAlpha' | 'aColor'>;
  private readonly maxLife = new Float32Array(MAX);
  private readonly size0 = new Float32Array(MAX);
  private readonly flags = new Uint8Array(MAX);
  private readonly uScale: THREE.IUniform<number> = { value: 400 };
  private readonly uLight: THREE.IUniform<number> = { value: 1 };
  private live = 0;

  constructor(scene: THREE.Scene, readonly mode: 'debris' | 'mist') {
    const mist = mode === 'mist';
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uScale, uLight: this.uLight },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vA = aAlpha * (aSize > 0.45 ? 0.3 : 1.0); vC = aColor;   /* a big soft particle (dust, mist) is thin */ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(aSize * uScale / max(0.05, -mv.z), aSize > 0.45 ? 220.0 : 26.0);   /* a clod by the lens is a speck, not a disc */ gl_Position = projectionMatrix * mv; }`,
      // debris: a lumpy clump (a squashed disc with a darker lower half, the light from above); mist: a soft round puff
      fragmentShader: mist
        ? `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0 || vA <= 0.002) discard; float a = (1.0 - r); a *= a; gl_FragColor = vec4(vC * a * vA, 1.0); }`
        : `varying float vA; varying vec3 vC; uniform float uLight; void main(){ vec2 d = gl_PointCoord - 0.5; float r = max(abs(d.x) * 1.7 + abs(d.y) * 0.9, length(d) * 2.1); if (r > 1.0 || vA <= 0.002) discard; float shade = 0.72 + 0.5 * (0.5 - d.y); gl_FragColor = vec4(vC * shade * uLight, vA * smoothstep(1.0, 0.8, r)); }`,
      transparent: true, depthWrite: false,
      blending: mist ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    mat.name = `night-${mode}`;
    this.pool = new ParticlePool({
      capacity: MAX, material: mat, renderOrder: mist ? 12 : 11,
      attributes: { aSize: { itemSize: 1, dynamic: true }, aAlpha: { itemSize: 1, dynamic: true }, aColor: { itemSize: 3, dynamic: true } },
    });
    this.points = this.pool.points;
    this.points.name = `night-${mode}`;
    scene.add(this.points);
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, r: number, g: number, b: number, flags = 0): void {
    const { pool } = this, { pos, vel } = pool, { aSize, aAlpha, aColor } = pool.data;
    const i = pool.claim();
    const j = i * 3;
    pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
    vel[j] = vx; vel[j + 1] = vy; vel[j + 2] = vz;
    pool.life[i] = life; this.maxLife[i] = life;
    aSize[i] = size; this.size0[i] = size;
    aColor[j] = r; aColor[j + 1] = g; aColor[j + 2] = b;
    aAlpha[i] = 1; this.flags[i] = flags;
    pool.attr.aColor.needsUpdate = true;
    this.live = MAX;
  }

  /** a spray from `c`: `n` particles, horizontal speed up to `speed`, upward `up` (± 40 %), each coloured round `rgb` (± `jitter`) */
  burst(c: THREE.Vector3, n: number, speed: number, up: number, life: number, size: number, rgb: readonly [number, number, number], jitter: number, flags: number, spread = 0.2): void {
    for (let k = 0; k < n; k++) {
      const a = app.rng.stream('cosmetic').next() * Math.PI * 2, s = speed * (0.3 + app.rng.stream('cosmetic').next() * 0.7), j = 1 - jitter + app.rng.stream('cosmetic').next() * jitter * 2;
      this.emit(c.x + Math.cos(a) * spread * app.rng.stream('cosmetic').next(), c.y + app.rng.stream('cosmetic').next() * spread, c.z + Math.sin(a) * spread * app.rng.stream('cosmetic').next(),
        Math.cos(a) * s, up * (0.6 + app.rng.stream('cosmetic').next() * 0.8), Math.sin(a) * s, life * (0.6 + app.rng.stream('cosmetic').next() * 0.8), size * (0.6 + app.rng.stream('cosmetic').next() * 0.8),
        rgb[0] * j, rgb[1] * j, rgb[2] * j, flags);
    }
  }

  update(dt: number, renderer: FxRenderer, camera: THREE.PerspectiveCamera): void {
    this.uLight.value = this.light;
    if (this.live <= 0) return;
    this.uScale.value = pointScale(renderer, camera);
    let any = 0;
    const { pool } = this, P = pool.pos, V = pool.vel, L = pool.life, { aSize, aAlpha } = pool.data;
    for (let i = 0; i < MAX; i++) {
      const l0 = L[i] ?? 0;
      if (l0 <= 0) continue;
      any++;
      const l = l0 - dt; L[i] = l;
      const j = i * 3, f = this.flags[i] ?? 0;
      let vx = V[j] ?? 0, vy = V[j + 1] ?? 0, vz = V[j + 2] ?? 0;
      if (f & FLAG_GRAVITY) vy -= 9.8 * dt;
      if (f & FLAG_RISE) vy += 0.6 * dt;
      const drag = f & FLAG_GRAVITY ? 0.995 : 0.965;
      vx *= drag; vz *= drag; if (!(f & FLAG_GRAVITY)) vy *= drag;
      const x = (P[j] ?? 0) + vx * dt, z = (P[j + 2] ?? 0) + vz * dt;
      let y = (P[j + 1] ?? 0) + vy * dt;
      if (f & FLAG_BOUNCE) {
        const gy = heightAt(x, z) + 0.03;
        if (y < gy) { y = gy; vy = Math.abs(vy) * 0.25; vx *= 0.45; vz *= 0.45; if (Math.abs(vy) < 0.4) { vy = 0; vx *= 0.5; vz *= 0.5; } }
      }
      V[j] = vx; V[j + 1] = vy; V[j + 2] = vz;
      P[j] = x; P[j + 1] = y; P[j + 2] = z;
      const k = l > 0 ? l / (this.maxLife[i] ?? 1) : 0;
      aAlpha[i] = this.mode === 'mist' ? Math.min(1, k * 2.2) * Math.min(1, (1 - k) * 6 + 0.2) : Math.min(1, k * 4);
      if (f & FLAG_GROW) aSize[i] = (this.size0[i] ?? 0) * (1 + (1 - k) * 2.2);
    }
    this.live = any;
    pool.posAttr.needsUpdate = true; pool.attr.aAlpha.needsUpdate = true; pool.attr.aSize.needsUpdate = true;
  }
}
