import { forearm, gloveFist, riderArm } from '@wildshard/engine/player/firstPersonArms';
import { Color } from 'three';

/** Own a linear author colour: numeric hex retains the native sRGB conversion; triples are already linear. */
export function bakeArmColour(value: number | readonly [number, number, number]): Color {
  return typeof value === 'number' ? new Color(value).convertSRGBToLinear().multiplyScalar(1) : new Color(...value);
}

/** Independent colours in the original arm palette order, without a live view or shared mutable palette. */
export function bakeArmPalette(style: Parameters<typeof gloveFist>[0]): Record<keyof Parameters<typeof gloveFist>[0], Color> {
  return {
    leather: bakeArmColour(style.leather), leatherLight: bakeArmColour(style.leatherLight), leatherDark: bakeArmColour(style.leatherDark), leatherEdge: bakeArmColour(style.leatherEdge),
    thread: bakeArmColour(style.thread), jade: bakeArmColour(style.jade), jadeDark: bakeArmColour(style.jadeDark), fleece: bakeArmColour(style.fleece),
    fleeceShade: bakeArmColour(style.fleeceShade), fleeceDeep: bakeArmColour(style.fleeceDeep), wool: bakeArmColour(style.wool), woolShade: bakeArmColour(style.woolShade),
    red: bakeArmColour(style.red), redDeep: bakeArmColour(style.redDeep), redLine: bakeArmColour(style.redLine), gold: bakeArmColour(style.gold),
  };
}

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
