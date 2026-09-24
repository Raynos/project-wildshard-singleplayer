/**
 * PineWeatherFX — what Pine Hollow's rain looks like (PH-L10): the rain around the camera with the canopy's drips in it,
 * the puddles in the ground's low spots. Everything reads `PineWeather`; nothing here decides anything. (The wet PBR is a
 * uniform in every lit shader — Atmosphere.ts `weatherUniforms.uWet` — and the rings on the pond and the creek are the
 * water program's — waterSurface.ts `waterWeather`; the sky is the clock's `PineDayNight.mod`.)
 *
 *   const fx = new PineWeatherFX({ sky, trees, roofAt, phone }).build();  scene.add(fx.group)
 *   fx.update(dt, weather, fogColor, wind)
 *
 * THE RAIN: Nalati's camera-local curtain (WeatherFX.buildRain) — N streak quads in a box round the eye, world-anchored by
 * a wrapped offset (no CPU per drop), built in the vertex shader, the count following the intensity. Pine Hollow's twist
 * is the COVER MAP: a 256² texture over the slab (≈ 2 m a texel) of the crowns (R, from `forest.trees`) and the roofs
 * (G, the cabins' floors + porches): under a roof no rain falls; under the crowns most of it is caught and what gets through
 * falls as fat slow-looking drips off the needles — the canopy drips, in the same draw.
 * THE PUDDLES: irregular draped discs in the concave spots of the roads and trails, merged into one mesh drawn by the
 * water's own program ('ph-water': the clock's sky in them, the rain's rings, a dark wet rim) at a fading alpha: 0 new
 * programs.
 *
 * Draws: 0 while dry (both hidden). Raining: the rain + the puddles = 2. Programs: +1 (the rain), built at boot (the meshes
 * are in the scene, hidden, when the precompile walks it).
 */
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { CHUNK_HALF } from '../core/config';
import { attachFogUniforms } from './Atmosphere';
import { fogGLSL } from './Particles';
import { heightAt, trailDistance, cabinMask, pondMask, streamAt, inChunk } from './Heightfield';
import { createWaterMaterial } from './waterSurface';
import type { Sky } from './Sky';
import type { TreeInstance } from './placement';
import type { PineWeather } from './PineWeather';

const COVER_N = 256;

export interface PineWeatherFXOpts {
  sky: Sky;
  trees: readonly TreeInstance[];
  /** a roof over (x, z) (a cabin's floor / porch deck under it) */
  roofAt: (x: number, z: number) => boolean;
  phone: boolean;
  seed: number;
}

export class PineWeatherFX {
  readonly group = new THREE.Group();
  rain!: THREE.Mesh;
  puddles!: THREE.Mesh;
  /** R = crown cover 0..1, G = roof; world x/z → uv = (p + CHUNK_HALF) / (2 CHUNK_HALF) */
  cover!: THREE.DataTexture;
  private coverData = new Uint8Array(COVER_N * COVER_N * 4);
  private readonly rainU = {
    uOffset: { value: new THREE.Vector3() }, uR: { value: 16 }, uVel: { value: new THREE.Vector3(0, -9, 0) }, uLen: { value: 0.9 },
    uCol: { value: new THREE.Color(0.6, 0.65, 0.75) }, uAlpha: { value: 0.3 }, uWidth: { value: 0.012 },
    uCover: { value: null as THREE.Texture | null }, uCoverK: { value: 1 / (2 * CHUNK_HALF) },
  };
  private readonly puddleFade = { value: 0 };
  private readonly rainCount: number;

  constructor(private readonly o: PineWeatherFXOpts) {
    this.rainCount = o.phone ? 3200 : 6000;
  }

  build(): this {
    this.cover = this.buildCover();
    this.rainU.uCover.value = this.cover;
    this.rain = this.buildRain();
    this.puddles = this.buildPuddles();
    this.group.add(this.rain, this.puddles);
    this.group.name = 'pine-weather';
    return this;
  }

  /** crown cover (0..1) at (x, z), from the CPU copy of the cover map (the animals' shelter, the ambience) */
  coverAt(x: number, z: number): number {
    const i = Math.floor((x + CHUNK_HALF) / (2 * CHUNK_HALF) * COVER_N), j = Math.floor((z + CHUNK_HALF) / (2 * CHUNK_HALF) * COVER_N);
    if (i < 0 || j < 0 || i >= COVER_N || j >= COVER_N) return 0;
    return (this.coverData[(j * COVER_N + i) * 4] ?? 0) / 255;
  }

