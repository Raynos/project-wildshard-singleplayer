// Pine Hollow's Longbow as the hands bake reads it (SHARD-PLATFORM M3; generators/handsPool.ts): a yew self bow twice as
// tall as the starter recurve — the pale sapwood back, the orange-brown heartwood belly, a leather grip with a band of
// amber, horn nocks, a linen string — its ash arrow and the hunter's gloved fists on it. The bake serialises this look into
// `custom/handsPool`'s `bow` row; the held bow draw (@wildshard/game/weapons/heldLauncher heldBowProfile) reads it there.
import { HUNTER_HANDS } from './handsLook';

/** Data-only authored arrow dimensions and palette. */
export interface ArrowLook { length: number; shaft: number; shaftDark: number; binding: number; head: number; feather: number; featherBar: number }
interface FistLook { R: number; mirror?: boolean; thumbRing?: boolean; span?: number; yaw?: number; curl?: number; thumbCurl?: number }
/** The complete stave look serialized by the author; runtime uses the admitted held-bow contract. */
export interface StaveBowLook {
  gripH: number; limbW: number; nockL: number; kappaRest: number; kappaDraw: number;
  braceZ: number; drawLen: number; arrowX: number; arrowY: number; radial: number; stringRadial: number; stringR: number; serving: number;
  palette: { sap: number; sapDark: number; heart: number; heartDark: number; heartHi: number; horn: number; hornHi: number;
    leather: number; leatherHi: number; amber: number; string: number; serving: number };
  arrow: ArrowLook;
  hands: { leather?: number; leatherLight?: number; leatherDark?: number; leatherEdge?: number;
    thread?: number; fleece?: number; fleeceShade?: number; fleeceDeep?: number; wool?: number; woolShade?: number;
    red?: number; redDeep?: number; redLine?: number; gold?: number; jade?: number; jadeDark?: number };
  leftFist: FistLook; rightFist: FistLook; rightRoll: number; leftSleeve: [number, number]; rightSleeve: [number, number];
}

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
