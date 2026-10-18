/**
 * Nalati dressing (look-pass lever 6, "density") — everything small that makes the steppe feel lived-in between the
 * POIs: boulder clusters with moss and lichen, outcrop slabs, stones lining every road, pebbles / cobbles / driftwood
 * on the gravel bars, junipers, wild rose, dwarf willow, lupin / sage and edelweiss / buttercup drifts in 3D, reeds,
 * fallen logs and stumps round the spruce, ovoo cairns and ribbon poles at the viewpoints, loose clutter round the
 * camps, and ambient life (pollen + seed fluff in the sun, butterflies over the drifts, kites circling high).
 *
 *   import { NalatiDressing } from '../world/nalati/dressing';
 *   const dressing = await new NalatiDressing(sky).build(product, macrotask);   // deterministic from the seed; yields between passes
 *   dressing.addTo(game.scene);                  // meshes (+ the camp clutter, clear of those boxes)
 *   await dressing.place(app.registry, macrotask);             // its collision into the world registry (NALATI-MERGE P1)
 *   game.onUpdate((dt) => dressing.update(dt, game.camera, player.position, renderer));
 *   dressing.stats()                                             // { calls, tris, perLayer } for the perf report
 *
 * E306 / E315 second pass: every scatter kind and every prop is a model (src/shards/nalati-grasslands/models/dressing.ts,
 * dressingProps.ts, fence.ts) placed `drawnInto` what draws it — a layer, the props' region meshes, the camp clutter —
 * with the colliders its copies made (the big rocks' hulls a task apart, the phone's collider budget). The drawing and
 * its culling stay the dressing's (world: the field that scatters them); the dressing is no set (it is not a place).
 *
 * Draw calls: 9 instanced scatter layers (boulder, slab, stone, juniper, rose, willow, lupin, daisy, reed) + up to
 * 4 merged prop meshes (frustum-culled by region) + the ribbon cloth + pollen + butterflies + raptors ≈ 17, of
 * which boulder / slab / the prop meshes also cast shadows. Everything is on the shared painterly material (one
 * program, + its instanced sibling) except the pollen points. Per-instance culling (range + frustum) runs only when
 * the view has moved ≥ 1 m or turned ≥ 2°; draw distances are per instance (density falls off with distance) and
 * scaled down on the phone tier.
 */
