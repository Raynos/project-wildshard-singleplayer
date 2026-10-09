import { rainCurtain } from '@wildshard/game/systems/looks/rainCurtain';
import { RAIN_PROGRAM } from './rainProgram';
/**
 * PineWeatherFX — what Pine Hollow's rain looks like (PH-L10): the rain around the camera with the canopy's drips in it,
 * the puddles in the ground's low spots. Everything reads `PineWeather`; nothing here decides anything. (The wet PBR is a
 * uniform in every lit shader — Atmosphere.ts `weatherUniforms.uWet` — and the rings on the pond and the creek are the
 * water program's — waterSurface.ts `waterWeather`; the sky is the clock's `PineDayNight.mod`.)
 *
 *   const fx = new PineWeatherFX({ sky, trees, roofAt, phone }).build();  scene.add(fx.group)
 *   fx.update(dt, weather, fogColor, wind, camera)   // the camera: the extras (splashes round it, drops on its lens)
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
 * THE CAVE MOUTH (E322 F-L5): the cover map's roofs reach the bear cave's passage (`roofAt` knows its footprint) but the
 * 2 m texels start it a metre in and the arch's hood stood open to the sky — a box in the cave's frame (BEAR_CAVE: the
 * mouth, the hood and the first metres in, under the arch's height) is tested exactly in the rain's vertex shader.
 *
 * A PRACTICE ROOM (the arena, a playground: `practiceRoom.open`) has none of it: no curtain, no extras (E322 F-L5, E350 F-X4).
 *
 * RAIN EXTRAS (E322 F-L5; Jake picked them, always on in the rain, none in a practice room):
 *  · splashes at the player's feet: a ring of crowns + ripples on the ground within a few metres of the eye, respawned on
 *    the CPU (≤ 96 slots, one instanced draw), none under a roof / in the cave, fewer under the crowns;
 *  · puddles off the trails too: the meadows' concave spots, appended to the same puddle mesh (a draw range, 0 draws more);
 *  · drops on the lens: ≤ 20 screen-space quads (NDC, no scene sample, no blur pass): a darker rim, the sky's light pooled
 *    in the lower half, a glint — they land while you face the open sky and bead, slide and dry.
 *
 * Draws: 0 while dry (all hidden). Raining: the rain + the puddles + the splashes + the lens = 4.
 * Programs: +3 (the rain, the splashes, the lens), built at boot (the meshes are in the scene, hidden, when the precompile
 * walks it).
 */
import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { Rng } from '@wildshard/engine/core/rng';
import { floorBelow } from '@wildshard/engine/physics/query';
import type { TreeInstance } from '@wildshard/engine/world/forest/placement';
import { normalAt, splatAt, trailDistance, cabinMask, pondMask, streamAt, inChunk } from '@wildshard/engine/world/Heightfield';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { createWaterMaterial } from '@wildshard/engine/world/waterSurface';
import { BEAR_CAVE } from '../layout';
import type { PineWeather } from './weatherProfile';

const COVER_N = 256;
/** the cave's hood in its own frame (lx across, lz into the rock; the mouth faces −lz): half width, from, to, height over
 *  the mouth's ground — the arch's opening is 2.6 × 4.8 m (caveArch.ts `openCaveArch`); the cover map takes over at lz ≈ 1.5 */
