import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
/**
 * Look v2 — the grass (port-v2.md step 5; the user: "the grass is not bad"): the clean-room prototype's GPU blade rings
 * and shader flowers, on the engine's own field, wind, trample and senses.
 *
 * Blades carry NO per-blade data: a ring is a grid of world-snapped square tiles round the camera, and a blade's root
 * is `tile origin + (gl_InstanceID's cell) × spacing + hash jitter`. Each ring is ONE instanced draw: the CPU culls the
 * ring's tiles against the frustum every frame and writes the visible tiles' origins into a small float texture; the
 * vertex shader finds its tile as `gl_InstanceID / bladesPerTile`. Three rings, finer near (phone 4 / 8 / 16 m tiles,
 * 0.085 / 0.20 / 0.45 m spacing, 3 / 2 / 1 segments); each ring skips the inner ring's square per blade (the tile
 * straddling it too) and the last ring fades out radially. Flowers are a fourth draw: camera-facing SDF heads
 * (buttercup, daisy, lupine spike, edelweiss) — no texture bytes. The near field (0 – ~3 m, where a blade is a big dark
 * spike on the phone's 94° lens) is a fifth draw: the painted card atlas (GRASS_CARDS) as clumps of 3 crossed quads on the
 * SDK's camera-tiled card field (`@wildshard/sdk/looks/tileField`, 2 m tiles, G395), same field / wind / trample; under
 * it ring 0 keeps only 40 % of its blades (slimmer) and the SDF heads stand down (the cards carry the flowers). Short
 * turf (< ~0.3 m) stays blades.
 *
 * Where it grows and how tall, baked once from the same functions the CPU senses read (so stealth, the wolves and
 * `grassHeightAt` see exactly the grass that is drawn):
 *   tField  the GrassField 4 m lattice itself (height, tone, bloom, drift species), GPU-bilinear = the CPU's bilinear
 *   tGround the painted ground colour under it (the roots sink into it)
 *   tMask   1 m: road beds + verges (`trailGrass`), yurt floors, the exact painted splat, × (1 − `dressingCover`),
 *           0 on spruce trunks — rebuilt when the dressing lands (`reseedGrassV2()`)
 *   tHeight 1 m: the terrain height (half float) the blades stand on
 * Bent by the one Wind (`windGust`, WIND_GLSL) and the trample map + live movers (`trampleBend`, TRAMPLE_GLSL) —
 * `update()` drives `wind.update` / `trample.push` / `trample.update`.
 *
 * Lit like the prototype: wrap diffuse from the key (the cheat key, painterly uPSunDir / uPSunRef), a sky / ground
 * hemisphere, translucency looking into the sun, self-occlusion toward the roots; fogged by the engine epilogue. The three
 * programs are look.materials graphs (data/lookGraphs.json 'nalati-grass-blades', 'nalati-grass-flowers',
 * 'nalati-grass-cards', compiled and lent by runtime/index.ts); this module culls the tiles, bakes the maps and writes
 * their params once a frame. Budget (phone): 5 draws, ~0.3 M submitted triangles (the cards ~16 k).
 */
import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { TIER } from '@wildshard/engine/core/tier';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { renderCount } from '@wildshard/engine/render/frameCounter';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import { trailDistance, splatAt } from '@wildshard/engine/world/Heightfield';
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { wind } from '@wildshard/engine/world/steppeWind';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { grassBaseHeightAt, trailGrass, grassToneAt, groundColorAt, grassBloomAt, flowerSpeciesAt } from '@wildshard/game/systems/looks/grassField';
import { trample } from '@wildshard/game/systems/looks/trample';
import { PLAYER_TRAMPLE_RADIUS, pushPlayerTrail, type PlayerTrail } from './trampleMovers';
import { dressingCover } from '../world/dressing/index';
import { bakeUniforms } from './bake';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import { loadSpecimenTexture } from '@wildshard/game/models/specimenCatalogue';
import { smoothstep } from '@wildshard/engine/core/noise';
import { tileFieldGeometry, tileOrigin, type TileCardRow } from '@wildshard/sdk/looks/tileField';
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';

const BLADES = 'nalati-grass-blades', HEADS = 'nalati-grass-flowers', CLUMPS = 'nalati-grass-cards';
const LOOKS = [BLADES, HEADS, CLUMPS] as const;