import * as THREE from 'three';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { TIER } from '@wildshard/engine/core/tier';
import { FrameCamera } from '@wildshard/engine/world/frameCamera';
import { modelContext, type ModelDef } from '@wildshard/engine/models/model';
import { place, type PlaceOptions, type Placed } from '@wildshard/engine/models/place';
import type { Renderer } from '@wildshard/engine/render/renderer';
import * as v from 'valibot';
import { painterlyMaterial, painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { Flutter } from '../Flutter';
import { CellWindow } from '@wildshard/engine/render/streamedInstances';
import { smoothstep } from '@wildshard/engine/core/noise';
import type { PoiPiece } from '../types';
import { AmbientGroup } from '@wildshard/game/ambient/flock';
import coverRows from '../../boot/cover.generated.json' with { type: 'json' };
import { Rng } from '@wildshard/engine/core/rng';
import { wind } from '@wildshard/engine/world/steppeWind';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { MOTES_GLSL } from '../../runtime/looks/motesGlsl';
import { coverGeometry, preloadCover } from '../../creatures/marmots';
import { loadNalatiModel, modelsOn } from '../modelView';
import type { Box } from '../solid';
import {
  boulder, slab, stone, juniper, wildRose, dwarfWillow, lupin, daisy, reeds,
  fallenLog, stump, ovoo, viewpointPole, skyGateway, fence, campClutter,
} from '../../models/catalogue';
import { preloadNalatiPlaces, bakedActorGeometry, bakedDressingGeo, bakedDressingContacts, bakedPlaceSteps, placer } from '../places';

export interface Inst {
  x: number; y: number; z: number;
  yaw: number;
  sx: number; sy: number; sz: number;
  /** lean (radians) about x / z — rocks settling into a slope, a tilted clump */
  tiltX?: number; tiltZ?: number;
  /** a big rock: it collides as the hull of what its layer draws (NALATI-MERGE P1, `NalatiDressing.descs`) */
  solid?: true;
  /** metres: this instance's draw distance (before the tier scale) */
  far: number;
  /** linear RGB multiplier (instanceColor) */
  r: number; g: number; b: number;
}

const dressNumber = v.pipe(v.number(), v.finite());
const spot = v.object({ x: dressNumber, z: dressNumber, s: dressNumber });
const instance = v.object({ x: dressNumber, y: dressNumber, z: dressNumber, yaw: dressNumber, sx: dressNumber, sy: dressNumber, sz: dressNumber,
  tiltX: v.exactOptional(dressNumber), tiltZ: v.exactOptional(dressNumber), solid: v.exactOptional(v.literal(true)), far: dressNumber, r: dressNumber, g: dressNumber, b: dressNumber });
const box = v.object({ x: dressNumber, z: dressNumber, hw: dressNumber, hd: dressNumber, rot: dressNumber, yBottom: dressNumber, yTop: dressNumber, ghost: v.exactOptional(v.literal(true)) });

/** Exact build-time world placements; the page only renders these rows. */
export const DRESSING_PLAN = v.object({
  boulder: v.array(instance), slab: v.array(instance), stone: v.array(instance),
  juniper: v.array(instance), rose: v.array(instance), willow: v.array(instance),
  lupin: v.array(instance), daisy: v.array(instance), reed: v.array(instance),
  logs: v.array(v.object({ ax: dressNumber, az: dressNumber, bx: dressNumber, bz: dressNumber, r: dressNumber, drift: v.boolean() })),
  stumps: v.array(spot), ovoos: v.array(spot), poles: v.array(spot),
  fences: v.array(v.array(v.tuple([dressNumber, dressNumber]))), gates: v.array(v.object({ x: dressNumber, z: dressNumber, yaw: dressNumber })),
  drifts: v.array(v.object({ x: dressNumber, y: dressNumber, z: dressNumber, r: dressNumber })), colliders: v.array(box),
});
export type DressPlan = v.InferOutput<typeof DRESSING_PLAN>;
/** Camp anchors already rejected against the actual POI, outcrop and crag boxes. */
export const CAMP_CLUTTER = v.array(v.object({ x: dressNumber, z: dressNumber, yaw: dressNumber, kind: dressNumber }));
export type ClutterSpots = v.InferOutput<typeof CAMP_CLUTTER>;

export interface DressLayerSource {
  version: 1; count: number; matrices: Float32Array; colours: Float32Array; spheres: Float32Array; ranges: Float32Array;
  cellSize: number; keepNear: number; fadeStart: number; rangeScale: number;
}

interface DressLayer { name: string; mesh: THREE.InstancedMesh; count: number; cull: (frustum: THREE.Frustum, viewer: THREE.Vector3) => void; readonly visible: number; readonly tris: number }
const sourceLayers = new WeakMap<THREE.Object3D, DressLayerSource>();
/** Copy original placement rows only when the offline map inventory requests them. */
export function captureDressLayerSource(mesh: THREE.Object3D): DressLayerSource | undefined {
  const source = sourceLayers.get(mesh);
  return source === undefined ? undefined : { ...source, matrices: source.matrices.slice(), colours: source.colours.slice(), spheres: source.spheres.slice(), ranges: source.ranges.slice() };
}

function dressingGeo(key: string): THREE.BufferGeometry {
  const geometry = bakedDressingGeo(key); if (geometry === null) throw new Error(`Missing dressing shape ${key}`); return geometry;
}

function dressLayer(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, list: Inst[], farScale: number, castShadow = false, keepNear = 26): DressLayer {
  geometry.computeBoundingSphere();
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
  mesh.name = `nalati-dress-${name}`; mesh.frustumCulled = false; mesh.castShadow = castShadow; mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length) * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const matrices = new Float32Array(list.length * 16), colours = new Float32Array(list.length * 3), spheres = new Float32Array(list.length * 4), ranges = new Float32Array(list.length);
  const transform = new THREE.Matrix4(), rotation = new THREE.Quaternion(), angles = new THREE.Euler(), point = new THREE.Vector3(), scale = new THREE.Vector3(), sphere = new THREE.Sphere();
  list.forEach((it, i) => {
    transform.compose(point.set(it.x, it.y, it.z), rotation.setFromEuler(angles.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0, 'YXZ')), scale.set(it.sx, it.sy, it.sz)).toArray(matrices, i * 16);
    colours.set([it.r, it.g, it.b], i * 3); spheres.set([it.x, it.y, it.z, (geometry.boundingSphere?.radius ?? 1) * Math.max(it.sx, it.sy, it.sz)], i * 4); ranges[i] = it.far * farScale;
  });
  const buckets = new Map<string, number[]>();
  list.forEach((it, i) => { const key = `${Math.floor(it.x / 24)},${Math.floor(it.z / 24)}`, entries = buckets.get(key) ?? []; entries.push(i); buckets.set(key, entries); });
  const cells = new CellWindow(24, [...buckets].map(([key, value]) => { const [x, z] = key.split(','); return { cx: Number(x), cz: Number(z), value }; }));
  const reach = ranges.reduce((far, value) => Math.max(far, value), 0);
  const cull = (frustum: THREE.Frustum, viewer: THREE.Vector3): void => {
    let n = 0;
    for (const [x, z] of cells.within(viewer.x, viewer.z, reach)) for (const i of cells.get(x, z) ?? []) {
      const far = ranges[i] ?? 0, d2 = ((spheres[i * 4] ?? 0) - viewer.x) ** 2 + ((spheres[i * 4 + 2] ?? 0) - viewer.z) ** 2;
      if (d2 > far * far) continue;
      sphere.center.set(spheres[i * 4] ?? 0, spheres[i * 4 + 1] ?? 0, spheres[i * 4 + 2] ?? 0); sphere.radius = spheres[i * 4 + 3] ?? 1;
      if (d2 > keepNear * keepNear && !frustum.intersectsSphere(sphere)) continue;
      const fade = smoothstep(far, far * 0.82, Math.sqrt(d2)), out = mesh.instanceMatrix.array;
      for (let q = 0; q < 16; q++) out[n * 16 + q] = (matrices[i * 16 + q] ?? 0) * (q < 11 && (q & 3) !== 3 ? fade : 1);
      mesh.instanceColor?.setXYZ(n, colours[i * 3] ?? 1, colours[i * 3 + 1] ?? 1, colours[i * 3 + 2] ?? 1); n++;
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  };
  sourceLayers.set(mesh, { version: 1, count: list.length, matrices, colours, spheres, ranges, cellSize: 24, keepNear, fadeStart: 0.82, rangeScale: farScale });
  const tris = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  mesh.count = 0;
  return { name, mesh, count: list.length, cull, get visible() { return mesh.count; }, get tris() { return mesh.count * tris; } };
}

