import { BOW } from '@wildshard/game/weapons/starterBowProfile';
import { BOW_PROFILE } from './bowProfile';
import { HANDS_POOL } from './handsPoolProduct';
import { LONGBOW_MATERIAL, ARROW_MATERIAL, LONGBOW_POSES } from './longbowPresentation';

// GR8: built by the program, not read from a scheduler job's output
const hands = HANDS_POOL.rows;

const { wind, ...STARTER_BOW } = BOW;
void wind;

/** Original longbow binding compiled beside its borrowed hand/stave pool. */
export const PINE_HELD_BOW: { base: { draw: { drawTime: number; letdownTime: number; renockTime: number; renockEarly: number; holdSteady: number; holdTire: number; tiredTime: number; }; loose: { muzzle: number; aimMultiplier: number; motion: number; degrees: number; radius: "linear" | "sqrt"; axisScale: 1 | 2; }; projectile: { maxFlying: number; substeps: number; lifetime: number; gravity: number; drag: number; windCoupling: number; }; parent: string; speedBase: number; speedDraw: number; damageScale: number; quiver: number; aimSpread: number; swayMax: number; aimZoom: number; arcColour: number; arcMode: string; zoomLook: boolean; inspectZ: number; inspectHidesArms: boolean; transparentParts: boolean; family: "bow"; mounted?: { drawTime: number; rearAngle: number; rearDraw: number; rearSpread: number; gaits: readonly { below: number; spread: number; }[]; arc: boolean; }; aimVmZoom: number; aimSway: number; aimIn: number; arcFrom: number; vmScale: number; }; bow: { bake: { sectionSamples: { widths: number[]; ridges: number[]; }; look: string; arrow: string; ringU: number[]; ringSign: number[]; limbVerts: number; dynVerts: number; lWrist: number[]; rWrist: number[]; rHook: number[]; rWristDir: number[]; }; parts: { stave: string; nocked: string; rightFist: string; leftSleeve: string; rightSleeve: string; arrow: string; }; materials: { bow: { name: string; look: { roughness: number; metalness: number; envMapIntensity: number; specularIntensity: number; }; }; arrow: { name: string; look: { roughness: number; metalness: number; }; }; }; arrow: { bury: number; recover: number; maxFlying: number; maxStuck: number; gravity: number; drag: number; windCoupling: number; }; wind: { base: number; gust: number; }; poses: Record<"drawn" | "rest" | "aim" | "restPort" | "drawnPort" | "aimPort", { readonly pos: readonly [number, number, number]; readonly aim: readonly [number, number, number]; readonly cant: number; readonly pitch: number; }>; }; } = {
  base: { ...STARTER_BOW, draw: BOW_PROFILE.draw, loose: { ...BOW_PROFILE.spread, muzzle: BOW_PROFILE.muzzle },
    projectile: { ...BOW_PROFILE.flight, maxFlying: BOW_PROFILE.pool, substeps: BOW_PROFILE.substeps, lifetime: BOW_PROFILE.lifetime },
    parent: 'weapon.bow', speedBase: BOW_PROFILE.speedBase, speedDraw: BOW_PROFILE.speedDraw, damageScale: BOW_PROFILE.damageScale,
    quiver: BOW_PROFILE.quiver, aimSpread: BOW_PROFILE.spread.aimMultiplier,
    swayMax: 1.4 * (Math.PI / 180), aimZoom: 1.6, arcColour: 0xffc070, arcMode: 'aim', zoomLook: false,
    inspectZ: -1.4, inspectHidesArms: true, transparentParts: true },
  bow: { bake: hands.bow,
    parts: { stave: 'bow-stave', nocked: 'bow-arrow-nocked', rightFist: 'bow-right-fist', leftSleeve: 'bow-left-sleeve', rightSleeve: 'bow-right-sleeve', arrow: 'bow-arrow' },
    materials: { bow: { name: 'longbow', look: LONGBOW_MATERIAL }, arrow: { name: 'longbow-arrow', look: ARROW_MATERIAL } },
    arrow: { ...BOW_PROFILE.flight, bury: 0.09, recover: 0.7, maxFlying: BOW_PROFILE.pool, maxStuck: 48 },
    wind: { base: 1.2, gust: 7 }, poses: LONGBOW_POSES },
};
