import dungeonLayout from '../data/kurganLayout.generated.json' with { type: 'json' };
import { annulus } from '@wildshard/engine/fx/groundFx';
import { finGeometry, ribGeometry, towerGeometry, type CragKind } from './cragGeometry';
import peopleFallbackFrames from '../data/peopleFrames.json' with { type: 'json' };
import type { DressPlan } from './dressingPlan';
import * as THREE from 'three';
import { paramsOf, type ModelDef, type ModelBuild, type ModelContext, type Placement } from '@wildshard/engine/models/model';
import { setTerrainHeight } from '@wildshard/engine/world/terrainHeight';
import { bakedSamplers, parseBakedTerrain } from '@wildshard/engine/world/BakedTerrain';
import { PaintKit, M, v3 } from './paint';
import { pole, lathe, blob, mergeVerticesByPos } from './smoothGeometry';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { graniteBlock } from './granite';
import { painted, paintedSpecimen, isPainted, rememberPainted, type Paint, type PaintCtx, type Made, type Kit, type PaintAt } from './painted';
import { cragLedgeFloor, leopardCaveFloor, kurganEntranceFloor, generatedBounds, instanceTris, type MemberData, type InstanceData, type GeneratedSpec } from './placement';
import type { FieldstoneParams, FieldstoneLook, Board, CragLedgeParams, LeopardCaveParams, KurganEntranceParams, KurganKerbParams, FirewoodParams, ChurnParams } from './campParams';
import { CAMP, CORRAL, HITCHING_RAIL, SUMMER_CAMP, BRIDGE, EAGLE_ROCK, WIND_CAIRN, CRAGS, WEST_CRAGS, CRAG_CAVE, KURGANS, GREAT_KURGAN, KURGAN_BALBALS, GREAT_KURGAN_DOOR } from './poiLayout';
import { boxDescs, prism, slab, supportHull, type Box } from './solid';
import { placementMatrix } from './modelPlacement';
import type { ModelPlacement, NalatiModelName } from '../data/modelTypes';
import type { Draw } from '@wildshard/engine/models/place';
import { specimenKey } from '@wildshard/game/models/specimenCatalogue';
import { torFloor, type PlaceFloorRow, type DressingGeoRow, type EffectRow, type MemberRow, type PlaceMeshRow, type PlaceRow, type SpecimenRow } from './placeRows';
import { EAGLE_PERCH_H, ribbonPolePainted, eaglePerchPainted, stovePainted, campBenchPainted, rugRackPainted, feltRugPainted, cartPainted, barrelPainted, hitchingRailPainted, waterTroughPainted, saddleRackPainted, corralPainted, hayPilePainted, feedTroughPainted, rugLinePainted, choppingBlockPainted, milkCansPainted, tetherLinePainted, kurtBoardPainted, ribbonPostPainted, graniteOutcropPainted, roundedBoulderPainted, fencePainted, fallenLogPainted, stumpPainted, ovooPainted, viewpointPolePainted, skyGatewayPainted, campClutterPainted, kokparGoalPainted, kokparPostPainted, stoneStepPainted, signpostPainted, fenceRun, logEnds, type RockTint } from './campProps';
import { eagleRock, windCairn, cragLedge, leopardCave, kurganEntrance, kurganKerb, fieldstoneBaked, kazan, chest, firewood, kumisChurn, groundSaddle, perchedEagle, watchtower, saddledHorse, kokparRider } from './catalogue';
import { yurtPainted } from './yurt';
import { kunesBridgePainted } from './kunesBridge';
import { yardGeometry, wearDisc, wearPath } from './yard';
import { bakeDressing } from './dressingBake';
import { writeGeometry, join } from './geometryWriter';
import { LEOPARD_CAVE, ARGYMAQ_PASTURE, SNOW_LOTUS, WATCHTOWER, KOKPAR, PASTURE, HORSE_PLAINS, SUMMER_YURTS, RIM_N as RIM_Z, MELT_STREAM as BROOK } from './layout';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '@wildshard/engine/core/rng';
import { inPoiClearing,zoneAt,glacierMask,brookMask,riverMask,rimZAt,RIVER,outcropAt,edgeBermAt } from './terrainRecipe';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { Noise2D, smoothstep } from '@wildshard/engine/core/noise';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { normalAt, trailDistance } from '@wildshard/engine/world/Heightfield';


/**
 * Build-time only (SHARD-PLATFORM M3, Nalati's places bake): the spring camp, the Kunes bridge and the summer camp, built
 * here by the builders that `world/NomadCamp.ts`, `world/Bridge.ts` and `world/SummerCamp.ts` used to run on the page
 * (moved verbatim: the same models painted in the same order from the same rng streams), over the page's ground, plus every
 * painted model's Explorer specimen (its defaults and each variant). `scripts/bake-nalati-places.mjs` runs it in Chromium
 * (its sin / cos / atan2 are the page's to the last bit: the places' colliders come from here) and writes each geometry's
 * attributes as their own float bytes, welded (identical vertices once, an index to expand them by), and the rows: each
 * place's meshes (name, material, child slot, in the order the builder made them), data boxes, cloth and smoke calls, its
 * generated (GLB) instances and per model the copies `place` registers. `world/placeBake.ts` draws them back bit-exact.
 */

/** Placement-only bake marker. Specimen builds belong to the declared host. */
function generated<P extends object>(spec: GeneratedSpec<P>): (() => never) & { readonly gen: GeneratedSpec<P> } {
  return Object.assign((): never => { throw new Error('Placement bake markers cannot build live specimens'); }, { gen: spec });
}

type Build<P> = (ctx: ModelContext, p: P, rng: Rng) => ModelBuild;
interface GeneratedBuild<P> { (ctx: ModelContext, p: P, rng: Rng): ModelBuild; readonly gen: GeneratedSpec<P> }
const isGenerated = <P>(b: Build<P>): b is GeneratedBuild<P> => 'gen' in b;
const _box = new THREE.Box3(), _part = new THREE.Box3(), _pt = new THREE.Vector3();

export class NalatiSet {
  /** the kit the painters paint into: the place's own, each part's world box tracked for its copy */
  readonly kit: Kit;
  private readonly members = new Map<string, MemberData>();
  /** the generated models' instances, per model, in the order they were first put */
  private readonly instances = new Map<NalatiModelName, InstanceData>();
  private tracking = false;
  /** every box every copy made, in order (the POI's `colliders` data) */
  readonly boxes: Box[] = [];

  /** the kit the painters paint into now (`into` moves it: a dressing prop is a kit of its own, finished on its own) */
  private current: PaintKit | null;

  /** `paintKit`: the place's kit (null: a place of generated models only, or one whose props each bring a kit: `into`) */
  constructor(paintKit: PaintKit | null, readonly c: PaintCtx) {
    this.current = paintKit;
    let none: PaintKit | null = null;
    const self = (): PaintKit | null => this.current;
    this.kit = {
      get rng() { return (self() ?? (none ??= new PaintKit(0))).rng; },
      add: (g, col, o) => {
        const k = self();
        if (!k) throw new Error('NalatiSet: this place has no kit to paint into');
        if (this.tracking) {
          const pos = g.getAttribute('position');
          _part.makeEmpty();
          for (let i = 0; i < pos.count; i++) _part.expandByPoint(_pt.set(pos.getX(i), pos.getY(i), pos.getZ(i)));
          if (o?.matrix) _part.applyMatrix4(o.matrix);
          _box.union(_part);
        }
        k.add(g, col, o);
      },
    };
  }

  /** paint into `kit` from now on (its rng is the painters' stream): each dressing prop is a kit of its own */
  into(kit: PaintKit): this { this.current = kit; return this; }

  private member<P extends object>(def: ModelDef<P>, draw: Draw, inKit: boolean): MemberData {
    let m = this.members.get(def.id);
    if (!m) {
      const mm: MemberData = {
        draw, inKit, placements: [], boxes: [], solid: [], descs: [], floors: [],
      };
      this.members.set(def.id, mm);
      m = mm;
    }
    return m;
  }

  private record(m: MemberData, pl: Omit<Placement<object>, 'params'>, box: THREE.Box3, made: Made): void {
    m.placements.push(pl);
    m.boxes.push(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z);
    const boxes = made.boxes ?? [];
    this.boxes.push(...boxes);
    m.solid.push(...boxDescs(boxes));
    m.descs.push(...(made.descs ?? []));
    if (made.floor) m.floors.push(made.floor);
  }

  /** paint one copy of a painted model into the place's kit, now; returns what it made */
  paint<P extends object>(def: ModelDef<P>, at: PaintAt, p: NoInfer<P>): Made {
    const b = def.build;
    if (!isPainted(b)) throw new Error(`NalatiSet.paint: ${def.id} is not a painted model`);
    _box.makeEmpty();
    this.tracking = true;
    let made: Made;
    try { made = b.paint(this.kit, at, p, this.c); } finally { this.tracking = false; }
    rememberPainted(b, at, p);
    this.record(this.member(def, 'merged', true), { x: at.x, y: at.y, z: at.z, yaw: at.yaw }, _box, made);
    return made;
  }

  /** one copy of a generated model, instanced with the place's others of it when its GLB lands; returns what it collides with */
  instance<P extends object>(def: ModelDef<P>, at: ModelPlacement, p: NoInfer<P>): Made {
    const b = def.build;
    if (!isGenerated(b)) throw new Error(`NalatiSet.instance: ${def.id} is not a generated model`);
    const pose = b.gen.pose?.(at, p) ?? at;
    let list = this.instances.get(b.gen.name);
    if (!list) { list = { look: b.gen.look ?? {}, castShadow: b.gen.castShadow ?? true, placements: [] }; this.instances.set(b.gen.name, list); }
    list.placements.push(pose);
    const made = b.gen.collide?.(at, p) ?? {};
    this.record(this.member(def, 'instanced', false), this.generatedCopy(b.gen.name, pose), _box, made);
    return made;
  }

  /**
   * Copies of a generated model the place draws and moves itself (the kokpar's galloping riders, the grazing herds):
   * counted and boxed where they start; nothing collides.
   */
  moving<P extends object>(def: ModelDef<P>, at: readonly ModelPlacement[]): void {
    const b = def.build;
    if (!isGenerated(b)) throw new Error(`NalatiSet.moving: ${def.id} is not a generated model`);
    const m = this.member(def, 'instanced', false);
    for (const pose of at) this.record(m, this.generatedCopy(b.gen.name, pose), _box, {});
  }

  /** a generated copy's placement, and its world box into `_box` (the file's measured size, before it has loaded) */
  private generatedCopy(name: NalatiModelName, pose: ModelPlacement): Omit<Placement<object>, 'params'> {
    const matrix = placementMatrix(pose);
    generatedBounds(name, _box).applyMatrix4(matrix);
    return { x: pose.x, y: pose.y, z: pose.z, matrix };
  }

  /** the generated models' triangles (the POI's perf report) */
  tris(): number { return instanceTris(this.instances); }

  /** the set as data, in order: each model's copies (by model id) and the generated instances (the places bake) */
  rows(): { readonly members: readonly (readonly [string, MemberData])[]; readonly instances: readonly (readonly [NalatiModelName, InstanceData])[] } {
    return { members: [...this.members.entries()], instances: [...this.instances.entries()] };
  }

}

const FLIP = Math.PI;
const towerSize = generatedBounds('watchtower').getSize(new THREE.Vector3());
const kazanPlaced: ModelDef<object> = { ...kazan, build: generated({
    id: 'nalati-grasslands/kazan', name: 'cauldron',
    pose: (at) => ({ x: at.x, y: at.y - 0.04, z: at.z, rot: at.rot ?? 0.4, scale: 1.05 }),
    collide: (at) => ({ boxes: [{ x: at.x, z: at.z, hw: 0.7, hd: 0.7, rot: 0, yBottom: at.y - 1, yTop: at.y + 0.95 }] }),
  }),
};
const chestPlaced: ModelDef<object> = { ...chest, build: generated({
    id: 'nalati-grasslands/chest', name: 'chest',
    pose: (at) => ({ x: at.x, y: at.y - 0.02, z: at.z, rot: (at.rot ?? 0) + FLIP, scale: 1.2 }),
    collide: (at) => ({ boxes: [{ x: at.x, z: at.z, hw: 0.55, hd: 0.3, rot: -(at.rot ?? 0), yBottom: at.y - 1, yTop: at.y + 0.75 }] }),
  }),
};
const firewoodPlaced: ModelDef<FirewoodParams> = { ...firewood, build: generated<FirewoodParams>({
    id: 'nalati-grasslands/firewood', name: 'firewood',
    pose: (at, p) => ({ x: at.x, y: at.y - 0.03, z: at.z, rot: (at.rot ?? 0) + FLIP + p.dy, scale: 1.45 }),
    collide: (_at, p) => (p.pile === undefined ? {} : { boxes: [p.pile] }),
  }),
};
const kumisChurnPlaced: ModelDef<ChurnParams> = { ...kumisChurn, build: generated<ChurnParams>({
    id: 'nalati-grasslands/kumis-churn', name: 'kumis-churn',
    pose: (at) => ({ x: at.x, y: at.y - 0.02, z: at.z, rot: at.rot ?? 0, scale: at.scale ?? 1 }),
    collide: (at, p) => ({ boxes: [{ x: at.x, z: at.z, hw: p.hw, hd: p.hw, rot: 0, yBottom: at.y - 1, yTop: at.y + p.h }] }),
  }),
};
const groundSaddlePlaced: ModelDef<object> = { ...groundSaddle, build: generated({
    id: 'nalati-grasslands/ground-saddle', name: 'saddle',
    pose: (at) => ({ x: at.x, y: at.y - 0.02, z: at.z, rot: (at.rot ?? 0) + FLIP, scale: 1.25 }),
  }),
};
const perchedEaglePlaced: ModelDef<object> = { ...perchedEagle, build: generated({
    id: 'nalati-grasslands/perched-eagle', name: 'eagle',
    pose: (at) => ({ x: at.x, y: at.y - 0.02, z: at.z, rot: (at.rot ?? 0) + FLIP, scale: 0.85 / generatedBounds('eagle').max.y }),
  }),
};
const watchtowerPlaced: ModelDef<object> = { ...watchtower, build: generated({
    id: 'nalati-grasslands/watchtower', name: 'watchtower', look: { rim: 0.3, bands: 0.8 },
    pose: (at) => ({ x: at.x, y: at.y - 0.4, z: at.z, rot: at.rot ?? 0 }),
    collide: (at) => ({ boxes: [{ x: at.x, z: at.z, hw: towerSize.x * 0.36, hd: towerSize.z * 0.36, rot: -(at.rot ?? 0), yBottom: at.y - 2, yTop: at.y + towerSize.y * 0.85 }] }),
  }),
};
const saddledHorsePlaced: ModelDef<object> = { ...saddledHorse, build: generated({ id: 'nalati-grasslands/saddled-horse', name: 'horse-saddled', look: { rim: 0.8, bands: 0.85 } }),
};
const kokparRiderPlaced: ModelDef<object> = { ...kokparRider, build: generated({ id: 'nalati-grasslands/kokpar-rider', name: 'kokpar-rider', look: { rim: 0.8, bands: 0.85 } }),
};

function finishBuild(steps: Generator<void, BuiltPlace>): BuiltPlace { for (;;) { const step = steps.next(); if (step.done === true) return step.value; } }

// ── the cloth and smoke a place makes, recorded in order ──────────────────────────────────────────────────────────────

type Rgb = THREE.ColorRepresentation;
const point = (p: THREE.Vector3): number[] => [p.x, p.y, p.z];
const colour = (c: Rgb): string | number => {
  if (typeof c === 'string' || typeof c === 'number') return c;
  throw new Error('[nalati places] a cloth colour the bake cannot replay');
};
const recordingFlutter = (log: EffectRow[]): PaintCtx['flutter'] => ({
  streamer: (a, len, w, color, o = {}) => { log.push(['streamer', point(a), len, w, colour(color), o]); },
  flag: (top, h, len, color, o = {}) => { log.push(['flag', point(top), h, len, colour(color), o]); },
  strip: (a, len, w, color) => { log.push(['strip', point(a), len, w, colour(color)]); },
});
const recordingPlumes = (log: EffectRow[]): Plumes => ({ emitter: (p, o = {}) => { log.push(['emitter', point(p), o]); } });

// ── the places (the builders, verbatim but for drawing: each mesh's geometry is kept with its material's kind) ─────────

interface BuiltMesh { readonly name: string; readonly material: string; readonly slot: number; readonly geometry: THREE.BufferGeometry }
export interface BuiltPlace { readonly name: string; readonly group: string | null; readonly surface: string; readonly tris: number; readonly meshes: BuiltMesh[]; readonly set: NalatiSet; readonly effects: EffectRow[]; readonly anchors?: PlaceAnchors; readonly colliders?: readonly Box[]; readonly headings?: ReadonlyMap<string, readonly (readonly [number, number])[]> }

/** the yurts: angle round the yard (deg, 0 = +x/west, 90 = +z/north), distance, radius, flue, palette */
const YURTS: { a: number; d: number; r: number; flue: boolean; pal: number; old?: boolean; base: 'lattice' | 'reed' | 'felt' }[] = [
  { a: 128, d: 13.5, r: 3.0, flue: true, pal: 0, base: 'lattice' },
  { a: 88, d: 14.5, r: 3.5, flue: true, pal: 1, base: 'reed' },      // the big one (the host's)
  { a: 46, d: 13.0, r: 2.8, flue: false, pal: 2, old: true, base: 'felt' },
  { a: 2, d: 13.5, r: 3.1, flue: true, pal: 0, base: 'lattice' },
  { a: -44, d: 13.0, r: 2.7, flue: false, pal: 1, base: 'reed' },
  { a: -92, d: 13.5, r: 3.2, flue: false, pal: 2, base: 'lattice' },
];

const trisOf = (g: THREE.BufferGeometry): number => g.getAttribute('position').count / 3;

/** the spring camp (world/NomadCamp.ts's builder): six yurts round the yard, the corral, the rail, the props */
function nomadCamp(ctx: PaintCtx, effects: EffectRow[]): BuiltPlace {
  const { ground, smoke } = ctx;
  const kit = new PaintKit(0x7a17);
  const set = new NalatiSet(kit, ctx);
  const rng = kit.rng;
  const cx = CAMP.x, cz = CAMP.z;
  const on = (x: number, z: number, yaw = 0) => ({ x, y: ground(x, z), z, yaw });

  // ── yurts ──
  const doors: { x: number; z: number; rot: number; r: number }[] = [];
  for (const y of YURTS) {
    const a = (y.a * Math.PI) / 180;
    const x = cx + Math.cos(a) * y.d, z = cz + Math.sin(a) * y.d;
    // door toward the yard (with a little irregularity)
    const fx = cx - x, fz = cz - z;
    const rot = Math.atan2(-fx, -fz) + rng.range(-0.18, 0.18);
    // stand on the lowest point of the footprint so no edge floats; the wall skirt runs 0.25 m into the ground
    let gy = Infinity;
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; gy = Math.min(gy, ground(x + Math.cos(t) * y.r, z + Math.sin(t) * y.r)); }
    gy = Math.min(gy, ground(x, z));
    // a pennant at the crown of every other yurt
    set.paint(yurtPainted, { x, y: gy, z, yaw: rot }, { r: y.r, flue: y.flue, palette: y.pal, old: y.old ?? false, base: y.base, pennant: y.pal !== 2 });
    doors.push({ x, z, rot, r: y.r });
  }

  // ── the ribbon pole in the yard; the eagle perch, the eagle facing the road (east) ──
  set.paint(ribbonPolePainted, on(cx + 1.5, cz - 0.5), {});
  {
    const at = on(cx - 9, cz + 1.5);
    set.paint(eaglePerchPainted, at, {});
    set.instance(perchedEaglePlaced, { x: at.x + 0.05, y: at.y + EAGLE_PERCH_H + 0.12, z: at.z, rot: Math.PI / 2 + 0.35 }, {});
  }

  // ── cooking: the stove and the kazan in the yard, smoking; the woodpile; a low bench by the kazan ──
  set.paint(stovePainted, on(cx + 4.5, cz - 5.5, 0.4), {});
  {
    const x = cx - 3.2, z = cz - 6.2, y = ground(x, z);
    set.instance(kazanPlaced, { x, y, z, rot: 0.4 }, {});
    smoke.emitter(v3(x, y + 0.9, z), { puffs: 28, rise: 4.5, size: [0.5, 3.0], life: 6 });
  }
  {
    // two birch stacks side by side along the pile; the pile's one box
    const x = cx + 8.5, z = cz - 3, yaw = 0.9, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const pile: Box = { x, z, hw: 0.8, hd: 0.85, rot: -yaw, yBottom: ground(x, z) - 1, yTop: ground(x, z) + 0.85 };
    for (const [k, [o, dy]] of ([[-0.45, 0.2], [0.45, -0.15]] as const).entries()) {
      const px = x + o * cs, pz = z - o * sn;
      set.instance(firewoodPlaced, { x: px, y: ground(px, pz), z: pz, rot: yaw }, k === 0 ? { dy, pile } : { dy });
    }
  }
  set.paint(campBenchPainted, on(cx - 3.2, cz - 9.0, 0.1), {});

  // ── rugs: a rack of drying felts, two rugs laid out at doors ──
  set.paint(rugRackPainted, on(cx + 6.5, cz + 4.5, -0.5), { pals: [0, 1, 2] });
  for (const k of [1, 3]) {
    const d = doors[k];
    if (!d) continue;
    const fx = -Math.sin(d.rot), fz = -Math.cos(d.rot), rx = d.x + fx * (d.r + 1.4), rz = d.z + fz * (d.r + 1.4);
    set.paint(feltRugPainted, on(rx, rz, d.rot), { w: 1.5, h: 2.2, pal: k });
  }

  // ── props round the yard ──
  set.paint(cartPainted, on(cx - 11, cz - 11, 2.3), {});
  for (const [bx, bz] of [[cx + 6.8, cz - 1.2], [cx + 6.3, cz - 0.3], [cx - 1.5, cz + 10.5]] as const) set.paint(barrelPainted, on(bx, bz), { s: rng.range(0.9, 1.05) });
  for (const [hx, hz, hyaw] of [[cx + 0.6, cz + 9.4, 0.2], [cx - 9.5, cz - 4.5, 1.8]] as const) set.instance(chestPlaced, { x: hx, y: ground(hx, hz), z: hz, rot: hyaw }, {});

  // ── the hitching rail (road side, runs north–south) + the water trough + the saddle rack ──
  {
    const { x, z, length: L, height: H } = HITCHING_RAIL;
    set.paint(hitchingRailPainted, on(x, z), { length: L, height: H });
    set.paint(waterTroughPainted, on(x + 1.3, z - L / 2 - 1.2), {});
    set.paint(saddleRackPainted, on(x + 2.2, z + L / 2 + 1.4, 0.3), {});
  }

  // ── the corral: round pole fence, gate open toward the yard (east, −x); a hay pile and a feed trough inside ──
  {
    const { x, z, r } = CORRAL;
    set.paint(corralPainted, on(x, z), { r, posts: 26 });
    set.paint(hayPilePainted, on(x + 3, z + 2, 0.4), {});
    set.paint(feedTroughPainted, on(x - 2.5, z + 5, 0.9), {});
  }

  // the kumis corner by the big yurt: a churn by the yurt, a bigger one 1.1 m east of it
  {
    const x = cx + 3.6, z = cz + 10.2;
    set.instance(kumisChurnPlaced, { x, y: ground(x, z), z, rot: 0.6, scale: 1 }, { hw: 0.28, h: 1.1 });
    const sx = x + 1.1, sz = z + 0.2;
    set.instance(kumisChurnPlaced, { x: sx, y: ground(sx, sz), z: sz, rot: 2.4, scale: 1.15 }, { hw: 0.34, h: 1.25 });
  }

  // ── yard set pieces: rugs on a line, the chopping block, saddles set down by the rail, the milk cans ──
  {
    const ax = cx - 7, az = cz + 6, bx = cx - 2.6, bz = cz + 8.6;
    set.paint(rugLinePainted, on(ax, az), { dx: bx - ax, dz: bz - az, pals: [1, 3, 0] });
  }
  set.paint(choppingBlockPainted, on(cx + 9.5, cz - 5.5), {});
  for (const [sx, sz, syaw] of [[HITCHING_RAIL.x + 2.8, HITCHING_RAIL.z - 2.2, 1.9], [HITCHING_RAIL.x + 3.2, HITCHING_RAIL.z + 1.2, 0.6]] as const) set.instance(groundSaddlePlaced, { x: sx, y: ground(sx, sz), z: sz, rot: syaw }, {});
  set.paint(milkCansPainted, on(cx + 5.2, cz + 8.4), {});

  const meshes: BuiltMesh[] = [];
  // trodden earth: the ring inside the yurts, a path to every door, the track in from the road, bare patches at the
  // rail, the stove and the kazan, and the corral's floor + the path to its gate
  {
    const wear: ((x: number, z: number) => number)[] = [wearDisc(cx, cz, 10.5), wearPath(HITCHING_RAIL.x + 3, cz, cx, cz, 2.4), wearDisc(HITCHING_RAIL.x + 1.2, HITCHING_RAIL.z, 4.2),
      wearDisc(cx + 4.5, cz - 5.5, 2.4), wearDisc(cx - 3.2, cz - 6.2, 3), wearPath(cx + 8, cz + 2, CORRAL.x - CORRAL.r, CORRAL.z, 1.8), wearDisc(CORRAL.x, CORRAL.z, CORRAL.r - 1.5)];
    for (const d of doors) {
      const fx = -Math.sin(d.rot), fz = -Math.cos(d.rot);
      wear.push(wearPath(d.x + fx * (d.r + 0.4), d.z + fz * (d.r + 0.4), cx + (d.x - cx) * 0.4, cz + (d.z - cz) * 0.4, 1.5));
    }
    meshes.push({ name: 'nalati-yard', material: 'yard', slot: 0, geometry: yardGeometry(ground, { x: cx + 6, z: cz + 3, half: 28 }, (x, z) => { let m = 0; for (const w of wear) { const v = w(x, z); if (v > m) m = v; } return m; }) });
  }
  const felt = kit.finishTextured({ ground }, 'felt');
  const mesh = kit.finish({ ground });
  const wood = kit.finishTextured({ ground }, 'rock');   // the corral, the gate, the racks and the perch (props.ts GRAIN)
  let tris = trisOf(mesh), slot = 1;
  const main = slot++;
  if (felt) { meshes.push({ name: 'nalati-camp-felt', material: 'felt', slot: slot++, geometry: felt }); tris += trisOf(felt); }
  meshes.splice(felt ? 2 : 1, 0, { name: '', material: 'poi', slot: main, geometry: mesh });
  if (wood) { meshes.push({ name: 'nalati-camp-wood', material: 'rock', slot, geometry: wood }); tris += trisOf(wood); }
  tris += set.tris();
  return { name: 'camp', group: 'nalati-camp', surface: 'wood', tris, meshes, set, effects };
}

