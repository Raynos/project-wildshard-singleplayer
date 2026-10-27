import { forearm, gloveFist, riderArm } from '@wildshard/engine/player/firstPersonArms';

/** A gloved first-person fist from an arm style (the engine's held-view fist law), for a held weapon's rest pool bake.
 *  Returns owned geometry and its wrist frame; nothing is drawn or installed. */
export function bakeGloveFist(style: Parameters<typeof gloveFist>[0], opts: Parameters<typeof gloveFist>[1]): ReturnType<typeof gloveFist> {
  return gloveFist(style, opts);
}

/** A rider's sleeved arm from an arm style (the engine's held-view arm law), for a held weapon's rest pool bake. */
export function bakeRiderArm(style: Parameters<typeof riderArm>[0], length?: number, seed?: number): ReturnType<typeof riderArm> {
  return riderArm(style, length, seed);
}

/** Construct owned fist/forearm geometry in the supplied grip direction, without a view or owner. */
export function bakeForearm(...args: Parameters<typeof forearm>): ReturnType<typeof forearm> { return forearm(...args); }
