// Pine Hollow's Longbow in first person as data (SHARD-PLATFORM M3, the viewmodel system @wildshard/sdk/viewmodel/staveBow):
// a yew self bow twice as tall as the starter recurve — the pale sapwood back, the orange-brown heartwood belly, a leather
// grip with a band of amber, horn nocks, a linen string — its ash arrow, the hunter's gloves and the grip poses.
import type { ArrowLook, GripPoseRow, StaveBowLook } from '@wildshard/sdk/viewmodel/staveBow';
import { HUNTER_HANDS } from './handsLook';

/** The arrow: an ash shaft, a sinew-bound bodkin head, three grey-goose feathers (a white cock feather). */
export const LONGBOW_ARROW: ArrowLook = {
  length: 0.76, shaft: 0xc9a878, shaftDark: 0x8a6a46, binding: 0x4a3622, head: 0x3c3e42, feather: 0x8e8a84, featherBar: 0xe6e0d4,
};
/** The stave: its proportions and bend, the string, the yew's colours, the arrow and the gloved fists on it. */
export const LONGBOW_LOOK: StaveBowLook = {
  gripH: 0.06, limbW: 0.74, nockL: 0.035,
  kappaRest: 0.52, kappaDraw: 0.9,
  braceZ: 0.155, drawLen: 0.56,
  arrowX: -0.017, arrowY: 0.052,
  radial: 14, stringRadial: 6, stringR: 0.0019, serving: 0.1,
  palette: {
    sap: 0xd9c08e, sapDark: 0xb89a64, heart: 0x9a4a24, heartDark: 0x6a2c14, heartHi: 0xc0703a,
    horn: 0x2a211a, hornHi: 0x6a5a44, leather: 0x3a2a1c, leatherHi: 0x5c4430, amber: 0xe08a28,
    string: 0xd8ccb0, serving: 0x3a2e24,
  },
  arrow: LONGBOW_ARROW,
  hands: HUNTER_HANDS.palette,
  leftFist: { R: 0.019, mirror: true, yaw: -0.32 },
  rightFist: { R: 0.009, yaw: 0.55 },
  rightRoll: 1.35,
  leftSleeve: [1.0, 1], rightSleeve: [0.9, 2],
};
/** The Longbow's material (the viewmodels' shared lit program): waxed yew, leather, linen. */
export const LONGBOW_MATERIAL = { roughness: 0.62, metalness: 0, envMapIntensity: 0.55, specularIntensity: 0.5 };
/* Poses in rig space (camera space / VM_SCALE), the starter bow's, re-seated for a bow twice as tall: rest = lowered and
 * canted across the body; drawn = the fist right of centre, the stave canted, the arrow converging on the crosshair ~6 m out. */
/** The Longbow's grip poses. */
export const LONGBOW_POSES: Record<'rest' | 'drawn' | 'restPort' | 'drawnPort' | 'aim' | 'aimPort', GripPoseRow> = {
  rest: { pos: [0.32, -0.46, -0.9], aim: [-0.1, 0.25, -4], cant: -0.78, pitch: -0.16 },
  drawn: { pos: [0.2, -0.17, -1.12], aim: [0, 0, -5.5], cant: -0.3, pitch: 0 },
  restPort: { pos: [0.16, -0.52, -0.92], aim: [-0.05, 0.12, -4], cant: -0.62, pitch: -0.14 },
  drawnPort: { pos: [0.07, -0.1, -1.08], aim: [0, 0, -5.5], cant: -0.24, pitch: 0 },
  aim: { pos: [0.1, -0.22, -1.15], aim: [0.02, -0.052, -7], cant: -0.22, pitch: 0 },
  aimPort: { pos: [0.04, -0.19, -1.15], aim: [0.02, -0.052, -8], cant: -0.16, pitch: 0 },
};