/** Existing ambient rows own every flight/perch decision. This owner only draws their poses. */
function dressingLife(sky: Sky) {
  const profile = TIER === 'phone' ? coverRows.phone : coverRows.desktop, group = new THREE.Group(), drift = new THREE.Vector2();
  const count = TIER === 'phone' ? 380 : 900, seeds = new Float32Array(count * 4), rng = new Rng(0x9011e);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next();
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const shader = new ShaderFamily(MOTES_GLSL, {}), material = new THREE.ShaderMaterial({ vertexShader: shader.glsl(MOTES_GLSL.MOTE_VERT), fragmentShader: shader.glsl(MOTES_GLSL.MOTE_FRAG), transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDrift: { value: drift }, uBox: { value: new THREE.Vector3(26, 7, 26) }, uPx: { value: 600 }, uSunDir: painterlyUniforms.uPSunDir, uSunCol: { value: new THREE.Color(1, 0.93, 0.8) }, uOpacity: { value: 1 } } });
  const motes = new THREE.Points(geometry, material); motes.frustumCulled = false; motes.renderOrder = 2; motes.name = 'nalati-dress-pollen'; group.add(motes);
  const flocks = profile.life.map(spec => {
    const wheel = spec.row.wheeling, ground = wheel === null ? 0 : terrainHeight(wheel.centre.x, wheel.centre.z);
    const flock = new AmbientGroup(wheel === null ? spec.row : { ...spec.row, wheeling: { ...wheel, altitude: wheel.altitude.map(value => value + ground) } }, spec.perches);
    return { kind: spec.kind, flock, previous: flock.birds.map(({ x, y, z, yaw, pitch, roll, flap }) => ({ x, y, z, yaw, pitch, roll, flap })) };
  });
  const butterflies = new THREE.InstancedMesh(coverGeometry(sky, 'wing'), painterlyMaterial(sky, { rim: 0.3, bands: 0.5, shade: 0.6, emissive: 0x101010 }), (TIER === 'phone' ? coverRows.butterflies.phone : coverRows.butterflies.desktop) * 2);
  const birds = new THREE.InstancedMesh(coverGeometry(sky, 'halfBird'), painterlyMaterial(sky, { rim: 0.6, bands: 0.6 }), coverRows.raptors * 2);
  for (const mesh of [butterflies, birds]) { mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; group.add(mesh); }
  butterflies.name = 'nalati-dress-butterflies'; birds.name = 'nalati-dress-raptors';
  const hues = coverRows.hue.map(hue => new THREE.Color(hue)), transform = new THREE.Matrix4(), wing = new THREE.Matrix4(), mirror = new THREE.Matrix4().makeScale(-1, 1, 1), composed = new THREE.Matrix4(), angles = new THREE.Euler(), rotation = new THREE.Quaternion(), point = new THREE.Vector3(), scale = new THREE.Vector3();
  let time = 0, credit = 0;
  return { group, setPollen(value: number) { const opacity = material.uniforms['uOpacity']; if (opacity !== undefined) opacity.value = value; },
    update(dt: number, camera: THREE.PerspectiveCamera, player: THREE.Vector3, renderHeight: number) {
      time += dt; credit += dt; drift.x += wind.dirX * wind.speed * 0.35 * dt; drift.y += wind.dirZ * wind.speed * 0.35 * dt;
      const t = material.uniforms['uTime'], px = material.uniforms['uPx']; if (t !== undefined) t.value = time; if (px !== undefined) px.value = renderHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
      if (credit >= 0.1) { const step = Math.floor(credit / 0.1) * 0.1; credit -= step; for (const entry of flocks) { entry.previous = entry.flock.birds.map(({ x, y, z, yaw, pitch, roll, flap }) => ({ x, y, z, yaw, pitch, roll, flap })); entry.flock.update(step, player); } }
      const alpha = Math.min(1, credit / 0.1); let flies = 0, raptors = 0;
      for (const entry of flocks) for (const [i, bird] of entry.flock.birds.entries()) {
        if (bird.state === 0) continue;
        const before = entry.previous[i] ?? bird, mix = (a: number, b: number): number => a + (b - a) * alpha;
        angles.set(-mix(before.pitch, bird.pitch), before.yaw + Math.atan2(Math.sin(bird.yaw - before.yaw), Math.cos(bird.yaw - before.yaw)) * alpha + Math.PI, mix(before.roll, bird.roll), 'YXZ');
        transform.compose(point.set(mix(before.x, bird.x), mix(before.y, bird.y), mix(before.z, bird.z)), rotation.setFromEuler(angles), scale.setScalar(entry.flock.row.scale * bird.scale));
        const mesh = entry.kind === 'butterfly' ? butterflies : birds, n = entry.kind === 'butterfly' ? flies : raptors, flap = entry.kind === 'butterfly' ? Math.sin(time * 12 + bird.phase) * 1.15 + 0.25 : mix(before.flap, bird.flap);
        mesh.setMatrixAt(n, composed.multiplyMatrices(transform, wing.makeRotationZ(flap))); mesh.setMatrixAt(n + 1, composed.multiplyMatrices(transform, wing.makeRotationZ(-flap).premultiply(mirror)));
        if (entry.kind === 'butterfly') { const color = hues[(flies / 2) % hues.length] ?? new THREE.Color(); mesh.setColorAt(n, color); mesh.setColorAt(n + 1, color); flies += 2; } else raptors += 2;
      }
      butterflies.count = flies; birds.count = raptors; butterflies.instanceMatrix.needsUpdate = true; birds.instanceMatrix.needsUpdate = true; if (butterflies.instanceColor !== null) butterflies.instanceColor.needsUpdate = true;
    } };
}

