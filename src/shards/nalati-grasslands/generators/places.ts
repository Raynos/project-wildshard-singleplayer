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
import * as THREE from 'three';
import { paramsOf, type ModelDef } from '@wildshard/engine/models/model';
import { setTerrainHeight } from '@wildshard/engine/world/terrainHeight';
import { bakedSamplers, parseBakedTerrain } from '@wildshard/engine/world/BakedTerrain';
import { PaintKit, M, v3 } from '../world/paint';
import { pole, blob } from '@wildshard/engine/world/geometryKit';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { graniteBlock } from '../world/granite';
import { NalatiSet, painted, paintedSpecimen, cragLedgeFloor, leopardCaveFloor, kurganEntranceFloor, paintFieldstone, type FieldstoneParams, type MemberData, type Paint, type PaintCtx } from '../world/painted';
import { Flutter } from '../world/Flutter';
import { CAMP, CORRAL, HITCHING_RAIL, SUMMER_CAMP, BRIDGE, EAGLE_ROCK, WIND_CAIRN, CRAGS, WEST_CRAGS, CRAG_CAVE, KURGANS, GREAT_KURGAN, KURGAN_BALBALS, GREAT_KURGAN_DOOR } from '../world/layout';
import { prism, slab, supportHull, type Box } from '../world/solid';
import type { Ground, Plumes, PlaceAnchors, Ledge, KurganEntrance } from '../world/types';
import { specimenKey, torFloor, type PlaceFloorRow, type DressingGeoRow, type EffectRow, type MemberRow, type PlaceMeshRow, type PlaceRow, type SpecimenRow } from '../world/placeBake';
import { kazan, chest, firewood, kumisChurn, groundSaddle, perchedEagle } from '../models/campGenerated';
import { EAGLE_PERCH_H, eagleRock, windCairn, cragLedge, leopardCave, kurganEntrance, kurganKerb, fieldstoneBaked,
  type CragLedgeParams, type LeopardCaveParams, type KurganEntranceParams, type KurganKerbParams } from '../models/campProps';
import { yurtPainted } from './yurt';
import { kunesBridgePainted } from './kunesBridge';
import { yardGeometry, wearDisc, wearPath } from './yard';
import {
  ribbonPolePainted, eaglePerchPainted, stovePainted, campBenchPainted, rugRackPainted, feltRugPainted, cartPainted, barrelPainted,
  hitchingRailPainted, waterTroughPainted, saddleRackPainted, corralPainted, hayPilePainted, feedTroughPainted, rugLinePainted,
  choppingBlockPainted, milkCansPainted, tetherLinePainted, kurtBoardPainted, ribbonPostPainted,
} from './campProps';
import { bakeDressing } from './dressingBake';
import { writeGeometry, join } from './geometryWriter';

// ── the cloth and smoke a place makes, recorded in order ──────────────────────────────────────────────────────────────

type Rgb = THREE.ColorRepresentation;
const point = (p: THREE.Vector3): number[] => [p.x, p.y, p.z];
const colour = (c: Rgb): string | number => {
  if (typeof c === 'string' || typeof c === 'number') return c;
  throw new Error('[nalati places] a cloth colour the bake cannot replay');
};
class RecordingFlutter extends Flutter {
  constructor(private readonly log: EffectRow[]) { super(); }
  override streamer(a: THREE.Vector3, len: number, w: number, color: Rgb, o: { droop?: number; taper?: number } = {}): void { this.log.push(['streamer', point(a), len, w, colour(color), o]); }
  override flag(top: THREE.Vector3, h: number, len: number, color: Rgb, o: { droop?: number; taper?: number } = {}): void { this.log.push(['flag', point(top), h, len, colour(color), o]); }
  override strip(a: THREE.Vector3, len: number, w: number, color: Rgb): void { this.log.push(['strip', point(a), len, w, colour(color)]); }
}
const recordingPlumes = (log: EffectRow[]): Plumes => ({ emitter: (p, o = {}) => { log.push(['emitter', point(p), o]); } });

// ── the places (the builders, verbatim but for drawing: each mesh's geometry is kept with its material's kind) ─────────

