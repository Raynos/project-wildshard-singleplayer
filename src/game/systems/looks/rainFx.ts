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
import { fogGLSL } from './fogProgram';
import { rainCurtain } from './rainCurtain';
import { ShaderFamily, type ShaderProgramRow } from './shaderFamily';

/**
 * A wooded level's rain as rows (SHARD-PLATFORM M3): the rain round the camera with the canopy's drips in it, the puddles in
 * the ground's low spots, the splashes at the player's feet and the drops on the lens. Everything reads a weather reading
 * (rain, wet); nothing here decides anything. The shard gives its sizes and its three programs as data, its trees, where
 * its roofs are and, optionally, one hood (a cave's mouth) where no rain falls.
 *
 *   const fx = new RainFx({ sky, trees, roofAt, phone, seed, look, programs, hood }).build();  scene.add(fx.group)
 *   fx.update(dt, weather, fogColor, wind, camera)   // the camera: the extras (splashes round it, drops on its lens)
 *
 * THE RAIN: a camera-local curtain (`rainCurtain`) — N streak quads in a box round the eye, world-anchored by a wrapped
 * offset (no CPU per drop), built in the vertex shader, the count following the intensity. The COVER MAP: a `coverN`²
 * texture over the slab of the crowns (R, from `trees`) and the roofs (G, `roofAt`): the rain program stops the rain under
 * a roof and turns most of it under the crowns into drips off the needles, in the same draw. Its uniforms: `uCover` /
 * `uCoverK` (world x/z → uv = p · k + 0.5), `uCave` (the hood's frame: x, z, cos yaw, sin yaw) and `uCaveBox` (half width,
 * lz from, lz to, the ceiling's world y; all 0 with no hood, which nothing is inside).
 * THE PUDDLES: irregular draped discs in the concave spots of the roads and trails (and the open meadows' dips after them),
 * merged into one mesh drawn by the water's own program at a fading alpha: 0 new programs.
 * THE EXTRAS: the splashes (a ring of crowns + ripples on the ground within a few metres of the eye, respawned on the CPU,
 * one instanced draw; none under a roof or the hood, fewer under the crowns) and the lens drops (screen-space quads: they
 * land while you face the open sky and bead, slide and dry).
 *
 * A practice room (`practiceRoom.open`) has none of it. Draws: 0 while dry (all hidden); raining: the rain + the puddles +
 * the splashes + the lens = 4. Programs: +3 (the rain, the splashes, the lens), built at boot (the meshes are in the scene,
 * hidden, when the precompile walks it).
 */

/** A count per device tier. */
export interface TierCount { readonly phone: number; readonly desktop: number }

/** The rain's sizes as data: the cover map's texels, the streaks, the splash and lens-drop slots, the puddles. */
export interface RainFxLook {
  readonly coverN: number;
  readonly streaks: TierCount;
  readonly splashes: TierCount;
  readonly lensDrops: TierCount;
  /** puddles on / beside the trails, then in the open dips; each a disc of `seg` sides through `rings` (radius, depth) */
  readonly puddles: { readonly trail: TierCount; readonly open: TierCount; readonly seg: number; readonly rings: readonly (readonly [number, number])[] };
}

/** The rain's three programs (`@{fog}` splices the atmosphere's fog GLSL). */
export interface RainFxPrograms {
  readonly rain: ShaderProgramRow;
  readonly splash: ShaderProgramRow;
  readonly lens: ShaderProgramRow;
}

/** A hood where no rain falls: a box in a frame at (x, z) turned by `rot` (lx across, lz in), under `top` (world y). */
export interface RainHood { readonly x: number; readonly z: number; readonly rot: number; readonly hw: number; readonly lz0: number; readonly lz1: number; readonly top: number }

/** What the rain reads each frame: how hard it rains and how wet the ground is (0..1). */
export interface RainReading { readonly rain: number; readonly wet: number }