/** the Kunes bridge (world/Bridge.ts's builder): painted into its own mesh */
function bridge(ctx: PaintCtx, effects: EffectRow[]): BuiltPlace {
  const { ground } = ctx;
  const kit = new PaintKit(0xb21d);
  const set = new NalatiSet(kit, ctx);
  set.paint(kunesBridgePainted, { x: BRIDGE.x, y: BRIDGE.deckY, z: BRIDGE.z, yaw: 0 }, { width: BRIDGE.width, span: BRIDGE.span });
  const geometry = kit.finish({ ground, aoH: 0.6 });
  return { name: 'bridge', group: null, surface: 'wood', tris: trisOf(geometry), meshes: [{ name: 'nalati-bridge', material: 'poi', slot: 0, geometry }], set, effects };
}

/** the summer camp (world/SummerCamp.ts's builder): three yurts round a hearth, the tether line, the kurt board */
function summerCamp(ctx: PaintCtx, effects: EffectRow[]): BuiltPlace {
  const { ground, smoke } = ctx;
  const kit = new PaintKit(0x5a33);
  const set = new NalatiSet(kit, ctx);
  const rng = kit.rng;
  const cx = SUMMER_CAMP.x, cz = SUMMER_CAMP.z;
  const on = (x: number, z: number, yaw = 0) => ({ x, y: ground(x, z), z, yaw });
  const Y = [{ a: 70, d: 9, r: 2.9, flue: true, pal: 1 }, { a: 175, d: 9.5, r: 2.6, flue: false, pal: 0 }, { a: -60, d: 9, r: 2.7, flue: true, pal: 2, old: true }];
  for (const y of Y) {
    const a = (y.a * Math.PI) / 180, x = cx + Math.cos(a) * y.d, z = cz + Math.sin(a) * y.d;
    const rot = Math.atan2(-(cx - x), -(cz - z)) + rng.range(-0.25, 0.25);
    let gy = ground(x, z);
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; gy = Math.min(gy, ground(x + Math.cos(t) * y.r, z + Math.sin(t) * y.r)); }
    set.paint(yurtPainted, { x, y: gy, z, yaw: rot }, { r: y.r, flue: y.flue, palette: y.pal, old: y.old ?? false, base: 'lattice', pennant: false });
  }
  {
    const x = cx + 1, z = cz - 1, y = ground(x, z);
    set.instance(kazanPlaced, { x, y, z, rot: 0.4 }, {});
    smoke.emitter(v3(x, y + 0.9, z), { puffs: 28, rise: 4.5, size: [0.5, 3.0], life: 6 });
  }
  set.paint(cartPainted, on(cx - 7, cz + 7.5, 0.6), {});
  set.instance(chestPlaced, { x: cx + 3.5, y: ground(cx + 3.5, cz + 3.5), z: cz + 3.5, rot: 2.2 }, {});
  set.paint(barrelPainted, on(cx - 3.2, cz - 4.6), { s: 1 });
  set.paint(feltRugPainted, on(cx - 1.5, cz + 4.2, 0.3), { w: 1.4, h: 2.0, pal: 3 });
  set.paint(feltRugPainted, on(cx + 4.8, cz - 3.2, 1.2), { w: 1.2, h: 1.8, pal: 2 });
  // the tether line: two posts, a rope between them (the horses will be tied here)
  {
    const ax = cx - 12, az = cz - 3, bx = cx - 12, bz = cz + 5;
    set.paint(tetherLinePainted, on(ax, az), { dx: bx - ax, dz: bz - az });
  }
  set.paint(kurtBoardPainted, on(cx + 6.5, cz + 2.5, 0.7), {});
  set.paint(ribbonPostPainted, on(cx - 2.5, cz + 1.2), {});
  const meshes: BuiltMesh[] = [];
  {
    const wear = [wearDisc(cx, cz, 6.5), wearDisc(cx - 12, cz + 1, 3.5), wearPath(cx - 12, cz + 1, cx, cz, 1.6)];
    for (const y of Y) { const a = (y.a * Math.PI) / 180; wear.push(wearPath(cx + Math.cos(a) * (y.d - y.r - 0.3), cz + Math.sin(a) * (y.d - y.r - 0.3), cx, cz, 1.4)); }
    meshes.push({ name: 'nalati-yard', material: 'yard', slot: 0, geometry: yardGeometry(ground, { x: cx - 3, z: cz, half: 16 }, (x, z) => { let m = 0; for (const w of wear) { const v = w(x, z); if (v > m) m = v; } return m; }) });
  }
  const felt = kit.finishTextured({ ground }, 'felt');
  const mesh = kit.finish({ ground });
  let tris = trisOf(mesh), slot = 1;
  const main = slot++;
  if (felt) { meshes.push({ name: '', material: 'felt', slot: slot++, geometry: felt }); tris += trisOf(felt); }
  meshes.splice(felt ? 2 : 1, 0, { name: '', material: 'poi', slot: main, geometry: mesh });
  const wood = kit.finishTextured({ ground }, 'rock');   // the posts (props.ts GRAIN)
  if (wood) { meshes.push({ name: 'nalati-summer-wood', material: 'rock', slot, geometry: wood }); tris += trisOf(wood); }
  tris += set.tris();
  return { name: 'summerCamp', group: 'nalati-summer-camp', surface: 'wood', tris, meshes, set, effects };
}

// ── the rock places' painters (offline only; their defs: ../models/campProps.ts) ──────────────────────────────────────

/**
 * Eagle Rock (E306 / E315 M3): the granite tor on the west rim (map-01 "EAGLE ROCK", the Tianjie-terrace view) — layers
 * of rounded, lichened, horizontally-jointed granite blocks, each layer twisted on the one below, narrowing to a summit
 * block whose flat top is the terrace, boulders round its foot; a scramble of granite slabs steps round its flank from
 * the south foot (less than one turn, 0.3 m risers) to the summit, where a railed timber viewing deck looks north over
 * the valley and a blue flag flies (the flag and its streamer are the shard's cloth, not the model). Used once
 * (src/shards/nalati-grasslands/generators/places.ts).
 *
 * Fitted to the ground under it: placed at the tor's centre with `at.y` = the summit terrace's height, it sizes itself
 * from the knoll it stands on (its foot is the lowest ground 9 m out). Painted into its place's mesh
 * (src/shards/nalati-grasslands/world/painted.ts). Collides: each layer as a 12-sided prism, the scramble's slabs and the deck as real
 * geometry, the big foot boulders, the rail and the flagpole as boxes; its floor (placement) is the scramble + the summit.
 */
const TOR_C = {
  granite: new THREE.Color('#9d8f7b'),
  graniteWarm: new THREE.Color('#b9a88c'),
  graniteDark: new THREE.Color('#766b5e'),
  lichen: new THREE.Color('#b4a860'),
  moss: new THREE.Color('#8c9c4c'),
  wood: new THREE.Color('#8e6a45'),
  woodGrey: new THREE.Color('#857866'),
};

const torPaint: Paint<object> = (kit, at, _p, c) => {
  const { ground, flutter } = c;
  const rng = kit.rng;
  const colliders: Box[] = [];
  const descs: ColliderDesc[] = [];
  const cx = at.x, cz = at.z, top = at.y;
  let base = Infinity;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; base = Math.min(base, ground(cx + Math.cos(a) * 9, cz + Math.sin(a) * 9)); }
  const H = Math.max(6, top - base);
  const stone = { top: { color: TOR_C.moss, threshold: 0.72, amount: 0.55 }, brush: 0.16 };
  /** the tor's radius at height y above its base: broad at the foot, a narrower summit block */
  const R0 = 13.5, R1 = 4.8;
  const radiusAt = (t: number) => R0 + (R1 - R0) * t ** 0.8;

  // ── the mass: jointed layers, each 3–5 rounded blocks round the core, each layer twisted on the one below ──
  const layerH = 3.2, nLayers = Math.max(2, Math.round((H + 1.5) / layerH));
  const lh = (H + 1.5) / nLayers;
  let y = base - 1.5, twist = rng.range(0, Math.PI);
  for (let i = 0; i < nLayers; i++) {
    const t = (i + 0.5) / nLayers, R = radiusAt(t), last = i === nLayers - 1;
    const hb = last ? top - y : lh * rng.range(0.9, 1.1);
    twist += rng.range(0.3, 0.9);
    const nb = last ? 1 : R > 8 ? 5 : R > 6 ? 4 : 3;
    for (let b = 0; b < nb; b++) {
      const a = twist + (b / nb) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const off = last ? 0 : R * rng.range(0.3, 0.5);
      const bw = last ? R * 2 : R * rng.range(1.05, 1.3), bd = last ? R * 1.7 : R * rng.range(0.8, 1.05);
      const bx = cx + Math.cos(a) * off, bz = cz + Math.sin(a) * off, byaw = a + rng.range(-0.3, 0.3);
      const col = rng.next() < 0.4 ? TOR_C.graniteDark : rng.next() < 0.5 ? TOR_C.granite : TOR_C.graniteWarm;
      kit.add(graniteBlock(bw, hb * rng.range(0.85, 1.15) + 0.45, bd, 0x70 + i * 8 + b, 0.32), (_q, nn) => (nn.y > 0.65 ? TOR_C.graniteWarm : col), { ...stone, matrix: M(bx, y + hb / 2 - 0.15, bz, byaw, 1, 1, 1, rng.range(-0.04, 0.04), rng.range(-0.04, 0.04)) });
    }
    // the layer as a 12-sided prism a hair inside the blocks, as narrow as the layer's top (the scramble's slabs run
    // round it at 0.86 × the radius at their own height + 0.15)
    const rIn = radiusAt(Math.min(1, (y + hb - base) / H)) * 0.86;
    descs.push(prism(cx, cz, i === 0 ? base - 4 : y - 0.05, y + hb, rIn, 12, twist, 'rock'));
    y += hb;
  }
  // foot boulders (not on the path's first steps)
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(R0 + 1, R0 + 7);
    if (Math.abs(((a - Math.PI * 1.5) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.5) continue;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = rng.range(0.5, 1.9), g = ground(x, z);
    kit.add(blob(s, rng, 2, 0.6, 0.25), TOR_C.graniteDark, { ...stone, matrix: M(x, g + s * 0.12, z, rng.range(0, 6)) });
    if (s > 0.9) colliders.push({ x, z, hw: s * 0.75, hd: s * 0.75, rot: 0, yBottom: g - 1, yTop: g + s * 0.5, surface: 'rock' });
  }

  // ── the scramble: granite slabs stepping round the tor from its south foot to the summit (< one turn) ──
  const a0 = -Math.PI / 2 - 0.5;                                   // start: south (−z), a little east
  const y0 = ground(cx + Math.cos(a0) * (R0 + 1.4), cz + Math.sin(a0) * (R0 + 1.4));
  const climb = top - y0, RISER = 0.3, nSteps = Math.ceil(climb / RISER), riser = climb / nSteps;
  const sweep = Math.PI * 1.7, da = sweep / nSteps, W = 1.9;                // clockwise seen from above: west then north
  const slabs: { y: number; rIn: number }[] = [];
  for (let s = 1; s <= nSteps; s++) {
    const a = a0 - s * da, sy = y0 + s * riser, t = Math.min(1, Math.max(0, (sy - base) / H));
    const rIn = radiusAt(t) * 0.86 + 0.15;
    slabs.push({ y: sy, rIn });
    const rc = rIn + W / 2, x = cx + Math.cos(a) * rc, z = cz + Math.sin(a) * rc;
    const len = Math.max(0.9, (rIn + W) * da + 0.25);
    const g = graniteBlock(W + 0.5, 0.7, len, 0x400 + s, 0.08, 1);
    kit.add(g, (_q, nn) => (nn.y > 0.6 ? TOR_C.graniteWarm : TOR_C.graniteDark), { top: { color: TOR_C.lichen, threshold: 0.7, amount: 0.25 }, brush: 0.1, matrix: M(x, sy - 0.35, z, -a) });
    // the slab as real geometry: its top at the step, down to the one below (a stair of 0.3 m risers round the tor)
    descs.push(slab(x, z, sy, Math.max(0.7, riser + 0.4), (W + 0.4) / 2, len / 2, -a, 'rock'));
  }
  // the summit: a flat terrace over the top block; a railed viewing deck on its north edge, a flag
  const rTop = radiusAt(1) * 0.8;
  {
    const dz = cz + rTop - 1.4;
    kit.add(new THREE.BoxGeometry(4.4, 0.14, 2.4), TOR_C.wood, { matrix: M(cx, top + 0.03, dz), flat: true });
    for (let i = 0; i <= 4; i++) kit.add(pole(v3(cx - 2.2 + i * 1.1, top - 0.1, dz + 1.15), v3(cx - 2.2 + i * 1.1, top + 1.1, dz + 1.15), 0.055, 0.05, 6), TOR_C.woodGrey);
    kit.add(pole(v3(cx - 2.3, top + 1.05, dz + 1.15), v3(cx + 2.3, top + 1.05, dz + 1.15), 0.045, 0.045, 5), TOR_C.woodGrey);
    colliders.push({ x: cx, z: dz + 1.2, hw: 2.3, hd: 0.1, rot: 0, yBottom: top - 0.5, yTop: top + 1.1, surface: 'wood' });
    descs.push(slab(cx, dz, top + 0.1, 0.3, 2.2, 1.2, 0, 'planks'));
    const fp = v3(cx - 1.8, top, cz - 0.8);
    kit.add(pole(fp, fp.clone().add(v3(0, 4.2, 0)), 0.06, 0.045, 6), TOR_C.woodGrey);
    kit.add(blob(0.45, rng, 1, 0.7), TOR_C.graniteDark, { matrix: M(fp.x, top + 0.1, fp.z) });
    flutter.flag(fp.clone().add(v3(0, 4.1, 0)), 0.7, 1.3, '#2f6fb3', { droop: 0.2 });
    flutter.streamer(fp.clone().add(v3(0, 3.3, 0)), 1.8, 0.1, '#f2ece0');
    colliders.push({ x: fp.x, z: fp.z, hw: 0.3, hd: 0.3, rot: 0, yBottom: top - 1, yTop: top + 4, surface: 'wood' });
  }
  // its floor (placement): the scramble's slabs and the summit, as data (../world/placeBake.ts `torFloor`)
  return { boxes: colliders, descs, floor: torFloor({ cx, cz, a0, da, w: W, slabs: slabs.map((s) => [s.rIn, s.y] as const), rTop, top }) };
};
const eagleRockPainted: ModelDef<object> = { ...eagleRock, build: painted(torPaint, { seed: 0xea61, fitted: true, finish: { aoH: 1.4 } }) };

/**
 * The Wind Cairn (E306 / E315 M3; Jel Ata the Storm Titan's threshold, B14): an ovoo-style heap of fieldstones round a
 * core dome, a bundle of weathered poles lashed together at the top and bristling out of it, four sagging lines from the
 * pole-heads to stakes round the heap, a few horned ram skulls and offering stones on the pile. The cloth strips tied up
 * the poles and along the lines (white and sky-blue — the khadag colours — with red, yellow and green among them) and the
 * two long silk streamers are the shard's cloth (they stream with the wind; in the storm they whip), not the model's
 * geometry. Used once (src/shards/nalati-grasslands/world/Cairn.ts).
 *
 * Placed at the heap's centre on the ground (`at.y`); its stakes stand on the ground round it. Painted into its place's
 * mesh (src/shards/nalati-grasslands/world/painted.ts). Collides: the heap as the hull of its core dome, the stakes as boxes.
 */
const CAIRN_C = {
  stone: new THREE.Color('#9d978b'),
  stoneLight: new THREE.Color('#b8b1a1'),
  stoneDark: new THREE.Color('#7f7a71'),
  lichen: new THREE.Color('#bfa75a'),
  pole: new THREE.Color('#9b8f7c'),
  poleDark: new THREE.Color('#6d604e'),
  bone: new THREE.Color('#e8dfca'),
  horn: new THREE.Color('#b9a37a'),
  rope: new THREE.Color('#5f4a33'),
};
const STRIPS = ['#f4f1e8', '#f4f1e8', '#8cc2ea', '#4f93d6', '#f4f1e8', '#8cc2ea', '#d8402b', '#e7c23a', '#4f9a52'];

const cairnPaint: Paint<object> = (kit, at, _p, c) => {
  const { ground, flutter } = c;
  const rng = kit.rng;
  const colliders: Box[] = [];
  const descs: ColliderDesc[] = [];
  const cx = at.x, cz = at.z, gy = at.y;
  const R = 2.9, Hh = 2.4;
  const stone = { top: { color: CAIRN_C.lichen, threshold: 0.55, amount: 0.45 }, brush: 0.12 };

  // ── the heap: stones in rough rings, smaller toward the top ──
  for (let ring = 0; ring < 6; ring++) {
    const t = ring / 5, rr = R * (1 - t * 0.85), yy = gy + Hh * t ** 0.9 * 0.92;
    const n = Math.max(3, Math.round(rr * 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.6 + rng.range(-0.15, 0.15);
      const s = rng.range(0.26, 0.42) * (1 - t * 0.3);
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      const col = rng.next() < 0.3 ? CAIRN_C.stoneLight : rng.next() < 0.5 ? CAIRN_C.stoneDark : CAIRN_C.stone;
      kit.add(blob(s, rng, 1, rng.range(0.6, 0.85), 0.25), col, { ...stone, matrix: M(x, Math.max(yy, ground(x, z)) + s * 0.25, z, rng.range(0, 6)) });
    }
  }
  // a core so there are no holes between the stones
  const core = new THREE.SphereGeometry(R * 0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, Hh / R * 0.9, 1);
  // P1: the heap collides as the hull of its core dome (the stones sit on it)
  descs.push(supportHull(core, M(cx, gy - 0.1, cz), 'stone'));
  kit.add(core, CAIRN_C.stone, { matrix: M(cx, gy - 0.1, cz), brush: 0.2 });

  // ── the pole bundle: 7 poles lashed at ~4 m, splaying out of the heap ──
  const lash = v3(cx, gy + 4.6, cz);
  const heads: THREE.Vector3[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const foot = v3(cx + Math.cos(a) * 0.55, gy + Hh * 0.55, cz + Math.sin(a) * 0.55);
    const dir = lash.clone().sub(foot).normalize();
    const head = lash.clone().add(dir.clone().multiplyScalar(rng.range(0.6, 1.5))).add(v3(-Math.cos(a) * 0.1, 0, -Math.sin(a) * 0.1));
    kit.add(pole(foot, head, 0.1, 0.05, 7), rng.next() < 0.5 ? CAIRN_C.pole : CAIRN_C.poleDark, { jitter: 0.1 });
    heads.push(head);
    // strips tied up the pole
    for (let k = 0; k < 7; k++) {
      const u = 0.3 + k * 0.1 + rng.range(-0.03, 0.03);
      const q = foot.clone().lerp(head, u);
      flutter.strip(q, rng.range(0.7, 1.2), rng.range(0.12, 0.18), rng.pick(STRIPS));
    }
  }
  kit.add(new THREE.CylinderGeometry(0.18, 0.18, 0.35, 10).translate(lash.x, lash.y, lash.z), CAIRN_C.rope);
  // the tallest pole carries a long streamer of blue silk
  const crown = lash.clone().add(v3(0, 1.4, 0));
  kit.add(pole(lash.clone().add(v3(0, -0.6, 0)), crown, 0.05, 0.03, 6), CAIRN_C.pole);
  flutter.streamer(crown, 4.2, 0.3, '#4f93d6', { droop: 0.4, taper: 0.4 });
  flutter.streamer(crown.clone().add(v3(0, -0.25, 0)), 3.4, 0.24, '#f4f1e8', { droop: 0.45, taper: 0.4 });

  // ── four strip lines from the pole heads to stakes ──
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5 + rng.range(-0.15, 0.15);
    const sx = cx + Math.cos(a) * 7.5, sz = cz + Math.sin(a) * 7.5, sy = ground(sx, sz);
    const stakeTop = v3(sx, sy + 1.3, sz);
    kit.add(pole(v3(sx, sy - 0.3, sz), stakeTop, 0.06, 0.05, 6), CAIRN_C.poleDark);
    kit.add(blob(0.3, rng, 1, 0.7), CAIRN_C.stone, { ...stone, matrix: M(sx + 0.2, sy + 0.05, sz, rng.range(0, 6)) });
    const from = heads[(i * 2) % heads.length] ?? lash;
    const n = 18;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const q = from.clone().lerp(stakeTop, t);
      q.y -= Math.sin(Math.PI * t) * 0.7;                                       // the line sags
      if (k > 0 && k < n) flutter.strip(q, rng.range(0.5, 0.8), rng.range(0.11, 0.15), rng.pick(STRIPS));
      if (k < n) {
        const q2 = from.clone().lerp(stakeTop, (k + 1) / n); q2.y -= Math.sin(Math.PI * ((k + 1) / n)) * 0.7;
        kit.add(pole(q, q2, 0.012, 0.012, 3), CAIRN_C.rope, { brush: 0 });
      }
    }
    colliders.push({ x: sx, z: sz, hw: 0.15, hd: 0.15, rot: 0, yBottom: sy - 1, yTop: sy + 1.3, surface: 'wood' });
  }

  // ── ram skulls and offerings on the heap ──
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2), rr = R * rng.range(0.35, 0.6);
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr, y = gy + Hh * (1 - rr / R) * 0.9 + 0.2;
    const m = M(x, y, z, a + Math.PI / 2, 1, 1, 1, -0.3);
    kit.add(new THREE.SphereGeometry(0.13, 10, 8).scale(0.8, 0.75, 1.3), CAIRN_C.bone, { matrix: m });
    for (const s of [-1, 1]) kit.add(new THREE.TorusGeometry(0.1, 0.035, 5, 10, Math.PI * 1.5).rotateY(Math.PI / 2).translate(s * 0.11, 0.02, -0.05), CAIRN_C.horn, { matrix: m });
  }
  return { boxes: colliders, descs };
};
const windCairnPainted: ModelDef<object> = { ...windCairn, build: painted(cairnPaint, { seed: 0xca19, fitted: true }) };

/** Eagle Rock (its offline painter): the tor on B0's knoll, painted into its own mesh */
function eagleRockPlace(ctx: PaintCtx, effects: EffectRow[]): BuiltPlace {
  const kit = new PaintKit(0xea61);
  const set = new NalatiSet(kit, ctx);
  set.paint(eagleRockPainted, { x: EAGLE_ROCK.x, y: EAGLE_ROCK.top, z: EAGLE_ROCK.z, yaw: 0 }, {});
  const geometry = kit.finish({ ground: ctx.ground, aoH: 1.4 });
  return { name: 'eagleRock', group: null, surface: 'rock', tris: trisOf(geometry), meshes: [{ name: 'nalati-eagle-rock', material: 'poi', slot: 0, geometry }], set, effects };
}

/** the Wind Cairn (world/Cairn.ts's builder): the heap on the bowl's south rim, painted into its own mesh (its strips: cloth) */
function cairnPlace(ctx: PaintCtx, effects: EffectRow[]): BuiltPlace {
  const kit = new PaintKit(0xca19);
  const set = new NalatiSet(kit, ctx);
  const cx = WIND_CAIRN.x, cz = WIND_CAIRN.z;
  set.paint(windCairnPainted, { x: cx, y: ctx.ground(cx, cz), z: cz, yaw: 0 }, {});
  const geometry = kit.finish({ ground: ctx.ground });
  return { name: 'cairn', group: null, surface: 'stone', tris: trisOf(geometry), meshes: [{ name: 'nalati-cairn', material: 'poi', slot: 0, geometry }], set, effects };
}

// Static landmarks: authored builders run only in this offline recipe.
const DROMOS_DEPTH = 2.2;
const FIELDSTONE_LOOK: Readonly<Record<FieldstoneLook, { stone: THREE.Color; lichen: THREE.Color; threshold: number; brush: number }>> = {
  kurgan: { stone: new THREE.Color('#77736c'), lichen: new THREE.Color('#b9a45a'), threshold: 0.5, brush: 0.07 },
  rubble: { stone: new THREE.Color('#948b7c'), lichen: new THREE.Color('#b3a35a'), threshold: 0.6, brush: 0.12 },
};