  // ─────────────────────────── the cover map ───────────────────────────
  private buildCover(): THREE.DataTexture {
    const d = this.coverData, N = COVER_N, cell = (2 * CHUNK_HALF) / N;
    const cov = new Float32Array(N * N);
    for (const t of this.o.trees) {
      const r = Math.max(1.6, 0.16 * t.height + 0.8), i0 = (t.x + CHUNK_HALF) / cell, j0 = (t.z + CHUNK_HALF) / cell, rc = r / cell;
      for (let j = Math.max(0, Math.floor(j0 - rc)); j <= Math.min(N - 1, Math.ceil(j0 + rc)); j++) {
        for (let i = Math.max(0, Math.floor(i0 - rc)); i <= Math.min(N - 1, Math.ceil(i0 + rc)); i++) {
          const q = Math.hypot(i + 0.5 - i0, j + 0.5 - j0) / rc;
          if (q >= 1) continue;
          const k = j * N + i;
          cov[k] = Math.min(1, (cov[k] ?? 0) + 0.85 * (1 - q * q));
        }
      }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = -CHUNK_HALF + (i + 0.5) * cell, z = -CHUNK_HALF + (j + 0.5) * cell;
      d[k * 4] = Math.round((cov[k] ?? 0) * 255);
      d[k * 4 + 1] = this.o.roofAt(x, z) ? 255 : 0;
      d[k * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  // ─────────────────────────── rain around the camera ───────────────────────────
  private buildRain(): THREE.Mesh {
    const n = this.rainCount, rng = new Rng(this.o.seed ^ 0x2a1);
    const seed = new Float32Array(n * 4 * 4), corner = new Float32Array(n * 4 * 2), idx = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const sx = rng.next(), sy = rng.next(), sz = rng.next(), sp = rng.range(0.85, 1.2);
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        seed[v * 4] = sx; seed[v * 4 + 1] = sy; seed[v * 4 + 2] = sz; seed[v * 4 + 3] = sp;
        corner[v * 2] = k & 1 ? 1 : -1; corner[v * 2 + 1] = k < 2 ? 0 : 1;
      }
      const b = i * 4;
      idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3)); // unused (the shader builds it)
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const uniforms: Record<string, THREE.IUniform> = { ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), ...this.rainU };
    attachFogUniforms({ uniforms });
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, // screen-built quads: either winding
      vertexShader: /* glsl */`
        attribute vec4 seed; attribute vec2 corner;
        uniform vec3 uOffset; uniform float uR; uniform vec3 uVel; uniform float uLen; uniform float uWidth;
        uniform sampler2D uCover; uniform float uCoverK;
        varying float vA; varying vec3 vW; varying float vDrip;
        void main() {
          float R = uR;
          vec3 p = seed.xyz * 2.0 * R + uOffset * seed.w;
          vec3 c = cameraPosition + vec3( 0.0, 2.0, 0.0 );
          vec3 w = mod( p - c + R, 2.0 * R ) - R + c;
          // the cover over this drop: a roof stops it; the crowns catch most of it and let the rest through as drips
          vec4 cv = texture2D( uCover, w.xz * uCoverK + 0.5 );
          float drip = smoothstep( 0.25, 0.8, cv.r );
          float keep = step( drip * 0.86, fract( seed.x * 91.7 + seed.z * 13.3 ) ) * ( 1.0 - step( 0.5, cv.g ) );
          vDrip = drip;
          vec3 v = normalize( uVel + vec3( 0.0, -3.0 * drip, 0.0 ) );   // drips fall straight: the canopy breaks the wind
          float len = mix( uLen, 0.28, drip ) * seed.w;
          vec3 a = w + v * ( corner.y * len );
          vW = a;
          vec4 mv = viewMatrix * vec4( a, 1.0 );
          vec3 vv = ( viewMatrix * vec4( v, 0.0 ) ).xyz;
          vec2 side = normalize( vec2( - vv.y, vv.x ) + 1e-5 );
          float dist = length( mv.xyz );
          mv.xy += side * corner.x * uWidth * mix( 1.0, 2.2, drip ) * max( dist, 1.0 ) * 0.12 * ( 0.6 + 0.4 * seed.w );
          vec3 off = abs( w - c );
          float edge = 1.0 - smoothstep( R * 0.65, R * 0.98, max( max( off.x, off.y ), off.z ) );
          vA = keep * edge * smoothstep( 0.5, 2.2, dist ) * ( corner.y > 0.5 ? 1.0 : 0.15 ) * mix( 1.0, 1.4, drip );
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        ${fogGLSL}
        uniform vec3 uCol; uniform float uAlpha;
        varying float vA; varying vec3 vW; varying float vDrip;
        void main() {
          float a = vA * uAlpha;
          if ( a < 0.002 ) discard;
          vec3 col = mix( uCol, atmosFogColor( vW ), atmosFogFactor( vW ) * 0.6 ) * mix( 1.0, 1.15, vDrip );
          gl_FragColor = vec4( col, a );
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = 20; m.visible = false; m.name = 'rain';
    return m;
  }

  // ─────────────────────────── puddles in the low spots ───────────────────────────
  private buildPuddles(): THREE.Mesh {
    const rng = new Rng(this.o.seed ^ 0x9dd1), want = this.o.phone ? 55 : 90;
    const spots: { x: number; z: number; r: number }[] = [];
    // the low spots on or beside the roads and trails: a point a few cm under the ground 2 m round it
    for (let tries = 0; tries < 30000 && spots.length < want; tries++) {
      const x = rng.range(-CHUNK_HALF, CHUNK_HALF), z = rng.range(-CHUNK_HALF, CHUNK_HALF);
      if (!inChunk(x, z, 12) || trailDistance(x, z) > 2.4) continue;
      if (cabinMask(x, z) > 0 || pondMask(x, z) > 0.01 || streamAt(x, z) !== null) continue;
      const h = heightAt(x, z);
      const m = (heightAt(x + 2, z) + heightAt(x - 2, z) + heightAt(x, z + 2) + heightAt(x, z - 2)) / 4;
      if (h - m > -0.006 && rng.next() > 0.1) continue; // mostly concave spots, a few anywhere on the track
      if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 49)) continue;
      spots.push({ x, z, r: rng.range(0.6, 1.5) });
    }
    // one merged mesh: each puddle a draped disc — deep centre, the water's edge, a wet dark rim, fading out
    const RINGS: readonly [number, number][] = [[0, 0.05], [0.55, 0.04], [1.0, 0.004], [1.12, -0.1], [1.35, -0.42]];
    const SEG = 14;
    const pos: number[] = [], uv: number[] = [], aw: number[] = [], idx: number[] = [];
    for (const s of spots) {
      const base = pos.length / 3, ph = rng.range(0, 6.283), ph2 = rng.range(0, 6.283), stretch = rng.range(1, 1.7), rot = rng.range(0, Math.PI);
      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (let r = 0; r < RINGS.length; r++) {
        const ring = RINGS[r] ?? [0, 0];
        const n = r === 0 ? 1 : SEG;
        for (let k = 0; k < n; k++) {
          const a = (k / SEG) * Math.PI * 2;
          const wob = 1 + 0.16 * Math.sin(a * 3 + ph) + 0.1 * Math.sin(a * 5 + ph2);
          const lx = Math.cos(a) * ring[0] * s.r * wob * stretch, lz = Math.sin(a) * ring[0] * s.r * wob;
          const x = s.x + lx * cr - lz * sr, z = s.z + lx * sr + lz * cr;
          pos.push(x, heightAt(x, z) + 0.035, z);
          uv.push(x, z);
          aw.push(ring[1], 0, 0, 45); // murky: 45 / m
        }
      }
      // the centre fan, then quads between rings
      for (let k = 0; k < SEG; k++) idx.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
      for (let r = 1; r + 1 < RINGS.length; r++) {
        const a0 = base + 1 + (r - 1) * SEG, b0 = a0 + SEG;
        for (let k = 0; k < SEG; k++) {
          const k1 = (k + 1) % SEG;
          idx.push(a0 + k, a0 + k1, b0 + k, a0 + k1, b0 + k1, b0 + k);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aWater', new THREE.Float32BufferAttribute(aw, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const { material } = createWaterMaterial(this.o.sky, { skyline: null, forestSinEl: 0.12, fade: this.puddleFade });
    material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -4; // on the ground, not in it
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'puddles';
    mesh.receiveShadow = true; // the creek's flags: the same 'ph-water' program
    mesh.renderOrder = 4;
    mesh.visible = false;
    mesh.userData['spots'] = spots.length;
    return mesh;
  }

  // ─────────────────────────────── per frame ───────────────────────────────
  /** `fogColor` the scene fog's (the rain's tint), `wind` the world wind (m/s, xz) for the slant */
  update(dt: number, w: PineWeather, fogColor: THREE.Color, wind: { x: number; z: number }): void {
    const rainOn = w.rain > 0.01;
    this.rain.visible = rainOn;
    if (rainOn) {
      const r = this.rainU;
      r.uVel.value.set(wind.x * 0.3, -9.5, wind.z * 0.3);
      r.uOffset.value.addScaledVector(r.uVel.value, dt);
      const R = this.o.phone ? 11 : 16, box = 2 * R;
      // keep the offset small (float precision): any whole multiple of the box wraps to itself
      r.uOffset.value.set(((r.uOffset.value.x % box) + box) % box, ((r.uOffset.value.y % box) + box) % box, ((r.uOffset.value.z % box) + box) % box);
      r.uR.value = R;
      r.uLen.value = 0.42 + 0.26 * w.rain;
      r.uCol.value.copy(fogColor).multiplyScalar(1.5).addScalar(0.04);
      r.uAlpha.value = 0.16 + 0.2 * w.rain;
      this.rain.geometry.setDrawRange(0, Math.ceil(this.rainCount * Math.min(1, w.rain * 1.1)) * 6);
    }
    this.puddleFade.value = THREE.MathUtils.smoothstep(w.wet, 0.05, 0.6);
    this.puddles.visible = this.puddleFade.value > 0.01;
  }
}
