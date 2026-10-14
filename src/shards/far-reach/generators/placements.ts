import { Matrix4, Quaternion, Vector3, Vector4, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { hdGeometry } from './modelIntake';
import { DAIS, FALLEN_BRIDGE, ISLES, MILL, MILL_DRUM, NEST, NOTES, PINES, SPANS, SPIRES, UPDRAFT, VANES, WINCH, WINCH_HOUSE, type Isle } from '../data/layout';
import { ISLE_KEEL_CUT, KEEL_TOP, SKY_ISLES, SKY_ISLE_HD, SKY_ISLE_MODELS, SKY_ISLE_WEAR, type SkyIsle, type SkyIsleModel } from '../data/skyIsles';
import { FALLS } from '../data/falls';
import { HD_URLS } from '../data/files';
import { CROWN_STONES } from '../data/crownLayout';
import { KEEPER_AT } from '../data/quests';
import { KEEPER_STAND } from '../quest/keeper';
import { spireAt } from '../layout';
import { TREE_MODELS, TREES, type TreeModel } from '../data/trees';
import { RISING_ISLETS } from '../world/islets';
import type { SkyIsleFrame } from '../world/skyIsleHd';
import type { SkyIslePine } from './skyIslePines';

/**
 * Build-time only (SHARD-PLATFORM G345, offline bakes): where Sky Reach's static instanced things stand, computed here once
 * as the page used to compute them on load, baked by `bake-sky-world.mjs` into `data/placements.json`; the page reads
 * the rows (world/skyIsleHd.ts, world/distant.ts, world/trees.ts, world/meadow.ts) and computes none of it.
 *
 * - the textured sky isles and the playable islands' keels: each model's instance matrices (its isles scaled to their rim
 *   radius and keel depth, turned to their own yaw: `skyIslePose`);
 * - the falls: each sheet's matrix, hung just inside its isle's lip (a modelled isle's rim at that angle);
 * - the modelled trees: each model's instance matrices (a spot's model, yaw, lean and size from a seeded hash of its place
 *   in the list);
 * - the meadow's holes round the structures and its worn paths (world/meadow.ts's uniforms).
 *
 * G99: in a grid cell (`ctx.cube`) only the sky isles inside the cube stand, which moves the models' turns, the falls and
 * the trees' hashes, so each of those is baked twice: `standalone` and `cell` (a cube of half width `half`).
 * A matrix is the float32 words the page stored (`Math.fround`, printed in nine significant digits: exact).
 */

/** A model in its unit frame (generators and the far bake): its geometry, its keel depth, its rim per angle bin and bulge. */
export interface SkyIsleUnit { readonly geometry: BufferGeometry; readonly depth: number; readonly rim: Float32Array; readonly bulge: number }

/** Bring a loaded model to the unit frame by its `frame` (as the page does, world/skyIsleHd.ts); moves the geometry in place. */
export function skyIsleUnit(geometry: BufferGeometry, frame: Omit<SkyIsleFrame, 'model'>): SkyIsleUnit {
  geometry.translate(-frame.tx, -frame.deck, -frame.tz); geometry.scale(frame.k, frame.k, frame.k);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, depth: -(geometry.boundingBox?.min.y ?? -1), rim: Float32Array.from(frame.rim), bulge: frame.bulge };
}

const FALLBACK: readonly SkyIsleModel[] = SKY_ISLE_MODELS;
/** The model a sky isle (or a playable keel) wears: its `SKY_ISLE_WEAR` row, else the `i`-th model in turn. */
export const skyIsleWear = (s: Isle, i: number): SkyIsleModel => SKY_ISLE_WEAR[s.id]?.[0] ?? FALLBACK[i % FALLBACK.length] ?? 'isle-mass-hd';

/** The playable islands' keels as isles: under each deck, a little narrower. */
export const keelIsles = (isles: readonly Isle[]): SkyIsle[] => isles.map((isle) => ({ ...isle, id: `keel.${isle.id}`, y: isle.y - (ISLE_KEEL_CUT[isle.id]?.keelTop ?? KEEL_TOP), r: isle.r * (ISLE_KEEL_CUT[isle.id]?.keelScale ?? 0.97), pines: 0, fall: null }));