/** `at`: the point on the ground it lies on (it takes its own turn) */
export const paintFieldstone: Paint<FieldstoneParams> = (kit, at, p) => {
  const rng = kit.rng, look = FIELDSTONE_LOOK[p.look];
  kit.add(blob(p.s, rng, 1, p.squash, p.rough), look.stone, { matrix: M(at.x, at.y + p.s * p.lift, at.z, rng.range(0, 6)), top: { color: look.lichen, threshold: look.threshold, amount: 0.4 }, brush: look.brush });
  return {};
};

const fieldstonePainted: ModelDef<FieldstoneParams> = { ...fieldstoneBaked, build: painted(paintFieldstone, { seed: 0x4b62 }) };

const CRAG_LEDGE_C = { graniteDark: new THREE.Color('#6e675f'), snow: new THREE.Color('#f1f4f8') };
const CRAG_LEDGE_TH = 1.6;

const paintCragLedge: Paint<CragLedgeParams> = (kit, at, p) => {
  const rng = kit.rng, top = at.y, yaw = at.yaw;
  kit.add(graniteBlock(p.w, CRAG_LEDGE_TH, p.d, rng.int(1, 9999), 0.12), CRAG_LEDGE_C.graniteDark, { top: { color: CRAG_LEDGE_C.snow, threshold: 0.45, amount: 0.95, minY: p.snowLine }, brush: 0.1, matrix: M(at.x, top - CRAG_LEDGE_TH / 2 + 0.05, at.z, yaw) });
  const cs = Math.cos(yaw), sn = Math.sin(yaw), hw = p.w / 2 - 0.25, hd = p.d / 2 - 0.25;
  return {
    boxes: [{ x: at.x, z: at.z, hw: p.w / 2 - 0.3, hd: p.d / 2 - 0.3, rot: -yaw, yBottom: top - 6, yTop: top }],
    // (the box's top is the ledge: a real floor since P1 — this is placement only)
    floor: cragLedgeFloor({ kind: 'ledge', x: at.x, z: at.z, cs, sn, hw, hd, top }),
  };
};

const cragLedgePainted: ModelDef<CragLedgeParams> = { ...cragLedge, build: painted(paintCragLedge, { seed: 0xc4a6, finish: { aoH: 1.2 } }) };

const LEOPARD_CAVE_C = {
  granite: new THREE.Color('#9a8f80'),
  graniteCool: new THREE.Color('#8c8883'),
  graniteDark: new THREE.Color('#6e675f'),
  snow: new THREE.Color('#f1f4f8'),
  dark: new THREE.Color('#0e0b0a'),
  bone: new THREE.Color('#e3d9c2'),
};

/** the mouth's clear width and height, the dark recess's depth (m) */
const LEOPARD_CAVE_SHAPE = { mouthW: 3.2, mouthH: 2.5, depth: 3.0 } as const;

const paintLeopardCave: Paint<LeopardCaveParams> = (kit, at, p, c) => {
  const rng = kit.rng, ground = c.ground;
  const colliders: Box[] = [];
  const descs: ColliderDesc[] = [];
  const snowTop = (minY: number) => ({ top: { color: LEOPARD_CAVE_C.snow, threshold: 0.45, amount: 0.95, minY }, brush: 0.1 });
  const cfx = -Math.sin(at.yaw), cfz = -Math.cos(at.yaw);
  const yawIn = Math.atan2(-cfx, -cfz);
  const O = { x: at.x, z: at.z };                                                          // the mouth (lz = 0)
  const L = (lx: number, ly: number, lz: number) => v3(O.x - cfx * lz - cfz * lx, ly, O.z - cfz * lz + cfx * lx);
  const { mouthW, mouthH, depth } = LEOPARD_CAVE_SHAPE;
  const floorY = at.y, porchY = floorY;
  // the recess: an inside-out dark box (its faces point inward, so from outside you look straight into the dark)
  {
    const g = new THREE.BoxGeometry(mouthW + 0.4, mouthH + 0.3, depth, 2, 2, 2);
    const idx = g.index;
    if (idx) { const arr = idx.array; for (let i = 0; i < arr.length; i += 3) { const t = arr[i + 1] ?? 0; arr[i + 1] = arr[i + 2] ?? 0; arr[i + 2] = t; } }
    g.computeVertexNormals();
    const cc = L(0, 0, depth / 2 + 0.15);
    kit.add(g, (q) => LEOPARD_CAVE_C.dark.clone().lerp(LEOPARD_CAVE_C.graniteDark, Math.max(0, 0.22 - (q.z + depth / 2) * 0.12)), { matrix: M(cc.x, floorY + (mouthH + 0.3) / 2, cc.z, yawIn), brush: 0.02, flat: true });
    const bw = L(0, 0, depth + 0.3);
    colliders.push({ x: bw.x, z: bw.z, hw: mouthW / 2 + 0.4, hd: 0.4, rot: -yawIn, yBottom: floorY - 3, yTop: floorY + mouthH + 3 });
  }
  // the hood: jambs either side (down to the hill), a lintel, a great capping block and boulders heaped on it
  for (const sx of [-1, 1]) {
    const j = L(sx * (mouthW / 2 + 1.35), 0, depth / 2);
    const gj = ground(j.x, j.z), hJ = floorY + mouthH + 1.2 - gj + 2;
    kit.add(graniteBlock(2.9, hJ, depth + 2.2, 0xca0 + sx, 0.2), LEOPARD_CAVE_C.granite, { ...snowTop(p.snowLine), matrix: M(j.x, gj - 2 + hJ / 2, j.z, yawIn + sx * 0.08) });
    colliders.push({ x: j.x, z: j.z, hw: 1.35, hd: (depth + 2) / 2, rot: -(yawIn + sx * 0.08), yBottom: gj - 3, yTop: floorY + mouthH + 1.2 });
  }
  { const li = L(0, 0, 0.3); kit.add(graniteBlock(mouthW + 4.6, 1.6, 2.2, 0xcab, 0.2), LEOPARD_CAVE_C.graniteCool, { ...snowTop(p.snowLine - 6), matrix: M(li.x, floorY + mouthH + 0.75, li.z, yawIn, 1, 1, 1, 0.06) }); }
  { const cap = L(0.3, 0, depth / 2 + 0.6); kit.add(graniteBlock(mouthW + 6, 3.2, depth + 3.5, 0xcac, 0.28), LEOPARD_CAVE_C.granite, { ...snowTop(p.snowLine - 8), matrix: M(cap.x, floorY + mouthH + 2.1, cap.z, yawIn + 0.1, 1, 1, 1, -0.12) }); }
  for (let i = 0; i < 4; i++) {
    const q = L(rng.range(-3.5, 3.5), 0, rng.range(1.5, 4.5)), s = rng.range(1.2, 2.2);
    kit.add(blob(s, rng, 2, 0.8, 0.3), LEOPARD_CAVE_C.granite, { ...snowTop(p.snowLine - 8), matrix: M(q.x, floorY + mouthH + 3.2 + s * 0.2, q.z, rng.range(0, 6)) });
  }
  // the porch ledge in front of the mouth: a thick slab down to the slope (the leopard's lookout)
  const porch = L(0, 0, -2.1);
  {
    const gp = ground(porch.x, porch.z), th = Math.max(1.4, porchY - gp + 1.2);
    kit.add(graniteBlock(6.6, th, 4.4, 0xcafe, 0.1), LEOPARD_CAVE_C.graniteDark, { ...snowTop(p.snowLine), matrix: M(porch.x, porchY - th / 2 + 0.02, porch.z, yawIn) });
    colliders.push({ x: porch.x, z: porch.z, hw: 3.0, hd: 1.9, rot: -yawIn, yBottom: gp - 3, yTop: porchY });
    // the cave's own floor, from the porch's back edge in to the back wall (P1: it was a floor function only)
    const cf = L(0, 0, depth / 2 - 0.1);
    descs.push(slab(cf.x, cf.z, porchY, 1.2, mouthW / 2 + 0.3, depth / 2 + 0.25, yawIn, 'rock'));
  }
  const cs = Math.cos(yawIn), sn = Math.sin(yawIn);
  const floor = leopardCaveFloor({ kind: 'cave', x: porch.x, z: porch.z, cs, sn, mouthW, depth, porchY });
  // old bones on the porch: a few long bones, a ribcage arc, a skull
  for (let i = 0; i < 6; i++) {
    const q = L(rng.range(-2, 2), 0, rng.range(-3.4, -1.2)), a = rng.range(0, Math.PI);
    kit.add(pole(v3(q.x - Math.cos(a) * 0.3, porchY + 0.05, q.z - Math.sin(a) * 0.3), v3(q.x + Math.cos(a) * 0.3, porchY + 0.05, q.z + Math.sin(a) * 0.3), 0.03, 0.025, 5), LEOPARD_CAVE_C.bone);
  }
  { const q = L(0.8, 0, -1.8); for (let k = 0; k < 5; k++) kit.add(new THREE.TorusGeometry(0.28 - k * 0.02, 0.02, 4, 10, Math.PI).rotateY(Math.PI / 2 + 0.2).translate(k * 0.1, 0, 0), LEOPARD_CAVE_C.bone, { matrix: M(q.x, porchY, q.z, yawIn) }); }
  { const q = L(-1.1, 0, -2.6); kit.add(new THREE.SphereGeometry(0.12, 10, 8).scale(0.9, 0.8, 1.3), LEOPARD_CAVE_C.bone, { matrix: M(q.x, porchY + 0.1, q.z, 0.7) }); }
  return { boxes: colliders, descs, floor };
};

const leopardCavePainted: ModelDef<LeopardCaveParams> = { ...leopardCave, build: painted(paintLeopardCave, { seed: 0xc4a6, fitted: true, finish: { aoH: 1.2 } }) };

const KURGAN_ENTRANCE_C = {
  kerb: new THREE.Color('#948f86'),
  lichen: new THREE.Color('#b9a45a'),
  larch: new THREE.Color('#7a5a3c'),
  larchOld: new THREE.Color('#6d6152'),
  turf: new THREE.Color('#9ab552'),
  turfDark: new THREE.Color('#7f9a42'),
  dark: new THREE.Color('#0d0a08'),
};

const paintKurganEntrance: Paint<KurganEntranceParams> = (kit, at, p, c) => {
  const rng = kit.rng, ground = c.ground;
  const colliders: Box[] = [];
  const descs: ColliderDesc[] = [];
  const len = 7.5;
  const D = at.yaw, fx = -Math.sin(D), fz = -Math.cos(D);                        // the unit vector the door faces
  const front = { x: at.x, z: at.z }, floorY = at.y, footY = p.footY;
  const openH = 2.35, lintelY = floorY + openH, cw = 2.5;                                    // clear width of the doorway
  // local frame: origin at the portal front on the axis, +z pointing INTO the mound, +x across
  const yawIn = Math.atan2(-fx, -fz);                                                      // local +z → world (−fx, −fz)
  const L = (lx: number, ly: number, lz: number) => v3(front.x - fx * lz - fz * lx, ly, front.z - fz * lz + fx * lx);
  const Lm = (lx: number, ly: number, lz: number, sx = 1, sy = 1, sz = 1, pitch = 0) => { const q = L(lx, ly, lz); return M(q.x, q.y, q.z, yawIn, sx, sy, sz, pitch); };
  // posts + double lintel (larch, weathered grey at the top)
  for (const sx of [-1, 1]) {
    kit.add(pole(L(sx * (cw / 2 + 0.22), footY - 0.6, 0.1), L(sx * (cw / 2 + 0.2), lintelY + 0.55, 0.12), 0.25, 0.21, 9), KURGAN_ENTRANCE_C.larch, { foot: 0.7 });
    kit.add(pole(L(sx * (cw / 2 + 0.25), footY - 0.6, 0.9), L(sx * (cw / 2 + 0.22), lintelY + 0.3, 0.9), 0.2, 0.18, 8), KURGAN_ENTRANCE_C.larchOld);
    const jp = L(sx * (cw / 2 + 0.22), 0, 0.5);
    colliders.push({ x: jp.x, z: jp.z, hw: 0.3, hd: 0.8, rot: -yawIn, yBottom: footY - 1, yTop: lintelY + 0.6 });
  }
  kit.add(pole(L(-cw / 2 - 0.9, lintelY + 0.22, 0.05), L(cw / 2 + 0.9, lintelY + 0.24, 0.05), 0.27, 0.25, 9), KURGAN_ENTRANCE_C.larchOld);
  kit.add(pole(L(-cw / 2 - 1.1, lintelY + 0.7, 0.35), L(cw / 2 + 1.1, lintelY + 0.68, 0.35), 0.25, 0.24, 9), KURGAN_ENTRANCE_C.larch);
  // flaring wing walls: stacked logs from the posts out and down to the foot, stones banked against them
  for (const sx of [-1, 1]) {
    for (let r = 0; r < 7; r++) {
      const y = footY - 0.1 + r * 0.42, lenOut = 3.4 - r * 0.42;
      if (lenOut < 0.5 || y > lintelY + 0.4) break;
      const a = L(sx * (cw / 2 + 0.5), y, 0.3), b = L(sx * (cw / 2 + 0.5 + lenOut * 0.72), y + rng.range(-0.05, 0.05), -lenOut * 0.7);
      kit.add(pole(a, b, 0.2, 0.18, 7), r % 2 === 0 ? KURGAN_ENTRANCE_C.larch : KURGAN_ENTRANCE_C.larchOld, { jitter: 0.08 });
    }
    for (let i = 0; i < 6; i++) {
      const q = L(sx * (cw / 2 + rng.range(1.4, 3.4)), 0, rng.range(-2.4, -0.2));
      kit.add(blob(rng.range(0.3, 0.6), rng, 1, 0.7), KURGAN_ENTRANCE_C.kerb, { matrix: M(q.x, ground(q.x, q.z) + 0.05, q.z, rng.range(0, 6)), top: { color: KURGAN_ENTRANCE_C.lichen, threshold: 0.5, amount: 0.4 } });
    }
    const wc = L(sx * (cw / 2 + 1.7), 0, -1.0);
    colliders.push({ x: wc.x, z: wc.z, hw: 0.35, hd: 1.6, rot: -(yawIn + sx * 0.7), yBottom: footY - 1, yTop: footY + 1.6 });
  }
  // the passage: dark log walls, a log ceiling, the black back — fading to nothing
  const dep = DROMOS_DEPTH;
  const darkBy = (lz: number, base: THREE.Color) => base.clone().lerp(KURGAN_ENTRANCE_C.dark, Math.min(1, 0.35 + lz / dep * 0.8));
  for (const sx of [-1, 1]) for (let r = 0; r < 6; r++) {
    const y = floorY + 0.2 + r * 0.4;
    kit.add(pole(L(sx * (cw / 2 + 0.05), y, 0.4), L(sx * (cw / 2 + 0.05), y, dep + 0.1), 0.19, 0.19, 6), darkBy(dep * 0.6, KURGAN_ENTRANCE_C.larch));
  }
  for (let i = 0; i < 6; i++) kit.add(pole(L(-cw / 2 - 0.3, lintelY + 0.05, 0.5 + i * 0.36), L(cw / 2 + 0.3, lintelY + 0.05, 0.5 + i * 0.36), 0.17, 0.17, 6), darkBy(0.5 + i * 0.36, KURGAN_ENTRANCE_C.larchOld));
  kit.add(new THREE.BoxGeometry(cw + 0.6, openH + 0.4, 0.3), KURGAN_ENTRANCE_C.dark, { matrix: Lm(0, floorY + openH / 2, dep + 0.1), brush: 0.02, flat: true });
  kit.add(new THREE.BoxGeometry(cw, 0.08, dep), KURGAN_ENTRANCE_C.dark.clone().lerp(KURGAN_ENTRANCE_C.larch, 0.25), { matrix: Lm(0, floorY - 0.04, dep / 2 + 0.2), flat: true });
  // raised timber threshold + steps down to the grass
  kit.add(new THREE.BoxGeometry(cw + 0.5, 0.26, 0.55), KURGAN_ENTRANCE_C.larchOld, { matrix: Lm(0, floorY - 0.13, 0.15), flat: true });
  const rise = floorY - footY, nSteps = Math.max(0, Math.ceil(rise / 0.34) - 1);
  for (let i = 1; i <= nSteps; i++) {
    const y = floorY - (rise * i) / (nSteps + 1);
    kit.add(new THREE.BoxGeometry(cw - 0.2, 0.2, 0.55), KURGAN_ENTRANCE_C.larch, { matrix: Lm(0, y - 0.1, -0.2 - i * 0.5), flat: true });
  }
  // turf hood over the passage, carrying the mound's line out to the lintel
  {
    const segZ = 10, g = new THREE.BoxGeometry(cw + 3.6, 1, len, 10, 1, segZ);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const lz = pos.getZ(i) + len / 2, t = lz / len;                            // 0 at the lintel → 1 deep in the mound
      const up = pos.getY(i) > 0;
      const q = L(0, 0, lz), gy = ground(q.x, q.z);
      const topY = lintelY + 1.05 - t * 1.2 + Math.sin(Math.PI * t) * 0.25;           // sinks under the mound behind
      const across = pos.getX(i) / ((cw + 3.6) / 2);
      // the underside arches over the passage (so the hood's front face never closes the doorway)
      const drop = up ? topY - (1 - Math.cos(across * 1.35)) * 1.6 : Math.abs(pos.getX(i)) < cw / 2 + 0.6 ? lintelY + 0.3 : gy - 0.6;
      pos.setXYZ(i, pos.getX(i) * (up ? 0.85 : 1.1), drop, lz - 0.2);
    }
    g.computeVertexNormals();
    kit.add(g, (_p, n) => (n.y > 0.35 ? KURGAN_ENTRANCE_C.turf : KURGAN_ENTRANCE_C.turfDark), { matrix: Lm(0, 0, 0), brush: 0.12 });
    // the hood's top is walkable (so you can climb the mound over the entrance), in 4 slices
    for (let s = 0; s < 4; s++) {
      const lz0 = s * (len / 4), lzc = lz0 + len / 8, pc = L(0, 0, lzc);
      const tc = lzc / len, yTop = lintelY + 1.05 - tc * 1.2 + Math.sin(Math.PI * tc) * 0.25 - 0.25;
      const top = Math.max(yTop, ground(pc.x, pc.z));
      // over the passage it only blocks above the lintel; either side of it, all the way down
      colliders.push({ x: pc.x, z: pc.z, hw: cw / 2 + 1.2, hd: len / 8, rot: -yawIn, yBottom: lintelY - 0.1, yTop: top, surface: 'earth' });
      for (const sx of [-1, 1]) { const q = L(sx * (cw / 2 + 0.75), 0, lzc); colliders.push({ x: q.x, z: q.z, hw: 0.55, hd: len / 8, rot: -yawIn, yBottom: footY - 1, yTop: top, surface: 'earth' }); }
    }

  }
  // the passage floor + threshold + steps are walkable; the back wall stops you

  { const bw = L(0, 0, dep + 0.1); colliders.push({ x: bw.x, z: bw.z, hw: cw / 2 + 0.3, hd: 0.3, rot: -yawIn, yBottom: floorY - 2, yTop: lintelY + 2 }); }
  // P1: the passage floor + the threshold as a timber slab, the steps down to the grass as treads (rise ≤ 0.34 m)
  { const pf = L(0, 0, (dep - 0.15) / 2); descs.push(slab(pf.x, pf.z, floorY, 0.6, cw / 2, (dep + 0.15) / 2, yawIn, 'wood')); }
  if (nSteps > 0) {
    // from the grass at the lowest drawn step's foot (the flank falls on past the foot line), rise ≤ 0.33 each
    const run = nSteps * 0.5 + 0.3, a = L(0, 0, -0.15 - run), b = L(0, 0, -0.15);
    const y0 = Math.min(footY, ground(a.x, a.z)) - 0.02, count = Math.max(nSteps + 1, Math.ceil((floorY - y0) / 0.33));
    descs.push({ kind: 'treads', from: { x: a.x, y: y0, z: a.z }, to: { x: b.x, y: floorY, z: b.z }, width: cw - 0.2, count, surface: 'wood' });
  }
  return { boxes: colliders, descs, floor: kurganEntranceFloor({ kind: 'entrance', x: front.x, z: front.z, fx, fz, cw, len, lintelY, dep, floorY, nSteps, rise }) };
};

const kurganEntrancePainted: ModelDef<KurganEntranceParams> = { ...kurganEntrance, build: painted(paintKurganEntrance, { seed: 0x4b62, fitted: true }) };

const KURGAN_KERB_C = { kerb: new THREE.Color('#948f86'), kerbDark: new THREE.Color('#77736c'), lichen: new THREE.Color('#b9a45a') };

/** `at`: the stone's foot on the ground, `yaw` the ring's angle there */
const paintKurganKerb: Paint<KurganKerbParams> = (kit, at, p) => {
  const rng = kit.rng;
  const g = blob(p.s, rng, 1, p.fallen ? 0.45 : rng.range(0.9, 1.35), 0.2);
  kit.add(g, rng.next() < 0.4 ? KURGAN_KERB_C.kerbDark : KURGAN_KERB_C.kerb, { matrix: M(at.x, at.y + p.s * (p.fallen ? 0.2 : 0.45), at.z, at.yaw + rng.range(-0.3, 0.3), 1, 1, 1, p.fallen ? 1.2 : rng.range(-0.1, 0.1)), top: { color: KURGAN_KERB_C.lichen, threshold: 0.5, amount: 0.5 }, brush: 0.1 });
  return {};
};

const kurganKerbPainted: ModelDef<KurganKerbParams> = { ...kurganKerb, build: painted(paintKurganKerb, { seed: 0x4b62 }) };

function kurgansPlace(ctx: PaintCtx): BuiltPlace {
  const { ground } = ctx;
  const kit = new PaintKit(0x4b62);
  const rng = kit.rng;
  const set = new NalatiSet(kit, ctx);
  const great = GREAT_KURGAN;
  const D = GREAT_KURGAN_DOOR, fx = -Math.sin(D), fz = -Math.cos(D);           // the unit vector the door faces

  // ── kerb rings ──
  for (const k of KURGANS) {
    const rings = k.great === true ? [k.r + 0.2, k.r + 1.9] : [k.r + 0.1];
    for (const [ri, rr] of rings.entries()) {
      const n = Math.round((Math.PI * 2 * rr) / (ri === 0 ? 1.25 : 1.9));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.02, 0.02);
        const sx = Math.cos(a), sz = Math.sin(a);
        // the great kurgan's kerb opens for the entrance
        if (k.great === true && sx * fx + sz * fz > Math.cos(0.16)) continue;
        if (rng.next() < 0.12) continue;                                          // robbed out
        const x = k.x + sx * (rr + rng.range(-0.15, 0.15)), z = k.z + sz * (rr + rng.range(-0.15, 0.15));
        const fallen = rng.next() < 0.08;
        const s = rng.range(0.34, 0.55) * (ri === 0 ? 1 : 0.85);
        set.paint(kurganKerbPainted, { x, y: ground(x, z), z, yaw: a }, { s, fallen });
      }
    }
    // loose stones in the grass round it
    for (let i = 0; i < Math.round(k.r * 0.5); i++) {
      const a = rng.range(0, Math.PI * 2), d = k.r + rng.range(1, 7);
      const x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d, s = rng.range(0.15, 0.4);
      set.paint(fieldstonePainted, { x, y: ground(x, z), z, yaw: 0 }, { s, squash: 0.55, rough: 0.22, lift: 0.1, look: 'kurgan' });
    }
  }

  // ── the great kurgan's entrance ──
  // walk the door axis in from the foot; the portal front stands where the flank has risen ~0.35 m
  const at = (d: number) => ({ x: great.x + fx * d, z: great.z + fz * d });
  const foot = at(great.r + 1.2), footY = ground(foot.x, foot.z);
  let dFront = great.r;
  for (let d = great.r; d > great.r * 0.5; d -= 0.1) { const p = at(d); if (ground(p.x, p.z) - footY >= 0.35) { dFront = d; break; } }
  const front = at(dFront), back = at(dFront - DROMOS_DEPTH);
  const floorY = Math.max(ground(back.x, back.z), ground(front.x, front.z)) + 0.1;
  set.paint(kurganEntrancePainted, { x: front.x, y: floorY, z: front.z, yaw: D }, { footY });

  // ── crown balbals: a pair on every small mound, side by side on its crown, facing east (the rising sun, as they did) —
  // since layout v2 cut the balbal circle these are all the shard's balbals (B11 wakes them) ──
  const balbalSpots: { x: number; z: number; yaw: number; scale: number }[] = [];
  KURGAN_BALBALS.map((i) => KURGANS[i]).filter((k) => k !== undefined).forEach((k, i) => {
    for (const side of [-1, 1]) {
      const yaw = Math.PI / 2 + ((i % 3) - 1) * 0.2 + side * 0.08;
      // side by side across the facing direction (east = −x), 0.75 m either side of the crown
      balbalSpots.push({ x: k.x + 0.3, z: k.z + side * 0.75, yaw, scale: 1.0 + ((i + (side > 0 ? 1 : 0)) % 3) * 0.06 });
    }
  });

  const geometry = kit.finish({ ground });
  const entrance: KurganEntrance = { x: front.x, y: floorY, z: front.z, facing: D };
  return { name: 'kurgans', group: null, surface: 'wood', tris: geometry.getAttribute('position').count / 3,
    meshes: [{ name: 'nalati-kurgans', material: 'poi', slot: 0, geometry }], set, effects: [],
    anchors: { entrance, balbalSpots } };
}

