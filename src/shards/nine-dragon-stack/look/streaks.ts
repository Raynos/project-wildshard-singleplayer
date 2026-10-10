// Wet-ground streaks, merged from the neon lab (the dev labs (deleted in E357 F7), "cards"): one instanced additive
// card per emitter, lying where optics puts its reflection — between the mirror points of the emitter's top and bottom,
// c / (c + h) of the way from the eye — stretched along the view ray by the gloss, broken on the same flagstone joints
// as the ground (STONES_GLSL, shared with the Jiehua ground), with a jagged two-octave ripple edge, striation, dashes and
// grain. It replaces the quarter-res mirror pass. The reflecting plane is the square's floor at `uGroundY` (the square and
// its street), or (round 14, dome C1's stair-street) a stair flight's slope: `stairStreaks` lays a card set on each flight's
// plane half a rise under its nosing line, so the depth test shows each card on the back half of every tread only — the
// per-step broken reflection — and a flat set on each landing.
// SHARD-PLATFORM M3: the card program's GLSL and row, the look, the cut and the stair's gains are data (data/streaks.ts).
import { Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, Uint16BufferAttribute, Vector3, Vector4 } from 'three';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import type { Emitter } from '@wildshard/sdk/looks/vertexSpill';
import { STAIR_DASH, STAIR_GAIN, STAIR_WIDTH, STREAK_CUT, STREAK_LOOK, STREAK_PROGRAMS } from '../data/streaks';
import { LOOK_FRAGMENTS, type Shared } from './style';

const STREAK_FAMILY = new ShaderFamily(LOOK_FRAGMENTS, STREAK_PROGRAMS);

/** the cards' perf knobs, shared by every card set (one object): x the tail-by-brightness reference (0 = off), y a
 *  brightness floor (0 = off), w −1 = no whole-card reject (the A / B harness) */
export const STREAK_PERF = new Vector4(STREAK_CUT.tails, STREAK_CUT.floor, 0, 0);

/** a reflecting plane: a point on it, its axis along x (tilted with a slope), its normal, and its extent (x0, z0, x1, z1) */
export interface StreakPlane { o: Vector3; u: Vector3; n: Vector3; clip: Vector4 }

const NO_CLIP = new Vector4(-1e5, -1e5, 1e5, 1e5);

export function buildStreaks(shared: Shared, emitters: readonly Emitter[], hole: Vector4, plane?: StreakPlane, gain = 1, lift = 0, width: number = STREAK_LOOK.cardWidth, dash: number = STREAK_LOOK.cardDash): Mesh {
  const L = STREAK_LOOK;
  const P = plane ?? { o: new Vector3(0, shared.u.uGroundY.value, 0), u: new Vector3(1, 0, 0), n: new Vector3(0, 1, 0), clip: NO_CLIP };
  const mat = STREAK_FAMILY.material('card', shared.u, {
    uniforms: {
      uPlaneO: { value: P.o.clone() }, uPlaneU: { value: P.u.clone().normalize() }, uPlaneN: { value: P.n.clone().normalize() }, uClip: { value: P.clip.clone() },
      uSpread: { value: new Vector4(L.tailNear, L.tailFar, width, 0.6) },
      uCardK: { value: new Vector4(L.cardGain * gain, dash, L.cardJog, 1) },
      uLift: { value: lift },
      uPerf: { value: STREAK_PERF },
      uHole: { value: hole },
    },
  });
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  g.setAttribute('aCorner', new Float32BufferAttribute([-1, 0, 1, 0, 1, 1, -1, 1], 2));
  g.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  const e = new Float32Array(emitters.length * 3), col = new Float32Array(emitters.length * 3), size = new Float32Array(emitters.length * 3);
  emitters.forEach((m, i) => {
    e.set([m.at.x, m.at.y, m.at.z], i * 3);
    col.set([m.color.r, m.color.g, m.color.b], i * 3);
    size.set([m.w, m.h, m.power], i * 3);
  });
  g.setAttribute('aE', new InstancedBufferAttribute(e, 3));
  g.setAttribute('aCol', new InstancedBufferAttribute(col, 3));
  g.setAttribute('aSize', new InstancedBufferAttribute(size, 3));
  g.instanceCount = emitters.length;
  const m = new Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = 4;
  return m;
}

/** the stair-street's flights and landings, as world/stairPlan.ts exports them */
export interface StairPlan {
  flights: readonly { x0: number; x1: number; y0: number }[];
  landings: readonly { x0: number; x1: number; y: number }[];
  rise: number;
  run: number;
  z0: number;
  z1: number;
}

/**
 * (render, round 14, dome C1) the wet stair-street's streaks: per flight, a card set on the plane half a rise under the
 * nosing line (y = y0 + rise / 2 + (x − x0) · rise / run) — the treads' backs show through the depth test, the fronts
 * hide under their nosings — and a flat set on each landing. One draw per flight / landing.
 */
export function stairStreaks(shared: Shared, emitters: readonly Emitter[], plan: StairPlan): Mesh[] {
  const slope = plan.rise / plan.run;
  const out: Mesh[] = [];
  const none = new Vector4(0, 0, 0, 0);
  for (const f of plan.flights) {
    out.push(buildStreaks(shared, emitters, none, {
      o: new Vector3(f.x0, f.y0 + plan.rise * 0.5, 0), u: new Vector3(1, slope, 0), n: new Vector3(-slope, 1, 0),
      clip: new Vector4(f.x0, plan.z0, f.x1, plan.z1),
    }, STAIR_GAIN, plan.rise * 0.42, STAIR_WIDTH, STAIR_DASH));
  }
  for (const l of plan.landings) {
    out.push(buildStreaks(shared, emitters, none, {
      o: new Vector3(l.x0, l.y, 0), u: new Vector3(1, 0, 0), n: new Vector3(0, 1, 0), clip: new Vector4(l.x0, plan.z0, l.x1, plan.z1),
    }, STAIR_GAIN, 0, STAIR_WIDTH, STAIR_DASH));
  }
  return out;
}
