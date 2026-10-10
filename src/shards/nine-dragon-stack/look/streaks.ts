// Wet-ground streaks, merged from the neon lab (the dev labs (deleted in E357 F7), "cards"): one instanced additive
// card per emitter, lying where optics puts its reflection — between the mirror points of the emitter's top and bottom,
// c / (c + h) of the way from the eye — stretched along the view ray by the gloss, broken on the same flagstone joints
// as the ground (STONES_GLSL, shared with the Jiehua ground), with a jagged two-octave ripple edge, striation, dashes and
// grain. It replaces the quarter-res mirror pass. The reflecting plane is the square's floor at `uGroundY` (the square and
// its street), or (round 14, dome C1's stair-street) a stair flight's slope: a card set on each flight's plane half a rise
// under its nosing line, so the depth test shows each card on the back half of every tread only — the per-step broken
// reflection — and a flat set on each landing.
// SHARD-PLATFORM M3: the card sets are the SDK's reflection cards (@wildshard/sdk/looks/reflectionCards); the card
// program's GLSL and row, the look, the cut and the stair's row are data (data/streaks.ts).
import { type Mesh, Vector4 } from 'three';
import { type ReflectCardProgram, type StairCardPlan, reflectionCards, stairReflectionCards } from '@wildshard/sdk/looks/reflectionCards';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import type { Emitter } from '@wildshard/sdk/looks/vertexSpill';
import { STAIR_CARDS, STREAK_CUT, STREAK_LOOK, STREAK_PROGRAMS } from '../data/streaks';
import { LOOK_FRAGMENTS, type Shared } from './style';

const STREAK_FAMILY = new ShaderFamily(LOOK_FRAGMENTS, STREAK_PROGRAMS);

/** the cards' perf knobs, shared by every card set (one object): x the tail-by-brightness reference (0 = off), y a
 *  brightness floor (0 = off), w −1 = no whole-card reject (the A / B harness) */
export const STREAK_PERF = new Vector4(STREAK_CUT.tails, STREAK_CUT.floor, 0, 0);

const program = (shared: Shared): ReflectCardProgram<'card'> => ({ family: STREAK_FAMILY, program: 'card', shared: shared.u, look: STREAK_LOOK, perf: STREAK_PERF });

/** the square's card set: on its floor at `uGroundY`, none in the Well's open shaft (`hole`) */
export function buildStreaks(shared: Shared, emitters: readonly Emitter[], hole: Vector4): Mesh {
  return reflectionCards(program(shared), emitters, { groundY: shared.u.uGroundY.value, hole });
}

/** (render, round 14, dome C1) the wet stair-street's card sets: one per flight and per landing (data/streaks.ts STAIR_CARDS) */
export function stairStreaks(shared: Shared, emitters: readonly Emitter[], plan: StairCardPlan): Mesh[] {
  return stairReflectionCards(program(shared), emitters, plan, STAIR_CARDS);
}