const PHONE = TIER === 'phone';

/** one scatter layer's model: what it draws, the colliders its big rocks made (world space, in plan order), its `place` */
interface Drawn { readonly layer: DressLayer; readonly list: readonly Inst[]; readonly descs: ColliderDesc[]; readonly place: (o: PlaceOptions) => Placed }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _b = new THREE.Box3();

/** each instance's world box (6 floats: min xyz, max xyz): its layer's geometry box at the instance's transform */
function instanceBoxes(geometry: THREE.BufferGeometry, list: readonly Inst[]): Float32Array {
  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  const bb = geometry.boundingBox ?? new THREE.Box3();
  const out = new Float32Array(list.length * 6);
  list.forEach((it, i) => {
    _m.compose(_p.set(it.x, it.y, it.z), _q.setFromEuler(_e.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0, 'YXZ')), _s.set(it.sx, it.sy, it.sz));
    _b.copy(bb).applyMatrix4(_m);
    out.set([_b.min.x, _b.min.y, _b.min.z, _b.max.x, _b.max.y, _b.max.z], i * 6);
  });
  return out;
}
/** per-layer draw-distance scale on this tier */
const FAR = PHONE ? { rock: 0.6, small: 0.55, shrub: 0.6, flower: 0.55 } : { rock: 1, small: 1, shrub: 1, flower: 1 };