const PHONE = TIER === 'phone';

interface RingCfg { T: number; G: number; s: number; w: number; seg: number }
const RINGS: RingCfg[] = PHONE
  ? [{ T: 4, G: 8, s: 0.085, w: 0.047, seg: 3 }, { T: 8, G: 12, s: 0.2, w: 0.1, seg: 2 }, { T: 16, G: 14, s: 0.45, w: 0.2, seg: 1 }]
  : [{ T: 4, G: 8, s: 0.06, w: 0.034, seg: 3 }, { T: 8, G: 14, s: 0.15, w: 0.08, seg: 3 }, { T: 16, G: 18, s: 0.34, w: 0.16, seg: 2 }];
const FLOWERS = PHONE ? { T: 8, G: 10, s: 0.3 } : { T: 8, G: 14, s: 0.22 };
/** the near field (0 – ~3 m): painted card clumps (GRASS_CARDS), 3 crossed quads each, on the SDK tile field (`across` 2 m
 *  tiles round the camera's, so the cards reach past NEAR[1] every way); the blades thin out under them */
const CARDS = PHONE ? { T: 2, across: 5, s: 0.2 } : { T: 2, across: 5, s: 0.17 };
/** where the cards hand over to the blades (m from the camera): cards full inside NEAR[0], gone past NEAR[1] */
const NEAR = [2.3, 3.4] as const;
const MAX_TILES = 256;

// the baked maps' extents
const HN = 512, H_ORG = -256;                            // tHeight / tMask: 1 m texels over [−256, 256]
const LAT = 4, LN = Math.ceil((CHUNK_HALF * 2) / LAT) + 1; // tField / tGround: the GrassField lattice

/** the day gain of the grass light */
const GRASS_GAIN = 1.8;
/** shared uniforms (the look's updater sets the sun + hemi each frame) */
export const grassV2Uniforms = {
  uSunView: { value: new THREE.Vector3(0, 0.4, 1).normalize() },
  uHemiSky: { value: new THREE.Color(0.4, 0.46, 0.62) },
  uHemiGround: { value: new THREE.Color(0.3, 0.3, 0.16) },
  uHemiI: { value: 0.4 },
  uGrassGain: { value: GRASS_GAIN },
  /** the grass's own saturation (1 by day; the hour / storm pull it down — `grassMood`) */
  uGrassSat: { value: 1 },
  /** …and its tint (white by day; moonlit blue at night, slate in the storm) */
  uGrassTint: { value: new THREE.Color(1, 1, 1) },
  uTime: { value: 0 },
};

if (typeof window !== 'undefined') Object.assign(window, { __grassV2: grassV2Uniforms }); // live tuning, like __gradeV2

/**
 * The grass's mood for the hour and the storm (step 2 of the polish: dusk, night and storms stay painterly and dark).
 * The blades are lit with a gain (the painted-meadow read by day) that over-lights them against the terrain once the key
 * is the moon or the storm's flat fill, and their olive / lime reads neon under a slate sky. So the gain drops and the
 * colour greys with the hour and the overcast; flashes still light them (the key carries the flash).
 * `night` 0..1 (sun well down), `dusk` 0..1 (the low sun), `overcast` 0..1 (the storm).
 */
export function grassMood(night: number, dusk: number, overcast: number): void {
  const g = GRASS_GAIN * (1 - 0.18 * dusk) * (1 - 0.5 * night) * (1 - 0.52 * overcast);
  grassV2Uniforms.uGrassGain.value = g;
  grassV2Uniforms.uGrassSat.value = (1 - 0.25 * dusk) * (1 - 0.5 * night) * (1 - 0.42 * overcast);
  grassV2Uniforms.uGrassTint.value.setRGB(1 - 0.22 * night - 0.08 * overcast, 1 - 0.12 * night - 0.04 * overcast, 1 + 0.12 * night + 0.04 * overcast);
}

/** A clump's outline on the tile field: 3 crossed quads, 2 rows each (the top row bends): across −0.5 … 0.5, up 0 … 1, part = the quad */
const CLUMP: TileCardRow = {
  shape: [0, 1, 2].flatMap((k) => [0, 0.5, 1].flatMap((y) => [[-0.5, y, k], [0.5, y, k]] as const)),
  triangles: [0, 1, 2].flatMap((k) => [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4].map((i) => i + k * 6)),
};

