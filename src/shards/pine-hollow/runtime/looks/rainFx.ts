import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { Rng } from '@wildshard/engine/core/rng';
import { floorBelow } from '@wildshard/engine/physics/query';
import { pondMask, streamAt } from '@wildshard/engine/world/Heightfield';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { createWaterMaterial } from '@wildshard/engine/world/waterSurface';
import { fetchLaneBake } from '@wildshard/game/plugin/geometry';
import { GeometryPack, packedRows, type PackedGeometryJson } from '@wildshard/sdk/kit/geometryPack';
import { rainCurtainGeometry } from '@wildshard/game/systems/looks/rainCurtain';
import { pineLook, setPineLookParam, setPineLookTexture } from './graphLooks';

/**
 * A wooded level's rain as rows (SHARD-PLATFORM M3): the rain round the camera with the canopy's drips in it, the puddles in
 * the ground's low spots, the splashes at the player's feet and the drops on the lens. Everything reads a weather reading
 * (rain, wet); nothing here decides anything. The shard gives its sizes and its three graphs' look.materials ids as data,
 * its bake, where its roofs are and, optionally, one hood (a cave's mouth) where no rain falls.
 *
 *   const fx = new RainFx({ sky, roofAt, phone, seed, look, programs, baked, hood }).build();  scene.add(fx.group)
 *   fx.update(dt, weather, fogColor, wind, camera)   // the camera: the extras (splashes round it, drops on its lens)
 *
 * THE RAIN: a camera-local curtain (`rainCurtainGeometry`) — N streak quads in a box round the eye, world-anchored by a
 * wrapped offset (no CPU per drop), built in the vertex stage of the `programs.rain` graph (data/weatherLook.ts), the
 * count following the intensity. The COVER MAP: a `coverN`² texture over the slab of the crowns (R, baked from the trees)
 * and the roofs (G, `roofAt`), lent to that graph: it stops the rain under a roof and turns most of it under the crowns
 * into drips off the needles, in the same draw; the hood's frame and box are its `cave` / `caveBox` params.
 * THE PUDDLES: irregular draped discs in the concave spots of the roads and trails (and the open meadows' dips after them),
 * merged into one mesh drawn by the water's own program at a fading alpha: 0 new programs. They and the crowns' half of the
 * cover map are baked offline (generators/bake-pine-rain.mjs over the page's ground and forest; `loadRainBake`), so the
 * page builds only the roofs' half.
 * THE EXTRAS: the splashes (a ring of crowns + ripples on the ground within a few metres of the eye, respawned on the CPU,
 * one instanced draw; none under a roof or the hood, fewer under the crowns) and the lens drops (screen-space quads in
 * the `programs.lens` graph: they land while you face the open sky and bead, slide
 * and dry).
 *
 * A practice room (`practiceRoom.open`) has none of it. Draws: 0 while dry (all hidden); raining: the rain + the puddles +
 * the splashes + the lens = 4. Programs: +3 (the curtain, splash and lens graphs, compiled with the shard's other looks).
 */

/** A count per device tier. */
export interface TierCount { readonly phone: number; readonly desktop: number }

/** The rain's sizes as data: the cover map's texels, the streaks, the splash and lens-drop slots. */
export interface RainFxLook {
  readonly coverN: number;
  readonly streaks: TierCount;
  readonly splashes: TierCount;
  readonly lensDrops: TierCount;
}

/** The offline bake: the merged puddles (position, `aWater`, index) and the crowns' cover (the R byte per texel). */
export interface RainBake { readonly puddles: THREE.BufferGeometry; readonly crowns: Float32Array }

/** Fetch a tier's rain bake (a lane-shuffled geometry pack: the puddles, then the crowns' floats). */
export async function loadRainBake(url: string, rows: PackedGeometryJson): Promise<RainBake> {
  const pack = new GeometryPack(await fetchLaneBake(url), packedRows(rows), 'rain');
  return { puddles: pack.geometry(0), crowns: pack.floats(1) };
}