// ── ground cover: where a boulder / slab / shrub sits, for the grass seeder (grass should not grow through rock) ──
const COVER_CELL = 4;
const cover = new Map<number, number[]>();
const coverKey = (ix: number, iz: number): number => (ix + 100) * 1000 + (iz + 100);
function addCover(list: readonly Inst[], k: number): void {
  for (const it of list) {
    const r = Math.max(it.sx, it.sz) * k;
    const key = coverKey(Math.floor(it.x / COVER_CELL), Math.floor(it.z / COVER_CELL));
    let l = cover.get(key); if (!l) cover.set(key, (l = []));
    l.push(it.x, it.z, r);
  }
}
/**
 * 0 … 1: how much a dressing rock or shrub covers the ground at (x, z) — 1 inside its footprint, easing to 0 over its
 * rim. For the grass (look/grass.ts tMask): `× (1 − dressingCover(x, z))` keeps blades out of the boulders.
 * All zero until the dressing has been built (the grass mask baked before it keeps its grass until `reseedGrassV2()`).
 */
export function dressingCover(x: number, z: number): number {
  const ix = Math.floor(x / COVER_CELL), iz = Math.floor(z / COVER_CELL);
  let best = 0;
  for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) {
    const l = cover.get(coverKey(a, b));
    if (!l) continue;
    for (let i = 0; i + 2 < l.length; i += 3) {
      const r = l[i + 2] ?? 0, d = Math.hypot(x - (l[i] ?? 0), z - (l[i + 1] ?? 0));
      if (d < r) best = Math.max(best, Math.min(1, (r - d) / (r * 0.25)));
    }
  }
  return best;
}