/** one tile of blades (`per` a side, `seg` segments): aBlade = the cell's offset in the tile (m), t up the blade, side; the
 *  ring's spacing / width / fade and its card hand-over ride along per vertex, the tile origin and the inner ring's square
 *  per instance (`aTile`, `aHole`: written as the frame culls) */
function bladeTile(per: number, cfg: RingCfg, fade: readonly [number, number], near: readonly [number, number, number]): InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  const nv = cfg.seg * 2 + 1, blade: number[] = [], idx: number[] = [];
  for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) {
    const b = (j * per + i) * nv;
    for (let k = 0; k < cfg.seg; k++) { const t = k / cfg.seg; blade.push(i * cfg.s, j * cfg.s, t, -1, i * cfg.s, j * cfg.s, t, 1); }
    blade.push(i * cfg.s, j * cfg.s, 1, 0);
    for (let k = 0; k < cfg.seg - 1; k++) { const a = b + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const a = b + (cfg.seg - 1) * 2; idx.push(a, a + 1, a + 2);
  }
  return tileGeometry(g, blade, 'aBlade', idx, [cfg.s, cfg.w, fade[0], fade[1]], near);
}

/** one tile of flower heads: aHead = the cell's offset in the tile (m), the quad corner (−0.5 … 0.5, 0 … 1) */
function flowerTile(per: number, s: number, fade: readonly [number, number], near: readonly [number, number, number]): InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry(), head: number[] = [], idx: number[] = [];
  for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) {
    const b = (j * per + i) * 4;
    for (const [x, y] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]] as const) head.push(i * s, j * s, x, y);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return tileGeometry(g, head, 'aHead', idx, [s, 0, fade[0], fade[1]], near);
}

type InstancedBufferGeometry = THREE.InstancedBufferGeometry;
function tileGeometry(g: InstancedBufferGeometry, cells: number[], name: string, idx: number[], ring: readonly number[], near: readonly number[]): InstancedBufferGeometry {
  const n = cells.length / 4;
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute(name, new THREE.Float32BufferAttribute(cells, 4));
  g.setAttribute('aRing', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => ring).flat(), 4));
  g.setAttribute('aNear', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => near).flat(), 3));
  g.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(MAX_TILES * 2), 2).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aHole', new THREE.InstancedBufferAttribute(new Float32Array(MAX_TILES * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(idx);
  g.instanceCount = 0;
  return g;
}

interface Ring { T: number; G: number; mesh: THREE.Mesh; geo: InstancedBufferGeometry; half: number }