/**
 * Where an isle's model instance stands: its yaw (radians), its rim scale and its keel stretch (`sy`, applied on top of
 * the rim scale to y). `k` is its place among the isles wearing the same model (the yaw fallback). A playable keel
 * (`clipTop`) tapers INSIDE its deck (round 13, seat C: the mill's keel bulged past its deck, a thin disc on a mossy
 * bun): its widest rock under the cut fitted to keelInset of the deck's radius; its depth kept.
 */
export function skyIslePose(s: Isle, u: SkyIsleUnit, k: number, clipTop: boolean): { readonly yaw: number; readonly r: number; readonly sy: number } {
  const r = clipTop ? s.r * Math.min(1, SKY_ISLE_HD.keelInset / Math.max(1e-3, u.bulge)) : s.r;
  const yaw = SKY_ISLE_WEAR[s.id]?.[1] ?? k * 2.39996, [lo, hi] = SKY_ISLE_HD.stretch, sy = Math.min(hi * s.r / r, Math.max(lo, s.keel / (r * u.depth)));
  return { yaw, r, sy };
}

/** A unit model's rim radius at a local angle (radians from +x), bins without a vertex borrowing the median. */
const rimAt = (u: SkyIsleUnit, a: number): number => {
  const bins = SKY_ISLE_HD.rimBins, b = Math.floor(((a / (Math.PI * 2)) % 1 + 1) * bins) % bins, r = u.rim[b] ?? 0;
  return r > 0 ? r : 1;
};

/** A model's instances: its name and its matrices, sixteen float32 words each, column-major. */
export interface PlacedModel<M extends string = string> { readonly model: M; readonly m: number[] }
/** One cube's placements (standalone or a grid cell). */
export interface CubePlacements { readonly isles: PlacedModel<SkyIsleModel>[]; readonly falls: number[]; readonly trees: PlacedModel<TreeModel>[] }
/** The whole bake (data/placements.json). */
export interface SkyPlacements {
  readonly half: number; readonly keels: PlacedModel<SkyIsleModel>[];
  readonly standalone: CubePlacements; readonly cell: CubePlacements;
  readonly meadow: { readonly holes: number[][]; readonly paths: number[][] };
}

/** The float32 words a page's `setMatrixAt` stores, in nine significant digits (enough to name each float32 exactly). */
const words = (m: Matrix4): number[] => m.elements.map((v) => Number(Math.fround(v).toPrecision(9)));

/** The isles' instances by model (the models in the order the isles first wear them), and each isle's pose, by id. */
function placeIsles(isles: readonly SkyIsle[], units: ReadonlyMap<SkyIsleModel, SkyIsleUnit>, clipTop: boolean): { placed: PlacedModel<SkyIsleModel>[]; poses: Map<string, { u: SkyIsleUnit; yaw: number }> } {
  const byModel = new Map<SkyIsleModel, SkyIsle[]>(), poses = new Map<string, { u: SkyIsleUnit; yaw: number }>();
  isles.forEach((s, i) => { const name = skyIsleWear(s, i); byModel.set(name, [...(byModel.get(name) ?? []), s]); });
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), placed: PlacedModel<SkyIsleModel>[] = [];
  for (const [model, list] of byModel) {
    const u = units.get(model); if (u === undefined) throw new Error(`far-reach placements: ${model} has no unit`);
    const out: number[] = [];
    list.forEach((s, k) => {
      const { yaw, r, sy } = skyIslePose(s, u, k, clipTop);
      q.setFromAxisAngle(up, yaw); m.compose(new Vector3(s.x, s.y, s.z), q, new Vector3(r, r * sy, r)); out.push(...words(m));
      poses.set(s.id, { u, yaw });
    });
    placed.push({ model, m: out });
  }
  return { placed, poses };
}

