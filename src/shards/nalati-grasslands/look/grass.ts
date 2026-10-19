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
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { wind } from '@wildshard/engine/world/steppeWind';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { trample } from '@wildshard/game/systems/looks/trample';
import { PLAYER_TRAMPLE_RADIUS, pushPlayerTrail, type PlayerTrail } from './trampleMovers';
import { dressingCover } from '../world/dressing/index';
import { bakeUniforms } from './bake';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import { loadSpecimenTexture } from '@wildshard/game/models/specimenCatalogue';
import { tileOrigin } from '@wildshard/sdk/looks/tileField';
import { unzlibSync } from 'fflate';
import { parseSceneBuffers } from '@wildshard/format/sceneBuffers';
import { createSceneBuffers } from '@wildshard/game/shardfile/sceneBuffers';
import { resourceScope } from '@wildshard/engine/app/resources';
import grassRows from '../boot/grass.generated.json' with { type: 'json' };
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';

const BLADES = 'nalati-grass-blades', HEADS = 'nalati-grass-flowers', CLUMPS = 'nalati-grass-cards';
const LOOKS = [BLADES, HEADS, CLUMPS] as const;

const PHONE = TIER === 'phone';

const rows = PHONE ? grassRows.phone : grassRows.desktop;
const RINGS = rows.rings, FLOWERS = rows.flowers, CARDS = rows.cards, NEAR = rows.near as [number,number];
const MAX_TILES = 256;
type InstancedBufferGeometry = THREE.InstancedBufferGeometry;
const decode = (encoded: string): Uint8Array<ArrayBuffer> => unzlibSync(Uint8Array.from(atob(encoded), value => value.codePointAt(0) ?? 0));
/** Sky's meadow and this field use the same row-driven draw host. */
function geometries(encoded: string, look: string): InstancedBufferGeometry[] {
  const input: unknown = JSON.parse(new TextDecoder().decode(decode(encoded)));
  return createSceneBuffers(parseSceneBuffers(input), lentLook(look), resourceScope()).children.map(child => {
    if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.InstancedBufferGeometry)) throw new Error('Grass draw requires instanced geometry');
    for (const name of ['aTile', 'aHole']) { const attribute = child.geometry.getAttribute(name); if (attribute instanceof THREE.BufferAttribute) attribute.setUsage(THREE.DynamicDrawUsage); }
    return child.geometry;
  });
}

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

interface Ring { T: number; G: number; mesh: THREE.Mesh; geo: InstancedBufferGeometry; half: number }

let heightTex: THREE.DataTexture | null = null;
/** the terrain height at 1 m over [−256, 256] (half float, linear) — the blades stand on it, the bake reads it */
export function terrainHeightTexture(): THREE.DataTexture {
  if (heightTex) return heightTex;
  const bytes = decode(grassRows.height), hd = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  return heightTexture(hd);
}
function heightTexture(hd: Uint16Array): THREE.DataTexture {
  const t = new THREE.DataTexture(hd, HN, HN, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  heightTex = cacheUntilDisposed(t, () => { if (heightTex === t) heightTex = null; });
  return t;
}

/** Static height and field maps are baked before boot; preparation only admits their bytes. */
export async function prepareGrassV2(yieldTask: () => Promise<void>): Promise<void> { terrainHeightTexture(); await yieldTask(); }

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
    const fd = decode(grassRows.field), gd = decode(grassRows.ground);
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
    const blades = geometries(rows.scenes.blades, BLADES);
    RINGS.forEach((cfg, ri) => {
      const half = (cfg.G * cfg.T) / 2;
      const geo = blades[ri]; if (geo === undefined) throw new Error('Grass ring missing');
      this.rings.push({ T: cfg.T, G: cfg.G, mesh: draw(BLADES, geo, `grass-v2-ring${ri}`), geo, half });
    });
    {
      const cfg = FLOWERS, half = (cfg.G * cfg.T) / 2;
      const geo = geometries(rows.scenes.flowers, HEADS)[0]; if (geo === undefined) throw new Error('Grass flowers missing');
      this.flowers = { T: cfg.T, G: cfg.G, mesh: draw(HEADS, geo, 'grass-v2-flowers'), geo, half };
    }
    // the near field: the painted card atlas as clumps of 3 crossed quads (not camera-facing: they hold up walked round),
    // on the same field, mask, wind and trample as the blades, cut at the atlas's alpha; the atlas swapped in when it lands
    const per = rows.per, geo = geometries(rows.scenes.cards, CLUMPS)[0];
    if (geo === undefined) throw new Error('Grass cards missing');
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
    const d = decode(grassRows.mask);
    for (let j = 0; j < HN; j++) {
      const z = H_ORG + j + 0.5;
      for (let i = 0; i < HN; i++) {
        const x = H_ORG + i + 0.5, k = (j * HN + i) * 4;
        d[k] = Math.round((d[k] ?? 0) * (1 - dressingCover(x, z)));
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