/** What a rain system is built from. */
export interface RainFxOptions {
  /** the group's name (a capture finds it by it) */
  name: string;
  sky: Sky;
  trees: readonly TreeInstance[];
  /** a roof over (x, z) */
  roofAt: (x: number, z: number) => boolean;
  phone: boolean;
  seed: number;
  look: RainFxLook;
  programs: RainFxPrograms;
  hood?: RainHood;
}

/** The camera-local rain, the puddles, the splashes and the lens drops of a wooded level (see the module's comment). */
export class RainFx {
  /** everything it draws (hidden while dry) */
  readonly group = new THREE.Group();
  /** the curtain */
  rain!: THREE.Mesh;
  /** the merged puddle discs */
  puddles!: THREE.Mesh;
  /** R = crown cover 0..1, G = roof; world x/z → uv = (p + CHUNK_HALF) / (2 CHUNK_HALF) */
  cover!: THREE.DataTexture;
  private readonly coverN: number;
  private readonly coverData: Uint8Array;
  private readonly rainU: {
    uOffset: { value: THREE.Vector3 }; uR: { value: number }; uVel: { value: THREE.Vector3 }; uLen: { value: number };
    uCol: { value: THREE.Color }; uAlpha: { value: number }; uWidth: { value: number };
    uCover: { value: THREE.Texture | null }; uCoverK: { value: number }; uCave: { value: THREE.Vector4 }; uCaveBox: { value: THREE.Vector4 };
  };
  private readonly puddleFade = { value: 0 };
  private readonly rainCount: number;
  /** the splashes at the feet */
  splashes!: THREE.Mesh;
  /** the drops on the lens */
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
  private readonly family: ShaderFamily<keyof RainFxPrograms>;

  /** `o`: the trees, roofs, tier, seed, the look and programs as data, and an optional hood. */
  constructor(private readonly o: RainFxOptions) {
    this.coverN = o.look.coverN;
    this.coverData = new Uint8Array(this.coverN * this.coverN * 4);
    const hood = o.hood;
    this.rainU = {
      uOffset: { value: new THREE.Vector3() }, uR: { value: 16 }, uVel: { value: new THREE.Vector3(0, -9, 0) }, uLen: { value: 0.9 },
      uCol: { value: new THREE.Color(0.6, 0.65, 0.75) }, uAlpha: { value: 0.3 }, uWidth: { value: 0.012 },
      uCover: { value: null }, uCoverK: { value: 1 / (2 * CHUNK_HALF) },
      uCave: { value: hood ? new THREE.Vector4(hood.x, hood.z, Math.cos(hood.rot), Math.sin(hood.rot)) : new THREE.Vector4() },
      uCaveBox: { value: hood ? new THREE.Vector4(hood.hw, hood.lz0, hood.lz1, hood.top) : new THREE.Vector4() },
    };
    this.rainCount = o.phone ? o.look.streaks.phone : o.look.streaks.desktop;
    this.xrng = new Rng(o.seed ^ 0x7e11);
    this.family = new ShaderFamily({ fog: fogGLSL }, o.programs);
  }

  /** Builds the cover map and the four meshes into `group`. */
  build(): this {
    this.cover = this.buildCover();
    this.rainU.uCover.value = this.cover;
    this.rain = this.buildRain();
    this.puddles = this.buildPuddles();
    this.splashes = this.buildSplashes();
    this.lens = this.buildLens();
    this.group.add(this.rain, this.puddles, this.splashes, this.lens);
    this.group.name = this.o.name;
    return this;
  }

  /** crown cover (0..1) at (x, z), from the CPU copy of the cover map (the animals' shelter, the ambience) */
  coverAt(x: number, z: number): number {
    const N = this.coverN;
    const i = Math.floor((x + CHUNK_HALF) / (2 * CHUNK_HALF) * N), j = Math.floor((z + CHUNK_HALF) / (2 * CHUNK_HALF) * N);
    if (i < 0 || j < 0 || i >= N || j >= N) return 0;
    return (this.coverData[(j * N + i) * 4] ?? 0) / 255;
  }

