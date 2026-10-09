/**
 * Nalati dressing (look-pass lever 6, "density") — everything small that makes the steppe feel lived-in between the
 * POIs: boulder clusters with moss and lichen, outcrop slabs, stones lining every road, pebbles / cobbles / driftwood
 * on the gravel bars, junipers, wild rose, dwarf willow, lupin / sage and edelweiss / buttercup drifts in 3D, reeds,
 * fallen logs and stumps round the spruce, ovoo cairns and ribbon poles at the viewpoints, loose clutter round the
 * camps, and ambient life (pollen + seed fluff in the sun, butterflies over the drifts, kites circling high).
 *
 *   import { NalatiDressing } from '../world/nalati/dressing';
 *   const dressing = await new NalatiDressing(sky, forest).build(macrotask);   // deterministic from the seed; yields between passes
 *   dressing.addTo(game.scene, pois.colliders);                  // meshes (+ the camp clutter, clear of those boxes)
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
import { TIER } from '@wildshard/engine/core/tier';
import { FrameCamera } from '@wildshard/engine/world/frameCamera';
import { modelContext, type ModelDef } from '@wildshard/engine/models/model';
import { place, type PlaceOptions, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { Flutter } from '../Flutter';
import { DressLayer, type Inst } from './layer';
import { planDressing, type DressPlan } from './place';
import { buildStatics, buildCampClutter } from './statics';
import { DressLife } from './life';
import { loadNalatiModel, modelsOn } from '../glbPaint';
import type { NalatiSet } from '../painted';
import { hullAt, hullCandidates, type Box } from '../solid';
import {
  boulder, slab, stone, juniper, wildRose, dwarfWillow, lupin, daisy, reeds, fitRock, GENERATED_ROCK, ROCK_LOOK,
  boulderGeo, slabGeo, stoneGeo, juniperGeo, roseGeo, willowGeo, lupinGeo, daisyGeo, reedGeo,
} from '../../models/dressing';

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
  life: DressLife | null = null;
  /** the boxes, as data (keep-outs); their solids are in `descs` or, for a `ghost`, a hull / capsule / prism there */
  colliders: Box[] = [];
  /** the collision as real geometry: big rocks as hulls of what they draw, logs as capsules, the ovoo heaps as prisms */
  descs: ColliderDesc[] = [];
  plan: DressPlan | null = null;
  /** the one-off props (merged per region: the props' tap target) and the camps' clutter */
  readonly statics = new THREE.Group();
  private drawn: Drawn[] = [];
  private staticsSet: NalatiSet | null = null;
  private clutter: { set: NalatiSet; mesh: THREE.Mesh } | null = null;
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

  constructor(private sky: Sky, private forest: Forest | null) { this.group.name = 'nalati-dressing'; this.statics.name = 'nalati-dress-statics'; }

  async build(yieldTask: () => Promise<void> = () => Promise.resolve()): Promise<this> {
    let t0 = performance.now();
    const lap = (k: string) => { const t = performance.now(); this.timings[k] = Math.round(t - t0); t0 = t; };
    const plan = this.plan = await planDressing(this.forest, yieldTask);
    lap('plan');
    await yieldTask();
    t0 = performance.now();

    const rock = painterlyMaterial(this.sky, { rim: 0.3, bands: 0.8 });
    const shrub = painterlyMaterial(this.sky, { rim: 0.5, bands: 0.7, sway: 0.05 });
    const flower = painterlyMaterial(this.sky, { rim: 0.45, bands: 0.6, sway: 0.3 });
    const reed = painterlyMaterial(this.sky, { rim: 0.5, bands: 0.6, sway: 0.1 });
    const add = <P extends object>(model: ModelDef<P>, name: string, geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[], far: number, o: { castShadow?: boolean; keepNear?: number } = {}) => {
      if (list.length === 0) { geo.dispose(); return; }
      const l = new DressLayer(name, geo, mat, list, { farScale: far, ...o });
      // P1: a big rock collides as the hull of what this layer draws for it
      const descs: ColliderDesc[] = [];
      if (list.some((it) => it.solid === true)) {
        const cand = hullCandidates(geo), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
        for (const it of list) {
          if (it.solid !== true) continue;
          m.compose(p.set(it.x, it.y, it.z), q.setFromEuler(e.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0, 'YXZ')), sc.set(it.sx, it.sy, it.sz));
          descs.push(hullAt(cand, m, 'rock'));
        }
        this.descs.push(...descs);
      }
      this.layers.push(l);
      this.drawn.push({ layer: l, list, descs, place: (how) => place(model, list.map((it) => ({ x: it.x, y: it.y, z: it.z })), how) });
      this.group.add(l.mesh);
    };
    // the rocks: the generated boulders (glbPaint.ts; every third boulder the tall faceted one) when `modelsOn('rocks')`,
    // else the procedural blobs — the same plan, sizes and tints either way
    const rockModels = modelsOn('rocks')
      ? await Promise.all(([GENERATED_ROCK.round.name, GENERATED_ROCK.tall.name, GENERATED_ROCK.slab.name] as const).map((n) => loadNalatiModel(this.sky, n, ROCK_LOOK))).catch((e: unknown) => { console.warn('[nalati] rock models failed', e); return null; })
      : null;
    if (rockModels) {
      const [b1, b2, b3] = rockModels;
      if (b1 && b2 && b3) {
        add(boulder, 'boulder', fitRock(b1, GENERATED_ROCK.round.half), b1.material, plan.boulder.filter((_, i) => i % 3 !== 2), FAR.rock, { castShadow: true, keepNear: 40 });
        add(boulder, 'boulder-tall', fitRock(b2, GENERATED_ROCK.tall.half), b2.material, plan.boulder.filter((_, i) => i % 3 === 2), FAR.rock, { castShadow: true, keepNear: 40 });
        add(slab, 'slab', fitRock(b3, GENERATED_ROCK.slab.half), b3.material, plan.slab, FAR.rock, { castShadow: true, keepNear: 40 });
      }
    } else {
      add(boulder, 'boulder', boulderGeo(0xb01d, PHONE ? 2 : 3), rock, plan.boulder, FAR.rock, { castShadow: true, keepNear: 40 });
      add(slab, 'slab', slabGeo(0x51ab, PHONE ? 2 : 3), rock, plan.slab, FAR.rock, { castShadow: true, keepNear: 40 });
    }
    add(stone, 'stone', stoneGeo(0x5707), rock, plan.stone, FAR.small);
    add(juniper, 'juniper', juniperGeo(0x1a9), shrub, plan.juniper, FAR.shrub, { castShadow: !PHONE });
    add(wildRose, 'rose', roseGeo(0x805e, PHONE), shrub, plan.rose, FAR.shrub, { castShadow: !PHONE });
    add(dwarfWillow, 'willow', willowGeo(0x3170), shrub, plan.willow, FAR.shrub, { castShadow: !PHONE });
    add(lupin, 'lupin', lupinGeo(0x1ab1, PHONE), flower, plan.lupin, FAR.flower);
    add(daisy, 'daisy', daisyGeo(0xda15), flower, plan.daisy, FAR.flower);
    add(reeds, 'reed', reedGeo(0x4eed), reed, plan.reed, FAR.shrub);
    lap('layers');
    cover.clear();
    addCover(plan.boulder, 0.9); addCover(plan.slab, 1.1); addCover(plan.juniper, 0.85); addCover(plan.rose, 0.5); addCover(plan.willow, 0.4);
    await yieldTask();
    t0 = performance.now();

    const st = buildStatics(this.sky, plan, this.flutter);
    this.props = st.meshes;
    this.propTris = st.tris;
    this.staticsSet = st.set;
    for (const m of st.meshes) this.statics.add(m);
    this.group.add(this.statics);
    if (this.flutter.count > 0) this.group.add(this.flutter.build(this.sky));
    this.colliders = [...plan.colliders, ...st.colliders];
    this.descs.push(...st.descs);
    lap('props');

    this.life = new DressLife(this.sky, plan.drifts).build();
    this.group.add(this.life.group);
    lap('life');
    return this;
  }

  /** into the scene; the camps' clutter keeps clear of `avoid` (the POIs' boxes, the outcrops') */
  addTo(scene: THREE.Object3D, avoid: readonly Collider[]): void {
    scene.add(this.group);
    const cl = buildCampClutter(this.sky, avoid);
    if (cl.mesh) { this.group.add(cl.mesh); this.props.push(cl.mesh); this.propTris += cl.tris; this.clutter = { set: cl.set, mesh: cl.mesh }; }
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
    if (this.staticsSet) out.push(...this.staticsSet.register({ ctx, registry, object: this.statics }));
    await yieldTask();
    if (this.clutter) out.push(...this.clutter.set.register({ ctx, registry, object: this.clutter.mesh }));
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