interface BuiltMesh { readonly name: string; readonly material: string; readonly slot: number; readonly geometry: THREE.BufferGeometry }
export interface BuiltPlace { readonly name: string; readonly group: string | null; readonly surface: string; readonly tris: number; readonly meshes: BuiltMesh[]; readonly set: NalatiSet; readonly effects: EffectRow[]; readonly anchors?: PlaceAnchors; readonly headings?: ReadonlyMap<string, readonly (readonly [number, number])[]> }

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
    set.instance(perchedEagle, { x: at.x + 0.05, y: at.y + EAGLE_PERCH_H + 0.12, z: at.z, rot: Math.PI / 2 + 0.35 }, {});
  }

  // ── cooking: the stove and the kazan in the yard, smoking; the woodpile; a low bench by the kazan ──
  set.paint(stovePainted, on(cx + 4.5, cz - 5.5, 0.4), {});
  {
    const x = cx - 3.2, z = cz - 6.2, y = ground(x, z);
    set.instance(kazan, { x, y, z, rot: 0.4 }, {});
    smoke.emitter(v3(x, y + 0.9, z), { puffs: 28, rise: 4.5, size: [0.5, 3.0], life: 6 });
  }
  {
    // two birch stacks side by side along the pile; the pile's one box
    const x = cx + 8.5, z = cz - 3, yaw = 0.9, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const pile: Box = { x, z, hw: 0.8, hd: 0.85, rot: -yaw, yBottom: ground(x, z) - 1, yTop: ground(x, z) + 0.85 };
    for (const [k, [o, dy]] of ([[-0.45, 0.2], [0.45, -0.15]] as const).entries()) {
      const px = x + o * cs, pz = z - o * sn;
      set.instance(firewood, { x: px, y: ground(px, pz), z: pz, rot: yaw }, k === 0 ? { dy, pile } : { dy });
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
  for (const [hx, hz, hyaw] of [[cx + 0.6, cz + 9.4, 0.2], [cx - 9.5, cz - 4.5, 1.8]] as const) set.instance(chest, { x: hx, y: ground(hx, hz), z: hz, rot: hyaw }, {});

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
    set.instance(kumisChurn, { x, y: ground(x, z), z, rot: 0.6, scale: 1 }, { hw: 0.28, h: 1.1 });
    const sx = x + 1.1, sz = z + 0.2;
    set.instance(kumisChurn, { x: sx, y: ground(sx, sz), z: sz, rot: 2.4, scale: 1.15 }, { hw: 0.34, h: 1.25 });
  }

  // ── yard set pieces: rugs on a line, the chopping block, saddles set down by the rail, the milk cans ──
  {
    const ax = cx - 7, az = cz + 6, bx = cx - 2.6, bz = cz + 8.6;
    set.paint(rugLinePainted, on(ax, az), { dx: bx - ax, dz: bz - az, pals: [1, 3, 0] });
  }
  set.paint(choppingBlockPainted, on(cx + 9.5, cz - 5.5), {});
  for (const [sx, sz, syaw] of [[HITCHING_RAIL.x + 2.8, HITCHING_RAIL.z - 2.2, 1.9], [HITCHING_RAIL.x + 3.2, HITCHING_RAIL.z + 1.2, 0.6]] as const) set.instance(groundSaddle, { x: sx, y: ground(sx, sz), z: sz, rot: syaw }, {});
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
    set.instance(kazan, { x, y, z, rot: 0.4 }, {});
    smoke.emitter(v3(x, y + 0.9, z), { puffs: 28, rise: 4.5, size: [0.5, 3.0], life: 6 });
  }
  set.paint(cartPainted, on(cx - 7, cz + 7.5, 0.6), {});
  set.instance(chest, { x: cx + 3.5, y: ground(cx + 3.5, cz + 3.5), z: cz + 3.5, rot: 2.2 }, {});
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
    job(milkCansPainted), job(tetherLinePainted), job(kurtBoardPainted), job(ribbonPostPainted), job(eagleRockPainted), job(windCairnPainted), job(cragLedgePainted), job(leopardCavePainted), job(kurganEntrancePainted), job(kurganKerbPainted)];
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
export function bakeNalatiPlaces(ground: Ground, specimenScope: SpecimenScope = nativeSpecimenScope): { places: PlacesBake<PlaceRow>; specimens: PlacesBake<SpecimenRow>; dressing: PlacesBake<DressingGeoRow> } {
  setTerrainHeight(ground);
  const blocks: Uint8Array[] = [];
  const rows = [nomadCamp, bridge, summerCamp, eagleRockPlace, cairnPlace, kurgansPlace, cragsPlace].map((build): PlaceRow => {
    const effects: EffectRow[] = [];
    const ctx: PaintCtx = { ground, flutter: new RecordingFlutter(effects), smoke: recordingPlumes(effects) };
    const p = build(ctx, effects), { members, instances } = p.set.rows();
    return {
      name: p.name, group: p.group, surface: p.surface, tris: p.tris, anchors: p.anchors ?? {},
      meshes: p.meshes.map((m) => ({ name: m.name, material: m.material, slot: m.slot, geometry: writeGeometry(m.geometry, blocks, `${p.name}.${m.name}`) })),
      colliders: [...p.set.boxes], effects,
      members: members.map(([id, m]) => [id, memberRow(m, p.headings?.get(id))] as const),
      instances: instances.map(([name, l]) => [name, { look: { ...l.look }, castShadow: l.castShadow, placements: l.placements.map((q) => ({ ...q })) }] as const),
    };
  });
  const places = { rows, bin: join(blocks) };
  const specimenBlocks: Uint8Array[] = [];
  // Native V8 trig differs on arm64/x64; even a final float32 UV can cross its rounding midpoint.
  const specimens = specimenScope(() => specimenJobs().flatMap((run) => run(specimenBlocks)));
  // the dressing's scatter shapes (generators/dressingGeos.ts): ground-free, indexed, kept as built
  return { places, specimens: { rows: specimens, bin: join(specimenBlocks) }, dressing: bakeDressing() };
}

/** the bake over the page's baked terrain grid (public/assets/baked/nalati-grasslands/terrain.bin), as the page samples it */
export function bakeNalatiPlacesOnTerrain(terrain: ArrayBuffer, specimenScope: SpecimenScope = nativeSpecimenScope): ReturnType<typeof bakeNalatiPlaces> {
  const grid = parseBakedTerrain(terrain);
  if (grid === null) throw new Error('[nalati places] no Nalati terrain grid');
  return bakeNalatiPlaces(bakedSamplers(grid).heightAt, specimenScope);
}