export class NalatiDressing {
  group = new THREE.Group();
  layers: DressLayer[] = [];
  props: THREE.Mesh[] = [];
  propTris = 0;
  flutter = new Flutter();
  life: ReturnType<typeof dressingLife> | null = null;
  /** the boxes, as data (keep-outs); their solids are in `descs` or, for a `ghost`, a hull / capsule / prism there */
  colliders: Box[] = [];
  /** the collision as real geometry: big rocks as hulls of what they draw, logs as capsules, the ovoo heaps as prisms */
  descs: ColliderDesc[] = [];
  plan: DressPlan | null = null;
  /** the one-off props (merged per region: the props' tap target) and the camps' clutter */
  statics: THREE.Object3D = new THREE.Group();
  private drawn: Drawn[] = [];
  private staticPiece: PoiPiece | null = null;
  private clutter: PoiPiece | null = null;
  /** build ms per stage */
  timings: Record<string, number> = {};
  private frustum = new THREE.Frustum();
  private projScreen = new THREE.Matrix4();
  private lastPos = new THREE.Vector3(1e9, 0, 0);
  private lastDir = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private readonly frame = new FrameCamera(this.group);
  private size = new THREE.Vector2();

  constructor(private sky: Sky) { this.group.name = 'nalati-dressing'; this.statics.name = 'nalati-dress-statics'; }


  async build(product: { file: (name: string) => Promise<Uint8Array> }, yieldTask: () => Promise<void> = () => Promise.resolve()): Promise<this> {
    let t0 = diagnosticNow();
    const lap = (k: string) => { const t = diagnosticNow(); this.timings[k] = Math.round(t - t0); t0 = t; };
    const read = async (key: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await product.file(`world/dressing-${key}.json`)));
    const entries = await Promise.all(Object.keys(DRESSING_PLAN.entries).map(async key => [key, await read(key)]));
    const plan = this.plan = v.parse(DRESSING_PLAN, Object.fromEntries(entries));
    lap('plan');
    await yieldTask();
    await Promise.all([preloadNalatiPlaces(), preloadCover()]); // the scatter shapes' bake (../placeBake.ts; in already when the POIs built first)
    t0 = diagnosticNow();