function cragsPlace(ctx: PaintCtx): BuiltPlace {
  const { ground } = ctx;
  const kit = new PaintKit(0xc4a6);
  const rng = kit.rng;
  const set = new NalatiSet(kit, ctx);
  const slopeAt = (x: number, z: number) => { const e = 1.5; return Math.hypot(ground(x + e, z) - ground(x - e, z), ground(x, z + e) - ground(x, z - e)) / (2 * e); };
  const downhill = (x: number, z: number) => { const e = 1.5; const gx = ground(x + e, z) - ground(x - e, z), gz = ground(x, z + e) - ground(x, z - e); const l = Math.hypot(gx, gz) || 1; return { x: -gx / l, z: -gz / l }; };
  const cave = CRAG_CAVE, cfx = -Math.sin(cave.rot), cfz = -Math.cos(cave.rot);

  const headings: (readonly [number, number])[] = [];
  const placed: { x: number; z: number; r: number }[] = [];
  const free = (x: number, z: number, r: number) => placed.every((p) => Math.hypot(p.x - x, p.z - z) > p.r + r) && Math.hypot(x - cave.x, z - cave.z) > 14 && x > -249 && z > -249;
  // (the outcrops that stood on the steep faces are src/shards/nalati-grasslands/cragRock.ts's now: fins on the crests, ribs against the
  //  faces, sunk into the rock — no block sits on a slope)

  // ── ledges: flat slabs jutting from moderate slopes on the west massif's valley-facing flanks (round Aqbars' cave) ──
  const ledges: Ledge[] = [];
  for (let tries = 0; tries < 500 && ledges.length < 6; tries++) {
    const a = rng.range(Math.PI * 0.45, Math.PI * 1.2), d = rng.range(28, 80);            // the N / NE / E flanks (+z / −x)
    const x = WEST_CRAGS.x + Math.cos(a) * d, z = WEST_CRAGS.z + Math.sin(a) * d;
    const gy = ground(x, z), sl = slopeAt(x, z);
    if (gy < 40 || gy > 70 || sl < 0.3 || sl > 1.2 || !free(x, z, 3.2)) continue;
    const dh = downhill(x, z), yaw = Math.atan2(dh.x, dh.z);
    const ux = x - dh.x * 1.6, uz = z - dh.z * 1.6;                                      // the uphill edge sits flush
    const top = Math.max(ground(ux, uz), gy + 0.9);
    const w = rng.range(4.2, 5.8), d2 = rng.range(3.0, 4.0);
    const px = x + dh.x * 0.6, pz = z + dh.z * 0.6;
    set.paint(cragLedgePainted, { x: px, y: top, z: pz, yaw }, { w, d: d2, snowLine: CRAGS.snowLine });
    headings.push([dh.x, dh.z]);
    placed.push({ x: px, z: pz, r: 3.2 });
    ledges.push({ x: px, y: top, z: pz, r: Math.min(w, d2) / 2 - 0.3 });
  }

  // ── the ledge cave: at its mouth, 3 m out from where it meets the hill, its floor over the highest ground under it ──
  const O = { x: cave.x + cfx * 3.0, z: cave.z + cfz * 3.0 };                            // the mouth (lz = 0)
  const L = (lx: number, ly: number, lz: number) => v3(O.x - cfx * lz - cfz * lx, ly, O.z - cfz * lz + cfx * lx);
  let floorY = -Infinity;
  for (const lz of [0, 1, 2, 3]) for (const lx of [-1.6, 0, 1.6]) { const q = L(lx, 0, lz); floorY = Math.max(floorY, ground(q.x, q.z)); }
  floorY += 0.12;
  set.paint(leopardCavePainted, { x: O.x, y: floorY, z: O.z, yaw: cave.rot }, { snowLine: CRAGS.snowLine });
  const porch = L(0, 0, -2.1);

  const geometry = kit.finish({ ground, aoH: 1.2 });
  return { name: 'crags', group: null, surface: 'rock', tris: geometry.getAttribute('position').count / 3,
    meshes: [{ name: 'nalati-crags', material: 'poi', slot: 0, geometry }], set, effects: [],
    headings: new Map([[cragLedge.id, headings]]), anchors: { ledges, cave: { x: porch.x, y: floorY, z: porch.z, facing: cave.rot } } };
}

// ── the bake's binary: each geometry's attributes as their own bytes, welded ──────────────────────────────────────────

const descRow = (d: MemberData['solid'][number]): MemberRow['solid'][number] => (d.kind === 'hull' ? { ...d, points: Array.from(d.points) } : { ...d });
const deckOf = (f: MemberData['floors'][number]): PlaceFloorRow => {
  if (!('row' in f)) throw new Error('[nalati places] a floor the bake cannot keep (only recorded floor profiles are data)');
  const row: unknown = f.row;
  if (typeof row !== 'object' || row === null) throw new Error('[nalati places] a floor without its row');
  return row as PlaceFloorRow;
};
const memberRow = (m: MemberData, headings?: readonly (readonly [number, number])[]): MemberRow => ({
  draw: m.draw, inKit: m.inKit, boxes: [...m.boxes], solid: m.solid.map((d, i) => Object.assign(descRow(d), headings?.[i] === undefined ? {} : { heading: headings[i] })), descs: m.descs.map(descRow),
  floors: m.floors.map((f, i) => Object.assign(deckOf(f), headings?.[i] === undefined ? {} : { heading: headings[i] })),
  placements: m.placements.map(({ matrix, ...rest }, i) => Object.assign(matrix === undefined ? rest : { ...rest, matrix: matrix.toArray() }, headings?.[i] === undefined ? {} : { heading: headings[i] })),
});

/** every painted model the places paint, for its Explorer specimens (its defaults, then each variant) */
function specimenJobs(): ((blocks: Uint8Array[]) => SpecimenRow[])[] {
  const job = <P extends object>(def: ModelDef<P>) => (blocks: Uint8Array[]): SpecimenRow[] => [undefined, ...(def.variants ?? []).map((v) => v.id)].map((variant) => {
    const params = paramsOf(def, variant, undefined);
    const parts = paintedSpecimen(def, params).map(({ geometry, layer }, slot): PlaceMeshRow => ({ name: '', material: layer ?? 'poi', slot, geometry: writeGeometry(geometry, blocks, `${def.id} specimen`) }));
    return { key: specimenKey(def.id, params), parts };
  });
  return [job(yurtPainted), job(kunesBridgePainted), job(ribbonPolePainted), job(eaglePerchPainted), job(stovePainted), job(campBenchPainted),
    job(rugRackPainted), job(feltRugPainted), job(cartPainted), job(barrelPainted), job(hitchingRailPainted), job(waterTroughPainted),
    job(saddleRackPainted), job(corralPainted), job(hayPilePainted), job(feedTroughPainted), job(rugLinePainted), job(choppingBlockPainted),
    job(milkCansPainted), job(tetherLinePainted), job(kurtBoardPainted), job(ribbonPostPainted), job(eagleRockPainted), job(windCairnPainted), job(cragLedgePainted), job(leopardCavePainted), job(kurganEntrancePainted), job(kurganKerbPainted), job(graniteOutcropPainted), job(roundedBoulderPainted), job(fencePainted), job(fallenLogPainted), job(stumpPainted), job(ovooPainted), job(viewpointPolePainted), job(skyGatewayPainted), job(campClutterPainted), job(stoneStepPainted), job(kokparGoalPainted), job(kokparPostPainted), job(signpostPainted), job(fieldstonePainted)];
}

/** a bake: its rows and raw binary (not yet lane-shuffled or compressed) */
export interface PlacesBake<R> { readonly rows: readonly R[]; readonly bin: Uint8Array }
/** The Node producer supplies platform-stable arithmetic only while building Explorer specimens. */
type SpecimenScope = (build: () => SpecimenRow[]) => SpecimenRow[];
const nativeSpecimenScope: SpecimenScope = (build) => build();

/**
 * The bake over the page's ground (its baked terrain sampler): the places in the page's order (the camp, the
 * bridge, the summer camp, Eagle Rock, the Wind Cairn), then the specimens (the bridge's fitted to its first placement, so after the places), then
 * the dressing's scatter shapes (their own binary, `dressing.bin`).
 */
export function bakeNalatiPlaces(ground: Ground, specimenScope: SpecimenScope = nativeSpecimenScope, dressing?: { readonly plan: DressPlan; readonly clutter: ClutterSpots }): { places: PlacesBake<PlaceRow>; specimens: PlacesBake<SpecimenRow>; dressing: PlacesBake<DressingGeoRow> } {
  setTerrainHeight(ground);
  const blocks: Uint8Array[] = [];
  const rows = [nomadCamp, bridge, summerCamp, eagleRockPlace, cairnPlace, kurgansPlace, cragsPlace, roadsPlace, watchtowerPlace, kokparPlace, (ctx: PaintCtx) => finishBuild(outcropsPlace(ctx)), (ctx: PaintCtx) => finishBuild(dressingStatics(ctx, dressingInput(dressing).plan)), (ctx: PaintCtx) => finishBuild(dressingClutter(ctx, dressingInput(dressing).clutter))].map((build): PlaceRow => {
    const effects: EffectRow[] = [];
    const ctx: PaintCtx = { ground, flutter: recordingFlutter(effects), smoke: recordingPlumes(effects) };
    const p = build(ctx, effects), { members, instances } = p.set.rows();
    return {
      name: p.name, group: p.group, surface: p.surface, tris: p.tris, anchors: p.anchors ?? {},
      meshes: p.meshes.map((m) => ({ name: m.name, material: m.material, slot: m.slot, geometry: writeGeometry(m.geometry, blocks, `${p.name}.${m.name}`) })),
      colliders: [...(p.colliders ?? p.set.boxes)], effects,
      members: members.map(([id, m]) => [id, memberRow(m, p.headings?.get(id))] as const),
      instances: instances.map(([name, l]) => [name, { look: { ...l.look }, castShadow: l.castShadow, placements: l.placements.map((q) => ({ ...q })) }] as const),
    };
  });
  // Finite shapes used by the placed/awake statues, the dungeon, kokpar and elite displays.
  // Native arithmetic matches the former runtime builders, as for the world places.
  const carvings = [[0, 0xba1], [1, 0xba1],
    ...[13.6, 18.4].flatMap(nz => [-1, 1].map(sx => [nz > 16 ? 1 : 0, 0xba1 + Math.round(nz * 10) + sx])),
    ...[0, 1, 2, 3].map(i => [i % 2, 0xba7 + i * 3])];
  const actors: [string, THREE.BufferGeometry][] = carvings.map(([variant = 0, seed = 0xba1]) => [`balbal:${String(variant)}:${String(seed)}`, balbalGeometry(variant, seed)]);
  actors.push(...kurganFabric(balbalGeometry), ['goat', goatGeometry()], ['rider', riderGeometry()],
    ...['aqbars', 'kokbori', 'qyran', 'qara-batyr', 'argymaq'].map((id): [string, THREE.BufferGeometry] => [`trophy:${id}`, trophyGeometry(id)]));
  for (const [key, geometry] of actors) {
    rows.push({ name: `actor:${key}`, group: null, surface: 'stone', tris: geometry.getAttribute('position').count / 3,
      meshes: [{ name: key, material: 'poi', slot: 0, geometry: writeGeometry(geometry, blocks, key) }], colliders: [], effects: [], members: [], instances: [] });
    geometry.dispose();
  }
  const places = { rows, bin: join(blocks) };
  const specimenBlocks: Uint8Array[] = [];
  // Native V8 trig differs on arm64/x64; even a final float32 UV can cross its rounding midpoint.
  const specimens = specimenScope(() => specimenJobs().flatMap((run) => run(specimenBlocks)));
  // the dressing's scatter shapes (generators/dressingGeos.ts): ground-free, indexed, kept as built
  return { places, specimens: { rows: specimens, bin: join(specimenBlocks) }, dressing: bakeDressing() };
}

/** the bake over the page's baked terrain grid (public/assets/baked/nalati-grasslands/terrain.bin), as the page samples it */
export function bakeNalatiPlacesOnTerrain(terrain: ArrayBuffer, specimenScope: SpecimenScope = nativeSpecimenScope, dressing?: { readonly plan: DressPlan; readonly clutter: ClutterSpots }): ReturnType<typeof bakeNalatiPlaces> {
  const grid = parseBakedTerrain(terrain);
  if (grid === null) throw new Error('[nalati places] no Nalati terrain grid');
  return bakeNalatiPlaces(bakedSamplers(grid).heightAt, specimenScope, dressing);
}

function watchtowerPlace(ctx: PaintCtx): BuiltPlace {
  const { ground } = ctx;
  const { x, z } = WATCHTOWER;
  // stand it on the lowest ground under its footprint so no corner floats; the rubble skirt runs into the rock
  let y = ground(x, z);
  for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; y = Math.min(y, ground(x + Math.cos(t) * 3.2, z + Math.sin(t) * 3.2)); }
  const rot = Math.PI / 2; // the doorway (the model's +Z) faces west (+x), into the bowl
  const kit = new PaintKit(0x70e7);
  const rng = kit.rng;
  const set = new NalatiSet(kit, ctx);
  set.instance(watchtowerPlaced, { x, y, z, rot }, {});
  // a few fallen blocks down the slope below it
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(5, 12), bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, s = rng.range(0.35, 0.8);
    set.paint(fieldstonePainted, { x: bx, y: ground(bx, bz), z: bz, yaw: 0 }, { s, squash: 0.7, rough: 0.25, lift: -0.2, look: 'rubble' });
  }
  // NALATI-MERGE P1: the tower's rock stands past the motor's 40° on every side — a stone stair climbs its west shoulder
  // from the bowl (the walkable way up, found over the physics heightfield) to the doorway's terrace
  addStoneStair(set, ground, [[x + 31.5, z + 4.7], [x + 23.7, z + 2.7], [x + 10, z + 0.7], [x + 7.5, z + 0.5]], { depth: 0.4, maxRise: 0.33 });
  const geometry = kit.finish({ ground });
  return { name: 'watchtower', group: 'nalati-watchtower', surface: 'stone', meshes: [{ name: '', material: 'poi', slot: 0, geometry }], tris: set.tris() + geometry.getAttribute('position').count / 3, set, effects: [] };
}

function onOval(t: number, k: number): { x: number; z: number; yaw: number } {
  const c = Math.cos(KOKPAR.rot), s = Math.sin(KOKPAR.rot);
  const lx = Math.cos(t) * KOKPAR.rx * k, lz = Math.sin(t) * KOKPAR.rz * k;
  const tx = -Math.sin(t) * KOKPAR.rx, tz = Math.cos(t) * KOKPAR.rz;         // d/dt (local)
  const x = KOKPAR.x + lx * c + lz * s, z = KOKPAR.z - lx * s + lz * c;
  const dx = tx * c + tz * s, dz = -tx * s + tz * c;
  return { x, z, yaw: Math.atan2(dx, dz) };
}

function kokparPlace(ctx: PaintCtx): BuiltPlace {
  const { ground, flutter } = ctx;
  const kit = new PaintKit(0x60ba);
  const rng = kit.rng;
  const set = new NalatiSet(kit, ctx);
  // marker posts round the oval, a pennant on every fourth
  const n = 34;
  for (let i = 0; i < n; i++) {
    const p = onOval((i / n) * Math.PI * 2, 1.08), gy = ground(p.x, p.z);
    set.paint(kokparPostPainted, { x: p.x, y: gy, z: p.z, yaw: 0 }, {});
    if (i % 4 === 0) flutter.flag(v3(p.x, gy + 1.2, p.z), 0.25, 0.55, i % 8 === 0 ? '#c9361f' : '#2f5fae', { taper: 1, droop: 0.2 });
  }
  // the two goals (the tai-kazan: a raised ring of turf with a stone rim) at the oval's ends
  for (const t of [0, Math.PI]) {
    const p = onOval(t, 0.82);
    set.paint(kokparGoalPainted, { x: p.x, y: ground(p.x, p.z), z: p.z, yaw: 0 }, {});
  }
  const geometry = kit.finish({ ground });
  // the spectators' saddled horses standing round the rail (static), a little way out
  for (let i = 0; i < 6; i++) {
    const p = onOval(1.2 + i * 0.55 + rng.range(-0.1, 0.1), 1.2 + rng.range(0, 0.1));
    set.instance(saddledHorsePlaced, { x: p.x, y: ground(p.x, p.z) - 0.03, z: p.z, rot: p.yaw + Math.PI / 2 + rng.range(-0.3, 0.3) }, {});
  }

  // the riders: six laps round the oval at different radii and speeds, bunched as in a game (the goat carried by one)
  const riders = Array.from({ length: 6 }, (_, i) => ({ t: (i < 4 ? 0.35 * i : 3 + i * 0.5), k: 0.45 + (i % 3) * 0.14, w: 0.28 + (i % 2) * 0.03 + i * 0.006, bob: rng.range(0, 6) }));
  set.moving(kokparRiderPlaced, riders.map((r) => { const p = onOval(r.t, r.k); return { x: p.x, y: ground(p.x, p.z), z: p.z, rot: p.yaw }; }));
  return { name: 'kokpar', group: 'nalati-kokpar', surface: 'wood', meshes: [{ name: '', material: 'poi', slot: 0, geometry }], tris: geometry.getAttribute('position').count / 3 + set.tris(), set, effects: [], anchors: { riders } };
}

interface Signpost { x: number; z: number; boards: Board[] }

const dirTo = (x0: number, z0: number, x1: number, z1: number) => Math.atan2(x1 - x0, z1 - z0);
/** compass directions as `dir` yaws: +z north, +x west */
const N = 0, S = Math.PI, W = Math.PI / 2;

/** the kurgan field's middle (the mounds other than the great one) */
const KF = KURGANS.filter((k) => k.great !== true).reduce((a, k, _, l) => ({ x: a.x + k.x / l.length, z: a.z + k.z / l.length }), { x: 0, z: 0 });
/** signposts at the junctions of layout v2 (src/shards/nalati-grasslands/layout.ts): the camp turn on the N road, the sky road's
 *  foot at the bridge, the gateway at its top, the bowl's crossroads, the E road's turn */
const SIGNS: Signpost[] = [
  { x: -5.2, z: 217, boards: [{ text: 'NOMAD CAMP', dir: dirTo(0, 214, CAMP.x, CAMP.z) }, { text: 'SKY GRASSLAND', dir: S }, { text: 'SHEEP PASTURE', dir: dirTo(0, 217, PASTURE.x, PASTURE.z) }] },
  { x: -6, z: 152, boards: [{ text: 'SKY ROAD', dir: W + 0.1 }, { text: 'KUNES BRIDGE', dir: N }] },
  { x: 127, z: 75, boards: [{ text: 'HORSE PLAINS', dir: dirTo(127, 75, HORSE_PLAINS.x, HORSE_PLAINS.z) }, { text: 'EAGLE ROCK', dir: dirTo(127, 75, EAGLE_ROCK.x, EAGLE_ROCK.z) }, { text: 'W ROAD', dir: dirTo(127, 75, 250, 0) }, { text: 'VALLEY · CAMP', dir: dirTo(127, 75, 92, 90) }] },
  { x: 12, z: 14, boards: [{ text: 'SNOW LOTUS VALLEY', dir: S }, { text: 'KOKPAR FIELD', dir: dirTo(12, 14, KOKPAR.x, KOKPAR.z) }, { text: 'SUMMER CAMP', dir: dirTo(12, 14, SUMMER_YURTS.x, SUMMER_YURTS.z) }, { text: 'HORSE PLAINS', dir: dirTo(12, 14, HORSE_PLAINS.x, HORSE_PLAINS.z) }] },
  { x: -170, z: 22, boards: [{ text: 'KURGAN FIELD', dir: dirTo(-170, 22, KF.x, KF.z) }, { text: 'WATCHTOWER', dir: dirTo(-170, 22, WATCHTOWER.x, WATCHTOWER.z) }, { text: 'E ROAD', dir: dirTo(-170, 22, -250, 0) }] },
];

function roadsPlace(ctx: PaintCtx): BuiltPlace {
  const { ground } = ctx;
  const kit = new PaintKit(0x70ad);
  const set = new NalatiSet(kit, ctx);
  const run = (pts: [number, number][], o: { h?: number; spacing?: number } = {}): void => {
    const r = fenceRun(pts, o);
    set.paint(fencePainted, { x: r.at.x, y: ground(r.at.x, r.at.z), z: r.at.z, yaw: 0 }, r.params);
  };

  // ── fences ──
  // N road, both sides, gate to the bridge; the west side opens for the camp spur
  run([[5.8, 244], [5.6, 232], [6.0, 221]]);
  run([[5.4, 209], [5.8, 196], [5.6, 190]]);
  run([[-5.8, 244], [-5.6, 224], [-5.9, 206], [-5.5, 190]]);
  // the camp spur's south side, and the pasture's paddock fence on its road side
  run([[9, 210], [26, 212.5], [42, 214.5], [60, 213]]);
  run([[PASTURE.x + PASTURE.r + 4, 242], [PASTURE.x + PASTURE.r + 3, 222], [PASTURE.x + PASTURE.r + 5, 200]], { h: 1.0, spacing: 2.8 });

  // ── signposts ──
  for (const s of SIGNS) {
    const gy = ground(s.x, s.z);
    set.paint(signpostPainted, { x: s.x, y: gy, z: s.z, yaw: 0 }, { boards: s.boards });
  }
  const geometry = kit.finish({ ground });
  const wood = kit.finishTextured({ ground }, 'rock');
  const meshes: BuiltPlace['meshes'] = [{ name: 'nalati-roads', material: 'poi', slot: 0, geometry }];
  if (wood) meshes.push({ name: 'nalati-roads-wood', material: 'rock', slot: 1, geometry: wood });
  return { name: 'roads', group: '', surface: 'wood', tris: geometry.getAttribute('position').count / 3 + (wood ? wood.getAttribute('position').count / 3 : 0), meshes, set, effects: [], anchors: { signposts: SIGNS.map(s => ({ x: s.x, z: s.z, boards: s.boards, y: ground(s.x, s.z) })) } };
}

/**
 * A stone stair up a slope the motor cannot climb (NALATI-MERGE P1): flat granite steps laid along a polyline from its
 * foot to its head — straight flights between square landings at the polyline's bends — each step a solid block from
 * under the turf up to its tread, drawn and collided as the same box. The profile follows the ground (every tread over
 * the highest ground under it, + `clear`: no steep turf pokes through under the feet) and is then lifted, never
 * lowered, so no riser is taller than `maxRise`; at the foot, extra steps lead down to the ground. So the rules for a
 * stair hold by construction: rise ≤ `maxRise` (0.32 m), tread ≥ `depth` (0.4 m) — PHYSICS.md: autostep climbs them,
 * never a ramp; a landing at a bend (not two flights' treads overlapping at an angle) keeps every step's top whole.
 *
 *   addStoneStair(set, ground, [[x0, z0], [x1, z1], [x2, z2]], { width: 1.8 });   // its steps: stone-step models
 *
 * The stair is the route (world): it lays `stoneStep` models (E306 / E315 M3, src/shards/nalati-grasslands/models/),
 * painted into the place's kit through its NalatiSet, each colliding as the box it draws.
 */

export interface StairOpts { width?: number; depth?: number; maxRise?: number; clear?: number }

/** one step (or landing): centre, heading, depth along the heading */
interface Step { x: number; z: number; yaw: number; d: number }

/** lay a stair's steps (stone-step models) into `set`; returns how many */
export function addStoneStair(set: NalatiSet, ground: Ground, pts: readonly (readonly [number, number])[], o: StairOpts = {}): number {
  const width = o.width ?? 1.8, depth = o.depth ?? 0.4, maxRise = o.maxRise ?? 0.32, clear = o.clear ?? 0.12;
  // the flights (between landings of side `width` at every bend) and the landings
  const steps: Step[] = [];
  const last = pts.length - 1;
  for (let k = 1; k <= last; k++) {
    const a = pts[k - 1], b = pts[k];
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const s0 = k > 1 ? width / 2 : 0, s1 = len - (k < last ? width / 2 : 0), n = Math.max(1, Math.floor((s1 - s0) / depth)), d = (s1 - s0) / n;   // every tread ≥ depth
    for (let i = 0; i < n; i++) { const t = (s0 + (i + 0.5) * d) / len; steps.push({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw, d }); }
    const c = pts[k + 1];
    if (k < last && c) {
      const yaw2 = Math.atan2(c[0] - b[0], c[1] - b[1]), mid = yaw + Math.atan2(Math.sin(yaw2 - yaw), Math.cos(yaw2 - yaw)) / 2;
      steps.push({ x: b[0], z: b[1], yaw: mid, d: width });
    }
  }
  // the ground under each: the highest across and along it (+ clear), the lowest (the block's foot)
  const hi: number[] = [], lo: number[] = [];
  const sample = (s: Step): [number, number] => {
    const ax = Math.cos(s.yaw), az = -Math.sin(s.yaw), fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    let h = -Infinity, l = Infinity;
    for (const u of [-0.55, -0.35, -0.15, 0.15, 0.35, 0.55]) for (const v of [-0.6, -0.2, 0.2, 0.6]) {
      const y = ground(s.x + ax * u * width + fx * v * s.d, s.z + az * u * width + fz * v * s.d);
      h = Math.max(h, y); l = Math.min(l, y);
    }
    return [h + clear, l];
  };
  for (const s of steps) { const [h, l] = sample(s); hi.push(h); lo.push(l); }
  // lift so every riser is ≤ maxRise both ways (the stair climbs; a dip in the ground is bridged, not followed down)
  const top = [...hi];
  for (let i = top.length - 2; i >= 0; i--) top[i] = Math.max(top[i] ?? 0, (top[i + 1] ?? 0) - maxRise);
  for (let i = 1; i < top.length; i++) top[i] = Math.max(top[i] ?? 0, (top[i - 1] ?? 0) - maxRise);
  // the foot: while the first step stands more than a step over the ground at its outer edge, lay one more before it,
  // a riser lower (the stair's foot is on walkable ground — the turf there may show through its first treads)
  for (let guard = 0; guard < 24; guard++) {
    const f = steps[0], t0 = top[0];
    if (!f || t0 === undefined || t0 - ground(f.x - Math.sin(f.yaw) * f.d / 2, f.z - Math.cos(f.yaw) * f.d / 2) <= 0.25) break;
    const s: Step = { x: f.x - Math.sin(f.yaw) * (f.d + depth) / 2, z: f.z - Math.cos(f.yaw) * (f.d + depth) / 2, yaw: f.yaw, d: depth };
    const [, l] = sample(s);
    steps.unshift(s); lo.unshift(l); top.unshift(t0 - maxRise);
  }
  steps.forEach((s, i) => {
    const y1 = top[i] ?? 0, y0 = Math.min((lo[i] ?? y1) - 0.4, y1 - 0.3), h = y1 - y0;
    // the step: a rough granite block a touch wider than the tread, its top flat at the tread
    set.paint(stoneStepPainted, { x: s.x, y: y0, z: s.z, yaw: s.yaw }, { width, depth: s.d, height: h, seed: 0x5a1 + i });
  });
  return steps.length;
}

