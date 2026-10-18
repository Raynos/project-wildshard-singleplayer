import type * as THREE from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import type { ModelBuild, ModelContext, ModelDef } from '@wildshard/engine/models/model';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import type { Material } from '@wildshard/engine/physics/surface';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { Board } from './campParams';
import { PaintKit, v3, type ColorLike, type FinishOpts, type Painter, type PaintOpts, type NalatiTexName } from './paint';

type Box = BoxSpec & { surface?: Material; ghost?: true };
type Ground = (x: number, z: number) => number;
type Platform = (x: number, z: number) => number | undefined;
interface Plumes { readonly emitter: (p: THREE.Vector3, o?: { puffs?: number; rise?: number; size?: [number, number]; life?: number; density?: number }) => void }

/** what a painted model paints into: a place's kit (its one rng stream) */
export interface Kit {
  readonly rng: Rng;
  add: (g: THREE.BufferGeometry, col: ColorLike | Painter, o?: PaintOpts) => void;
}

/** where one copy stands, world space; `yaw` about +y (for a building: the way its door faces, 0 = −z) */
export interface PaintAt { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }

/** what a painter is handed besides the kit: the ground under it, and the place's shared cloth and smoke (effects) */
export interface PaintCtx {
  readonly ground: Ground;
  readonly flutter: { readonly streamer: (p: THREE.Vector3, len: number, width: number, color: THREE.ColorRepresentation, o?: { droop?: number; taper?: number }) => void; readonly flag: (p: THREE.Vector3, width: number, len: number, color: THREE.ColorRepresentation, o?: { droop?: number; taper?: number }) => void; readonly strip: (p: THREE.Vector3, len: number, width: number, color: THREE.ColorRepresentation) => void };
  readonly smoke: Plumes;
}

/** what one copy made, world space: its boxes (data for the weather / the dressing's keep-out; a `ghost` one is data
 *  only), its colliders as real geometry, its walkable top (placement only) */
export interface Made {
  readonly boxes?: readonly Box[];
  readonly descs?: readonly ColliderDesc[];
  readonly floor?: Platform;
}

/** paints one copy of a model into `kit` at `at` */
export type Paint<P, O extends Made = Made> = (kit: Kit, at: PaintAt, p: P, c: PaintCtx) => O;

export interface PaintSpec {
  /** the specimen's kit seed (its rng stream: the shape of a per-copy random model) */
  readonly seed: number;
  /** the finish its place gives it (aoH …; the ground is the place's) */
  readonly finish?: Omit<FinishOpts, 'ground'>;
  /** fitted to the ground under it: the specimen is painted at its first real placement, on the real terrain */
  readonly fitted?: boolean;
  /** the kit's textured layers it paints into (the timber grain, the felt) */
  readonly layers?: readonly NalatiTexName[];
}

type Build<P> = (ctx: ModelContext, p: P, rng: Rng) => ModelBuild;
interface PaintedBuild<P> { (ctx: ModelContext, p: P, rng: Rng): ModelBuild; readonly paint: Paint<P>; readonly spec: PaintSpec }
export const isPainted = <P>(b: Build<P>): b is PaintedBuild<P> => 'paint' in b;

/** the first copy each fitted model painted (its specimen is painted there) */
const firsts = new WeakMap<object, { at: PaintAt; p: object }>();
const ORIGIN: PaintAt = { x: 0, y: 0, z: 0, yaw: 0 };

/** a painted specimen's geometry: one copy on a kit of its own, moved to the origin, each with its textured layer (null:
 *  the POI material) — `painted`'s build without its materials (the places bake's specimens, generators/places.ts) */
function specimenParts<P extends object>(paint: Paint<P>, spec: PaintSpec, build: object, p: P): { geometry: THREE.BufferGeometry; layer: NalatiTexName | null }[] {
  const first = spec.fitted === true ? firsts.get(build) : undefined;
  const at = first?.at ?? ORIGIN;
  const params: P = first ? { ...p, ...first.p } : p;
  const ground: Ground = first ? (x, z) => heightAt(x, z) : () => at.y;
  const kit = new PaintKit(spec.seed);
  paint(kit, at, params, { ground, flutter: { streamer: () => undefined, flag: () => undefined, strip: () => undefined }, smoke: { emitter: () => undefined } });
  const o: FinishOpts = { ...spec.finish, ground };
  const parts: { geometry: THREE.BufferGeometry; layer: NalatiTexName | null }[] = [];
  const move = (g: THREE.BufferGeometry): THREE.BufferGeometry => { g.translate(-at.x, -at.y, -at.z); g.computeBoundingSphere(); g.computeBoundingBox(); return g; };
  if (!kit.empty) parts.push({ geometry: move(kit.finish(o)), layer: null });
  for (const name of spec.layers ?? []) {
    const g = kit.finishTextured(o, name);
    if (g) parts.push({ geometry: move(g), layer: name });
  }
  return parts;
}

/** A build-only painter marker. Runtime specimens always read the emitted catalogue. */
export function painted<P extends object>(paint: Paint<P>, spec: PaintSpec): PaintedBuild<P> {
  const build = (): never => { throw new Error('Paint recipes run only in the offline specimen producer'); };
  return Object.assign(build, { paint, spec });
}

/** a painted model's specimen geometry for `p` (its build's parts without materials); refuses any other model */
export function paintedSpecimen<P extends object>(def: ModelDef<P>, p: P): { geometry: THREE.BufferGeometry; layer: NalatiTexName | null }[] {
  const b = def.build;
  if (!isPainted(b)) throw new Error(`paintedSpecimen: ${def.id} is not a painted model`);
  return specimenParts(b.paint, b.spec, b, p);
}


/** Retain a fitted specimen's first world placement without runtime ownership. */
export function rememberPainted<P extends object>(build: PaintedBuild<P>, at: PaintAt, p: P): void {
  if (build.spec.fitted === true && !firsts.has(build)) firsts.set(build, { at, p });
}

/** one board's plank: its centre, its yaw (local +x = the pointing way), its width */
export interface BoardSpot { readonly p: THREE.Vector3; readonly yaw: number; readonly w: number }

/** where a signpost at (x, gy, z) hangs its boards, top down */
export function boardSpots(x: number, z: number, gy: number, boards: readonly Board[]): BoardSpot[] {
  const H = 1.9 + boards.length * 0.36;
  return boards.map((b, i) => {
    const y = gy + H - 0.3 - i * 0.36, w = 1.45;
    const yaw = b.dir - Math.PI / 2;                                       // M's local +x → world (sin dir, cos dir)
    const cx = x + Math.sin(b.dir) * (w / 2 + 0.05), cz = z + Math.cos(b.dir) * (w / 2 + 0.05);
    return { p: v3(cx, y, cz), yaw, w };
  });
}
