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
import type * as THREE from 'three';
import { paramsOf, type ModelDef } from '@wildshard/engine/models/model';
import { setTerrainHeight } from '@wildshard/engine/world/terrainHeight';
import { bakedSamplers, parseBakedTerrain } from '@wildshard/engine/world/BakedTerrain';
import { PaintKit, v3 } from '../world/paint';
import { NalatiSet, paintedSpecimen, type MemberData, type PaintCtx } from '../world/painted';
import { Flutter } from '../world/Flutter';
import { Smoke } from '../world/Smoke';
import { CAMP, CORRAL, HITCHING_RAIL, SUMMER_CAMP, BRIDGE } from '../world/layout';
import type { Box } from '../world/solid';
import type { Ground } from '../world/types';
import { specimenKey, type DeckRow, type EffectRow, type MemberRow, type PlaceGeometryRow, type PlaceMeshRow, type PlaceRow, type SpecimenRow } from '../world/placeBake';
import { kazan, chest, firewood, kumisChurn, groundSaddle, perchedEagle } from '../models/campGenerated';
import { EAGLE_PERCH_H } from '../models/campProps';
import { yurtPainted } from './yurt';
import { kunesBridgePainted } from './kunesBridge';
import { yardGeometry, wearDisc, wearPath } from './yard';
import {
  ribbonPolePainted, eaglePerchPainted, stovePainted, campBenchPainted, rugRackPainted, feltRugPainted, cartPainted, barrelPainted,
  hitchingRailPainted, waterTroughPainted, saddleRackPainted, corralPainted, hayPilePainted, feedTroughPainted, rugLinePainted,
  choppingBlockPainted, milkCansPainted, tetherLinePainted, kurtBoardPainted, ribbonPostPainted,
} from './campProps';

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
class RecordingSmoke extends Smoke {
  constructor(private readonly log: EffectRow[]) { super(); }
  override emitter(p: THREE.Vector3, o: { puffs?: number; rise?: number; size?: [number, number]; life?: number; density?: number } = {}): void { this.log.push(['emitter', point(p), o]); }
}

// ── the places (the builders, verbatim but for drawing: each mesh's geometry is kept with its material's kind) ─────────

interface BuiltMesh { readonly name: string; readonly material: string; readonly slot: number; readonly geometry: THREE.BufferGeometry }
interface BuiltPlace { readonly name: string; readonly group: string | null; readonly surface: string; readonly tris: number; readonly meshes: BuiltMesh[]; readonly set: NalatiSet; readonly effects: EffectRow[] }

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

// ── the bake's binary: each geometry's attributes as their own bytes, welded ──────────────────────────────────────────

const pad = (bytes: Uint8Array): Uint8Array => { if (bytes.length % 4 === 0) return bytes; const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4); out.set(bytes); return out; };
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, what: string): Float32Array => {
  const array: unknown = 'array' in a ? a.array : null;
  if (!(array instanceof Float32Array) || a.normalized || array.length !== a.count * a.itemSize) throw new Error(`[nalati places] ${what} is not plain float32`);
  return array;
};

/** a geometry's row and blocks: float32 attributes in their order; a non-indexed one welded (each distinct vertex once) */
function writeGeometry(g: THREE.BufferGeometry, blocks: Uint8Array[], what: string): PlaceGeometryRow {
  if (Object.keys(g.morphAttributes).length > 0 || g.groups.length > 0) throw new Error(`[nalati places] ${what} has morphs / groups`);
  const names = Object.keys(g.attributes), arrays = names.map((n) => f32(g.getAttribute(n), `${what}.${n}`));
  const sizes = names.map((n) => g.getAttribute(n).itemSize), n = g.getAttribute('position').count, box = g.boundingBox !== null;
  const attrs = names.map((name, i): readonly [string, 'f32', number, boolean] => [name, 'f32', sizes[i] ?? 0, false]);
  const index = g.index;
  if (index !== null) {
    for (const a of arrays) blocks.push(pad(new Uint8Array(a.buffer, a.byteOffset, a.byteLength).slice()));
    const deltas = new Int32Array(index.count);
    let last = 0;
    for (let i = 0; i < index.count; i++) { const x = index.getX(i); deltas[i] = x - last; last = x; }
    blocks.push(new Uint8Array(deltas.buffer));
    return { attrs, count: n, index: index.array instanceof Uint16Array ? 'u16' : 'u32', indexCount: index.count, box, expand: false };
  }
  // weld: a vertex is its attributes' exact bits
  const words = arrays.map((a) => new Uint32Array(a.buffer, a.byteOffset, a.length));
  const seen = new Map<string, number>(), order: number[] = [], idx = new Int32Array(n);
  for (let v = 0; v < n; v++) {
    let key = '';
    for (const [k, w] of words.entries()) { const s = sizes[k] ?? 0; for (let c = 0; c < s; c++) key += `${String(w[v * s + c] ?? 0)},`; }
    let at = seen.get(key);
    if (at === undefined) { at = order.length; seen.set(key, at); order.push(v); }
    idx[v] = at;
  }
  for (const [k, a] of arrays.entries()) {
    const s = sizes[k] ?? 0, out = new Float32Array(order.length * s);
    for (const [j, v] of order.entries()) for (let c = 0; c < s; c++) out[j * s + c] = a[v * s + c] ?? 0;
    blocks.push(new Uint8Array(out.buffer));
  }
  const deltas = new Int32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) { const x = idx[i] ?? 0; deltas[i] = x - last; last = x; }
  blocks.push(new Uint8Array(deltas.buffer));
  return { attrs, count: order.length, index: 'u32', indexCount: n, box, expand: true };
}