const CAVE_HOOD = { hw: 3.2, lz0: -1.4, lz1: 4.5, up: 5.6 };
/** splash slots (a ring buffer) and lens-drop slots */
const SPLASH_N = { phone: 64, desktop: 96 };
const LENS_N = { phone: 14, desktop: 20 };

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
    /** the cave's frame (x, z, cos yaw, sin yaw) and its hood box (half width, lz from, lz to, the ceiling's world y) */
    uCave: { value: new THREE.Vector4(BEAR_CAVE.x, BEAR_CAVE.z, Math.cos(BEAR_CAVE.rot), Math.sin(BEAR_CAVE.rot)) },
    uCaveBox: { value: new THREE.Vector4(CAVE_HOOD.hw, CAVE_HOOD.lz0, CAVE_HOOD.lz1, heightAt(BEAR_CAVE.x, BEAR_CAVE.z) + CAVE_HOOD.up) },
  };
  private readonly puddleFade = { value: 0 };
  private readonly rainCount: number;
  /** E322 F-L5 Rain extras: the splashes at the feet, the lens drops */
  splashes!: THREE.Mesh;
  lens!: THREE.Mesh;
  private readonly splashU = { uTime: { value: 0 }, uCol: { value: new THREE.Color(0.8, 0.84, 0.9) }, uAlpha: { value: 0.5 } };
  private splashAttr!: THREE.InstancedBufferAttribute;
  private splashNext = 0;
  private splashAcc = 0;
  private readonly lensU = {
    uAspect: { value: 1 }, uSky: { value: new THREE.Color(0.8, 0.82, 0.86) }, uGround: { value: new THREE.Color(0.2, 0.22, 0.2) },
  };
  private lensAttr!: THREE.InstancedBufferAttribute;
  private readonly drops: { x: number; y: number; r: number; age: number; life: number; vy: number; slide: number }[] = [];
  private lensAcc = 0;
  private readonly eye = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3(0, 0, -1);
  private readonly xrng: Rng;

  constructor(private readonly o: PineWeatherFXOpts) {
    this.rainCount = o.phone ? 3200 : 6000;
    this.xrng = new Rng(o.seed ^ 0x7e11);
  }

  build(): this {
    this.cover = this.buildCover();
    this.rainU.uCover.value = this.cover;
    this.rain = this.buildRain();
    this.puddles = this.buildPuddles();
    this.splashes = this.buildSplashes();
    this.lens = this.buildLens();
    this.group.add(this.rain, this.puddles, this.splashes, this.lens);
    this.group.name = 'pine-weather';
    return this;
  }

  /** crown cover (0..1) at (x, z), from the CPU copy of the cover map (the animals' shelter, the ambience) */
  coverAt(x: number, z: number): number {
    const i = Math.floor((x + CHUNK_HALF) / (2 * CHUNK_HALF) * COVER_N), j = Math.floor((z + CHUNK_HALF) / (2 * CHUNK_HALF) * COVER_N);
    if (i < 0 || j < 0 || i >= COVER_N || j >= COVER_N) return 0;
    return (this.coverData[(j * COVER_N + i) * 4] ?? 0) / 255;
  }

  /** no rain reaches (x, y, z): under a cabin's roof (the cover map's G) or in the cave's mouth / hood */
  private dryAt(x: number, y: number, z: number): boolean {
    const i = Math.floor((x + CHUNK_HALF) / (2 * CHUNK_HALF) * COVER_N), j = Math.floor((z + CHUNK_HALF) / (2 * CHUNK_HALF) * COVER_N);
    if (i >= 0 && j >= 0 && i < COVER_N && j < COVER_N && (this.coverData[(j * COVER_N + i) * 4 + 1] ?? 0) > 127) return true;
    const c = this.rainU.uCave.value, b = this.rainU.uCaveBox.value, dx = x - c.x, dz = z - c.y;
    const lx = dx * c.z - dz * c.w, lz = dx * c.w + dz * c.z;
    return Math.abs(lx) < b.x && lz > b.y && lz < b.z && y < b.w;
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
    return rainCurtain({ count: this.rainCount, seed: this.o.seed, uniforms: this.rainU, program: RAIN_PROGRAM });
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
    const trailSpots = spots.length;
    // E322 F-L5 (Rain extras): the meadows' low spots too — open (little crown over them), flat, not rock, the dips; their own
    // random stream and appended, so the trails' puddles stay exactly as they were
    const rx = new Rng(this.o.seed ^ 0x51ab), wantOff = this.o.phone ? 36 : 60;
    for (let tries = 0; tries < 40000 && spots.length < trailSpots + wantOff; tries++) {
      const x = rx.range(-CHUNK_HALF, CHUNK_HALF), z = rx.range(-CHUNK_HALF, CHUNK_HALF);
      if (!inChunk(x, z, 12) || trailDistance(x, z) <= 2.4 || this.coverAt(x, z) > 0.45) continue;
      if (cabinMask(x, z) > 0 || pondMask(x, z) > 0.01 || streamAt(x, z) !== null) continue;
      if (splatAt(x, z)[2] > 0.15 || normalAt(x, z, 1.5)[1] < 0.975) continue;
      const h = heightAt(x, z);
      const m = (heightAt(x + 2.5, z) + heightAt(x - 2.5, z) + heightAt(x, z + 2.5) + heightAt(x, z - 2.5)) / 4;
      if (h - m > -0.012) continue; // only the dips: water pools, it does not sit on a rise
      if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 100)) continue;
      spots.push({ x, z, r: rx.range(0.8, 2.0) });
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
    mesh.userData['spots'] = trailSpots;
    mesh.userData['extraSpots'] = spots.length - trailSpots;
    return mesh;
  }

  // ─────────────────────────── splashes at the feet (Rain extras) ───────────────────────────
  /**
   * One instanced draw: per slot a flat ripple ring (verts 0–3) and an upright crown of droplets facing the eye (4–7), both
   * built in the vertex shader from (x, y, z, born) and the clock; a dead slot collapses off screen.
   */
  private buildSplashes(): THREE.Mesh {
    const n = this.o.phone ? SPLASH_N.phone : SPLASH_N.desktop;
    const geo = new THREE.InstancedBufferGeometry();
    const corner = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0, -1, 0, 1, 1, 0, 1, -1, 1, 1, 1, 1, 1]);
    geo.setAttribute('position', new THREE.BufferAttribute(corner, 3)); // xy the corner, z 0 ring / 1 crown
    geo.setIndex([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6]);
    this.splashAttr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(-1e4), 4);
    this.splashAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSplash', this.splashAttr);
    geo.instanceCount = n;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.splashU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute vec4 aSplash;
        uniform float uTime;
        varying vec2 vUv; varying float vAge; varying float vKind; varying float vSeed;
        void main() {
          float age = ( uTime - aSplash.w ) / 0.42;
          vUv = position.xy; vKind = position.z; vAge = age;
          vSeed = fract( sin( dot( aSplash.xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
          if ( age < 0.0 || age > 1.0 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }
          vec3 p = aSplash.xyz;
          if ( position.z < 0.5 ) {
            float r = mix( 0.02, 0.17, sqrt( age ) ) * ( 0.7 + 0.6 * vSeed );
            p += vec3( position.x * r, 0.012, position.y * r );
          } else {
            vec3 toEye = cameraPosition - p; toEye.y = 0.0;
            vec3 side = normalize( vec3( - toEye.z, 0.0, toEye.x ) + 1e-4 );
            float w = 0.045 + 0.035 * age, h = 0.07 * ( 0.7 + 0.6 * vSeed );
            p += side * position.x * w + vec3( 0.0, position.y * h, 0.0 );
          }
          gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCol; uniform float uAlpha;
        varying vec2 vUv; varying float vAge; varying float vKind; varying float vSeed;
        void main() {
          float a;
          if ( vKind < 0.5 ) {
            // a ripple ring widening and thinning out
            float d = length( vUv );
            a = smoothstep( 0.14, 0.0, abs( d - 0.85 ) ) * ( 1.0 - vAge ) * 0.55;
          } else {
            // the crown: five droplets thrown up and out on arcs, falling back
            a = 0.0;
            for ( int i = 0; i < 5; i++ ) {
              float fi = float( i ), s = ( fi - 2.0 ) / 2.0 + ( vSeed - 0.5 ) * 0.3;
              vec2 c = vec2( s * 0.75 * vAge, 4.0 * vAge * ( 1.0 - vAge ) * ( 0.95 - 0.35 * abs( s ) ) * 1.9 - 0.9 );
              a += smoothstep( 0.16, 0.06, length( ( vUv - c ) * vec2( 1.0, 0.8 ) ) );
            }
            a *= 1.0 - vAge * vAge;
          }
          a *= uAlpha;
          if ( a < 0.01 ) discard;
          gl_FragColor = vec4( uCol, a );
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = 21; m.visible = false; m.name = 'rain-splashes';
    return m;
  }

  /** new splashes this frame round the eye (more in front of it), none where no rain lands, fewer under the crowns */
  private spawnSplashes(dt: number, rain: number): void {
    const a = this.splashAttr, arr = a.array, n = a.count, rng = this.xrng, t = this.splashU.uTime.value;
    this.splashAcc += dt * rain * (this.o.phone ? 70 : 110);
    const phys = app.physics;
    let wrote = false;
    for (let guard = 0; this.splashAcc >= 1 && guard < 12; guard++) {
      this.splashAcc -= 1;
      // a point within 7 m, weighted to the view (a cone ± 70° round the look, 3 in 4)
      const front = rng.next() < 0.75, yaw = Math.atan2(this.fwd.x, this.fwd.z) + (front ? rng.range(-1.2, 1.2) : rng.range(0, Math.PI * 2));
      const d = 0.8 + 6.2 * Math.sqrt(rng.next()), x = this.eye.x + Math.sin(yaw) * d, z = this.eye.z + Math.cos(yaw) * d;
      if (pondMask(x, z) > 0.01 || streamAt(x, z) !== null) continue; // the water has its own rings
      if (rng.next() < 0.8 * this.coverAt(x, z)) continue;             // the crowns catch most of it
      const fy = phys ? floorBelow(phys, x, z, this.eye.y + 2.5, 8) : undefined;
      if (fy !== undefined && fy > this.eye.y - 0.4) continue; // a trunk / a rock at the eye: not the ground at the feet
      const y = fy ?? heightAt(x, z);
      if (this.dryAt(x, y + 0.2, z)) continue;
      const k = this.splashNext++ % n;
      arr[k * 4] = x; arr[k * 4 + 1] = y; arr[k * 4 + 2] = z; arr[k * 4 + 3] = t + rng.range(0, 0.05);
      wrote = true;
    }
    if (this.splashAcc > 1) this.splashAcc = 1;
    if (wrote) a.needsUpdate = true;
  }

  // ─────────────────────────── drops on the lens (Rain extras) ───────────────────────────
  /** ≤ 20 quads in clip space over everything (no depth, no scene sample): see `lensDrop` in the fragment shader */
  private buildLens(): THREE.Mesh {
    const n = this.o.phone ? LENS_N.phone : LENS_N.desktop;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 1, 3, 2]);
    this.lensAttr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); // ndc x, y, radius (ndc y), alpha
    this.lensAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aDrop', this.lensAttr);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.lensU, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: /* glsl */`
        attribute vec4 aDrop;
        uniform float uAspect;
        varying vec2 vUv; varying float vA; varying float vSeed;
        void main() {
          vUv = position.xy; vA = aDrop.w;
          vSeed = fract( sin( aDrop.x * 91.3 + aDrop.y * 47.1 ) * 1753.1 );
          // a bead is a little taller than wide once it runs
          gl_Position = vec4( aDrop.xy + position.xy * aDrop.z * vec2( 1.0 / uAspect, 1.15 ), 0.0, 1.0 );
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSky; uniform vec3 uGround;
        varying vec2 vUv; varying float vA; varying float vSeed;
        void main() {
          // an uneven outline (a bead is never a circle)
          float ang = atan( vUv.y, vUv.x );
          float r = length( vUv ) * ( 1.0 + 0.07 * sin( ang * 3.0 + vSeed * 6.3 ) + 0.04 * sin( ang * 5.0 - vSeed * 4.0 ) );
          if ( r > 1.0 ) discard;
          // the lens a drop makes shows the world upside down and small: the bright sky pooled low, the dark ground high
          float body = smoothstep( 1.0, 0.0, r );
          vec3 col = mix( uGround, uSky, smoothstep( 0.5, -0.6, vUv.y ) );
          float rim = smoothstep( 0.72, 0.95, r ) * smoothstep( 1.0, 0.95, r );
          col = mix( col, uGround * 0.35, rim * 0.8 );
          float glint = smoothstep( 0.22, 0.0, length( vUv - vec2( -0.32, 0.4 ) ) );
          col += glint * 0.9;
          float a = ( 0.28 + 0.4 * rim + 0.5 * glint ) * smoothstep( 1.0, 0.9, r ) * vA * mix( 0.8, 1.0, body );
          gl_FragColor = vec4( col, a );
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = 1000; m.visible = false; m.name = 'rain-lens';
    // the screen's shape, read as it draws
    m.onBeforeRender = (_r, _s, cam) => { if (cam instanceof THREE.PerspectiveCamera) this.lensU.uAspect.value = cam.aspect; };
    return m;
  }

  /** the drops: land while the rain reaches the eye (facing the open sky: more looking up, none looking down), bead, slide, dry */
  private updateLens(dt: number, rain: number): void {
    const rng = this.xrng, max = this.lensAttr.count;
    const dry = this.dryAt(this.eye.x, this.eye.y, this.eye.z);
    const expose = dry ? 0 : rain * (1 - 0.7 * this.coverAt(this.eye.x, this.eye.z)) * THREE.MathUtils.smoothstep(this.fwd.y, -0.55, 0.25);
    this.lensAcc += dt * expose * 1.6;
    while (this.lensAcc >= 1) {
      this.lensAcc -= 1;
      if (this.drops.length >= max) break;
      this.drops.push({ x: rng.range(-0.95, 0.95), y: rng.range(-0.8, 0.95), r: rng.range(0.018, 0.05), age: 0, life: rng.range(2.5, 6), vy: 0, slide: rng.next() < 0.35 ? rng.range(0.6, 1.4) : 0 });
    }
    if (this.lensAcc > 1) this.lensAcc = 1;
    const arr = this.lensAttr.array;
    let k = 0;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d === undefined) continue;
      d.age += dt * (dry ? 3 : 1); // under a roof they dry off quicker
      // a big bead lets go after a beat and runs down, slowing as it thins
      if (d.slide > 0 && d.age > d.slide) { d.vy = Math.min(0.35, d.vy + dt * 0.5); d.y -= d.vy * dt * d.r * 12; }
      if (d.age >= d.life || d.y < -1.1) { this.drops.splice(i, 1); continue; }
    }
    for (const d of this.drops) {
      const fade = Math.min(1, d.age / 0.12) * (1 - THREE.MathUtils.smoothstep(d.age, d.life * 0.6, d.life));
      arr[k * 4] = d.x; arr[k * 4 + 1] = d.y; arr[k * 4 + 2] = d.r * (1 - 0.3 * Math.min(1, d.vy / 0.35)); arr[k * 4 + 3] = fade;
      k++;
    }
    const geo = this.lens.geometry;
    if (geo instanceof THREE.InstancedBufferGeometry) geo.instanceCount = k;
    this.lensAttr.needsUpdate = k > 0;
    this.lens.visible = k > 0;
  }

  // ─────────────────────────────── per frame ───────────────────────────────
  /** `fogColor` the scene fog's (the rain's tint), `wind` the world wind (m/s, xz) for the slant, `cam` the view (the extras) */
  update(dt: number, w: PineWeather, fogColor: THREE.Color, wind: { x: number; z: number }, cam?: THREE.Camera): void {
    // E350 F-X4: the curtain is camera-local, so it followed the eye into a practice room (the arena's hall, a playground):
    // none there, like the extras below; it is back the frame the room closes (`practiceRoom.open`, E321)
    const rainOn = w.rain > 0.01 && !practiceRoom.open;
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
    // E322 F-L5: the extras — none in a practice room (E321: its x / z is no spot on the shard)
    if (practiceRoom.open) { this.splashes.visible = false; this.lens.visible = false; this.drops.length = 0; return; }
    if (cam) { cam.getWorldPosition(this.eye); cam.getWorldDirection(this.fwd); }
    this.splashU.uTime.value += dt;
    this.splashes.visible = rainOn;
    if (rainOn) {
      this.splashU.uCol.value.copy(fogColor).multiplyScalar(1.4).addScalar(0.05);
      this.splashU.uAlpha.value = 0.24 + 0.26 * w.rain;
      this.spawnSplashes(dt, w.rain);
      this.lensU.uSky.value.copy(fogColor).multiplyScalar(1.45).addScalar(0.06);
      this.lensU.uGround.value.copy(fogColor).multiplyScalar(0.35);
    }
    this.updateLens(dt, rainOn ? w.rain : 0);
  }
}