    const rock = painterlyMaterial(this.sky, { rim: 0.3, bands: 0.8 });
    const shrub = painterlyMaterial(this.sky, { rim: 0.5, bands: 0.7, sway: 0.05 });
    const flower = painterlyMaterial(this.sky, { rim: 0.45, bands: 0.6, sway: 0.3 });
    const reed = painterlyMaterial(this.sky, { rim: 0.5, bands: 0.6, sway: 0.1 });
    const add = <P extends object>(model: ModelDef<P>, name: string, geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[], far: number, o: { castShadow?: boolean; keepNear?: number } = {}) => {
      if (list.length === 0) { geo.dispose(); return; }
      const l = dressLayer(name, geo, mat, list, far, o.castShadow, o.keepNear);
      // P1: a big rock collides as the hull of what this layer draws for it
      const descs = list.some(it => it.solid === true) ? bakedDressingContacts(name) : [];
      this.descs.push(...descs);
      this.layers.push(l);
      this.drawn.push({ layer: l, list, descs, place: (how) => place(model, list.map((it) => ({ x: it.x, y: it.y, z: it.z })), how) });
      this.group.add(l.mesh);
    };
    // the rocks: the generated boulders (glbPaint.ts; every third boulder the tall faceted one) when `modelsOn('rocks')`,
    // else the procedural blobs — the same plan, sizes and tints either way
    const rockModels = modelsOn('rocks')
      ? await Promise.all((['boulder-1', 'boulder-2', 'boulder-3'] as const).map((n) => loadNalatiModel(this.sky, n, { rim: 0.3, bands: 0.8 }))).catch((e: unknown) => { console.warn('[nalati] rock models failed', e); return null; })
      : null;
    if (rockModels) {
      const [b1, b2, b3] = rockModels;
      if (b1 && b2 && b3) {
        add(boulder, 'boulder', bakedActorGeometry(`dressing:${TIER}:boulder`), b1.material, plan.boulder.filter((_, i) => i % 3 !== 2), FAR.rock, { castShadow: true, keepNear: 40 });
        add(boulder, 'boulder-tall', bakedActorGeometry(`dressing:${TIER}:boulder-tall`), b2.material, plan.boulder.filter((_, i) => i % 3 === 2), FAR.rock, { castShadow: true, keepNear: 40 });
        add(slab, 'slab', bakedActorGeometry(`dressing:${TIER}:slab`), b3.material, plan.slab, FAR.rock, { castShadow: true, keepNear: 40 });
      }
    } else {
      add(boulder, 'boulder', dressingGeo(`boulder:${PHONE ? 2 : 3}`), rock, plan.boulder, FAR.rock, { castShadow: true, keepNear: 40 });
      add(slab, 'slab', dressingGeo(`slab:${PHONE ? 2 : 3}`), rock, plan.slab, FAR.rock, { castShadow: true, keepNear: 40 });
    }
    add(stone, 'stone', dressingGeo('stone'), rock, plan.stone, FAR.small);
    add(juniper, 'juniper', dressingGeo('juniper'), shrub, plan.juniper, FAR.shrub, { castShadow: !PHONE });
    add(wildRose, 'rose', dressingGeo(PHONE ? 'rose:lite' : 'rose'), shrub, plan.rose, FAR.shrub, { castShadow: !PHONE });
    add(dwarfWillow, 'willow', dressingGeo('willow'), shrub, plan.willow, FAR.shrub, { castShadow: !PHONE });
    add(lupin, 'lupin', dressingGeo(PHONE ? 'lupin:lite' : 'lupin'), flower, plan.lupin, FAR.flower);
    add(daisy, 'daisy', dressingGeo('daisy'), flower, plan.daisy, FAR.flower);
    add(reeds, 'reed', dressingGeo('reed'), reed, plan.reed, FAR.shrub);
    lap('layers');
    cover.clear();
    addCover(plan.boulder, 0.9); addCover(plan.slab, 1.1); addCover(plan.juniper, 0.85); addCover(plan.rose, 0.5); addCover(plan.willow, 0.4);
    await yieldTask();
    t0 = diagnosticNow();

    const steps = this.staticSteps('dressing-statics');
    let step = steps.next();
    while (step.done !== true) { await yieldTask(); step = steps.next(); }
    const st = step.value;
    this.props = st.object.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    this.propTris = st.tris;
    this.staticPiece = st;
    this.statics = st.object;
    this.group.add(this.statics);
    if (this.flutter.count > 0) this.group.add(this.flutter.build(this.sky));
    this.colliders = [...plan.colliders, ...st.colliders];
    this.descs.push(...(st.descs ?? []));
    lap('props');
    await yieldTask();
    t0 = diagnosticNow();