/** Static dressing construction runs only in the existing places bake. */

export function* dressingStatics(ctx: PaintCtx, plan: DressPlan): Generator<void, BuiltPlace> {
  const { ground, flutter } = ctx;
  const regions = new Map<number, THREE.BufferGeometry[]>();
  const put = (x: number, z: number, g: THREE.BufferGeometry) => {
    const k = (x < 0 ? 0 : 1) + (z > 60 ? 2 : 0);
    let list = regions.get(k); if (!list) regions.set(k, (list = []));
    list.push(g);
  };
  const descs: ColliderDesc[] = [];
  const rng = new Rng(0x0d7e);
  const set = new NalatiSet(null, { ground, flutter, smoke: ctx.smoke });
  const on = (x: number, z: number, yaw = 0) => ({ x, y: ground(x, z), z, yaw });

  // ── logs + driftwood (no AO bake: a lone log has nothing to occlude it; the contact shade does the foot) ──
  for (const l of plan.logs) {
    const kit = new PaintKit(rng.int(1, 1e6));
    const e = logEnds(l.ax, l.az, l.bx, l.bz);
    const made = set.into(kit).paint(fallenLogPainted, on(e.at.x, e.at.z), { ...e.ends, r: l.r, drift: l.drift, rng });
    descs.push(...(made.descs ?? []));
    put((l.ax + l.bx) / 2, (l.az + l.bz) / 2, kit.finish({ ground, aoH: 0.3, aoMin: 0.6, ao: false }));
    yield;
  }

  // ── stumps ──
  for (const s of plan.stumps) {
    const kit = new PaintKit(rng.int(1, 1e6));
    set.into(kit).paint(stumpPainted, on(s.x, s.z), { s: s.s, rng });
    put(s.x, s.z, kit.finish({ ground, aoH: 0.35, ao: false }));
    yield;
  }

  // ── ovooPainted cairns: a stone heap, a lashed pole bundle, ribbons ──
  for (const o of plan.ovoos) {
    const kit = new PaintKit(rng.int(1, 1e6));
    const made = set.into(kit).paint(ovooPainted, on(o.x, o.z), { s: o.s, rng });
    descs.push(...(made.descs ?? []));
    put(o.x, o.z, kit.finish({ ground, aoH: 0.4, ao: { strength: 0.5 } }));
    yield;
  }

  // ── lone ribbon poles ──
  for (const p of plan.poles) {
    const kit = new PaintKit(rng.int(1, 1e6));
    set.into(kit).paint(viewpointPolePainted, on(p.x, p.z), { rng });
    put(p.x, p.z, kit.finish({ ground, aoH: 0.3, ao: false }));
    yield;
  }

  // ── the sky road's guard fences (the split-rail fencePainted) + the gateway on the rim ──
  // (the timber is the kit's 'rock' textured layer — props.ts GRAIN — so every run goes into one extra mesh, `wood`)
  const woodGeos: THREE.BufferGeometry[] = [];
  for (const run of plan.fences) {
    const kit = new PaintKit(rng.int(1, 1e6));
    const r = fenceRun(run, { h: 1.05, spacing: 2.6 });
    set.into(kit).paint(fencePainted, on(r.at.x, r.at.z), r.params);
    const g = kit.finishTextured({ ground, aoH: 0.3, ao: false }, 'rock');
    if (g) woodGeos.push(g);
    if (!kit.empty) { const mid = run[Math.floor(run.length / 2)] ?? [0, 0]; put(mid[0], mid[1], kit.finish({ ground, aoH: 0.3, ao: false })); }
    yield;
  }
  for (const g of plan.gates) {
    const kit = new PaintKit(rng.int(1, 1e6));
    set.into(kit).paint(skyGatewayPainted, on(g.x, g.z, g.yaw), { rng });
    put(g.x, g.z, kit.finish({ ground, aoH: 0.4, ao: false }));
    yield;
  }

  const meshes: BuiltPlace['meshes'] = [];
  let tris = 0;
  for (const [k, list] of regions) {
    if (list.length === 0) continue;
    const geo = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    geo.computeBoundingSphere();
    meshes.push({ name: `nalati-dress-props-${k}`, material: 'poi', slot: meshes.length, geometry: geo });
    tris += geo.getAttribute('position').count / 3;
    yield;
  }
  if (woodGeos.length > 0) {
    const geo = mergeGeometries(woodGeos, false);
    for (const g of woodGeos) g.dispose();
    geo.computeBoundingSphere();
    meshes.push({ name: 'nalati-dress-fences', material: 'rock', slot: meshes.length, geometry: geo });
    tris += geo.getAttribute('position').count / 3;
  }
  return { name: 'dressing-statics', group: 'nalati-dress-statics', surface: 'wood', meshes, tris, set, effects: [] };
}

export function* dressingClutter(ctx: PaintCtx, spots: ClutterSpots): Generator<void, BuiltPlace> {
  const { ground } = ctx;
  const rng = new Rng(0xc1a7);
  const kit = new PaintKit(0xc1a8);
  const set = new NalatiSet(kit, ctx);
  yield;
  for (const s of spots) { set.paint(campClutterPainted, { x: s.x, y: ground(s.x, s.z), z: s.z, yaw: s.yaw }, { kind: s.kind, rng }); yield; }
  const geometry = kit.finish({ ground, aoH: 0.35, ao: { strength: 0.45 } });
  return { name: 'dressing-clutter', group: null, surface: 'wood', meshes: [{ name: 'nalati-dress-camp-clutter', material: 'poi', slot: 0, geometry }], tris: geometry.getAttribute('position').count / 3, set, effects: [] };
}

/** The original outcrop placement and paint, offline over native terrain. */

export function* outcropsPlace(ctx: PaintCtx, seed = 0x0c7): Generator<void, BuiltPlace> {
  const heightAt = ctx.ground;
  const kit = new PaintKit(seed);
  const rng = kit.rng;
  const set = new NalatiSet(kit, ctx);
  const cluster = new Noise2D(seed + 11);
  const colliders: Collider[] = [];
  const descs: ColliderDesc[] = [];
  const hulls = (m: { readonly descs?: readonly ColliderDesc[] }): void => { descs.push(...(m.descs ?? [])); };
  let count = 0;
  const step = 8;
  for (let gx = -244; gx <= 244; gx += step) for (let gz = RIM_Z - 10; gz <= 160; gz += step) {
    const x = gx + rng.range(-step * 0.45, step * 0.45), z = gz + rng.range(-step * 0.45, step * 0.45);
    const [nx, ny, nz] = normalAt(x, z, 1.5);
    const slope = 1 - ny;
    if (slope < 0.045) continue; // 1 − n.y: 0.045 ≈ 17°, 0.13 ≈ 30°
    const y0 = heightAt(x, z);
    if (y0 < -8.5 || y0 > 46) continue;
    if (trailDistance(x, z) < 7 || riverMask(x, z) > 0 || inPoiClearing(x, z, 4)) continue;
    if (Math.abs(x) > 238 || Math.abs(z) > 238) continue;
    // clustered where the ground paints rock (the def's outcropAt: rock breaking through the turf), grass between
    const c = outcropAt(x, z) * 1.25 - 0.2;
    const keep = (c + 0.1) * 1.5 * Math.min(1, (slope - 0.035) * 10);
    if (rng.next() > keep) continue;

    // a block lying along the contour, tipped into the slope, sunk a third into the ground
    const size = 0.9 + rng.next() * (slope > 0.12 ? 2.4 : 1.5);
    const w = size * rng.range(1.4, 2.6), h = size * rng.range(0.7, 1.2), d = size * rng.range(1.0, 1.6);
    const downYaw = Math.atan2(nx, nz);                 // the heading the slope falls toward
    const yaw = downYaw + Math.PI / 2 + rng.range(-0.35, 0.35);
    const tilt = Math.min(0.5, Math.acos(Math.min(1, ny)) * 0.55);
    const y = y0 - h * 0.32;
    const tint: RockTint = rng.next() < 0.5 ? 'granite' : rng.next() < 0.5 ? 'warm' : 'cool';
    hulls(set.paint(graniteOutcropPainted, { x, y, z, yaw }, { w, h, d, rough: 0.22, pitch: tilt * Math.cos(yaw - downYaw), roll: tilt * Math.sin(yaw - downYaw), tint, lichen: 0.55, solid: h > 1.1 }));
    // one or two rounded stones leaning on it, downhill
    const extra = rng.int(0, 2);
    for (let k = 0; k < extra; k++) {
      const r = size * rng.range(0.35, 0.6);
      const ox = x + Math.sin(downYaw) * (d * 0.5 + r * 0.6) + rng.range(-w * 0.4, w * 0.4);
      const oz = z + Math.cos(downYaw) * (d * 0.5 + r * 0.6) + rng.range(-w * 0.4, w * 0.4);
      set.paint(roundedBoulderPainted, { x: ox, y: heightAt(ox, oz) - r * 0.25, z: oz, yaw: 0 }, { r, look: 'lean', tint, solid: false });
    }
    if (h > 1.1) colliders.push({ x, z, hw: w * 0.42, hd: d * 0.42, rot: yaw, yTop: y + h * 0.5, yBottom: y - h });
    count++;
    yield;
  }
  // the rim: a broken band of granite just under the plateau's lip, so the climb tops out through rock
  for (let x = -236; x <= 236; x += 4.5) {
    const c = cluster.fbm(x * 0.03 + 40, 3.3, 2);
    if (c < -0.12 || rng.next() > 0.75) continue;
    const z = rimZAt(x) + rng.range(4, 12);
    if (trailDistance(x, z) < 8 || inPoiClearing(x, z, 4)) continue;
    const [nx, ny, nz] = normalAt(x, z, 1.5);
    if (1 - ny < 0.04) continue;
    const size = 1.2 + rng.next() * 2.2;
    const w = size * rng.range(1.6, 2.8), h = size * rng.range(0.9, 1.5), d = size * rng.range(1.0, 1.5);
    const downYaw = Math.atan2(nx, nz), yaw = downYaw + Math.PI / 2 + rng.range(-0.25, 0.25);
    const y = heightAt(x, z) - h * 0.3;
    hulls(set.paint(graniteOutcropPainted, { x, y, z, yaw }, { w, h, d, rough: 0.24, pitch: 0.12, roll: 0, draw: 2, lichen: 0.5, solid: h > 1.1 }));
    if (h > 1.1) colliders.push({ x, z, hw: w * 0.42, hd: d * 0.42, rot: yaw, yTop: y + h * 0.5, yBottom: y - h });
    count++;
    yield;
  }
  // (Snow Lotus Valley's walls are src/shards/nalati-grasslands/cragRock.ts's: ribs standing against them, sunk into the rock)
  // the river's channels: boulders standing in the current (the white water breaks round them)
  for (let x = -240; x <= 240; x += 7) {
    if (rng.next() > 0.55 || Math.abs(x) < 16) continue;
    const u = rng.range(-0.9, 0.9), bx = x + rng.range(-3, 3), bz = RIVER.z(bx) + u * RIVER.half(bx);
    if (heightAt(bx, bz) > RIVER.level - 0.3) continue; // only where there is water over the bed
    const r = rng.range(0.5, 1.2);
    set.paint(roundedBoulderPainted, { x: bx, y: heightAt(bx, bz) + r * 0.2, z: bz, yaw: 0 }, { r, look: 'channel', tint: 'cool', solid: false });
    count++;
    yield;
  }
  // the river banks: rounded boulders along both edges of the gravel corridor and a few out on the bars
  for (let x = -244; x <= 244; x += 5) {
    for (const side of [-1, 1]) {
      if (cluster.fbm(x * 0.025 + side * 17, 9.1, 2) < -0.05 || rng.next() > 0.6) continue;
      const bank = side * (RIVER.half(x) + rng.range(-3, 2.5));
      const bx = x + rng.range(-2, 2), bz = RIVER.z(bx) + bank;
      if (trailDistance(bx, bz) < 6 || inPoiClearing(bx, bz, 2)) continue;
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const r = rng.range(0.45, 1.3), ox = bx + rng.range(-2, 2), oz = bz + rng.range(-1.5, 1.5);
        set.paint(roundedBoulderPainted, { x: ox, y: Math.max(heightAt(ox, oz), RIVER.level - 0.4) - r * 0.3, z: oz, yaw: 0 }, { r, look: 'bank', coolOdds: 0.5, solid: false });
      }
      count++;
      yield;
    }
  }
  // the meltwater stream (Snow Lotus Valley): boulders in its bed that the water runs round, heaped along both banks
  for (let i = 0; i + 1 < BROOK.length; i++) {
    const a = BROOK[i], b = BROOK[i + 1];
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
    for (let d = rng.range(0, 2); d < len; d += rng.range(1.8, 3.6)) {
      const px = a[0] + tx * d, pz = a[1] + tz * d;
      if (trailDistance(px, pz) < 5 || inPoiClearing(px, pz, 1)) continue;
      if (rng.next() < 0.45) {
        const r = rng.range(0.3, 0.75), u = rng.range(-0.9, 0.9);
        const bx = px - tz * u, bz = pz + tx * u;
        set.paint(roundedBoulderPainted, { x: bx, y: heightAt(bx, bz) - r * 0.15, z: bz, yaw: 0 }, { r, look: 'bed', tint: 'cool', solid: false });
        count++;
        yield;
      }
      for (const side of [-1, 1]) {
        if (rng.next() > 0.6) continue;
        const r = rng.range(0.45, 1.35), o = side * rng.range(1.9, 4.8);
        const bx = px - tz * o + rng.range(-0.8, 0.8), bz = pz + tx * o + rng.range(-0.8, 0.8);
        hulls(set.paint(roundedBoulderPainted, { x: bx, y: heightAt(bx, bz) - r * 0.3, z: bz, yaw: 0 }, { r, look: 'streambank', coolOdds: 0.6, solid: r > 1.0 }));
        if (r > 1.0) colliders.push({ x: bx, z: bz, hw: r * 0.7, hd: r * 0.7, rot: 0, yBottom: heightAt(bx, bz) - 1, yTop: heightAt(bx, bz) + r * 0.5 });
        count++;
        yield;
      }
    }
  }
  // N23 (the edge berm): granite breaking out of the edge berm's crest and its steep upper face — clustered, the
  // spruce lines between — so its skyline is rock and trees, and nobody walks up the last metres onto the crest
  for (let s = -CHUNK_HALF + 3; s <= CHUNK_HALF - 3; s += 4.2) {
    for (let side = 0; side < 4; side++) {
      if (cluster.fbm(s * 0.035 + side * 23.1, 5.7, 2) < -0.08 || rng.next() > 0.7) continue;
      const d = rng.range(1.5, 9) ** 1.1;
      const x = side === 0 ? s : side === 1 ? -s : side === 2 ? CHUNK_HALF - d : -CHUNK_HALF + d;
      const z = side === 0 ? CHUNK_HALF - d : side === 1 ? -CHUNK_HALF + d : side === 2 ? -s : s;
      const rise = edgeBermAt(x, z);
      if (rise < 4 || trailDistance(x, z) < 9 || inPoiClearing(x, z, 2)) continue;
      const [nx, ny, nz] = normalAt(x, z, 1.5);
      const size = 1.1 + rng.next() * 2.4 * Math.min(1, rise / 12);
      const w = size * rng.range(1.3, 2.5), h = size * rng.range(0.9, 1.6), dd = size * rng.range(1.0, 1.5);
      const downYaw = Math.atan2(nx, nz), yaw = downYaw + Math.PI / 2 + rng.range(-0.5, 0.5);
      const tilt = Math.min(0.45, Math.acos(Math.min(1, ny)) * 0.5);
      const y = heightAt(x, z) - h * 0.3;
      hulls(set.paint(graniteOutcropPainted, { x, y, z, yaw }, { w, h, d: dd, rough: 0.24, pitch: tilt * Math.cos(yaw - downYaw), roll: tilt * Math.sin(yaw - downYaw), draw: 3, lichen: 0.5, solid: true }));
      colliders.push({ x, z, hw: w * 0.42, hd: dd * 0.42, rot: yaw, yTop: y + h * 0.5, yBottom: y - h });
      count++;
      yield;
    }
  }
  yield;
  const geometry = kit.finish({ ground: heightAt, ao: false, aoH: 0.8, aoMin: 0.6 });
  return { name: 'outcrops', group: null, surface: 'rock', meshes: [{ name: 'nalati-outcrops', material: 'poi', slot: 0, geometry }], tris: geometry.getAttribute('position').count / 3, set, effects: [], colliders };
}

type Ground = PaintCtx['ground'];
type Plumes = PaintCtx['smoke'];
type PlaceAnchors = NonNullable<PlaceRow['anchors']>;
type Ledge = NonNullable<PlaceAnchors['ledges']>[number];
type KurganEntrance = NonNullable<PlaceAnchors['entrance']>;

type ClutterSpots = readonly { readonly x: number; readonly z: number; readonly yaw: number; readonly kind: number }[];

function dressingInput(input: { readonly plan: DressPlan; readonly clutter: ClutterSpots } | undefined): { readonly plan: DressPlan; readonly clutter: ClutterSpots } {
  if (input === undefined) throw new Error('[nalati places] dressing paint needs the explicit native placement rows');
  return input;
}

const C = {
  stone: new THREE.Color('#9a9386'),
  stoneWarm: new THREE.Color('#a69a88'),
  carve: new THREE.Color('#5d5a54'),
  lichenGold: new THREE.Color('#b8a266'),
  lichenGreen: new THREE.Color('#98a07e'),
};

const lichen = new Noise2D(0xba1b);
/** granite with carved-groove darkening supplied by the caller, plus lichen blotches from 3D-ish noise */
function stonePainter(base: THREE.Color): (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color {
  const out = new THREE.Color();
  return (p, n) => {
    out.copy(base);
    const b = lichen.get(p.x * 4.1 + p.y * 1.7, p.z * 4.3 - p.y * 2.3) * 0.6 + lichen.get(p.x * 11 + p.y * 5, p.z * 11) * 0.4;
    if (b > 0.36) out.lerp(p.y > 1.0 || n.y > 0.3 ? C.lichenGold : C.lichenGreen, Math.min(0.5, (b - 0.36) * 2.5));
    if (n.y < -0.4) out.multiplyScalar(0.8);
    return out;
  };
}

/** a stone part: welded, its surface chipped and weathered by noise (amp in metres), smooth-shaded */
function weathered(g: THREE.BufferGeometry, amp: number, seed: number): THREE.BufferGeometry {
  const w = mergeVerticesByPos(g);
  const n = new Noise2D(seed);
  const pos = w.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.hypot(x, z) || 1;
    const k = (n.get(x * 7 + y * 3, z * 7 - y * 2) * 0.6 + n.get(x * 17 + 3, y * 17 + z * 5) * 0.4) * amp;
    pos.setXYZ(i, x + (x / len) * k, y + k * 0.3, z + (z / len) * k);
  }
  w.computeVertexNormals();
  return w;
}

/**
 * A carved balbal in local space: feet at y 0, facing −z, ~2.15 m tall. A squat, heavy stele — the Turkic kurgan
 * warrior: a big head with a heavy brow, deep-set almond eyes, a long wedge nose and a thick moustache curling down past
 * the mouth; the right hand raises a goblet to the chest, the left rests on the sabre at the belt; belt pendants; the
 * stone chipped and weathered, lichen gold on the tops. Variant 1 wears a pointed cap and a short beard.
 */
export function balbalGeometry(variant: number, seed = 0xba1): THREE.BufferGeometry {
  const kit = new PaintKit(seed + variant * 17);
  const stone = variant === 0 ? C.stone : C.stoneWarm;
  const paint = stonePainter(stone);
  const carve = stonePainter(C.carve);
  const add = (g: THREE.BufferGeometry, c: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color) => kit.add(g, c, { brush: 0.1 });
  const s0 = seed + variant * 101;
  // plinth (half buried) and the body: a broad flattened pillar, tapering a little, weathered
  add(weathered(new THREE.CylinderGeometry(0.46, 0.52, 0.5, 12, 2).scale(1, 1, 0.78), 0.05, s0), paint);
  add(weathered(new THREE.CylinderGeometry(0.35, 0.4, 1.34, 20, 8).scale(1, 1, 0.74).translate(0, 0.86, 0), 0.03, s0 + 1), paint);
  add(weathered(new THREE.SphereGeometry(0.36, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.0, 0.36, 0.74).translate(0, 1.52, 0), 0.02, s0 + 2), paint);
  add(new THREE.CylinderGeometry(0.19, 0.22, 0.16, 14).scale(1, 1, 0.9).translate(0, 1.62, 0.01), paint);
  // head: big, a little forward, a flattened face
  const hy = 1.88;
  add(weathered(new THREE.SphereGeometry(0.27, 22, 16).scale(0.95, 1.12, 0.9).translate(0, hy, 0.0), 0.015, s0 + 3), paint);
  add(weathered(new THREE.BoxGeometry(0.4, 0.36, 0.08, 4, 4, 1).translate(0, hy - 0.03, -0.2), 0.008, s0 + 4), paint);
  // the heavy brow ridge (an arch), the deep eye sockets, the almond eyes inside them
  add(pole(v3(-0.16, hy + 0.06, -0.225), v3(0, hy + 0.085, -0.25), 0.035, 0.038, 8), paint);
  add(pole(v3(0, hy + 0.085, -0.25), v3(0.16, hy + 0.06, -0.225), 0.038, 0.035, 8), paint);
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.05, 10, 8).scale(1.3, 0.75, 0.5).translate(sx * 0.085, hy + 0.02, -0.232), carve);
    add(new THREE.SphereGeometry(0.03, 10, 6).scale(1.5, 0.55, 0.5).translate(sx * 0.085, hy + 0.018, -0.245), paint);
    // the moustache: thick, drooping past the mouth, the ends curling out
    add(pole(v3(sx * 0.012, hy - 0.085, -0.268), v3(sx * 0.07, hy - 0.1, -0.258), 0.026, 0.024, 7), paint);
    add(pole(v3(sx * 0.07, hy - 0.1, -0.258), v3(sx * 0.115, hy - 0.16, -0.24), 0.024, 0.018, 7), paint);
    add(pole(v3(sx * 0.115, hy - 0.16, -0.24), v3(sx * 0.14, hy - 0.2, -0.225), 0.018, 0.01, 6), paint);
    add(new THREE.SphereGeometry(0.05, 8, 6).scale(0.45, 1.1, 0.8).translate(sx * 0.255, hy + 0.0, -0.02), paint);    // ears
  }
  // nose: a long wedge from the brow
  { const g = new THREE.CylinderGeometry(0.022, 0.05, 0.17, 4).rotateY(Math.PI / 4).scale(1, 1, 0.9); add(g.translate(0, hy - 0.02, -0.255), paint); }
  add(new THREE.BoxGeometry(0.09, 0.014, 0.02).translate(0, hy - 0.13, -0.245), carve);                                         // mouth
  if (variant === 1) {
    add(weathered(new THREE.ConeGeometry(0.28, 0.32, 18, 2).scale(1, 1, 0.9).translate(0, hy + 0.36, 0.01), 0.012, s0 + 5), paint);
    add(new THREE.TorusGeometry(0.26, 0.028, 5, 20).rotateX(Math.PI / 2).scale(1, 1, 0.9).translate(0, hy + 0.2, 0), paint);
    add(new THREE.ConeGeometry(0.06, 0.14, 6).rotateX(Math.PI).translate(0, hy - 0.26, -0.2), paint);                           // short beard
  } else {
    add(new THREE.TorusGeometry(0.25, 0.026, 5, 20).rotateX(Math.PI / 2 - 0.15).scale(1, 1, 0.9).translate(0, hy + 0.14, 0.02), carve);  // headband
  }
  // right arm (+x) in relief: upper arm down the side, forearm across the chest, the hand holding the goblet
  add(new THREE.CapsuleGeometry(0.075, 0.34, 3, 10).scale(1, 1, 0.65).rotateZ(0.07).translate(0.33, 1.3, -0.12), paint);
  add(pole(v3(0.31, 1.1, -0.22), v3(0.05, 1.24, -0.29), 0.07, 0.06, 10), paint);
  add(new THREE.SphereGeometry(0.068, 10, 8).scale(1.05, 0.9, 0.75).translate(0.03, 1.25, -0.31), paint);
  add(new THREE.CylinderGeometry(0.075, 0.04, 0.14, 12).translate(-0.02, 1.36, -0.31), paint);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6).translate(-0.02, 1.27, -0.31), paint);
  add(new THREE.TorusGeometry(0.072, 0.012, 4, 12).rotateX(Math.PI / 2).translate(-0.02, 1.43, -0.31), carve);
  // left arm (−x): hand on the sabre hilt at the belt
  add(new THREE.CapsuleGeometry(0.075, 0.34, 3, 10).scale(1, 1, 0.65).rotateZ(-0.07).translate(-0.33, 1.3, -0.12), paint);
  add(pole(v3(-0.31, 1.1, -0.2), v3(-0.19, 0.95, -0.29), 0.066, 0.056, 10), paint);
  add(new THREE.SphereGeometry(0.064, 10, 8).scale(1, 0.9, 0.75).translate(-0.18, 0.93, -0.3), paint);
  // belt, pendants, the sabre
  add(new THREE.CylinderGeometry(0.385, 0.39, 0.08, 22).scale(1, 1, 0.76).translate(0, 0.86, 0), carve);
  for (const bx of [-0.22, -0.02, 0.18]) add(new THREE.BoxGeometry(0.05, 0.12, 0.025).translate(bx, 0.76, -0.29), paint);
  add(new THREE.BoxGeometry(0.06, 0.66, 0.03).rotateZ(-0.12).translate(-0.24, 0.5, -0.29), paint);
  add(new THREE.BoxGeometry(0.16, 0.035, 0.05).translate(-0.19, 0.86, -0.3), paint);
  const geo = kit.finish({ ao: { cell: 0.035, dist: 0.25, strength: 0.75 } });
  // a soft foot shade (the instances stand on grass)
  const pos = geo.getAttribute('position'), col = geo.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const k = 0.62 + 0.38 * Math.min(1, Math.max(0, pos.getY(i) / 0.5));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * (k * 0.9 + 0.1));
  }
  col.needsUpdate = true;
  return geo;
}