/** The look.materials ids of the rain's graphs: the curtain, the splashes and the lens drops. */
export interface RainFxPrograms { readonly rain: string; readonly splash: string; readonly lens: string }

/** A hood where no rain falls: a box in a frame at (x, z) turned by `rot` (lx across, lz in), under `top` (world y). */
export interface RainHood { readonly x: number; readonly z: number; readonly rot: number; readonly hw: number; readonly lz0: number; readonly lz1: number; readonly top: number }

/** What the rain reads each frame: how hard it rains and how wet the ground is (0..1). */
export interface RainReading { readonly rain: number; readonly wet: number }

/** What a rain system is built from. */
export interface RainFxOptions {
  /** the group's name (a capture finds it by it) */
  name: string;
  sky: Sky;
  /** a roof over (x, z) */
  roofAt: (x: number, z: number) => boolean;
  phone: boolean;
  seed: number;
  look: RainFxLook;
  programs: RainFxPrograms;
  baked: RainBake;
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
  /** the hood's frame (x, z, cos yaw, sin yaw) and box (half width, lz from, lz to, ceiling y); all 0 with none */
  private readonly cave = new THREE.Vector4();
  private readonly caveBox = new THREE.Vector4();
  /** the curtain's wrapped world offset and fall velocity */
  private readonly offset = new THREE.Vector3();
  private readonly vel = new THREE.Vector3();
  private readonly puddleFade = { value: 0 };
  private readonly rainCount: number;
  /** the splashes at the feet */
  splashes!: THREE.Mesh;
  /** the drops on the lens */
  lens!: THREE.Mesh;
  /** the splashes' clock (s): a slot's born time is on it */
  private splashTime = 0;
  private splashAttr!: THREE.InstancedBufferAttribute;
  private splashNext = 0;
  private splashAcc = 0;
  /** the lens drops' clock (s; three times as fast under a roof) and their smoothed exposure × slot share */
  private lensClock = 0;
  private lensWet = 0;
  private readonly eye = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3(0, 0, -1);
  private readonly xrng: Rng;

  /** `o`: the roofs, tier, seed, the look and programs as data, and an optional hood. */
  constructor(private readonly o: RainFxOptions) {
    this.coverN = o.look.coverN;
    this.coverData = new Uint8Array(this.coverN * this.coverN * 4);
    const hood = o.hood;
    if (hood) { this.cave.set(hood.x, hood.z, Math.cos(hood.rot), Math.sin(hood.rot)); this.caveBox.set(hood.hw, hood.lz0, hood.lz1, hood.top); }
    this.rainCount = o.phone ? o.look.streaks.phone : o.look.streaks.desktop;
    this.xrng = new Rng(o.seed ^ 0x7e11);
  }

  /** Builds the cover map and the four meshes into `group`. */
  build(): this {
    this.cover = this.buildCover();
    this.rain = this.buildRain();
    this.puddles = this.buildPuddles();
    this.splashes = this.buildSplashes();
    this.lens = this.buildLens();
    this.group.add(this.rain, this.puddles, this.splashes, this.lens);
    this.group.name = this.o.name;
    return this;
  }

  /** the cover map's byte `ch` (0 R the crowns, 1 G a roof) at (x, z); 0 off the map */
  private texel(x: number, z: number, ch: number): number {
    const N = this.coverN, i = Math.floor((x + CHUNK_HALF) / (2 * CHUNK_HALF) * N), j = Math.floor((z + CHUNK_HALF) / (2 * CHUNK_HALF) * N);
    return i < 0 || j < 0 || i >= N || j >= N ? 0 : this.coverData[(j * N + i) * 4 + ch] ?? 0;
  }

  /** crown cover (0..1) at (x, z), from the CPU copy of the cover map (the animals' shelter, the ambience) */
  coverAt(x: number, z: number): number { return this.texel(x, z, 0) / 255; }

