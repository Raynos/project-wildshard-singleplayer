import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { Rng } from '@wildshard/engine/core/rng';
import { floorBelow } from '@wildshard/engine/physics/query';
import { pondMask, streamAt } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { installWeather, prepareWeatherDraw } from '../../world/weather';
import { WaterSurface } from '@wildshard/game/systems/looks/waterSurface';
import type { WaterSurfaceSchema } from '@wildshard/format/water';
import type { InferInput } from 'valibot';
import type { ShardContext } from '@wildshard/game/plugin/context';
import { fetchLaneBake, GeometryPack, packedRows, type PackedGeometryJson } from '@wildshard/sdk/kit/geometryPack';
import { rainCurtainGeometry } from '@wildshard/game/systems/looks/rainCurtain';
import { installChannelPrograms } from '@wildshard/game/plugin/channelPrograms';
import { graphParamRoots } from '@wildshard/game/looks/graphDaySky';
import { lentLook, pushLentParams, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';

/**
 * A wooded level's rain as rows (SHARD-PLATFORM M3): the rain round the camera with the canopy's drips in it, the puddles in
 * the ground's low spots, the splashes at the player's feet and the drops on the lens. Everything reads a weather reading
 * (rain, wet); nothing here decides anything. The shard gives its sizes and its three graphs' look.materials ids as data,
 * its bake, where its roofs are and, optionally, one hood (a cave's mouth) where no rain falls.
 *
 *   const fx = new RainFx({ roofAt, phone, seed, look, programs, baked, hood }).build();  scene.add(fx.group)
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
 * THE PARAMS the three graphs turn each frame (the fall, the clocks, the alphas, the lens's wetness) are the numeric
 * channel group `programs.channels` (generators/rainChannels.ts), over the frame's reading this fills (`seen`).
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

/** The look.materials ids of the rain's graphs (the curtain, the splashes and the lens drops) and their channel group. */
export interface RainFxPrograms { readonly rain: string; readonly splash: string; readonly lens: string; readonly channels: string }

/** A hood where no rain falls: a box in a frame at (x, z) turned by `rot` (lx across, lz in), under `top` (world y). */
export interface RainHood { readonly x: number; readonly z: number; readonly rot: number; readonly hw: number; readonly lz0: number; readonly lz1: number; readonly top: number }

/** What the rain reads each frame: how hard it rains and how wet the ground is (0..1). */
export interface RainReading { readonly rain: number; readonly wet: number }

/** What a rain system is built from. */
export interface RainFxOptions {
  /** the group's name (a capture finds it by it) */
  name: string;
  /** a roof over (x, z) */
  roofAt: (x: number, z: number) => boolean;
  phone: boolean;
  seed: number;
  look: RainFxLook;
  programs: RainFxPrograms;
  baked: RainBake;
  hood?: RainHood;
  /** the shardfile's client channel rows (the `programs.channels` group) */
  channels: unknown;
  water: InferInput<typeof WaterSurfaceSchema>;
}

/** The camera-local rain, the puddles, the splashes and the lens drops of a wooded level (see the module's comment). */
export class RainFx {
  /** Counted weather-view entry; native observations arrive as rows. */
  static async installPage(ctx: ShardContext, input: unknown): ReturnType<typeof installWeather> {
    const draw = prepareWeatherDraw(ctx, input), baked = await loadRainBake(draw.bake.url, draw.bake.rows);
    return installWeather(ctx, draw.host, new RainFx({ ...draw.options, baked }).build());
  }
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
  private readonly rainCount: number;
  /** the frame's reading the channel group reads, and its evaluation (which pushes the graphs' params) */
  private readonly seen = { on: 0, rain: 0, dry: 0, cover: 0, lookY: 0, room: 0, radius: 0, slots: 0, windX: 0, windZ: 0 };
  private frame!: (dt: number) => void;
  private param!: (id: string, name: string) => number;
  /** the splashes at the feet */
  splashes!: THREE.Mesh;
  /** the drops on the lens */
  lens!: THREE.Mesh;
  private splashAttr!: THREE.InstancedBufferAttribute;
  private splashNext = 0;
  private splashAcc = 0;
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
    this.seen.radius = o.phone ? 11 : 16; this.seen.slots = o.phone ? o.look.lensDrops.phone : o.look.lensDrops.desktop;
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
    const p = this.o.programs, params = graphParamRoots(this.o.channels, p.channels, [p.rain, p.splash, p.lens]);
    const lane = installChannelPrograms(this.o.channels, p.channels, new Map<string, unknown>([['rain', this.seen], ...params.roots]));
    this.frame = (dt) => { lane.evaluate({ time: 0, delta: dt, values: {} }); pushLentParams(params); };
    this.param = (id, name) => { const v = params.roots.get(id)?.[name]; return typeof v === 'number' ? v : 0; };
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
    setLentTexture(id, 'cover', this.cover);
    setLentParam(id, 'coverK', 1 / (2 * CHUNK_HALF));
    setLentParam(id, 'cave', this.cave.toArray());
    setLentParam(id, 'caveBox', this.caveBox.toArray());
    setLentParam(id, 'radius', this.seen.radius);
    const m = new THREE.Mesh(rainCurtainGeometry(this.rainCount, this.o.seed, 'aSeed'), lentLook(id));
    m.frustumCulled = false; m.renderOrder = 20; m.visible = false; m.name = 'rain';
    return m;
  }

  // ─────────────────────────── puddles in the low spots ───────────────────────────
  private buildPuddles(): THREE.Mesh {
    // the bake leaves out the normals; the puddle look (../../data/waterLook.ts) maps world x / z and sits on the ground
    const geo = this.o.baked.puddles;
    geo.computeVertexNormals();
    const mesh = new WaterSurface(this.o.water, { material: lentLook(this.o.water.look) }).draw(geo).mesh;
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
    const m = new THREE.Mesh(geo, lentLook(this.o.programs.splash));
    m.frustumCulled = false; m.renderOrder = 21; m.visible = false; m.name = 'rain-splashes';
    return m;
  }

  /** new splashes this frame round the eye (more in front of it), none where no rain lands, fewer under the crowns */
  private spawnSplashes(dt: number, rain: number): void {
    const a = this.splashAttr, arr = a.array, n = a.count, rng = this.xrng, t = this.param(this.o.programs.splash, 'time');
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
    const mat = lentLook(this.o.programs.lens);
    mat.depthTest = false; // over everything
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = 1000; m.visible = false; m.name = 'rain-lens';
    return m;
  }

  // ─────────────────────────────── per frame ───────────────────────────────
  /** `wind` the world wind (m/s, xz) for the slant, `cam` the view (the extras); the rain's tints are the fog's, in its graphs */
  update(dt: number, w: RainReading, wind: { x: number; z: number }, cam?: THREE.Camera): void {
    // the curtain is camera-local, so it would follow the eye into a practice room: none there, like the extras below
    const room = practiceRoom.open, rainOn = w.rain > 0.01 && !room, s = this.seen;
    if (cam && !room) { cam.getWorldPosition(this.eye); cam.getWorldDirection(this.fwd); }
    s.on = Number(rainOn); s.rain = w.rain; s.room = Number(room); s.windX = wind.x; s.windZ = wind.z; s.lookY = this.fwd.y;
    s.dry = Number(this.dryAt(this.eye.x, this.eye.y, this.eye.z)); s.cover = this.coverAt(this.eye.x, this.eye.z);
    this.frame(dt);
    this.rain.visible = rainOn;
    if (rainOn) this.rain.geometry.setDrawRange(0, Math.ceil(this.rainCount * Math.min(1, w.rain * 1.1)) * 6); // the streaks follow the intensity
    const puddles = THREE.MathUtils.smoothstep(w.wet, 0.05, 0.6);
    setLentParam(this.o.water.look, 'fade', puddles);
    this.puddles.visible = puddles > 0.01;
    // the extras — none in a practice room (its x / z is no spot on the level)
    this.splashes.visible = rainOn;
    this.lens.visible = !room && this.param(this.o.programs.lens, 'wet') > 0.002;
    if (room) return;
    if (cam instanceof THREE.PerspectiveCamera) setLentParam(this.o.programs.lens, 'aspect', cam.aspect); // the screen's shape
    if (rainOn) this.spawnSplashes(dt, w.rain);
  }
}