/** The falls' matrices: each sheet just inside its isle's lip (a modelled isle's rim at that angle), facing out. */
function placeFalls(skyIsles: readonly SkyIsle[], poses: ReadonlyMap<string, { u: SkyIsleUnit; yaw: number }>): number[] {
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), local = new Vector3(), out: number[] = [];
  const lip = (isle: Isle, a: number): number | null => {
    const at = poses.get(isle.id); if (at === undefined) return null;
    local.set(Math.cos(a), 0, Math.sin(a)).applyAxisAngle(up, -at.yaw);
    return rimAt(at.u, Math.atan2(local.z, local.x)) * isle.r;
  };
  const sky = skyIsles.flatMap((s) => s.fall === null ? [] : [{ isle: s, a: s.fall, length: s.keel * 1.3 }]);
  const at = [...FALLS.flatMap(([id, a, length]) => { const isle = ISLES.find((i) => i.id === id); return isle === undefined ? [] : [{ isle, a, length }]; }), ...sky];
  for (const { isle, a, length } of at) {
    const r = (lip(isle, a) ?? isle.r * Math.cos(Math.PI / 12)) * 0.9, width = 1.8 + isle.r * 0.04;
    q.setFromAxisAngle(up, Math.atan2(Math.cos(a), Math.sin(a)));
    m.compose(new Vector3(isle.x + Math.cos(a) * r, isle.y - 1.1, isle.z + Math.sin(a) * r), q, new Vector3(width, length, 1)); out.push(...words(m));
  }
  return out;
}