  /** no rain reaches (x, y, z): under a roof (the cover map's G) or in the hood */
  private dryAt(x: number, y: number, z: number): boolean {
    const N = this.coverN;
    const i = Math.floor((x + CHUNK_HALF) / (2 * CHUNK_HALF) * N), j = Math.floor((z + CHUNK_HALF) / (2 * CHUNK_HALF) * N);
    if (i >= 0 && j >= 0 && i < N && j < N && (this.coverData[(j * N + i) * 4 + 1] ?? 0) > 127) return true;
    const c = this.rainU.uCave.value, b = this.rainU.uCaveBox.value, dx = x - c.x, dz = z - c.y;
    const lx = dx * c.z - dz * c.w, lz = dx * c.w + dz * c.z;
    return Math.abs(lx) < b.x && lz > b.y && lz < b.z && y < b.w;
  }

  // ─────────────────────────── the cover map ───────────────────────────
  private buildCover(): THREE.DataTexture {
    const d = this.coverData, N = this.coverN, cell = (2 * CHUNK_HALF) / N;
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
    const row = this.family.row('rain');
    return rainCurtain({ count: this.rainCount, seed: this.o.seed, uniforms: this.rainU, program: { vertexShader: this.family.glsl(row.vertex), fragmentShader: this.family.glsl(row.fragment) } });
  }

  // ─────────────────────────── puddles in the low spots ───────────────────────────
  private buildPuddles(): THREE.Mesh {
    const pl = this.o.look.puddles;
    const rng = new Rng(this.o.seed ^ 0x9dd1), want = this.o.phone ? pl.trail.phone : pl.trail.desktop;
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
    // the meadows' low spots too — open (little crown over them), flat, not rock, the dips; their own random stream and
    // appended, so the trails' puddles stay exactly as they were
    const rx = new Rng(this.o.seed ^ 0x51ab), wantOff = this.o.phone ? pl.open.phone : pl.open.desktop;
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
    const RINGS = pl.rings;
    const SEG = pl.seg;
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
    mesh.receiveShadow = true; // the creek's flags: the same water program
    mesh.renderOrder = 4;
    mesh.visible = false;
    mesh.userData['spots'] = trailSpots;
    mesh.userData['extraSpots'] = spots.length - trailSpots;
    return mesh;
  }

  // ─────────────────────────── splashes at the feet ───────────────────────────
  /**
   * One instanced draw: per slot a flat ripple ring (verts 0–3) and an upright crown of droplets facing the eye (4–7), both
   * built in the vertex shader from (x, y, z, born) and the clock; a dead slot collapses off screen.
   */
  private buildSplashes(): THREE.Mesh {
    const n = this.o.phone ? this.o.look.splashes.phone : this.o.look.splashes.desktop;
    const geo = new THREE.InstancedBufferGeometry();
    const corner = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0, -1, 0, 1, 1, 0, 1, -1, 1, 1, 1, 1, 1]);
    geo.setAttribute('position', new THREE.BufferAttribute(corner, 3)); // xy the corner, z 0 ring / 1 crown
    geo.setIndex([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6]);
    this.splashAttr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(-1e4), 4);
    this.splashAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSplash', this.splashAttr);
    geo.instanceCount = n;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = this.family.material('splash', {}, { uniforms: this.splashU });
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

  // ─────────────────────────── drops on the lens ───────────────────────────
  /** quads in clip space over everything (no depth, no scene sample) */
  private buildLens(): THREE.Mesh {
    const n = this.o.phone ? this.o.look.lensDrops.phone : this.o.look.lensDrops.desktop;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 1, 3, 2]);
    this.lensAttr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); // ndc x, y, radius (ndc y), alpha
    this.lensAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aDrop', this.lensAttr);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = this.family.material('lens', {}, { uniforms: this.lensU });
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
  update(dt: number, w: RainReading, fogColor: THREE.Color, wind: { x: number; z: number }, cam?: THREE.Camera): void {
    // the curtain is camera-local, so it would follow the eye into a practice room: none there, like the extras below
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
    // the extras — none in a practice room (its x / z is no spot on the level)
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
