// Pine Hollow's Longbow as the hands bake reads it (SHARD-PLATFORM M3; generators/handsPool.ts): a yew self bow twice as
// tall as the starter recurve — the pale sapwood back, the orange-brown heartwood belly, a leather grip with a band of
// amber, horn nocks, a linen string — its ash arrow and the hunter's gloved fists on it. The bake serialises this look into
// `custom/handsPool`'s `bow` row; the held bow draw (@wildshard/game/weapons/heldLauncher heldBowProfile) reads it there.
import * as v from 'valibot';
import { HUNTER_HANDS } from './handsLook';

const finite = v.pipe(v.number(), v.finite()), pair = v.tuple([finite, finite]);
/** The arrow's exact authored length and palette. */
const ArrowLookSchema = v.strictObject({ length: finite, shaft: finite, shaftDark: finite, binding: finite, head: finite, feather: finite, featherBar: finite });
const optional = v.exactOptional(finite);
const fist = v.strictObject({ R: finite, mirror: v.exactOptional(v.boolean()), thumbRing: v.exactOptional(v.boolean()), span: v.exactOptional(finite),
  yaw: v.exactOptional(finite), curl: v.exactOptional(finite), thumbCurl: v.exactOptional(finite) });
/** The stave's exact look, including the serialised key order the bake keeps. */
export const StaveBowLookSchema = v.strictObject({ gripH: finite, limbW: finite, nockL: finite, kappaRest: finite, kappaDraw: finite,
  braceZ: finite, drawLen: finite, arrowX: finite, arrowY: finite, radial: finite, stringRadial: finite, stringR: finite, serving: finite,
  palette: v.strictObject({ sap: finite, sapDark: finite, heart: finite, heartDark: finite, heartHi: finite, horn: finite, hornHi: finite,
    leather: finite, leatherHi: finite, amber: finite, string: finite, serving: finite }),
  arrow: ArrowLookSchema, hands: v.strictObject({ leather: optional, leatherLight: optional, leatherDark: optional, leatherEdge: optional,
    thread: optional, fleece: optional, fleeceShade: optional, fleeceDeep: optional, wool: optional, woolShade: optional, red: optional, redDeep: optional, redLine: optional,
    gold: optional, jade: optional, jadeDark: optional }),
  leftFist: fist, rightFist: fist, rightRoll: finite, leftSleeve: pair, rightSleeve: pair });
export type ArrowLook = v.InferOutput<typeof ArrowLookSchema>;
export type StaveBowLook = v.InferOutput<typeof StaveBowLookSchema>;

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