function hash(i: number): number { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/** The trees' instances by model: each spot (x, y, z, scale) one model by a seeded hash (mostly conifers), at its own yaw, scale and slight lean. */
function placeTrees(at: readonly (readonly [number, number, number, number])[]): PlacedModel<TreeModel>[] {
  const byModel = new Map<TreeModel, [number, number, number, number, number][]>();
  at.forEach(([x, y, z, s], i) => {
    let r = hash(i * 7 + 3), pick: TreeModel = 'tree-pine-tall';
    for (const name of TREE_MODELS) { r -= TREES[name].share; if (r <= 0) { pick = name; break; } }
    byModel.set(pick, [...(byModel.get(pick) ?? []), [x, y, z, s, i]]);
  });
  const m = new Matrix4(), q = new Quaternion(), tilt = new Quaternion(), up = new Vector3(0, 1, 0), side = new Vector3(), placed: PlacedModel<TreeModel>[] = [];
  for (const [model, list] of byModel) {
    const out: number[] = [];
    for (const [x, y, z, s, i] of list) {
      const yaw = hash(i * 13 + 1) * Math.PI * 2, lean = (hash(i * 29 + 5) - 0.5) * 0.12, size = s * (0.8 + 0.4 * hash(i * 31 + 9));
      side.set(Math.cos(yaw), 0, Math.sin(yaw));
      q.setFromAxisAngle(up, yaw); tilt.setFromAxisAngle(side, lean); q.premultiply(tilt);
      m.compose(new Vector3(x, y, z), q, new Vector3(size, size, size)); out.push(...words(m));
    }
    placed.push({ model, m: out });
  }
  return placed;
}

/** Where grass never grows: discs (x, z, radius, short) round the structures and pieces you stand at, and the trodden ground. */
export function meadowHoles(): Vector4[] {
  const holes: [number, number, number][] = [[MILL.x, MILL.z, MILL_DRUM.r + 0.1], [WINCH.x, WINCH.z, 1.3], [NOTES.x, NOTES.z, 0.8], [KEEPER_AT.x, KEEPER_AT.z, 0.7], [KEEPER_STAND.x, KEEPER_STAND.z, 0.45], [DAIS.x, DAIS.z, DAIS.r + 0.4]];
  for (const v of VANES) holes.push([v.x, v.z, 1]);
  for (const st of CROWN_STONES) holes.push([st.x, st.z, 0.85]);
  holes.push([NEST.x, NEST.z, NEST.r + 0.2], [WINCH_HOUSE.x, WINCH_HOUSE.z, WINCH_HOUSE.w * 0.75]);
  for (const sp of SPIRES) { const at = spireAt(sp); holes.push([at.x, at.z, sp.r + 0.2]); }
  const out = holes.map(([x, z, r]) => new Vector4(x, z, r, 0));
  // the keeper's trodden ground (E399 round 6, mockup B: he stands in low grass, his boots and his stand in view; the
  // sward between him and the spawn hid both): a disc where the grass grows short (w 1, as round the hero rocks)
  // (round 7, seat B: at 3.2 m it mowed A's foreground, 1.8-2.4 m from him: to his boots and the stand)
  out.push(new Vector4(KEEPER_AT.x, KEEPER_AT.z, 1.2, 1), new Vector4(KEEPER_STAND.x, KEEPER_STAND.z, 0.9, 1));
  return out;
}

/** The worn paths: a segment (x0, z0) → (x1, z1) from each bridge landing in toward its island's middle. */
export function meadowPaths(isles: readonly Isle[] = ISLES): Vector4[] {
  const out: Vector4[] = [];
  const ends: [number, number][] = [];
  for (const s of [...SPANS, FALLEN_BRIDGE]) { ends.push([s.x0, s.z0], [s.x1, s.z1]); }
  ends.push([UPDRAFT.x0, UPDRAFT.z0], [UPDRAFT.x1, UPDRAFT.z1]);
  for (const [x, z] of ends) {
    let best: Isle | null = null, bd = Infinity;
    for (const isle of isles) { const d = Math.hypot(x - isle.x, z - isle.z); if (d < bd) { bd = d; best = isle; } }
    if (best === null || bd > best.r + 2) continue;
    // a short worn apron in from each landing (E392: the mockups' meadow runs right up to the bridge)
    const k = Math.max(0, bd - 3.5) / Math.max(1e-3, bd);
    out.push(new Vector4(x, z, best.x + (x - best.x) * k, best.z + (z - best.z) * k));
  }
  return out;
}

/** Whether a sky isle's footprint stands inside a cube of half width `half` (G99). */
export const inCube = (s: SkyIsle, half: number): boolean => Math.abs(s.x) + s.r <= half && Math.abs(s.z) + s.r <= half;

/**
 * G99 (every shard is a 500 × 500 × 500 cube): the sky isles whose footprint (centre ± rim radius) stands inside the cube.
 * Standalone (`cube` null) every isle builds, the same array; in a grid cell the five past the cell edge (o2, n1, n2, n3 on
 * the horizon past the crown, b4 across the south edge) leave the world, the falls and the far proxy, so nothing of Sky
 * Reach hangs over the road or a neighbour.
 */
export function skyIslesIn(cube: { readonly half: number } | null): readonly SkyIsle[] {
  return cube === null ? SKY_ISLES : SKY_ISLES.filter((s) => inCube(s, cube.half));
}

/** The cube Sky Reach fills in a grid cell (G99: every shard is a 500 m cube). */
export const CELL_HALF = 250;

/** Every placement (`read` returns a public file's bytes; `frames` the models' unit frames; `pines` the sky isles' firs). */
export async function bakeSkyPlacements(read: (url: string) => Uint8Array, frames: readonly SkyIsleFrame[], pines: Readonly<Record<string, readonly SkyIslePine[]>>): Promise<SkyPlacements> {
  const units = new Map<SkyIsleModel, SkyIsleUnit>();
  for (const model of SKY_ISLE_MODELS) {
    const source = await readSourceModel(read(HD_URLS[model])), hd = hdGeometry(source.gltf.scene, (material) => source.texture(material) !== null);
    const frame = frames.find((f) => f.model === model);
    if (hd === null || frame === undefined) throw new Error(`far-reach placements: ${model} has no textured mesh or frame`);
    units.set(model, skyIsleUnit(hd.geometry, frame));
  }
  // the spots the playable islands' pines and the gate isles' pine (beside the chain posts) stand on, before the sky isles' firs
  const base: [number, number, number, number][] = [];
  for (const isle of ISLES) for (const [dx, dz, s] of PINES[isle.id] ?? []) base.push([isle.x + dx, isle.y, isle.z + dz, s]);
  for (const isle of RISING_ISLETS.map(entry => entry.gate)) base.push([isle.x + 3, isle.y, isle.z - 3, 0.9]);
  const cube = (half: number | null): CubePlacements => {
    const skyIsles = skyIslesIn(half === null ? null : { half }), { placed, poses } = placeIsles(skyIsles, units, false);
    const at = [...base];
    for (const s of skyIsles) for (const p of pines[s.id] ?? []) if (p.y !== null) at.push([p.x, p.y, p.z, p.size]);
    return { isles: placed, falls: placeFalls(skyIsles, poses), trees: placeTrees(at) };
  };
  const v4 = (v: Vector4): number[] => [v.x, v.y, v.z, v.w];
  return { half: CELL_HALF, keels: placeIsles(keelIsles(ISLES), units, true).placed, standalone: cube(null), cell: cube(CELL_HALF),
    meadow: { holes: meadowHoles().map(v4), paths: meadowPaths().map(v4) } };
}