export function goatGeometry(): THREE.BufferGeometry {
  const kit = new PaintKit(0x9047);
  const hide = '#8a7457', dark = '#5b4a3a', horn = '#3a302a';
  kit.add(blob(0.36, kit.rng, 2, 1, 0.12).scale(1.55, 0.62, 0.8), hide, { brush: 0.18 });
  for (const [x, z] of [[0.36, 0.14], [0.3, -0.14], [-0.36, 0.14], [-0.32, -0.14]] as const) kit.add(pole(v3(x, 0, z), v3(x * 1.12, -0.12, z * 2.9), 0.045, 0.03, 6), dark);
  kit.add(blob(0.13, kit.rng, 1, 0.9, 0.1).scale(1.5, 0.9, 0.9).translate(0.66, 0.02, 0.04), hide);
  for (const s of [-1, 1]) kit.add(pole(v3(0.72, 0.11, s * 0.05), v3(0.6, 0.26, s * 0.1), 0.022, 0.008, 5), horn);
  return kit.finish({ ao: false });
}

export function riderGeometry(): THREE.BufferGeometry {
  const kit = new PaintKit(0x9a7a);
  const teal = new THREE.Color(0.55, 0.9, 0.95), dark = new THREE.Color(0.2, 0.42, 0.48);
  kit.add(new THREE.CylinderGeometry(0.2, 0.26, 0.7, 12), teal, { matrix: M(0, 0.45, -0.02) });          // torso
  kit.add(new THREE.CylinderGeometry(0.3, 0.42, 0.9, 12, 1, true), dark, { matrix: M(0, 0.25, -0.12) });  // the cloak
  kit.add(new THREE.SphereGeometry(0.14, 12, 10), teal, { matrix: M(0, 0.95, 0) });                    // head
  kit.add(new THREE.ConeGeometry(0.15, 0.35, 12), dark, { matrix: M(0, 1.14, 0) });                   // the spiked helm
  for (const sx of [1, -1]) kit.add(pole(v3(sx * 0.22, 0.72, 0), v3(sx * 0.3, 0.35, 0.28), 0.06, 0.05, 6), teal);
  kit.add(pole(v3(-0.3, 0.1, 0.6), v3(0.1, 1.6, -0.3), 0.025, 0.025, 6), dark);                       // the glaive
  kit.add(new THREE.ConeGeometry(0.06, 0.5, 6), teal, { matrix: M(0.12, 1.75, -0.36, 0, 1, 1, 1, -0.25) });
  kit.add(pole(v3(0.05, 0.3, -0.25), v3(0.05, 2.3, -0.4), 0.02, 0.02, 5), dark);                        // the standard's pole
  for (let i = 0; i < 7; i++) kit.add(pole(v3(0.05, 2.25, -0.4), v3(0.05 + Math.sin(i) * 0.12, 1.55 - i * 0.03, -0.55 - (i % 3) * 0.08), 0.03, 0.005, 4), new THREE.Color(0.85, 0.95, 0.95));
  return kit.finish();
}

export function trophyGeometry(id: string): THREE.BufferGeometry {
  const kit = new PaintKit(0x7e0 + id.length);
  const rng = kit.rng;
  switch (id) {
    case 'aqbars': case 'kokbori': {
      // a folded pelt with its tail
      const col = id === 'aqbars' ? new THREE.Color('#d8d4ca') : new THREE.Color('#9aa4b0');
      kit.add(blob(0.32, rng, 2, 0.35, 0.2), (p) => (id === 'aqbars' && Math.sin(p.x * 30) * Math.sin(p.z * 30) > 0.55 ? new THREE.Color('#3a3a3c') : col), { matrix: M(0, 0, 0, 0, 1.3, 1, 0.9) });
      kit.add(pole(v3(-0.3, 0.02, 0), v3(-0.75, 0.1, 0.25), 0.07, 0.05, 8), col);
      break;
    }
    case 'qyran':
      kit.add(pole(v3(0, -0.4, 0), v3(0, 0.45, 0), 0.012, 0.004, 5), new THREE.Color('#e7d9b0'));
      kit.add(blob(0.25, rng, 2, 0.12, 0.1), (p) => (p.y > 0.1 ? new THREE.Color('#f0b44a') : new THREE.Color('#5a3a20')), { matrix: M(0, 0.05, 0, 0, 0.35, 1.7, 1) });
      break;
    case 'qara-batyr':
      kit.add(pole(v3(0, -0.5, 0), v3(0, 0.5, 0), 0.02, 0.02, 6), new THREE.Color('#2a3a40'));
      for (let i = 0; i < 9; i++) kit.add(pole(v3(0, 0.45, 0), v3(Math.sin(i) * 0.14, -0.05 - (i % 3) * 0.06, Math.cos(i) * 0.14), 0.035, 0.006, 4), new THREE.Color('#bfe8ea'));
      break;
    default:
      for (let i = 0; i < 3; i++) kit.add(pole(v3((i - 1) * 0.05, 0.4, 0), v3((i - 1) * 0.08, -0.4, 0.05), 0.03, 0.02, 6), new THREE.Color('#141416'));
  }
  return kit.finish();
}

/** Fixed camp fallback shapes use the places painter, before shipping. */
export function buildPeopleFallback(selected: keyof typeof peopleFallbackFrames): { body: THREE.BufferGeometry; head: THREE.BufferGeometry; arm: THREE.BufferGeometry; height: number; neck: THREE.Vector3; shoulder: THREE.Vector3; radius: number } {
  type PersonId = keyof typeof peopleFallbackFrames;
  interface PersonFrame { height: number; neck: THREE.Vector3; shoulder: THREE.Vector3 }
// ── the palette (painterly: saturated, warm) ─────────────────────────────────────────────────────────────────────────
const campPalette = {
  skin: '#c89066', skinDark: '#a8704c', beard: '#ebe6dc', hair: '#2a211c',
  indigo: '#34315a', gold: '#d2a646', red: '#b5302a', felt: '#efe8d8', black: '#1c1a1a', boot: '#2a1d16',
  coat: '#7a5634', coat2: '#56613c', trousers: '#39373e', fur: '#8c6a47', tymaqTop: '#a3291f', wood: '#6e4a2c',
  under: '#6e2a2a', shirt: '#ece4d2', vest: '#2f7a4c', cap: '#a9322a', dress: '#9b2d2a', velvet: '#1f4a3f', apron: '#ebe3d1', scarf: '#f3eee4', iron: '#3b3a3c',
};

function personFrame(id: PersonId): PersonFrame {
  const row = peopleFallbackFrames[id];
  return { height: row.height, neck: new THREE.Vector3(...row.neck), shoulder: new THREE.Vector3(...row.shoulder) };
}

interface Parts { body: THREE.BufferGeometry; head: THREE.BufferGeometry; arm: THREE.BufferGeometry; neck: THREE.Vector3; shoulder: THREE.Vector3; height: number; radius: number }

/** a sphere shell open at the face (±57° round the front, below the height `open` of the way up the sphere): a headscarf, hair */
const hood = (r: number, open: number): THREE.BufferGeometry => {
  const g = new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.8);
  const pos = g.getAttribute('position'), idx = g.getIndex(), keep: number[] = [];
  if (idx) for (let i = 0; i + 2 < idx.count; i += 3) {
    let fx = 0, fy = 0, fz = 0;
    for (let k = 0; k < 3; k++) { const v = idx.getX(i + k); fx += pos.getX(v); fy += pos.getY(v); fz += pos.getZ(v); }
    const face = fz > 0 && Math.abs(Math.atan2(fx, fz)) < 1.0 && fy / 3 < r * (open - 0.5) * 2;
    if (!face) keep.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  }
  g.setIndex(keep);
  return g;
};
/** how far round from the front (+z) a face centre is, radians 0…π — lathe front panels by whole faces (no zig-zag) */
const front = (p: THREE.Vector3): number => Math.abs(Math.atan2(p.x, p.z));
const sphere = (r: number, sx = 1, sy = 1, sz = 1, w = 12, h = 9): THREE.BufferGeometry => new THREE.SphereGeometry(r, w, h).scale(sx, sy, sz);

/** a head at the neck pivot (origin = the neck's top), facing +z: face, nose, eyes, ears, the neck (hats are added by the caller) */
function head(kit: PaintKit, skin: string, r: number): void {
  kit.add(sphere(r, 0.92, 1.05, 0.98).translate(0, r * 0.95, 0), skin, { brush: 0.05 });
  kit.add(sphere(r * 0.2, 0.8, 1, 1.1, 8, 6).translate(0, r * 0.85, r * 0.93), campPalette.skinDark);        // nose
  for (const s of [-1, 1]) {
    kit.add(sphere(r * 0.1, 1, 1, 0.6, 6, 5).translate(s * r * 0.36, r * 1.08, r * 0.86), campPalette.black, { jitter: 0 }); // eyes
    kit.add(sphere(r * 0.22, 0.5, 1, 0.8, 6, 5).translate(s * r * 0.93, r * 0.95, 0), campPalette.skinDark);  // ears
  }
  kit.add(new THREE.CylinderGeometry(r * 0.42, r * 0.5, r * 0.5, 8).translate(0, -r * 0.05, 0), skin); // neck
}

/** a sleeve from the shoulder pivot (origin) hanging down-forward, with a hand */
function arm(kit: PaintKit, sleeve: string, skin: string, len: number, r: number, extra?: (k: PaintKit, hand: THREE.Vector3) => void): void {
  const hand = v3(0, -len, len * 0.28);
  kit.add(pole(v3(0, 0.02, 0), hand, r, r * 0.8, 8), sleeve, { brush: 0.06 });
  kit.add(sphere(r * 0.85, 1, 1.1, 1).translate(hand.x, hand.y - r * 0.6, hand.z), skin);
  extra?.(kit, v3(hand.x, hand.y - r * 0.6, hand.z));
}

function finish(kit: PaintKit, ao = false): THREE.BufferGeometry {
  const g = kit.finish({ ao: ao ? {} : false });
  if (g.hasAttribute('uv')) g.deleteAttribute('uv');
  return g;
}

// ── the figures (local frame: feet at the origin, facing +z, +x = the figure's LEFT) ─────────────────────────────────

function elder(seed: number): Parts {
  const b = new PaintKit(seed);
  // the chapan: a long robe to the ankles, a gold hem band, the front edges trimmed
  const robe = lathe([[0.001, 0.06], [0.34, 0.06], [0.33, 0.3], [0.3, 0.7], [0.26, 0.98], [0.23, 1.15], [0.25, 1.33], [0.2, 1.46], [0.1, 1.52], [0.001, 1.53]], 24);
  b.add(robe, (p) => { const a = front(p); return p.y < 0.16 ? campPalette.gold : a < 0.2 ? campPalette.under : a < 0.45 ? campPalette.gold : campPalette.indigo; }, { foot: 0.8 });
  b.add(new THREE.TorusGeometry(0.245, 0.045, 6, 18).rotateX(Math.PI / 2).translate(0, 1.0, 0), campPalette.red);                  // the sash
  kit2Boots(b, 0.26);
  // the left arm, merged: down to the staff
  b.add(pole(v3(0.23, 1.4, 0), v3(0.3, 1.02, 0.2), 0.065, 0.055, 8), campPalette.indigo);
  b.add(sphere(0.05).translate(0.31, 0.98, 0.23), campPalette.skin);
  b.add(pole(v3(0.32, 0.0, 0.26), v3(0.31, 1.62, 0.22), 0.025, 0.02, 6), campPalette.wood);                                         // the staff
  b.add(sphere(0.045).translate(0.31, 1.64, 0.22), campPalette.wood);
  const h = new PaintKit(seed + 1);
  head(h, campPalette.skin, 0.115);
  h.add(new THREE.ConeGeometry(0.078, 0.21, 9).rotateX(Math.PI).scale(1, 1, 0.7).translate(0, -0.04, 0.078), campPalette.beard, { brush: 0.12 }); // the beard, from the mouth down
  h.add(pole(v3(-0.07, 0.07, 0.1), v3(0.07, 0.07, 0.1), 0.018, 0.018, 5), campPalette.beard);                                       // moustache
  h.add(lathe([[0.001, 0.2], [0.125, 0.19], [0.11, 0.3], [0.075, 0.4], [0.03, 0.44], [0.001, 0.445]], 12), campPalette.felt);        // the kalpak
  h.add(new THREE.TorusGeometry(0.125, 0.028, 5, 14).rotateX(Math.PI / 2).translate(0, 0.205, 0), campPalette.black);                // its brim
  const a = new PaintKit(seed + 2);
  arm(a, campPalette.indigo, campPalette.skin, 0.44, 0.065);
  return { body: finish(b, true), head: finish(h), arm: finish(a), ...personFrame('elder'), radius: peopleFallbackFrames.elder.radius };
}

/** two boot toes peeking out under a robe */
function kit2Boots(k: PaintKit, fwd: number): void {
  for (const s of [-1, 1]) k.add(sphere(0.06, 1, 0.7, 1.7).translate(s * 0.1, 0.045, fwd), campPalette.boot);
}

function herder(seed: number, hat: 'tymaq' | 'kalpak', coat: string): Parts {
  const b = new PaintKit(seed);
  for (const s of [-1, 1]) {
    b.add(pole(v3(s * 0.1, 0.1, 0), v3(s * 0.11, 0.86, 0), 0.07, 0.08, 8), campPalette.trousers);
    b.add(lathe([[0.001, 0.0], [0.075, 0.0], [0.075, 0.34], [0.07, 0.36], [0.001, 0.36]], 9).scale(1, 1, 1.25).translate(s * 0.1, 0, 0.02), campPalette.boot); // tall boots
    b.add(sphere(0.06, 1, 0.7, 1.5).translate(s * 0.1, 0.04, 0.08), campPalette.boot);
  }
  // the short chapan to the knee, open at the front over a shirt
  const coatG = lathe([[0.001, 0.52], [0.27, 0.52], [0.25, 0.8], [0.23, 1.02], [0.25, 1.3], [0.2, 1.44], [0.1, 1.5], [0.001, 1.51]], 24);
  b.add(coatG, (p) => { const a = front(p); return a < 0.2 && p.y > 1.05 ? campPalette.shirt : p.y < 0.6 || (a < 0.45 && a >= 0.2) ? campPalette.gold : coat; }, { foot: 0.85 });
  b.add(new THREE.TorusGeometry(0.235, 0.04, 6, 18).rotateX(Math.PI / 2).translate(0, 1.02, 0), campPalette.red);
  b.add(pole(v3(0.22, 1.38, 0), v3(0.28, 1.0, 0.12), 0.06, 0.05, 8), coat);                                              // the left arm, merged
  b.add(sphere(0.048).translate(0.29, 0.96, 0.14), campPalette.skin);
  const h = new PaintKit(seed + 1);
  head(h, campPalette.skin, 0.11);
  h.add(pole(v3(-0.07, 0.075, 0.098), v3(0.07, 0.075, 0.098), 0.014, 0.014, 5), campPalette.hair);                                 // moustache
  if (hat === 'tymaq') {
    h.add(sphere(0.135, 1, 0.75, 1, 12, 8).translate(0, 0.19, -0.005), campPalette.tymaqTop);
    h.add(new THREE.TorusGeometry(0.12, 0.045, 6, 14).rotateX(Math.PI / 2).translate(0, 0.17, 0), campPalette.fur, { brush: 0.15 });
    for (const s of [-1, 1]) h.add(sphere(0.055, 0.5, 1.2, 1).translate(s * 0.125, 0.07, -0.01), campPalette.fur, { brush: 0.15 }); // ear flaps
    h.add(sphere(0.07, 1, 0.8, 0.5).translate(0, 0.08, -0.12), campPalette.fur, { brush: 0.15 });                                    // the neck flap
  } else {
    h.add(lathe([[0.001, 0.2], [0.12, 0.19], [0.105, 0.29], [0.07, 0.37], [0.001, 0.4]], 12), campPalette.felt);
    h.add(new THREE.TorusGeometry(0.12, 0.026, 5, 14).rotateX(Math.PI / 2).translate(0, 0.205, 0), campPalette.black);
  }
  const a = new PaintKit(seed + 2);
  arm(a, coat, campPalette.skin, 0.42, 0.062, hat === 'tymaq'
    ? (k, hand) => { k.add(pole(hand, v3(hand.x - 0.02, hand.y - 0.02, hand.z + 0.34), 0.016, 0.012, 5), campPalette.wood); k.add(pole(v3(hand.x - 0.02, hand.y - 0.02, hand.z + 0.34), v3(hand.x - 0.05, hand.y - 0.5, hand.z + 0.4), 0.007, 0.005, 4), campPalette.boot); } // the qamshy (whip)
    : undefined);
  return { body: finish(b, true), head: finish(h), arm: finish(a), ...personFrame(hat === 'tymaq' ? 'herderGate' : 'herderRail'), radius: peopleFallbackFrames[hat === 'tymaq' ? 'herderGate' : 'herderRail'].radius };
}

function child(seed: number): Parts {
  const b = new PaintKit(seed);
  for (const s of [-1, 1]) {
    b.add(pole(v3(s * 0.065, 0.06, 0), v3(s * 0.07, 0.5, 0), 0.045, 0.05, 7), campPalette.trousers);
    b.add(sphere(0.045, 1, 0.8, 1.5).translate(s * 0.065, 0.04, 0.03), campPalette.boot);
  }
  b.add(lathe([[0.001, 0.46], [0.16, 0.46], [0.15, 0.62], [0.14, 0.78], [0.12, 0.86], [0.06, 0.9], [0.001, 0.905]], 24), (p) => (p.y > 0.55 && front(p) < 0.45 ? campPalette.shirt : p.y < 0.52 ? campPalette.gold : campPalette.vest), { foot: 0.9 });
  b.add(pole(v3(0.13, 0.84, 0), v3(0.19, 0.58, 0.06), 0.036, 0.032, 7), campPalette.shirt);
  b.add(sphere(0.03).translate(0.195, 0.55, 0.07), campPalette.skin);
  const h = new PaintKit(seed + 1);
  head(h, campPalette.skin, 0.1);
  h.add(hood(0.104, 0.62).translate(0, 0.1, -0.01), campPalette.hair);                                                            // hair under the cap
  h.add(lathe([[0.001, 0.15], [0.1, 0.15], [0.098, 0.2], [0.07, 0.23], [0.001, 0.24]], 10), (p) => (Math.floor(Math.atan2(p.x, p.z) * 2.5) % 2 === 0 ? campPalette.cap : campPalette.gold)); // the taqiya
  const a = new PaintKit(seed + 2);
  arm(a, campPalette.shirt, campPalette.skin, 0.28, 0.036);
  return { body: finish(b, true), head: finish(h), arm: finish(a), ...personFrame('child'), radius: peopleFallbackFrames.child.radius };
}

function cook(seed: number): Parts {
  const b = new PaintKit(seed);
  b.add(lathe([[0.001, 0.04], [0.33, 0.04], [0.31, 0.35], [0.27, 0.72], [0.22, 0.98], [0.21, 1.12], [0.24, 1.3], [0.19, 1.42], [0.09, 1.47], [0.001, 1.48]], 24),
    (p) => (p.y > 0.95 && p.y < 1.4 ? campPalette.velvet : front(p) < 0.7 && p.y < 0.98 && p.y > 0.12 ? campPalette.apron : p.y < 0.1 ? campPalette.gold : campPalette.dress), { foot: 0.85 });
  kit2Boots(b, 0.25);
  b.add(pole(v3(0.21, 1.34, 0), v3(0.26, 0.98, 0.16), 0.058, 0.05, 8), campPalette.dress);
  b.add(sphere(0.045).translate(0.265, 0.95, 0.18), campPalette.skin);
  const h = new PaintKit(seed + 1);
  head(h, campPalette.skin, 0.105);
  // the oramal: a white scarf over the head, knotted at the back, its tail down the neck
  h.add(hood(0.126, 0.7).translate(0, 0.105, -0.012), campPalette.scarf);
  h.add(sphere(0.06, 1, 1.4, 0.7).translate(0, 0.02, -0.13), campPalette.scarf);
  const a = new PaintKit(seed + 2);
  arm(a, campPalette.dress, campPalette.skin, 0.36, 0.058, (k, hand) => {
    k.add(pole(hand, v3(hand.x, hand.y - 0.05, hand.z + 0.42), 0.012, 0.012, 5), campPalette.wood);                               // the ladle
    k.add(sphere(0.045, 1, 0.55, 1).translate(hand.x, hand.y - 0.07, hand.z + 0.45), campPalette.iron);
  });
  return { body: finish(b, true), head: finish(h), arm: finish(a), ...personFrame('cook'), radius: peopleFallbackFrames.cook.radius };
}

/** each figure's builder (the seeds fix its brush noise) */
const BUILD: Readonly<Record<PersonId, () => Parts>> = {
  elder: () => elder(0xe1d3), herderGate: () => herder(0x4e7a, 'tymaq', campPalette.coat), herderRail: () => herder(0x4e7b, 'kalpak', campPalette.coat2),
  child: () => child(0xc41d), cook: () => cook(0xc00c),
};

  return BUILD[selected]();
}

/** Exact fixed crag output; no runtime terrain traversal or geometry construction. */
export interface CragRockBake {
  meshes: { name: string; geometry: THREE.BufferGeometry }[];
  colliders: Collider[]; descs: ColliderDesc[];
  count: { fins: number; ribs: number; blocks: number }; triangles: number;
  placements: { x: number; y: number; z: number; variant: CragKind }[];
  boxes: number[];
}

// ── placement ───────────────────────────────────────────────────────────────────────────────────────────────────

const RING = 7; // the crest test's radius (m)