const join = (blocks: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(blocks.reduce((s, b) => s + b.length, 0));
  let at = 0;
  for (const b of blocks) { out.set(b, at); at += b.length; }
  return out;
};

const descRow = (d: MemberData['solid'][number]): MemberRow['solid'][number] => (d.kind === 'hull' ? { ...d, points: Array.from(d.points) } : { ...d });
const deckOf = (f: MemberData['floors'][number]): DeckRow => {
  if (!('row' in f)) throw new Error('[nalati places] a floor the bake cannot keep (only deckFloor floors are data)');
  const row: unknown = f.row;
  if (typeof row !== 'object' || row === null) throw new Error('[nalati places] a floor without its row');
  return row as DeckRow;
};
const memberRow = (m: MemberData): MemberRow => ({
  draw: m.draw, inKit: m.inKit, boxes: [...m.boxes], solid: m.solid.map(descRow), descs: m.descs.map(descRow), floors: m.floors.map(deckOf),
  placements: m.placements.map(({ matrix, ...rest }) => (matrix === undefined ? rest : { ...rest, matrix: matrix.toArray() })),
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
    job(milkCansPainted), job(tetherLinePainted), job(kurtBoardPainted), job(ribbonPostPainted)];
}

/** a bake: its rows and raw binary (not yet lane-shuffled or compressed) */
export interface PlacesBake<R> { readonly rows: readonly R[]; readonly bin: Uint8Array }

/**
 * The bake over the page's ground (its baked terrain sampler): the three places in the page's order (the camp, the
 * bridge, the summer camp), then the specimens (the bridge's fitted to its first placement, so after the places).
 */
export function bakeNalatiPlaces(ground: Ground): { places: PlacesBake<PlaceRow>; specimens: PlacesBake<SpecimenRow> } {
  setTerrainHeight(ground);
  const blocks: Uint8Array[] = [];
  const rows = [nomadCamp, bridge, summerCamp].map((build): PlaceRow => {
    const effects: EffectRow[] = [];
    const ctx: PaintCtx = { ground, flutter: new RecordingFlutter(effects), smoke: new RecordingSmoke(effects) };
    const p = build(ctx, effects), { members, instances } = p.set.rows();
    return {
      name: p.name, group: p.group, surface: p.surface, tris: p.tris,
      meshes: p.meshes.map((m) => ({ name: m.name, material: m.material, slot: m.slot, geometry: writeGeometry(m.geometry, blocks, `${p.name}.${m.name}`) })),
      colliders: [...p.set.boxes], effects,
      members: members.map(([id, m]) => [id, memberRow(m)] as const),
      instances: instances.map(([name, l]) => [name, { look: { ...l.look }, castShadow: l.castShadow, placements: l.placements.map((q) => ({ ...q })) }] as const),
    };
  });
  const places = { rows, bin: join(blocks) };
  const specimenBlocks: Uint8Array[] = [];
  const specimens = specimenJobs().flatMap((run) => run(specimenBlocks));
  return { places, specimens: { rows: specimens, bin: join(specimenBlocks) } };
}

/** the bake over the page's baked terrain grid (public/assets/baked/nalati-grasslands/terrain.bin), as the page samples it */
export function bakeNalatiPlacesOnTerrain(terrain: ArrayBuffer): ReturnType<typeof bakeNalatiPlaces> {
  const grid = parseBakedTerrain(terrain);
  if (grid === null) throw new Error('[nalati places] no Nalati terrain grid');
  return bakeNalatiPlaces(bakedSamplers(grid).heightAt);
}