  /** no rain reaches (x, y, z): under a roof (the cover map's G) or in the hood */
  private dryAt(x: number, y: number, z: number): boolean {
    if (this.texel(x, z, 1) > 127) return true;
    const c = this.cave, b = this.caveBox, dx = x - c.x, dz = z - c.y;
    const lx = dx * c.z - dz * c.w, lz = dx * c.w + dz * c.z;
    return Math.abs(lx) < b.x && lz > b.y && lz < b.z && y < b.w;
  }

  // ─────────────────────────── the cover map ───────────────────────────
  private buildCover(): THREE.DataTexture {
    const d = this.coverData, N = this.coverN, cell = (2 * CHUNK_HALF) / N, crowns = this.o.baked.crowns;
    for (let j = 0; j < Math.min(N, 1024); j++) for (let i = 0; i < Math.min(N, 1024); i++) {
      const k = j * N + i;
      d[k * 4] = crowns[k] ?? 0;
      d[k * 4 + 1] = this.o.roofAt(-CHUNK_HALF + (i + 0.5) * cell, -CHUNK_HALF + (j + 0.5) * cell) ? 255 : 0;
      d[k * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  // ─────────────────────────── rain around the camera ───────────────────────────
  /** the streak quads in the `programs.rain` graph, lent the cover map and given the hood once */
  private buildRain(): THREE.Mesh {
    const id = this.o.programs.rain;
    setPineLookTexture(id, 'cover', this.cover);
    setPineLookParam(id, 'coverK', 1 / (2 * CHUNK_HALF));
    setPineLookParam(id, 'cave', this.cave.toArray());
    setPineLookParam(id, 'caveBox', this.caveBox.toArray());
    const m = new THREE.Mesh(rainCurtainGeometry(this.rainCount, this.o.seed, 'aSeed'), pineLook(id));
    m.frustumCulled = false; m.renderOrder = 20; m.visible = false; m.name = 'rain';
    return m;
  }

  // ─────────────────────────── puddles in the low spots ───────────────────────────
  private buildPuddles(): THREE.Mesh {
    // the bake leaves out what the positions give: the uv (world x / z) and the normals
    const geo = this.o.baked.puddles, p = geo.getAttribute('position'), uv = new Float32Array(p.count * 2);
    for (let i = 0; i < Math.min(p.count, 65536); i++) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const { material } = createWaterMaterial(this.o.sky, { skyline: null, forestSinEl: 0.12, fade: this.puddleFade });
    material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -4; // on the ground, not in it
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'puddles';
    mesh.receiveShadow = true; // the creek's flags: the same water program
    mesh.renderOrder = 4;
    mesh.visible = false;
    return mesh;
  }

  // ─────────────────────────── splashes at the feet ───────────────────────────
  /**
   * One instanced draw in the look.materials graph `programs.splash` (data/weatherLook.ts): per slot a flat ripple ring
   * (verts 0–3) and an upright crown of droplets facing the eye (4–7), both posed from (x, y, z, born) and the clock.
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
    const m = new THREE.Mesh(geo, pineLook(this.o.programs.splash));
    m.frustumCulled = false; m.renderOrder = 21; m.visible = false; m.name = 'rain-splashes';
    return m;
  }

  /** new splashes this frame round the eye (more in front of it), none where no rain lands, fewer under the crowns */
  private spawnSplashes(dt: number, rain: number): void {
    const a = this.splashAttr, arr = a.array, n = a.count, rng = this.xrng, t = this.splashTime;
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
  /** one quad a slot in clip space over everything (no depth, no scene sample); the `programs.lens` graph lands, slides
   *  and dries each slot's drops from its clock */
  private buildLens(): THREE.Mesh {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 1, 3, 2]);
    geo.instanceCount = this.o.phone ? this.o.look.lensDrops.phone : this.o.look.lensDrops.desktop;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = pineLook(this.o.programs.lens);
    mat.depthTest = false; // over everything
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = 1000; m.visible = false; m.name = 'rain-lens';
    return m;
  }

  /** the drops land while the rain reaches the eye (facing the open sky: more looking up, none looking down) and dry off
   *  three times as fast under a roof; ~6.8 drops at full exposure, as many as the slots hold at most */
  private updateLens(dt: number, rain: number): void {
    const dry = this.dryAt(this.eye.x, this.eye.y, this.eye.z), slots = this.o.phone ? this.o.look.lensDrops.phone : this.o.look.lensDrops.desktop;
    const expose = dry ? 0 : rain * (1 - 0.7 * this.coverAt(this.eye.x, this.eye.z)) * THREE.MathUtils.smoothstep(this.fwd.y, -0.55, 0.25);
    this.lensClock += dt * (dry ? 3 : 1);
    this.lensWet += (expose * Math.min(1, 6.8 / slots) - this.lensWet) * Math.min(1, dt / 2.5);
    setPineLookParam(this.o.programs.lens, 'clock', this.lensClock);
    setPineLookParam(this.o.programs.lens, 'wet', this.lensWet);
    this.lens.visible = this.lensWet > 0.002;
  }

  // ─────────────────────────────── per frame ───────────────────────────────
  private readonly v3 = [0, 0, 0];
  /** (x, y, z) as a param's vec3 (one array, copied by the param setter) */
  private xyz(x: number, y: number, z: number): number[] {
    this.v3[0] = x; this.v3[1] = y; this.v3[2] = z;
    return this.v3;
  }

  /** `wind` the world wind (m/s, xz) for the slant, `cam` the view (the extras); the rain's tints are the fog's, in its graphs */
  update(dt: number, w: RainReading, wind: { x: number; z: number }, cam?: THREE.Camera): void {
    // the curtain is camera-local, so it would follow the eye into a practice room: none there, like the extras below
    const rainOn = w.rain > 0.01 && !practiceRoom.open;
    this.rain.visible = rainOn;
    if (rainOn) {
      const id = this.o.programs.rain, o = this.offset.addScaledVector(this.vel.set(wind.x * 0.3, -9.5, wind.z * 0.3), dt);
      const R = this.o.phone ? 11 : 16, box = 2 * R;
      // keep the offset small (float precision): any whole multiple of the box wraps to itself
      o.set(((o.x % box) + box) % box, ((o.y % box) + box) % box, ((o.z % box) + box) % box);
      setPineLookParam(id, 'velocity', this.xyz(this.vel.x, this.vel.y, this.vel.z));
      setPineLookParam(id, 'offset', this.xyz(o.x, o.y, o.z));
      setPineLookParam(id, 'radius', R);
      setPineLookParam(id, 'length', 0.42 + 0.26 * w.rain);
      setPineLookParam(id, 'alpha', 0.16 + 0.2 * w.rain);
      this.rain.geometry.setDrawRange(0, Math.ceil(this.rainCount * Math.min(1, w.rain * 1.1)) * 6);
    }
    this.puddleFade.value = THREE.MathUtils.smoothstep(w.wet, 0.05, 0.6);
    this.puddles.visible = this.puddleFade.value > 0.01;
    // the extras — none in a practice room (its x / z is no spot on the level)
    if (practiceRoom.open) { this.splashes.visible = false; this.lens.visible = false; this.lensWet = 0; return; }
    if (cam) { cam.getWorldPosition(this.eye); cam.getWorldDirection(this.fwd); }
    if (cam instanceof THREE.PerspectiveCamera) setPineLookParam(this.o.programs.lens, 'aspect', cam.aspect); // the screen's shape
    this.splashTime += dt;
    setPineLookParam(this.o.programs.splash, 'time', this.splashTime);
    this.splashes.visible = rainOn;
    if (rainOn) {
      setPineLookParam(this.o.programs.splash, 'alpha', 0.24 + 0.26 * w.rain);
      this.spawnSplashes(dt, w.rain);
    }
    this.updateLens(dt, rainOn ? w.rain : 0);
  }
}