export function bakeCragRock(phone: boolean, heightAt: Ground, seed = 0xc4a9): CragRockBake {
  const rng = new Rng(seed), jitter = new Noise2D(seed + 3);
  const colliders: Collider[] = [];
  const descs: ColliderDesc[] = [];
  const count = { fins: 0, ribs: 0, blocks: 0 };
  // four quadrant buckets (east / west × north / south of z = −110), each one mesh
  const parts: THREE.BufferGeometry[][] = [[], [], [], []];
  const occ = new Map<number, { x: number; z: number; r: number }[]>();
  const key = (x: number, z: number): number => (Math.floor(x / 12) + 64) * 1024 + Math.floor(z / 12) + 64;
  const free = (x: number, z: number, r: number): boolean => {
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of occ.get(key(x + a * 12, z + b * 12)) ?? []) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false;
    return true;
  };
  const claim = (x: number, z: number, r: number): void => { const k = key(x, z); const l = occ.get(k) ?? []; l.push({ x, z, r }); occ.set(k, l); };
  // keep-outs: the cave, Argymaq's bench, the snow lotus, the watchtower's rock (their own agents dress them)
  const keepOut: [number, number, number][] = [[LEOPARD_CAVE.x, LEOPARD_CAVE.z, 22], [ARGYMAQ_PASTURE.x, ARGYMAQ_PASTURE.z, 34], [WATCHTOWER.x, WATCHTOWER.z, 22], ...SNOW_LOTUS.map((l): [number, number, number] => [l.x, l.z, l.r + 6])];
  const blocked = (x: number, z: number, r: number): boolean =>
    Math.abs(x) > 246 || Math.abs(z) > 246 || trailDistance(x, z) < 9 + r || inPoiClearing(x, z, 4 + r) || glacierMask(x, z) > 0.02 || brookMask(x, z) > 0 ||
    keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + r);
  const col = (): THREE.Color => new THREE.Color().setScalar(rng.range(0.3, 0.4)).offsetHSL(0, 0, 0).add(new THREE.Color(0, 0.004, 0.02));

  // the pieces placed (the crag rock model's copies): where each stands, its kind, its world box
  const placements: { x: number; y: number; z: number; variant: CragKind }[] = [];
  const boxes: number[] = [];
  const box = new THREE.Box3();
  const add = (kind: CragKind, g: THREE.BufferGeometry, x: number, y: number, z: number, yaw: number, pitch: number, roll: number): void => {
    const c = col();
    const n = g.getAttribute('position').count, cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    descs.push(supportHull(g, null, 'rock', true));
    g.computeBoundingBox();
    const b = g.boundingBox ?? box;
    placements.push({ x, y, z, variant: kind });
    boxes.push(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z);
    parts[(x < 0 ? 0 : 1) + (z < -110 ? 2 : 0)]?.push(g);
  };
  const lowest = (x: number, z: number, r: number): number => {
    let lo = heightAt(x, z);
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; lo = Math.min(lo, heightAt(x + Math.cos(t) * r, z + Math.sin(t) * r)); }
    return lo;
  };

  const step = 4.5;
  for (let gx = -246; gx <= 246; gx += step) {
    for (let gz = -246; gz <= 60; gz += step) {
      const x = gx + rng.range(-step * 0.45, step * 0.45), z = gz + rng.range(-step * 0.45, step * 0.45);
      const roll = rng.next();
      const zs = zoneAt(x, z)[2];
      if (zs < 0.55) continue;
      const h = heightAt(x, z);
      if (h < 6) continue;
      // the local shape: the mean of a ring round the point (a crest stands above it), the gradient
      let sum = 0, bestPair = -Infinity, ridgeYaw = 0;
      const around: number[] = [];
      for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; const v = heightAt(x + Math.cos(t) * RING, z + Math.sin(t) * RING); around.push(v); sum += v; }
      for (let k = 0; k < 4; k++) { const pair = (around[k] ?? 0) + (around[k + 4] ?? 0); if (pair > bestPair) { bestPair = pair; ridgeYaw = -(k / 8) * Math.PI * 2; } }
      const crest = h - sum / 8;
      const gxh = heightAt(x + 1.5, z) - heightAt(x - 1.5, z), gzh = heightAt(x, z + 1.5) - heightAt(x, z - 1.5);
      const grad = Math.hypot(gxh, gzh) / 3; // rise per metre
      const downYaw = Math.atan2(-gxh, -gzh); // three.js yaw whose local +z points downhill … (sin, cos) of the fall line
      const dens = 0.55 + 0.45 * smoothstep(-0.3, 0.4, jitter.fbm(x * 0.02, z * 0.02, 2));

      const band = smoothstep(-0.1, 0.35, jitter.fbm(x * 0.017 + 9, z * 0.017 - 5, 3)); // where the cliff bands run

      if (crest > 1.6 && h > 46 && roll < 0.2 * dens * (phone ? 0.75 : 1)) {
        // ── a fin on the crest: a broad castellated tower, long axis along the ridge ──
        const hh = rng.range(3, 6) + smoothstep(50, 110, h) * rng.range(2, 6) + Math.min(4, crest * 0.5);
        const w = rng.range(7, 14), d = rng.range(4, 7.5);
        if (blocked(x, z, w * 0.5) || !free(x, z, w * 0.42)) continue;
        claim(x, z, w * 0.42);
        const base = lowest(x, z, w * 0.4) - 1.2;
        add('fin', finGeometry(rng, w, d, hh + (h - base)), x, base, z, ridgeYaw + rng.range(-0.2, 0.2), rng.range(-0.05, 0.05), rng.range(-0.06, 0.06));
        count.fins++;
      } else if (grad > 0.8 && roll < (0.15 + 0.85 * band) * 0.65 * (phone ? 0.75 : 1)) {
        // ── a rib against a steep face (≥ ~39°), long axis down the fall line, its top just proud of the slope above: side
        //    by side where a cliff band runs they make one vertical wall with clefts between the buttresses ──
        const len = rng.range(5, 10), thick = rng.range(3.5, 6.5);
        if (blocked(x, z, thick * 0.6) || !free(x, z, thick * 0.42)) continue;
        claim(x, z, thick * 0.42);
        const ux = x - Math.sin(downYaw) * len * 0.45, uz = z - Math.cos(downYaw) * len * 0.45;
        const topY = heightAt(ux, uz) + rng.range(0.3, 1.8) + band * 1.2;
        const base = lowest(x, z, len * 0.5) - 1.5;
        if (topY - base < 4) continue;
        // its top slants down the fall line with the face (a rib, not a flat-topped block), the downhill end still a
        // sheer drop
        add('rib', ribGeometry(rng, thick, len, topY - base, grad), x, base, z, downYaw + rng.range(-0.12, 0.12), 0, 0);
        count.ribs++;
      } else if (grad > 0.5 && grad <= 0.8 && h > 32 && roll > 0.95 - 0.04 * dens) {
        // ── a broken tower on a steep shoulder ──
        const sz = rng.range(4, 8);
        if (blocked(x, z, sz * 0.6) || !free(x, z, sz * 0.6)) continue;
        claim(x, z, sz * 0.6);
        const base = lowest(x, z, sz * 0.5) - 1;
        const top = h + rng.range(2.5, 6);
        add('tower', towerGeometry(rng, sz, top - base), x, base, z, rng.range(0, Math.PI * 2), 0, 0);
        if (grad < 0.7) colliders.push({ x, z, hw: sz * 0.4, hd: sz * 0.3, rot: 0, yBottom: base, yTop: top });
        count.blocks++;
      }
    }
  }

  const meshes: CragRockBake['meshes'] = [];
  let triangles = 0;
  for (const [i, list] of parts.entries()) {
    if (list.length === 0) continue;
    const geometry = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    triangles += geometry.getAttribute('position').count / 3;
    meshes.push({ name: `nalati-crag-rock-${i}`, geometry });
  }
  return { meshes, colliders, descs, count, triangles: Math.round(triangles), placements, boxes };
}

