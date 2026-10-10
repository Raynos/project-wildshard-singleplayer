// reflectionCards — wet-ground reflection cards of light emitters on a plane (SHARD-PLATFORM M3, ex Nine Dragon's
// look/streaks.ts): one instanced card per emitter (./emitterCards), laid out by a shard's card program on a reflecting
// plane — the ground at a height, or a tilted plane with an extent (a stair flight's slope, a landing). The program is
// the shard's (a `ShaderFamily` row); this system hands it the card contract's uniforms:
//   uPlaneO / uPlaneU / uPlaneN  the plane (a point on it, its axis along x, its normal), uClip its extent (x0, z0, x1, z1)
//   uSpread  x tail toward the eye, y tail away, z width scale, w min distance
//   uCardK   x gain, y dash contrast, z jog, w saturation keep
//   uLift    how far the card rises off the plane as the view steepens
//   uPerf    the perf knobs every card set shares (one object), uHole a rectangle with no floor to reflect in
// `stairReflectionCards` lays a set on each flight's plane half a rise under its nosing line (the depth test shows each
// card on the back half of every tread: the per-step broken reflection) and a flat set on each landing.
import { Mesh, Vector3, Vector4 } from 'three';
import { emitterCardsGeometry } from './emitterCards';
import type { ShaderFamily, UniformMap } from './shaderFamily';
import type { Emitter } from './vertexSpill';

/** A reflecting plane: a point on it, its axis along x (tilted with a slope), its normal, and its extent (x0, z0, x1, z1). */
export interface ReflectPlane { o: Vector3; u: Vector3; n: Vector3; clip: Vector4 }

/** A card set's look as data: the tails, the gain, dash, jog and width, the min distance, the saturation keep, the draw order. */
export interface ReflectCardRow {
  readonly tailNear: number;
  readonly tailFar: number;
  readonly cardGain: number;
  readonly cardDash: number;
  readonly cardJog: number;
  readonly cardWidth: number;
  readonly minDistance: number;
  readonly saturationKeep: number;
  readonly renderOrder: number;
}

/** One card set: its plane (the ground at `groundY` when none), the rectangle with no floor, and its gain, lift, width and dash. */
export interface ReflectCardSet {
  readonly groundY: number;
  readonly hole: Vector4;
  readonly plane?: ReflectPlane;
  readonly gain?: number;
  readonly lift?: number;
  readonly width?: number;
  readonly dash?: number;
}

/** The program a card set draws with: the shard's family and program, its shared uniforms, its look row and the shared perf knobs. */
export interface ReflectCardProgram<P extends string = string> {
  readonly family: ShaderFamily<P>;
  readonly program: P;
  readonly shared: UniformMap;
  readonly look: ReflectCardRow;
  readonly perf: Vector4;
}

const NO_CLIP = new Vector4(-1e5, -1e5, 1e5, 1e5);

/** One card set's mesh: a card per emitter on the set's plane (not frustum-culled: the program places the cards). */
export function reflectionCards<P extends string>(prog: ReflectCardProgram<P>, emitters: readonly Emitter[], set: ReflectCardSet): Mesh {
  const L = prog.look;
  const plane = set.plane ?? { o: new Vector3(0, set.groundY, 0), u: new Vector3(1, 0, 0), n: new Vector3(0, 1, 0), clip: NO_CLIP };
  const mat = prog.family.material(prog.program, prog.shared, {
    uniforms: {
      uPlaneO: { value: plane.o.clone() }, uPlaneU: { value: plane.u.clone().normalize() }, uPlaneN: { value: plane.n.clone().normalize() }, uClip: { value: plane.clip.clone() },
      uSpread: { value: new Vector4(L.tailNear, L.tailFar, set.width ?? L.cardWidth, L.minDistance) },
      uCardK: { value: new Vector4(L.cardGain * (set.gain ?? 1), set.dash ?? L.cardDash, L.cardJog, L.saturationKeep) },
      uLift: { value: set.lift ?? 0 },
      uPerf: { value: prog.perf },
      uHole: { value: set.hole },
    },
  });
  const m = new Mesh(emitterCardsGeometry(emitters), mat);
  m.frustumCulled = false;
  m.renderOrder = L.renderOrder;
  return m;
}

/** A stair's flights and landings: each flight's start and end x and its foot's height, each landing's x extent and height,
 *  the rise and run of a step, and the stair's z extent. */
export interface StairCardPlan {
  readonly flights: readonly { readonly x0: number; readonly x1: number; readonly y0: number }[];
  readonly landings: readonly { readonly x0: number; readonly x1: number; readonly y: number }[];
  readonly rise: number;
  readonly run: number;
  readonly z0: number;
  readonly z1: number;
}

/** A stair's card sets as data: their gain, width and dash, and the flights' lift as a fraction of the rise. */
export interface StairCardRow { readonly gain: number; readonly width: number; readonly dash: number; readonly lift: number }

/**
 * A stair's card sets: per flight, a set on the plane half a rise under the nosing line (y = y0 + rise / 2 + (x − x0) ·
 * rise / run) — the treads' backs show through the depth test, the fronts hide under their nosings — and a flat set on
 * each landing. One draw per flight and landing.
 */
export function stairReflectionCards<P extends string>(prog: ReflectCardProgram<P>, emitters: readonly Emitter[], plan: StairCardPlan, row: StairCardRow): Mesh[] {
  const slope = plan.rise / plan.run;
  const out: Mesh[] = [];
  const hole = new Vector4(0, 0, 0, 0);
  for (const f of plan.flights) {
    out.push(reflectionCards(prog, emitters, {
      groundY: 0, hole, gain: row.gain, lift: plan.rise * row.lift, width: row.width, dash: row.dash,
      plane: { o: new Vector3(f.x0, f.y0 + plan.rise * 0.5, 0), u: new Vector3(1, slope, 0), n: new Vector3(-slope, 1, 0), clip: new Vector4(f.x0, plan.z0, f.x1, plan.z1) },
    }));
  }
  for (const l of plan.landings) {
    out.push(reflectionCards(prog, emitters, {
      groundY: 0, hole, gain: row.gain, lift: 0, width: row.width, dash: row.dash,
      plane: { o: new Vector3(l.x0, l.y, 0), u: new Vector3(1, 0, 0), n: new Vector3(0, 1, 0), clip: new Vector4(l.x0, plan.z0, l.x1, plan.z1) },
    }));
  }
  return out;
}