    this.life = dressingLife(this.sky);
    this.group.add(this.life.group);
    lap('life');
    await yieldTask();
    return this;
  }

  /** Into the scene; camp clutter uses its already-cleared build-time anchors. */
  addTo(scene: THREE.Object3D): void {
    scene.add(this.group);
    const steps = this.staticSteps('dressing-clutter');
    for (;;) { const step = steps.next(); if (step.done === true) { this.addClutter(step.value); break; } }
  }

  /** `addTo`, the clutter a task apart whenever `due` says the task is over budget (SF67); the same clutter */
  async addToSliced(scene: THREE.Object3D, due: () => Promise<void> | null): Promise<void> {
    scene.add(this.group);
    const steps = this.staticSteps('dressing-clutter');
    for (;;) {
      const step = steps.next(); if (step.done === true) { this.addClutter(step.value); break; }
      const pause = due(); if (pause !== null) await pause;
    }
  }

  private staticSteps(name: string): Generator<void, PoiPiece> {
    return bakedPlaceSteps(name, { sky: this.sky, ground: () => 0, flutter: this.flutter, smoke: { emitter: () => undefined } }, new Map([placer(fallenLog), placer(stump), placer(ovoo), placer(viewpointPole), placer(skyGateway), placer(fence), placer(campClutter)]));
  }

  private addClutter(cl: PoiPiece): void {
    if (isMesh(cl.object)) { this.group.add(cl.object); this.props.push(cl.object); this.propTris += cl.tris; this.clutter = cl; }
    this.colliders.push(...cl.colliders);
    if (import.meta.env.DEV) Object.assign(window, { __nalatiDressing: this }); // dev: stats / poking from the console
  }

  /**
   * The dressing's models into the world registry (E306 / E315; NALATI-MERGE P1: its collision): each scatter layer's
   * model placed `drawnInto` its layer, the big rocks' hulls 150 a task (the phone's per-task collider budget), then the
   * props (their region meshes) and the camps' clutter.
   */
  async place(registry: WorldRegistry, yieldTask: () => Promise<void>): Promise<readonly Placed[]> {
    const ctx = modelContext(this.sky);
    const out: Placed[] = [];
    for (const d of this.drawn) {
      const placed = d.place({
        ctx, draw: 'instanced', registry, drawnInto: { object: d.layer.mesh, boxes: instanceBoxes(d.layer.mesh.geometry, d.list), colliders: d.descs },
        piece: { solidFloor: true, split: { every: 150, yieldTask } },
      });
      await placed.registered;
      out.push(placed);
      await yieldTask();
    }
    if (this.staticPiece?.register) out.push(...this.staticPiece.register({ ctx, registry }));
    await yieldTask();
    if (this.clutter?.register) out.push(...this.clutter.register({ ctx, registry }));
    return out;
  }

  update(dt: number, view: THREE.PerspectiveCamera, player: THREE.Vector3, renderer: Renderer): void {
    // SF63: the layers' copies are in the group's space; inside a grid cell it stands at the cell's render offset, so the
    // cull reads the camera seen from the group (standalone: the camera itself)
    const camera = this.frame.of(view);
    camera.getWorldPosition(this.camPos);
    camera.getWorldDirection(this.dir);
    const moved = this.camPos.distanceToSquared(this.lastPos) > 1;
    const turned = this.dir.dot(this.lastDir) < 0.9994; // ≈ 2°
    if (moved || turned) {
      this.lastPos.copy(this.camPos); this.lastDir.copy(this.dir);
      camera.updateMatrixWorld();
      this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projScreen);
      for (const l of this.layers) l.cull(this.frustum, this.camPos);
    }
    this.flutter.update(dt);
    renderer.getDrawingBufferSize(this.size);
    this.life?.update(dt, view, player, this.size.y);
  }

  /** visible instances / triangles per layer (after the last cull) + the static props */
  stats(): { layers: Record<string, { total: number; visible: number; tris: number }>; propTris: number; clothVerts: number; calls: number } {
    const layers: Record<string, { total: number; visible: number; tris: number }> = {};
    let calls = 0;
    for (const l of this.layers) { layers[l.name] = { total: l.count, visible: l.visible, tris: Math.round(l.tris) }; if (l.visible > 0) calls++; }
    return { layers, propTris: Math.round(this.propTris), clothVerts: this.flutter.vertexCount, calls: calls + this.props.length + 4 };
  }
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh { return object instanceof THREE.Mesh; }