/** Original Kurgan fabric construction, scoped to the existing places author. */
function kurganFabric(supplyCarving: (variant: number, seed: number) => THREE.BufferGeometry): [string, THREE.BufferGeometry][] {
  const { CH, DROMOS_END, COFFIN, PEDESTAL, NICHES } = dungeonLayout;

  const { SAND_N, BEAM_Y, PLANK_Y, DW, DH, DOOR_W, DOOR_H, BRAZIERS, FALLEN } = dungeonLayout.FABRIC;

  const chamberColours = {
    larch: new THREE.Color('#6f5238'), larchDark: new THREE.Color('#4c3826'), larchOld: new THREE.Color('#6b5f52'),
    board: new THREE.Color('#5c4430'), boardDust: new THREE.Color('#7d6a52'),
    earth: new THREE.Color('#4a3524'), black: new THREE.Color('#0c0806'),
    felt: new THREE.Color('#8a2619'), feltDark: new THREE.Color('#4f150e'), cream: new THREE.Color('#e2cfa0'), ochre: new THREE.Color('#b0843e'),
    gold: new THREE.Color('#f2c14e'), goldDark: new THREE.Color('#9a6a1c'), bronze: new THREE.Color('#8a5a2a'),
    stone: new THREE.Color('#8f8b83'), fur: new THREE.Color('#cfc3ad'), sand: new THREE.Color('#a88c62'),
    day: new THREE.Color('#9fb4c8'),
  };

  // ─────────────────────────────── motifs ───────────────────────────────

  const inEll = (u: number, v: number, cx: number, cy: number, rx: number, ry: number, rot = 0) => {
    const c = Math.cos(rot), s = Math.sin(rot), dx = u - cx, dy = v - cy;
    const x = dx * c + dy * s, y = -dx * s + dy * c;
    return (x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1;
  };
  /** a galloping felt-appliqué horse (Pazyryk style) in the unit square, facing left: true inside the figure */
  function horseMask(u: number, v: number): boolean {
    if (inEll(u, v, 0.52, 0.52, 0.25, 0.12, 0.05)) return true;                 // barrel
    if (inEll(u, v, 0.28, 0.64, 0.07, 0.17, -0.55)) return true;                // neck
    if (inEll(u, v, 0.15, 0.78, 0.1, 0.05, 0.55)) return true;                  // head
    if (inEll(u, v, 0.3, 0.84, 0.03, 0.05, -0.3)) return true;                  // ear / mane crest
    if (inEll(u, v, 0.82, 0.55, 0.12, 0.03, -0.55)) return true;                // tail
    if (inEll(u, v, 0.3, 0.33, 0.035, 0.16, 0.55)) return true;                 // foreleg, stretched forward
    if (inEll(u, v, 0.4, 0.3, 0.03, 0.15, -0.2)) return true;                   // foreleg under
    if (inEll(u, v, 0.66, 0.31, 0.035, 0.16, 0.25)) return true;                // hind leg under
    if (inEll(u, v, 0.78, 0.33, 0.03, 0.17, -0.65)) return true;                // hind leg, kicked back
    return false;
  }
  /** a felt panel: red ground, a cream border with a running diamond, `horses` horses along it */
  function feltPainter(w: number, h: number, horses: number, horizontal: boolean): (p: THREE.Vector3) => THREE.Color {
    const out = new THREE.Color();
    return (p) => {
      const u = p.x / w + 0.5, v = p.y / h + 0.5;
      const bu = Math.min(u, 1 - u) * w, bv = Math.min(v, 1 - v) * h, b = Math.min(bu, bv);
      if (b < 0.05) return out.copy(chamberColours.feltDark);
      if (b < 0.16) {
        // the border: a cream band with red diamonds
        const along = bu < bv ? v * h : u * w;
        const across = (b - 0.05) / 0.11;
        const dmd = Math.abs(((along * 5) % 1) - 0.5) + Math.abs(across - 0.5);
        return out.copy(dmd < 0.35 ? chamberColours.felt : chamberColours.cream);
      }
      if (b < 0.2) return out.copy(chamberColours.ochre);
      // the field: horses
      const iw = w - 0.4, ih = h - 0.4;
      const fu = (u * w - 0.2) / iw, fv = (v * h - 0.2) / ih;
      if (horizontal) {
        const k = Math.min(horses - 1, Math.floor(fu * horses)), lu = fu * horses - k;
        if (horseMask(lu * 1.05 - 0.02, (fv - 0.5) * (ih / (iw / horses)) + 0.5)) return out.copy(chamberColours.cream);
      } else {
        const k = Math.min(horses - 1, Math.floor(fv * horses)), lv = fv * horses - k;
        if (horseMask(fu, (lv - 0.5) * ((ih / horses) / iw) + 0.5)) return out.copy(chamberColours.cream);
      }
      return out.copy(chamberColours.felt);
    };
  }

  // ─────────────────────────────── the bake ───────────────────────────────

  interface Lamp { x: number; y: number; z: number; r: number; i: number; c: THREE.Color }
  const WARM = new THREE.Color(1.0, 0.7, 0.44), DAY = new THREE.Color(1.0, 0.93, 0.78), LAMP = new THREE.Color(1.0, 0.72, 0.48);
  const LAMPS: Lamp[] = [
    ...BRAZIERS.map((b) => ({ x: b.x, y: 1.5, z: b.z, r: 9.5, i: 1.5, c: WARM })),
    { x: 0, y: 2.0, z: 12.6, r: 5, i: 0.75, c: LAMP }, { x: 0, y: 2.0, z: 18.2, r: 5, i: 0.7, c: LAMP },
  ];
  const AMBIENT = new THREE.Color(0.15, 0.13, 0.115);
  const _n = new THREE.Vector3(), _d = new THREE.Vector3(), _l = new THREE.Color();

  /** the light at a chamber-local point with normal n (the unlit interior's whole lighting model, baked once) */
  function lightAt(x: number, y: number, z: number, n: THREE.Vector3, out: THREE.Color): THREE.Color {
    out.copy(AMBIENT);
    // soft sky bounce from the looter's hole and the dark ceiling
    out.multiplyScalar(1 - 0.35 * THREE.MathUtils.smoothstep(y, 3, 6));
    for (const L of LAMPS) {
      _d.set(L.x - x, L.y - y, L.z - z);
      const d = _d.length();
      if (d > L.r) continue;
      const f = (1 - (d / L.r) ** 2) ** 2;
      const lam = Math.max(0.2, n.dot(_d.normalize()));
      out.r += L.c.r * L.i * f * lam; out.g += L.c.g * L.i * f * lam; out.b += L.c.b * L.i * f * lam;
    }
    // the daylight shaft from the looter's hole: a pool on the coffin and the floor round it, and a glow on nearby faces
    const dx = x - (COFFIN.x + 0.3), dz = z - (COFFIN.z + 0.2), dr = Math.hypot(dx, dz);
    const pool = (1 - THREE.MathUtils.smoothstep(dr, 1.2, 3.0)) * Math.max(0, n.y);
    const halo = (1 - THREE.MathUtils.smoothstep(dr, 0.5, 5.5)) * 0.35;
    out.r += DAY.r * (pool * 1.8 + halo); out.g += DAY.g * (pool * 1.8 + halo); out.b += DAY.b * (pool * 1.8 + halo);
    // the pedestal's shaft, faint until the victory lights it (the FX does that)
    const pr = Math.hypot(x - PEDESTAL.x, z - PEDESTAL.z);
    const pp = (1 - THREE.MathUtils.smoothstep(pr, 0.6, 2.2)) * 0.5;
    out.r += DAY.r * pp; out.g += DAY.g * pp; out.b += DAY.b * pp;
    // the dromos' far end: cool daylight leaking in from the mound's door
    if (z > CH) {
      const k = THREE.MathUtils.smoothstep(z, DROMOS_END - 4, DROMOS_END);
      out.r += chamberColours.day.r * 0.5 * k; out.g += chamberColours.day.g * 0.5 * k; out.b += chamberColours.day.b * 0.6 * k;
    }
    // corners and the foot of every wall sit in the dark
    const wx = z > CH ? DW - Math.abs(x) : CH - Math.abs(x), wz = z > CH ? 99 : CH - Math.abs(z);
    const ao = THREE.MathUtils.smoothstep(Math.min(wx, wz) + y * 0.8, 0.0, 1.4);
    out.multiplyScalar(0.55 + 0.45 * ao);
    return out;
  }

  /** multiply a merged geometry's vertex colours by the baked light (positions are chamber-local) */
  function bake(geo: THREE.BufferGeometry, from = 0, to = Infinity): void {
    const pos = geo.getAttribute('position'), nrm = geo.getAttribute('normal'), col = geo.getAttribute('color');
    for (let i = from, end = Math.min(to, pos.count); i < end; i++) {
      _n.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      lightAt(pos.getX(i), pos.getY(i), pos.getZ(i), _n, _l);
      col.setXYZ(i, col.getX(i) * _l.r, col.getY(i) * _l.g, col.getZ(i) * _l.b);
    }
    col.needsUpdate = true;
  }


  // ─────────────────────────────── the builder ───────────────────────────────

  /** a horizontal log from (x0, y, z0) to (x1, y, z1) */
  const log = (x0: number, y: number, z0: number, x1: number, z1: number, r: number, sides = 9) => pole(v3(x0, y, z0), v3(x1, y, z1), r, r * 0.96, sides);

  /** The original chamber recipe, executed only by the offline places bake. */
  class KurganFabric {
    readonly group = new THREE.Group();
    readonly statues: THREE.Mesh[] = [];
    declare lid: THREE.Mesh;
    declare heap: THREE.Mesh;
    declare sandMesh: THREE.Mesh;
    readonly sandLight = new Float32Array((SAND_N + 1) * (SAND_N + 1) * 3);
    constructor(private readonly carve: (variant: number, seed: number) => THREE.BufferGeometry) {}
    build(): [string, THREE.BufferGeometry][] {
      const kit = new PaintKit(0xb0551), rng = kit.rng;
      const steps = this.chamberSteps(kit, rng);
      while (steps.next().done !== true) { /* original paint order */ }
      this.buildDromos(kit, rng);
      this.buildGraveGoods(kit, rng);
      const geometry = kit.finish();
      bake(geometry);
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
      const movables = this.movableSteps(mat, rng);
      while (movables.next().done !== true) { /* original RNG continuation */ }
      this.buildSand(mat);
      this.sandMesh.geometry.setAttribute('light', new THREE.BufferAttribute(this.sandLight, 3));
      mat.dispose();
      return [['dungeon:interior', geometry], ['dungeon:lid', this.lid.geometry],
        ...this.statues.map((mesh, i): [string, THREE.BufferGeometry] => [`dungeon:statue:${String(i)}`, mesh.geometry]),
        ['dungeon:heap', this.heap.geometry], ['dungeon:sand', this.sandMesh.geometry], ...fxFabric()];
    }
    private *chamberSteps(kit: PaintKit, rng: Rng): Generator<void, void> {
      // ── floor: long larch boards, dusty toward the walls ──
      for (let i = 0; i < 40; i++) {
        const z = -CH + 0.25 + i * 0.5;
        kit.add(new THREE.BoxGeometry(CH * 2, 0.16, 0.48), rng.next() < 0.3 ? chamberColours.larchOld : chamberColours.board, { matrix: M(0, -0.08 + rng.range(-0.012, 0.012), z), flat: true, brush: 0.12 });
      }
      // ── walls: stacked horizontal logs; openings for the door (north) and the four niches (east / west) ──
      const rows = Math.ceil(PLANK_Y / 0.42);                // up to the deck: no gap under the ceiling
      for (let r = 0; r < rows; r++) {
        const y = 0.22 + r * 0.42, rr = 0.23 + rng.range(-0.015, 0.015);
        const col = r % 3 === 0 ? chamberColours.larchDark : r % 3 === 1 ? chamberColours.larch : chamberColours.larchOld;
        // north (z = +CH): split round the door
        if (y < DOOR_H + 0.1) { kit.add(log(-CH, y, CH, -DOOR_W - 0.35, CH, rr), col, { brush: 0.12 }); kit.add(log(DOOR_W + 0.35, y, CH, CH, CH, rr), col, { brush: 0.12 }); }
        else kit.add(log(-CH, y, CH, CH, CH, rr), col, { brush: 0.12 });
        kit.add(log(-CH, y, -CH, CH, -CH, rr), col, { brush: 0.12 });
        // east (x = −CH) / west (x = +CH): split round the niches
        for (const sx of [-1, 1]) {
          const x = sx * CH;
          if (y < 3.55) {
            const cuts = NICHES.filter((n) => Math.sign(n.x) === sx).map((n) => n.z).sort((a, b) => a - b);
            let z0 = -CH;
            for (const cz of cuts) { kit.add(log(x, y, z0, x, cz - 1.15, rr), col, { brush: 0.12 }); z0 = cz + 1.15; }
            kit.add(log(x, y, z0, x, CH, rr), col, { brush: 0.12 });
          } else kit.add(log(x, y, -CH, x, CH, rr), col, { brush: 0.12 });
        }
      }
      // ── posts: the corners, the wall midpoints, either side of every opening ──
      const post = (x: number, z: number, r = 0.3) => kit.add(pole(v3(x, -0.1, z), v3(x, BEAM_Y + 0.2, z), r, r * 0.9, 10), chamberColours.larchDark, { brush: 0.14, foot: 0.7 });
      for (const [x, z] of [[-CH, -CH], [CH, -CH], [-CH, CH], [CH, CH], [0, -CH], [-CH, 0], [CH, 0]] as const) post(x * 0.97, z * 0.97, 0.34);
      for (const sx of [-1, 1]) post(sx * (DOOR_W + 0.3), CH - 0.05, 0.32);
      kit.add(log(-DOOR_W - 0.9, DOOR_H + 0.3, CH - 0.1, DOOR_W + 0.9, CH - 0.1, 0.3), chamberColours.larchOld, { brush: 0.1 });
      // niches: framed, recessed, dark inside
      for (const n of NICHES) {
        const sx = Math.sign(n.x), x = sx * CH;
        for (const dz of [-1.15, 1.15]) kit.add(pole(v3(x - sx * 0.1, -0.1, n.z + dz), v3(x - sx * 0.1, 3.7, n.z + dz), 0.24, 0.22, 9), chamberColours.larchDark, { brush: 0.12 });
        kit.add(log(x - sx * 0.1, 3.72, n.z - 1.4, x - sx * 0.1, n.z + 1.4, 0.26), chamberColours.larchOld);
        kit.add(new THREE.BoxGeometry(0.2, 3.8, 2.4), chamberColours.earth.clone().multiplyScalar(0.55), { matrix: M(x + sx * 1.2, 1.8, n.z), flat: true });
        kit.add(new THREE.BoxGeometry(1.3, 0.2, 2.4), chamberColours.earth.clone().multiplyScalar(0.7), { matrix: M(x + sx * 0.6, 3.8, n.z), flat: true });
        for (const dz of [-1.2, 1.2]) kit.add(new THREE.BoxGeometry(1.3, 3.8, 0.2), chamberColours.earth.clone().multiplyScalar(0.6), { matrix: M(x + sx * 0.6, 1.8, n.z + dz), flat: true });
        kit.add(new THREE.BoxGeometry(1.3, 0.1, 2.4), chamberColours.earth, { matrix: M(x + sx * 0.6, 0.0, n.z), flat: true });
      }
      yield; // the walls and niches, then the ceiling a task later (the yield draws nothing)
      // ── the ceiling: massive beams across, a plank deck above them, the looter's hole over the coffin ──
      const hole = (x: number, z: number) => Math.hypot((x - 0.3) / 1.45, (z - COFFIN.z - 0.1) / 1.25) < 1 + 0.12 * Math.sin(Math.atan2(z, x) * 5);
      for (let k = 0; k < 13; k++) {
        const z = -CH + 0.6 + k * 1.57;
        const r = 0.3 + rng.range(-0.02, 0.03);
        if (Math.abs(z - COFFIN.z) < 1.2) {
          // the broken beam: two halves hanging into the hole
          kit.add(pole(v3(-CH, BEAM_Y, z), v3(-1.2, BEAM_Y - 0.55, z + 0.2), r, r * 0.8, 9), chamberColours.larchOld, { brush: 0.14 });
          kit.add(pole(v3(CH, BEAM_Y, z), v3(1.6, BEAM_Y - 0.9, z - 0.3), r, r * 0.8, 9), chamberColours.larchOld, { brush: 0.14 });
          continue;
        }
        kit.add(log(-CH, BEAM_Y, z, CH, z, r, 10), k % 2 === 0 ? chamberColours.larchDark : chamberColours.larch, { brush: 0.14 });
      }
      for (let i = 0; i < 40; i++) {
        const x = -CH + 0.25 + i * 0.5;
        // boards along z, cut where they cross the hole (ragged ends)
        let z0 = -CH;
        const segs: [number, number][] = [];
        let inHole = false;
        for (let z = -CH; z <= CH + 1e-6; z += 0.25) {
          const h = hole(x, z);
          if (h && !inHole) { segs.push([z0, z]); inHole = true; }
          if (!h && inHole) { z0 = z + rng.range(0, 0.2); inHole = false; }
        }
        if (!inHole) segs.push([z0, CH]);
        for (const [a, b] of segs) if (b - a > 0.2) kit.add(new THREE.BoxGeometry(0.47, 0.12, b - a), rng.next() < 0.4 ? chamberColours.larchOld : chamberColours.larchDark, { matrix: M(x, PLANK_Y + rng.range(-0.02, 0.02), (a + b) / 2), flat: true, brush: 0.15 });
      }
      // the mound's packed earth over the deck (the plank seams must not show the sky): four slabs framing the hole
      const HX0 = -1.3, HX1 = 1.9, HZ0 = COFFIN.z - 1.3, HZ1 = COFFIN.z + 1.5, EY = PLANK_Y + 0.2;
      const earthSlab = (x0: number, x1: number, z0: number, z1: number) => kit.add(new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0), chamberColours.earth.clone().multiplyScalar(0.4), { matrix: M((x0 + x1) / 2, EY, (z0 + z1) / 2), flat: true, brush: 0 });
      earthSlab(-CH - 0.5, CH + 0.5, HZ1, CH + 0.5); earthSlab(-CH - 0.5, CH + 0.5, -CH - 0.5, HZ0); earthSlab(-CH - 0.5, HX0, HZ0, HZ1); earthSlab(HX1, CH + 0.5, HZ0, HZ1);
      // earth and turf showing round the hole's rim (the mound's fill), and dangling roots
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2, x = 0.3 + Math.cos(a) * 1.5, z = COFFIN.z + 0.1 + Math.sin(a) * 1.3;
        kit.add(blob(rng.range(0.25, 0.45), rng, 1, 0.6), chamberColours.earth, { matrix: M(x, PLANK_Y + 0.15, z, rng.range(0, 6)) });
        if (i % 3 === 0) kit.add(pole(v3(x, PLANK_Y, z), v3(x + rng.range(-0.2, 0.2), PLANK_Y - rng.range(0.5, 1.3), z + rng.range(-0.2, 0.2)), 0.025, 0.008, 4), chamberColours.earth);
      }
      // ── the coffin plinth (walkable high ground) and the coffin: a hollowed larch log, horses carved along its sides ──
      kit.add(new THREE.BoxGeometry(COFFIN.wid + 1.3, COFFIN.plinthH, COFFIN.len + 1.2), chamberColours.larchOld, { matrix: M(COFFIN.x, COFFIN.plinthH / 2, COFFIN.z), flat: true, brush: 0.1 });
      for (const sx of [-1, 1]) kit.add(log(COFFIN.x + sx * (COFFIN.wid / 2 + 0.55), COFFIN.plinthH - 0.05, COFFIN.z - COFFIN.len / 2 - 0.5, COFFIN.x + sx * (COFFIN.wid / 2 + 0.55), COFFIN.z + COFFIN.len / 2 + 0.5, 0.14), chamberColours.larchDark);
      const cy = COFFIN.plinthH + COFFIN.h / 2;
      const sidePaint = (w: number, h: number) => {
        const out = new THREE.Color();
        return (p: THREE.Vector3, n: THREE.Vector3) => {
          if (Math.abs(n.x) > 0.7) {
            // a frieze of three horses along the side (p.z along, p.y up)
            const u = p.z / w + 0.5, v = p.y / h + 0.5;
            const k = Math.min(2, Math.floor(u * 3)), lu = u * 3 - k;
            if (v > 0.18 && v < 0.86 && horseMask(n.x > 0 ? lu : 1 - lu, (v - 0.18) / 0.68)) return out.copy(chamberColours.larchOld).lerp(chamberColours.cream, 0.25);
            if (v < 0.12 || v > 0.9) return out.copy(chamberColours.larchDark);
          }
          return out.copy(chamberColours.larch);
        };
      };
      kit.add(new THREE.BoxGeometry(COFFIN.wid, COFFIN.h, COFFIN.len, 2, 12, 60), sidePaint(COFFIN.len, COFFIN.h), { matrix: M(COFFIN.x, cy, COFFIN.z), flat: true, brush: 0.08 });
      kit.add(new THREE.BoxGeometry(COFFIN.wid - 0.22, 0.04, COFFIN.len - 0.22), chamberColours.black, { matrix: M(COFFIN.x, COFFIN.plinthH + COFFIN.h + 0.005, COFFIN.z), flat: true, brush: 0 });
      // ── the pedestal: a dressed stone block under a red felt with a horse ──
      kit.add(new THREE.BoxGeometry(1.2, PEDESTAL.h, 1.0), chamberColours.stone, { matrix: M(PEDESTAL.x, PEDESTAL.h / 2, PEDESTAL.z), brush: 0.14, flat: true });
      kit.add(new THREE.BoxGeometry(1.1, 0.04, 1.3), chamberColours.felt, { matrix: M(PEDESTAL.x, PEDESTAL.h + 0.02, PEDESTAL.z + 0.1), flat: true });
      kit.add(new THREE.PlaneGeometry(0.95, 0.75, 38, 30), feltPainter(0.95, 0.75, 1, true), { matrix: M(PEDESTAL.x, PEDESTAL.h - 0.36, PEDESTAL.z + 0.505), brush: 0.05 });
      kit.add(new THREE.BoxGeometry(1.6, 0.18, 1.4), chamberColours.stone.clone().multiplyScalar(0.85), { matrix: M(PEDESTAL.x, 0.09, PEDESTAL.z), flat: true, brush: 0.12 });
      // ── the braziers: bronze tripods with a bowl of embers ──
      for (const b of BRAZIERS) {
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          kit.add(pole(v3(b.x + Math.cos(a) * 0.45, 0, b.z + Math.sin(a) * 0.45), v3(b.x + Math.cos(a) * 0.18, 0.9, b.z + Math.sin(a) * 0.18), 0.035, 0.03, 5), chamberColours.bronze);
        }
        kit.add(lathe([[0.02, 0.0], [0.34, 0.04], [0.5, 0.2], [0.52, 0.28], [0.47, 0.27], [0.3, 0.12], [0.0, 0.1]], 16), chamberColours.bronze, { matrix: M(b.x, 0.9, b.z), brush: 0.1 });
        kit.add(blob(0.36, rng, 1, 0.3, 0.3), new THREE.Color(2.2, 0.8, 0.25), { matrix: M(b.x, 1.13, b.z) });  // embers (HDR: they glow)
      }
      // ── felt hangings on the walls and red felt rugs on the floor ──
      const hang = (x: number, z: number, yaw: number) => {
        kit.add(new THREE.PlaneGeometry(1.7, 2.7, 44, 70), feltPainter(1.7, 2.7, 2, false), { matrix: M(x, 2.55, z, yaw), brush: 0.06 });
        kit.add(log(x - Math.cos(yaw), 3.95, z + Math.sin(yaw), x + Math.cos(yaw), z - Math.sin(yaw), 0.04, 6), chamberColours.larchDark);
      };
      hang(-5.6, CH - 0.28, Math.PI); hang(5.6, CH - 0.28, Math.PI);
      hang(-4.8, -CH + 0.28, 0); hang(4.8, -CH + 0.28, 0);
      hang(-CH + 0.28, 0.2, Math.PI / 2); hang(CH - 0.28, 0.2, -Math.PI / 2);
      const rug = (x: number, z: number, w: number, d: number, yaw: number, horses: number) => {
        const fp = feltPainter(w, d, horses, true), q = new THREE.Vector3();
        kit.add(new THREE.PlaneGeometry(w, d, Math.round(w * 22), Math.round(d * 22)).rotateX(-Math.PI / 2), (p) => fp(q.set(p.x, -p.z, 0)), { matrix: M(x, 0.012, z, yaw), brush: 0.05 });
      };
      rug(0, 4.4, 3.4, 2.2, 0, 2);
      rug(-5.8, -6.0, 2.6, 1.8, 0.35, 1);
      rug(6.2, 0.4, 1.8, 2.8, 0.1, 2);
      rug(0, -6.9, 2.8, 1.6, 0, 2);
      // fur pelts by the coffin
      for (const [x, z, a] of [[-1.9, 0.8, 0.4], [2.0, -1.6, -0.6]] as const) kit.add(blob(0.8, rng, 2, 0.08, 0.3), chamberColours.fur, { matrix: M(x, 0.02, z, a, 1.2, 1, 0.8), brush: 0.1 });
      // the fallen roof beams (high ground)
      for (const f of FALLEN) kit.add(pole(v3(f.a.x, f.r, f.a.z), v3(f.b.x, f.r * 0.95, f.b.z), f.r, f.r * 0.9, 10), chamberColours.larchOld, { brush: 0.14 });
    }

    private buildDromos(kit: PaintKit, rng: Rng): void {
      const z0 = CH + 0.2, z1 = DROMOS_END;
      for (let i = 0; i < 7; i++) {
        const x = -DW + 0.22 + i * 0.43;
        kit.add(new THREE.BoxGeometry(0.42, 0.16, z1 - z0), rng.next() < 0.4 ? chamberColours.larchOld : chamberColours.board, { matrix: M(x, -0.08, (z0 + z1) / 2), flat: true, brush: 0.12 });
      }
      const niche = (z: number) => [13.6, 18.4].some((nz) => Math.abs(z - nz) < 0.9);
      for (let r = 0; r < 8; r++) {
        const y = 0.2 + r * 0.4;
        for (const sx of [-1, 1]) {
          if (y < 2.4) {
            kit.add(log(sx * DW, y, z0, sx * DW, 12.7, 0.2), r % 2 ? chamberColours.larch : chamberColours.larchDark);
            kit.add(log(sx * DW, y, 14.5, sx * DW, 17.5, 0.2), r % 2 ? chamberColours.larch : chamberColours.larchDark);
            kit.add(log(sx * DW, y, 19.3, sx * DW, z1, 0.2), r % 2 ? chamberColours.larch : chamberColours.larchDark);
          } else kit.add(log(sx * DW, y, z0, sx * DW, z1, 0.2), r % 2 ? chamberColours.larch : chamberColours.larchDark);
        }
      }
      for (let z = z0 + 0.2; z < z1; z += 0.55) kit.add(log(-DW - 0.3, DH + 0.05, z, DW + 0.3, z, 0.21, 8), chamberColours.larchOld, { brush: 0.12 });
      // the niches with their dormant balbals (static — only the chamber's four wake)
      for (const nz of [13.6, 18.4]) for (const sx of [-1, 1]) {
        kit.add(new THREE.BoxGeometry(0.2, 2.8, 1.8), chamberColours.earth.clone().multiplyScalar(0.55), { matrix: M(sx * (DW + 0.9), 1.3, nz), flat: true });
        kit.add(new THREE.BoxGeometry(1.1, 0.12, 1.9), chamberColours.earth.clone().multiplyScalar(0.7), { matrix: M(sx * (DW + 0.45), -0.02, nz), flat: true });
        for (const dz of [-0.95, 0.95]) kit.add(new THREE.BoxGeometry(1.1, 2.8, 0.14), chamberColours.earth.clone().multiplyScalar(0.5), { matrix: M(sx * (DW + 0.45), 1.3, nz + dz), flat: true });
        kit.add(new THREE.BoxGeometry(1.1, 0.14, 1.9), chamberColours.earth.clone().multiplyScalar(0.45), { matrix: M(sx * (DW + 0.45), 2.72, nz), flat: true });
        for (const dz of [-0.9, 0.9]) kit.add(pole(v3(sx * DW, -0.1, nz + dz), v3(sx * DW, 2.7, nz + dz), 0.2, 0.18, 8), chamberColours.larchDark);
        kit.add(log(sx * DW, 2.65, nz - 1.1, sx * DW, nz + 1.1, 0.2), chamberColours.larchOld);
        const g = this.carve(nz > 16 ? 1 : 0, 0xba1 + Math.round(nz * 10) + sx);
        g.applyMatrix4(M(sx * (DW + 0.55), 0, nz, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 1.0));
        kit.add(g, (p) => new THREE.Color(0.4, 0.39, 0.37).multiplyScalar(0.85 + 0.15 * Math.sin(p.y * 7)), { brush: 0.08 });
      }
      // the door frame between the dromos and the chamber: massive larch posts and a lintel
      for (const sx of [-1, 1]) kit.add(pole(v3(sx * (DOOR_W + 0.05), -0.1, CH + 0.3), v3(sx * (DOOR_W + 0.05), DOOR_H + 0.35, CH + 0.3), 0.3, 0.27, 10), chamberColours.larchDark, { brush: 0.14 });
      kit.add(log(-DOOR_W - 0.6, DOOR_H + 0.3, CH + 0.3, DOOR_W + 0.6, CH + 0.3, 0.3), chamberColours.larch);
      // the far end: packed earth and daylight coming round the bend from the mound's door
      kit.add(new THREE.BoxGeometry(DW * 2 + 0.4, DH + 0.4, 0.3), chamberColours.day.clone().multiplyScalar(0.55), { matrix: M(0, DH / 2, z1 + 0.15), flat: true, brush: 0.2 });
      // gold offerings along the walls, oil lamps on posts
      for (let i = 0; i < 12; i++) {
        const z = rng.range(z0 + 0.6, z1 - 1), sx = rng.next() < 0.5 ? -1 : 1;
        if (niche(z)) continue;
        this.goldBowl(kit, rng, sx * (DW - 0.35), z, rng.range(0.1, 0.18));
      }
      for (const z of [12.6, 18.2]) {
        kit.add(pole(v3(-DW + 0.25, 0, z), v3(-DW + 0.25, 1.75, z), 0.05, 0.04, 6), chamberColours.larchDark);
        kit.add(lathe([[0.02, 0], [0.12, 0.04], [0.14, 0.08], [0.0, 0.07]], 10), chamberColours.bronze, { matrix: M(-DW + 0.25, 1.75, z) });
      }
    }

    private goldBowl(kit: PaintKit, rng: Rng, x: number, z: number, r: number, y = 0): void {
      kit.add(lathe([[0.0, 0.0], [r * 0.55, 0.0], [r * 0.9, r * 0.25], [r, r * 0.6], [r * 0.93, r * 0.62], [r * 0.82, r * 0.3], [0.0, r * 0.12]], 14), rng.next() < 0.7 ? chamberColours.gold : chamberColours.goldDark, { matrix: M(x, y, z, rng.range(0, 6)), brush: 0.18 });
    }

    private buildGraveGoods(kit: PaintKit, rng: Rng): void {
      const G = kit;
      const nearWall = (): [number, number] => {
        const side = rng.int(0, 3), t = rng.range(-CH + 1.2, CH - 1.2), d = rng.range(0.7, 1.9);
        const p: [number, number] = side === 0 ? [t, -CH + d] : side === 1 ? [t, CH - d] : side === 2 ? [-CH + d, t] : [CH - d, t];
        return p;
      };
      const blocked = (x: number, z: number) => (Math.abs(x) < DOOR_W + 0.8 && z > CH - 2.6)
        || NICHES.some((n) => Math.abs(x - n.x) < 2.6 && Math.abs(z - n.z) < 1.6)
        || Math.hypot(x - PEDESTAL.x, z - PEDESTAL.z) < 1.6 || BRAZIERS.some((b) => Math.hypot(x - b.x, z - b.z) < 1.0);
      // chests (carved boxes), cauldrons, amphorae, bowls, heaps of plaques — against the walls
      for (let i = 0; i < 70; i++) {
        const [x, z] = nearWall();
        if (blocked(x, z)) continue;
        const kind = rng.next();
        if (kind < 0.16) {
          const w = rng.range(0.8, 1.3), d = rng.range(0.55, 0.8), h = rng.range(0.45, 0.7), yaw = Math.abs(x) > Math.abs(z) ? Math.PI / 2 : 0;
          G.add(new THREE.BoxGeometry(w, h, d), chamberColours.larchDark, { matrix: M(x, h / 2, z, yaw + rng.range(-0.1, 0.1)), flat: true, brush: 0.12 });
          G.add(new THREE.BoxGeometry(w + 0.06, 0.08, d + 0.06), chamberColours.bronze, { matrix: M(x, h + 0.04, z, yaw), flat: true });
          for (let k = 0; k < 4; k++) this.goldBowl(G, rng, x + rng.range(-w / 3, w / 3), z + rng.range(-0.15, 0.15), rng.range(0.08, 0.13), h + 0.08);
        } else if (kind < 0.26) {
          G.add(lathe([[0.0, 0.0], [0.22, 0.02], [0.4, 0.2], [0.44, 0.45], [0.38, 0.62], [0.34, 0.64], [0.36, 0.6], [0.0, 0.55]], 16), chamberColours.bronze, { matrix: M(x, 0, z), brush: 0.14 });
          for (const a of [0, Math.PI]) G.add(new THREE.TorusGeometry(0.1, 0.02, 5, 10), chamberColours.bronze, { matrix: M(x + Math.cos(a) * 0.4, 0.62, z + Math.sin(a) * 0.4, a + Math.PI / 2) });
        } else if (kind < 0.36) {
          G.add(lathe([[0.0, 0.0], [0.08, 0.02], [0.2, 0.25], [0.21, 0.5], [0.1, 0.72], [0.07, 0.85], [0.1, 0.9], [0.0, 0.9]], 14), rng.next() < 0.5 ? chamberColours.ochre : chamberColours.gold, { matrix: M(x, 0, z, 0, 1, rng.range(0.8, 1.2)), brush: 0.14 });
        } else if (kind < 0.72) {
          this.goldBowl(G, rng, x, z, rng.range(0.14, 0.3));
        } else {
          // a heap of gold plaques and coins
          G.add(blob(rng.range(0.35, 0.7), rng, 2, 0.35, 0.35), (p) => (Math.sin(p.x * 60) * Math.sin(p.z * 60) > 0.2 ? chamberColours.gold : chamberColours.goldDark), { matrix: M(x, 0, z, rng.range(0, 6)), brush: 0.25 });
        }
      }
      // gold spilled across the floor
      for (let i = 0; i < 90; i++) {
        const x = rng.range(-CH + 0.6, CH - 0.6), z = rng.range(-CH + 0.6, CH - 0.6);
        if (Math.hypot(x - COFFIN.x, z - COFFIN.z) < 2.4 || blocked(x, z)) continue;
        G.add(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 7), chamberColours.gold, { matrix: M(x, 0.008, z, 0, 1, 1, 1, rng.range(-0.2, 0.2)) });
      }
      // spears with gold horse finials and round gold shields leaning on the walls
      for (let i = 0; i < 10; i++) {
        const [x, z] = nearWall();
        if (blocked(x, z)) continue;
        const tx = x + Math.sign(x) * (Math.abs(x) > Math.abs(z) ? 0.6 : 0), tz = z + Math.sign(z) * (Math.abs(z) >= Math.abs(x) ? 0.6 : 0);
        if (i % 2 === 0) {
          G.add(pole(v3(x, 0, z), v3(tx, 2.9, tz), 0.03, 0.025, 5), chamberColours.larchDark);
          G.add(new THREE.ConeGeometry(0.06, 0.3, 6), chamberColours.gold, { matrix: M(tx, 3.05, tz) });
          G.add(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 6), new THREE.Color('#9a1a14'), { matrix: M(tx, 2.78, tz) });
        } else {
          const yaw = Math.abs(x) > Math.abs(z) ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : (z > 0 ? Math.PI : 0);
          G.add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), (p, n) => (n.y > 0.5 && Math.hypot(p.x, p.z) > 0.3 ? chamberColours.goldDark : chamberColours.gold), { matrix: M(x, 0.45, z, yaw, 1, 1, 1, Math.PI / 2 - 0.25), brush: 0.1 });
        }
      }
      // gold ibex statuettes flanking the pedestal
      for (const sx of [-1, 1]) {
        const x = PEDESTAL.x + sx * 1.6, z = PEDESTAL.z + 0.2;
        G.add(new THREE.BoxGeometry(0.5, 0.5, 0.5), chamberColours.larchDark, { matrix: M(x, 0.25, z), flat: true });
        G.add(new THREE.CapsuleGeometry(0.1, 0.32, 3, 8).rotateZ(Math.PI / 2), chamberColours.gold, { matrix: M(x, 0.72, z, Math.PI / 2) });
        G.add(new THREE.CapsuleGeometry(0.05, 0.16, 3, 6), chamberColours.gold, { matrix: M(x, 0.9, z - sx * 0, Math.PI / 2, 1, 1, 1, 0.6) });
        for (const dz of [-0.13, 0.13]) G.add(new THREE.TorusGeometry(0.1, 0.018, 5, 10, Math.PI * 1.3), chamberColours.gold, { matrix: M(x, 1.05, z + dz, 0, 1, 1, 1, 0) });
        for (const lx of [-0.12, 0.12]) G.add(new THREE.CylinderGeometry(0.025, 0.02, 0.22, 5), chamberColours.gold, { matrix: M(x + lx, 0.56, z) });
      }
    }

    /** the pieces that move or come and go: the coffin lid, the four niche balbals, the heap of plaques */
    *movableSteps(mat: THREE.MeshBasicMaterial, rng: Rng): Generator<void, void> {
      {
        const kit = new PaintKit(0x11d);
        kit.add(new THREE.BoxGeometry(COFFIN.wid + 0.14, 0.18, COFFIN.len + 0.14, 2, 1, 40), (p, n) => (n.y > 0.5 && horseMask(p.z / COFFIN.len * 3 % 1 + 0.5, p.x / COFFIN.wid + 0.5) ? chamberColours.larchOld : chamberColours.larch), { flat: true, brush: 0.1 });
        const g = kit.finish();
        // bake as it lies on the coffin (the lid is small: the light barely changes when it slides)
        g.translate(COFFIN.x, COFFIN.plinthH + COFFIN.h + 0.09, COFFIN.z); bake(g); g.translate(-COFFIN.x, -(COFFIN.plinthH + COFFIN.h + 0.09), -COFFIN.z);
        this.lid = new THREE.Mesh(g, mat);
        this.lid.position.set(COFFIN.x, COFFIN.plinthH + COFFIN.h + 0.09, COFFIN.z);
        this.lid.frustumCulled = false;
        this.group.add(this.lid);
      }
      for (const [i, n] of NICHES.entries()) {
        yield;
        const kit = new PaintKit(0x2b + i);
        const g0 = this.carve(i % 2, 0xba7 + i * 3);
        g0.applyMatrix4(M(0, 0, 0, 0, 1.2));
        kit.add(g0, (p) => new THREE.Color(0.4, 0.39, 0.37).multiplyScalar(0.85 + 0.15 * Math.sin(p.y * 7)), { brush: 0.08 });
        const g = kit.finish();
        const sx = Math.sign(n.x);
        g.applyMatrix4(M(n.x + sx * 0.55, 0, n.z, n.yaw + Math.PI));
        bake(g);
        const m = new THREE.Mesh(g, mat);
        m.frustumCulled = false;
        this.statues.push(m); this.group.add(m);
      }
      yield;
      {
        const kit = new PaintKit(0x4ea9);
        for (let i = 0; i < 70; i++) {
          const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 1.1, y = (1.1 - r) * 0.35;
          kit.add(new THREE.BoxGeometry(0.1, 0.02, 0.13), rng.next() < 0.7 ? chamberColours.gold : chamberColours.goldDark, { matrix: M(Math.cos(a) * r, y + rng.range(0, 0.08), Math.sin(a) * r, rng.range(0, 6), 1, 1, 1, rng.range(-0.8, 0.8), rng.range(-0.8, 0.8)), flat: true });
        }
        kit.add(blob(0.9, rng, 2, 0.4, 0.3), chamberColours.goldDark, { matrix: M(0, 0.02, 0) });
        const g = kit.finish();
        const col = g.getAttribute('color');
        for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * 1.6, col.getY(i) * 1.35, col.getZ(i) * 1.1);
        this.heap = new THREE.Mesh(g, mat);
        this.heap.visible = false;
        this.group.add(this.heap);
      }
    }

    buildSand(mat: THREE.MeshBasicMaterial): void {
      const g = new THREE.PlaneGeometry(CH * 2, CH * 2, SAND_N, SAND_N).rotateX(-Math.PI / 2);
      const pos = g.getAttribute('position'), n = pos.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        _n.set(0, 1, 0);
        lightAt(x, 0.2, z, _n, _l);
        this.sandLight[i * 3] = _l.r; this.sandLight[i * 3 + 1] = _l.g; this.sandLight[i * 3 + 2] = _l.b;
        pos.setY(i, -0.05);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      (pos as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
      this.sandMesh = new THREE.Mesh(g, mat);
      this.sandMesh.frustumCulled = false;
      this.sandMesh.visible = false;
      this.group.add(this.sandMesh);
    }

  }

  /** Fixed effect rest shapes; materials and encounter-driven transforms stay live. */
  function fxFabric(): [string, THREE.BufferGeometry][] {
    const rows: [string, THREE.BufferGeometry][] = [];
    for (const [i, top, r0, r1] of [[0, PLANK_Y + 1.5, 1.3, 1.25], [1, PLANK_Y + 0.5, 0.75, 0.65]] as const) {
      const geometry = new THREE.CylinderGeometry(r0, r1, top, 24, 1, true);
      geometry.translate(0, top / 2, 0);
      rows.push([`dungeon:shaft:${String(i)}`, geometry]);
    }
    {
      const parts: THREE.BufferGeometry[] = [];
      const flame = (x: number, y: number, z: number, h: number) => {
        for (const a of [0, Math.PI / 2]) { const p = new THREE.PlaneGeometry(h * 0.6, h, 1, 4); p.translate(0, h / 2, 0); p.rotateY(a); p.translate(x, y, z); parts.push(p); }
      };
      for (const b of BRAZIERS) flame(b.x, 1.12, b.z, 0.9);
      flame(-DW + 0.25, 1.8, 12.6, 0.28); flame(-DW + 0.25, 1.8, 18.2, 0.28);
      const geometry = mergeParts(parts);
      rows.push(['dungeon:flames', geometry]);
    }
    const stream = new THREE.CylinderGeometry(0.28, 0.4, PLANK_Y, 12, 1, true); stream.translate(0, PLANK_Y / 2, 0);
    const beam = new THREE.CylinderGeometry(0.45, 0.7, 1, 18, 1, true); beam.translate(0, 0.5, 0);
    const seal = new THREE.PlaneGeometry(DOOR_W * 2 + 0.4, DOOR_H + 0.4, 1, 1); seal.translate(0, (DOOR_H + 0.4) / 2, 0);
    rows.push(['dungeon:ring', annulus(0.84, 1.0, 128)], ['dungeon:stream', stream],
      ['dungeon:tell', new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2)], ['dungeon:beam', beam],
      ['dungeon:line', annulus(5.85, 6.15, 64, Math.PI * 0.6)],
      ['dungeon:dome', new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55)],
      ['dungeon:arc', new THREE.CircleGeometry(1, 32, -Math.PI * 0.35, Math.PI * 0.7).rotateX(-Math.PI / 2)], ['dungeon:seal', seal]);
    // These effect meshes have one material; constructor material groups are unused.
    for (const [, geometry] of rows) geometry.clearGroups();
    return rows;
  }

  function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    let n = 0, idx = 0;
    for (const p of parts) { n += p.getAttribute('position').count; idx += p.index?.count ?? 0; }
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), ind: number[] = [];
    let o = 0;
    for (const p of parts) {
      const pp = p.getAttribute('position'), pn = p.getAttribute('normal'), pu = p.getAttribute('uv');
      for (let i = 0; i < pp.count; i++) {
        pos[(o + i) * 3] = pp.getX(i); pos[(o + i) * 3 + 1] = pp.getY(i); pos[(o + i) * 3 + 2] = pp.getZ(i);
        nrm[(o + i) * 3] = pn.getX(i); nrm[(o + i) * 3 + 1] = pn.getY(i); nrm[(o + i) * 3 + 2] = pn.getZ(i);
        uv[(o + i) * 2] = pu.getX(i); uv[(o + i) * 2 + 1] = pu.getY(i);
      }
      const pi = p.index;
      if (pi) for (let i = 0; i < pi.count; i++) ind.push(pi.getX(i) + o);
      o += pp.count;
      p.dispose();
    }
    void idx;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(ind);
    return g;
  }
  return new KurganFabric(supplyCarving).build();
}