let heightTex: THREE.DataTexture | null = null;
/** the terrain height at 1 m over [−256, 256] (half float, linear) — the blades stand on it, the bake reads it */
export function terrainHeightTexture(): THREE.DataTexture {
  if (heightTex) return heightTex;
  const hd = new Uint16Array(HN * HN);
  for (let j = 0; j < HN; j++) heightRow(hd, j);
  return heightTexture(hd);
}
function heightRow(hd: Uint16Array, j: number): void { for (let i = 0; i < HN; i++) hd[j * HN + i] = THREE.DataUtils.toHalfFloat(heightAt(H_ORG + i + 0.5, H_ORG + j + 0.5)); }
/** the prepared rows as the cached texture, unless a carpet built it meanwhile */
function adoptHeightTexture(hd: Uint16Array): THREE.DataTexture { return heightTex ?? heightTexture(hd); }
function heightTexture(hd: Uint16Array): THREE.DataTexture {
  const t = new THREE.DataTexture(hd, HN, HN, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  heightTex = cacheUntilDisposed(t, () => { if (heightTex === t) heightTex = null; });
  return t;
}

/** the field lattice's two maps (height, tone, bloom, species; the painted ground colour), one lattice row at a time */
function fieldRow(fd: Uint8Array, gd: Uint8Array, j: number, rgb: [number, number, number]): void {
  for (let i = 0; i < LN; i++) {
    const x = i * LAT - CHUNK_HALF, z = j * LAT - CHUNK_HALF, k = (j * LN + i) * 4;
    // the field's own height (no trail: tMask carries the roads at 1 m)
    fd[k] = Math.round(Math.min(1, grassBaseHeightAt(x, z, Infinity) / 1.5) * 255);
    fd[k + 1] = Math.round(Math.min(1, Math.max(0, grassToneAt(x, z))) * 255);
    fd[k + 2] = Math.round(Math.min(1, Math.max(0, grassBloomAt(x, z))) * 255);
    fd[k + 3] = Math.round(Math.min(1, Math.max(0, flowerSpeciesAt(x, z))) * 255);
    groundColorAt(x, z, rgb);
    gd[k] = Math.round(Math.min(1, rgb[0]) * 255); gd[k + 1] = Math.round(Math.min(1, rgb[1]) * 255); gd[k + 2] = Math.round(Math.min(1, rgb[2]) * 255); gd[k + 3] = 255;
  }
}
let preparedField: { fd: Uint8Array; gd: Uint8Array } | null = null;
/**
 * SF67: the height texture and the field lattice the next `GrassV2` reads, computed ahead a slice at a time (they were
 * most of one ~230 ms task at 4x CPU inside the grass step). The same bytes as the constructor computes; the next
 * carpet takes the prepared field (once), the height texture stays cached as before.
 */
export async function prepareGrassV2(yieldTask: () => Promise<void>): Promise<void> {
  if (!heightTex) {
    const hd = new Uint16Array(HN * HN);
    for (let j = 0; j < HN; j++) { heightRow(hd, j); if ((j & 63) === 63) await yieldTask(); }
    adoptHeightTexture(hd);
  }
  const fd = new Uint8Array(LN * LN * 4), gd = new Uint8Array(LN * LN * 4), rgb: [number, number, number] = [0, 0, 0];
  for (let j = 0; j < LN; j++) { fieldRow(fd, gd, j, rgb); if ((j & 31) === 31) await yieldTask(); }
  preparedField = { fd, gd };
}

const instances = new Set<GrassV2>();
/** the dressing landed: every v2 carpet re-bakes its mask (wireNalati calls it once the dressing is built) */
export function reseedGrassV2(): void { for (const g of instances) g.reseed(); }

const _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _box = new THREE.Box3(), _origin = new THREE.Vector3(), _camL = new THREE.Vector3();

export class GrassV2 {
  readonly group = new THREE.Group();
  private readonly maps: { tHeight: THREE.DataTexture; tMask: THREE.DataTexture; tField: THREE.DataTexture; tGround: THREE.DataTexture };
  private readonly maskData = new Uint8Array(HN * HN * 4);
  private rings: Ring[] = [];
  private flowers: Ring | null = null;
  private cards: { readonly geo: THREE.InstancedBufferGeometry; readonly tiles: number; readonly origin: THREE.Vector2 } | null = null;
  private readonly trail: PlayerTrail = { lastX: Number.NaN, lastZ: Number.NaN };
  private readonly pushTrample = (x: number, z: number, r: number, s: number, vx: number, vz: number): void => { trample.push(x, z, r, s, vx, vz); };
  private baking = 0;
  /** live tunables */
  readonly params = { playerRadius: PLAYER_TRAMPLE_RADIUS };

  constructor(private readonly sky: Sky, private readonly forest: Forest) {
    instances.add(this);
    const tHeight = terrainHeightTexture();
    // the field: GrassField's own 4 m lattice (height, tone, bloom, species) and the painted ground colour — prepared
    // ahead a slice at a time by the shard's boot (`prepareGrassV2`), else now
    let field = preparedField;
    preparedField = null;
    if (field === null) {
      field = { fd: new Uint8Array(LN * LN * 4), gd: new Uint8Array(LN * LN * 4) };
      const rgb: [number, number, number] = [0, 0, 0];
      for (let j = 0; j < LN; j++) fieldRow(field.fd, field.gd, j, rgb);
    }
    const { fd, gd } = field;
    const tField = new THREE.DataTexture(fd, LN, LN, THREE.RGBAFormat); tField.magFilter = tField.minFilter = THREE.LinearFilter; tField.needsUpdate = true;
    const tGround = new THREE.DataTexture(gd, LN, LN, THREE.RGBAFormat); tGround.magFilter = tGround.minFilter = THREE.LinearFilter; tGround.needsUpdate = true;
    this.maskData.fill(255);
    const tMask = new THREE.DataTexture(this.maskData, HN, HN, THREE.RGBAFormat); tMask.magFilter = tMask.minFilter = THREE.LinearFilter; tMask.needsUpdate = true;
    this.maps = { tHeight, tMask, tField, tGround };
  }

  build(): this {
    const m = this.maps;
    for (const id of LOOKS) {
      setLentTexture(id, 'tHeight', m.tHeight); setLentTexture(id, 'tMask', m.tMask); setLentTexture(id, 'tField', m.tField);
      setLentParam(id, 'heightXf', [H_ORG, H_ORG, 1 / HN, HN]); setLentParam(id, 'fieldXf', [-CHUNK_HALF, -CHUNK_HALF, 1 / LAT, LN]);
    }
    setLentTexture(BLADES, 'tGround', m.tGround); // the roots sink into the painted ground (the blades only)
    setLentTexture(BLADES, 'tTrample', trample.texture); setLentTexture(CLUMPS, 'tTrample', trample.texture);
    const draw = (id: string, geo: InstancedBufferGeometry, name: string): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, lentLook(id));
      mesh.frustumCulled = false; mesh.name = name;
      mesh.onBeforeRender = (renderer, _s, camera) => { this.place(renderer, camera); };
      this.group.add(mesh);
      return mesh;
    };
    RINGS.forEach((cfg, ri) => {
      const per = Math.round(cfg.T / cfg.s), last = ri === RINGS.length - 1, half = (cfg.G * cfg.T) / 2;
      const geo = bladeTile(per, cfg, last ? [half * 0.6, half * 0.95] : [1e4, 1e4], ri === 0 ? [NEAR[0], NEAR[1], 0.4] : [-1, 0, 1]);
      this.rings.push({ T: cfg.T, G: cfg.G, mesh: draw(BLADES, geo, `grass-v2-ring${ri}`), geo, half });
    });
    {
      const cfg = FLOWERS, per = Math.round(cfg.T / cfg.s), half = (cfg.G * cfg.T) / 2;
      const geo = flowerTile(per, cfg.s, [half * 0.6, half * 0.96], [NEAR[0] - 0.4, NEAR[1] - 0.2, 0]);
      this.flowers = { T: cfg.T, G: cfg.G, mesh: draw(HEADS, geo, 'grass-v2-flowers'), geo, half };
    }
    // the near field: the painted card atlas as clumps of 3 crossed quads (not camera-facing: they hold up walked round),
    // on the same field, mask, wind and trample as the blades, cut at the atlas's alpha; the atlas swapped in when it lands
    const cfg = CARDS, per = Math.round(cfg.T / cfg.s), geo = tileFieldGeometry({ across: cfg.across, layers: 0, seed: 0x4a1a, grid: per, card: CLUMP }, per * per);
    setLentParam(CLUMPS, 'cardNear', [NEAR[0], NEAR[1], per]);
    draw(CLUMPS, geo, 'grass-v2-cards');
    this.cards = { geo, tiles: geo.instanceCount, origin: new THREE.Vector2() };
    void (async (): Promise<void> => {
      try { const atlas = await loadSpecimenTexture(paintedTextures.cards); atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping; setLentTexture(CLUMPS, 'tCards', atlas); } catch (e: unknown) { console.warn('[grass v2] no card atlas', e); }
    })();
    void this.bakeMask();
    return this;
  }

  /** the dressing landed (`reseedGrassV2`): bake the fine mask again with its cover */
  reseed(): void { void this.bakeMask(); }

  /**
   * tMask at 1 m: R = the cut-outs (road bed, yurt floor, the exact painted splat, 1 − dressing cover, spruce trunks),
   * G = the verge (0 = capped at the grazed 0.22 m, 1 = the full field). A few rows per task.
   */
  private async bakeMask(): Promise<void> {
    const run = ++this.baking;
    await macrotask(); // not inside the caller's task (SF67: the first rows were the grass step's)
    if (run !== this.baking) return;
    const d = new Uint8Array(HN * HN * 4);
    for (let j = 0; j < HN; j++) {
      const z = H_ORG + j + 0.5;
      for (let i = 0; i < HN; i++) {
        const x = H_ORG + i + 0.5, k = (j * HN + i) * 4;
        const td = trailDistance(x, z);
        // trailGrass(h, td) = mix(min(h, 0.22), h, s1) · s2 — read s1 (the verge growing back) and s2 (the bed's edge) off it
        const full = trailGrass(1, td), capped = trailGrass(0.22, td);
        const s2 = Math.min(1, capped / 0.22);
        let cut = s2;
        const verge = s2 <= 1e-4 ? 0 : Math.max(0, Math.min(1, (full - capped) / (0.78 * s2)));
        if (cut > 0) {
          const base = grassBaseHeightAt(x, z, Infinity);
          if (base <= 0) cut = 0;                                          // water, yurt floors, off-chunk
          else cut *= smoothstep(0.35, 0.6, splatAt(x, z)[0]);          // the exact painted ground (a gravel bar's edge)
          if (cut > 0) cut *= 1 - dressingCover(x, z);
        }
        d[k] = Math.round(cut * 255); d[k + 1] = Math.round(verge * 255); d[k + 2] = 0; d[k + 3] = 255;
      }
      if ((j & 31) === 31) { await macrotask(); if (run !== this.baking) return; }
    }
    // spruce trunks: no blades inside a trunk
    for (const t of this.forest.trees) {
      const r = t.r;
      const i0 = Math.floor(t.x - H_ORG - r - 0.5), j0 = Math.floor(t.z - H_ORG - r - 0.5);
      for (let j = j0; j <= j0 + Math.ceil(2 * r + 1); j++) for (let i = i0; i <= i0 + Math.ceil(2 * r + 1); i++) {
        if (i < 0 || j < 0 || i >= HN || j >= HN) continue;
        if (Math.hypot(H_ORG + i + 0.5 - t.x, H_ORG + j + 0.5 - t.z) < r + 0.35) d[(j * HN + i) * 4] = 0;
      }
    }
    if (run !== this.baking) return;
    this.maskData.set(d);
    this.maps.tMask.needsUpdate = true;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // the player parts the grass and leaves a trail; the wind and the trample advance
    pushPlayerTrail(this.trail, dt, playerPos.x, playerPos.z, this.params.playerRadius, this.pushTrample);
    wind.update(dt);
    painterlyUniforms.uPWind.value.set(wind.dirX, wind.dirZ, wind.speed / 5);
    trample.update(dt, playerPos);
    grassV2Uniforms.uTime.value += dt;
    // the hemisphere the fill comes from (the rig + the look retune it every frame)
    const hemi = this.sky.hemi;
    grassV2Uniforms.uHemiSky.value.copy(hemi.color); grassV2Uniforms.uHemiGround.value.copy(hemi.groundColor); grassV2Uniforms.uHemiI.value = hemi.intensity;
    // the looks' params: the key, the hemisphere and the mood; the wind, the trample and its live movers; the static bake
    const u = grassV2Uniforms, w = wind.uniforms, t = trample.uniforms, b = bakeUniforms;
    const sunDir = painterlyUniforms.uPSunDir.value.toArray(), sunRef = painterlyUniforms.uPSunRef.value.toArray();
    const be = b.uBakeMatrix.value.elements, cols = [0, 1, 2, 3].map((k) => be.slice(k * 4, k * 4 + 4));
    for (const id of LOOKS) {
      setLentParam(id, 'sunDir', sunDir); setLentParam(id, 'sunRef', sunRef);
      setLentParam(id, 'hemiSky', u.uHemiSky.value.toArray()); setLentParam(id, 'hemiGround', u.uHemiGround.value.toArray());
      setLentParam(id, 'mood', [u.uHemiI.value, u.uGrassGain.value, u.uGrassSat.value]); setLentParam(id, 'tint', u.uGrassTint.value.toArray());
      cols.forEach((c, k) => { setLentParam(id, `bakeM${k}`, c); });
      setLentParam(id, 'bakeInfo', b.uBakeInfo.value.toArray()); setLentParam(id, 'contactXf', b.uContactXf.value.toArray());
      if (b.tBakeShadow.value) setLentTexture(id, 'tBakeShadow', b.tBakeShadow.value);
      if (b.tBakeContact.value) setLentTexture(id, 'tBakeContact', b.tBakeContact.value);
    }
    setLentParam(HEADS, 'time', u.uTime.value);
    for (const id of [BLADES, CLUMPS]) {
      setLentParam(id, 'sunView', u.uSunView.value.toArray());
      setLentParam(id, 'wind', [w.uWindDir.value.x, w.uWindDir.value.y, w.uWindTravel.value, w.uWindTime.value]);
      setLentParam(id, 'windAux', [w.uWindSpeed.value, w.uWindGustiness.value]);
      setLentParam(id, 'trampleWin', t.uTrampleWin.value.toArray());
      for (let k = 0; k < 4; k++) setLentParam(id, `mover${k}`, k < t.uMoverCount.value ? (t.uMovers.value[k]?.toArray() ?? [0, 0, 0, 0]) : [0, 0, 0, 0]);
    }
  }

  private placedFrame = -1;
  /**
   * As the frame renders (the camera is final — the first of the four draws calls it, once per render): snap the rings
   * to the camera, cull their tiles against its frustum, fill the tile lists and the instance counts.
   */
  private place(renderer: Renderer, camera: THREE.Camera): void {
    const frame = renderCount(renderer); // the engine's render count (SF59: node draws bump three's)
    if (frame === this.placedFrame) return;
    this.placedFrame = frame;
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    // the tiles are in the grass's own frame: a grid cell draws it at its offset (zero standalone), the camera is the page's
    const o = _origin.setFromMatrixPosition(this.group.matrixWorld);
    const cx = camera.position.x - o.x, cz = camera.position.z - o.z;
    // seen from high up the fine rings are wasted (their blades are sub-pixel): a ring stands down once the camera is
    // higher above the ground than the ring reaches, and the next ring fills its square
    const above = camera.position.y - o.y - heightAt(Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, cx)), Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, cz)));
    let prev: { cx: number; cz: number; half: number } | null = null;
    this.rings.forEach((R, i) => {
      if (i < this.rings.length - 1 && above > R.half * 0.9) { R.geo.instanceCount = 0; return; }
      prev = this.fill(R, cx, cz, prev);
    });
    if (this.flowers) this.fill(this.flowers, cx, cz, null);
    if (this.cards) {
      this.cards.geo.instanceCount = above > 6 ? 0 : this.cards.tiles;
      const o2 = tileOrigin(this.cards.origin, _camL.set(cx, 0, cz), CARDS.T);
      setLentParam(CLUMPS, 'cardField', [o2.x, o2.y, CARDS.T, CARDS.s]);
    }
  }

  private fill(R: Ring, camX: number, camZ: number, prev: { cx: number; cz: number; half: number } | null): { cx: number; cz: number; half: number } {
    const { T, G } = R;
    const ox = Math.round(camX / T) * T - (G / 2) * T, oz = Math.round(camZ / T) * T - (G / 2) * T;
    const tileAttr = R.geo.getAttribute('aTile'), holeAttr = R.geo.getAttribute('aHole');
    if (!(tileAttr instanceof THREE.InstancedBufferAttribute) || !(holeAttr instanceof THREE.InstancedBufferAttribute)) return { cx: 0, cz: 0, half: 0 };
    const data = tileAttr.array, hole = holeAttr.array;
    let n = 0;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const x0 = ox + i * T, z0 = oz + j * T;
      if (prev && x0 >= prev.cx - prev.half && x0 + T <= prev.cx + prev.half && z0 >= prev.cz - prev.half && z0 + T <= prev.cz + prev.half) continue;
      if (x0 + T < -CHUNK_HALF || z0 + T < -CHUNK_HALF || x0 > CHUNK_HALF || z0 > CHUNK_HALF) continue;
      const y = heightAt(Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, x0 + T / 2)), Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, z0 + T / 2)));
      _box.min.set(x0, y - T * 0.35 - 2, z0); _box.max.set(x0 + T, y + T * 0.35 + 2, z0 + T);
      _box.translate(_origin); // the frustum is the page's
      if (!_frustum.intersectsBox(_box)) continue;
      if (n >= MAX_TILES) break;
      data[n * 2] = x0; data[n * 2 + 1] = z0;
      if (prev) { hole[n * 4] = prev.cx; hole[n * 4 + 1] = prev.cz; hole[n * 4 + 2] = prev.half; hole[n * 4 + 3] = 1; } else hole[n * 4 + 3] = 0;
      n++;
    }
    tileAttr.needsUpdate = true; holeAttr.needsUpdate = true;
    R.geo.instanceCount = n;
    return { cx: ox + (G / 2) * T, cz: oz + (G / 2) * T, half: (G / 2) * T };
  }
}
