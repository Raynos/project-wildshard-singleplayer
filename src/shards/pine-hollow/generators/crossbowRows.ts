import * as THREE from 'three';
import { BUCKSKIN } from './handsLook';
import displayRest from '../data/crossbowDisplay.json' with { type: 'json' };

/**
 * Pine Hollow's crossbow as rows on the held-launcher host (`@wildshard/game/weapons/heldLauncher`, H3), authored here and
 * written by the crossbow pool bake (bake-crossbow-pool.mjs) into `custom/crossbowPool` `rows` beside the baked parts; the
 * runtime (runtime/weapons/crossbow/Crossbow.ts) reads the section and never imports this file (G467).
 *
 *   view       the hip pose (lower-right, Skyrim) at 1.35×; the cheek on the stock (the eye 5.6 cm above the rail, looking
 *              straight down the bolt, the nut 3 cm in front of the near plane); the rear peep at model z 0.10, 2.1 cm
 *              (mockup art/ads-aim/round-1/ads-C-peep-sight.png)
 *   hands      the hunter's gloved hands (E322 F-M6, Jake's pick B) by their baked part (handsPool.ts `hand-<part>`)
 *   launcher   the looks, nodes, anchors, string spring, glance, camera frame, tracer and the display copy's rest
 */

type Triple = [number, number, number];
/** One hand as the bake builds it (runtime/viewmodel/gloveHands HandSpec) and where the weapon holds it. */
interface CrossbowHold {
  readonly spec: { R: number; curl: number; thumbCurl: number; bend?: readonly [number, number]; armLen: number; tint: number; gloveTint: Triple; coat: boolean; elbow?: Triple };
  readonly at: Triple; readonly axis: Triple; readonly palm: Triple;
}

/** The left round the back of the fore-end's leather, its coat sleeve free (aimed at an elbow off the frame's lower left,
 *  so the reload's tilt never swings the arm away); the right under the grip with the index by the trigger. Both in the
 *  coat's sleeves. The specs are the hands bake's keys (handsPool.ts HAND_SPECS): keep their key order. */
export const CROSSBOW_HAND_HOLDS: { readonly left: CrossbowHold; readonly right: CrossbowHold } = {
  left: { spec: { R: 0.025, curl: 0.7, thumbCurl: 0.9, armLen: 1, tint: 2.2, gloveTint: BUCKSKIN, coat: true, elbow: [-0.35, -0.45, -0.45] }, at: [0.004, -0.034, -0.04], axis: [0, 0, -1], palm: [-0.5, 0.87, 0] },
  right: { spec: { R: 0.03, curl: 0.6, thumbCurl: 0.9, bend: [0.8, -1.2], armLen: 0.6, tint: 2.2, gloveTint: BUCKSKIN, coat: true }, at: [0, -0.09, 0.33], axis: [0, 0.34, -0.94], palm: [0, 1, 0] },
};
const hand = (part: string, { spec, at, axis, palm }: CrossbowHold) => ({ part, at, axis, palm, coat: spec.coat, ...spec.elbow === undefined ? {} : { elbow: spec.elbow } });

/**
 * Every lit part on the viewmodels' shared program (viewmodelRowMaterial: MeshPhysical + vertex colours + the five map
 * slots); the names (`xbow-wood` …) are the finishes' keys (data/weaponFinishes.ts). The walnut stock (a low
 * specularIntensity kills the grazing sunset sheen on the rail), the brushed-steel iron, prod and brass, the leather wrap,
 * the hemp cord (its 1×1 filler ARM), the dark-iron rear peep with a faint cyan glow, and the bolt (its atlas, alpha-tested
 * fletching, one DoubleSide pass). Physical at its defaults is Standard's F0 0.04, so every part shares the stock's program;
 * the prod keeps its own (anisotropy, the hero-weapon sheen) and the bolt its own (alpha test).
 */
const LOOKS = {
  wood: { set: 'walnut', normalScale: [0.75, 0.75], roughness: 1, metalness: 0, envMapIntensity: 0.45, specularIntensity: 0.3 },
  iron: { set: 'steel', normalScale: [0.7, 0.7], roughness: 1.5, metalness: 1, color: [0.24, 0.23, 0.23], envMapIntensity: 0.6 },
  prod: { set: 'steel', normalScale: [0.6, 0.6], roughness: 1.25, metalness: 1, color: [0.55, 0.55, 0.57], anisotropy: 0.8, anisotropyRotation: 0, envMapIntensity: 0.7 },
  leather: { set: 'leather', roughness: 1, metalness: 0, envMapIntensity: 0.5 },
  cord: { set: 'cord', roughness: 0.85, metalness: 0 },
  brass: { set: 'steel', normalScale: [0.3, 0.3], roughness: 1.1, metalness: 1, color: [0.95, 0.66, 0.3], envMapIntensity: 1.0 },
};
const PEEP = { color: [0.05, 0.05, 0.055], roughness: 0.9, metalness: 0.75, emissive: 0x8fe3ff, emissiveIntensity: 0.05 };
const BOLT = { set: 'bolt', roughness: 1, metalness: 1, alphaTest: 0.5, vertexColors: false, forceSinglePass: true, side: THREE.DoubleSide };

/** The crossbow's rows (custom/crossbowPool `rows`). */
export const CROSSBOW_ROWS = {
  view: {
    hip: { px: 0.12, py: -0.165, pz: -0.27, rx: 0.035, ry: 0.13, rz: 0.04, scale: 1.35 },
    ads: { eyeAboveRail: 0.056, nearMargin: 0.03, pitch: 0 },
    peep: { z: 0.10, radius: 0.01, worldRadius: 0.0105 },
  },
  hands: { left: hand('crossbow-left', CROSSBOW_HAND_HOLDS.left), right: hand('crossbow-right', CROSSBOW_HAND_HOLDS.right) },
  launcher: {
    materials: { ...Object.fromEntries(Object.entries(LOOKS).map(([id, look]) => [id, { name: `xbow-${id}`, look }])),
      bolt: { name: 'xbow-bolt', look: BOLT }, 'peep-iron': { name: 'xbow-peep', look: PEEP }, 'peep-glow': { name: 'xbow-peep-glow', basic: { color: 0x8fe3ff, opacity: 0.85 } } },
    /** the walnut along the stock, the steel twice each way */
    textures: { walnut: { set: 'walnut', repeat: [1, 4] }, steel: { set: 'brushed-steel', repeat: [2, 2] }, leather: { set: 'leather' }, cord: { set: 'cord' }, bolt: { set: 'bolt' } },
    objects: { sight: 'peep', sightRing: 'peep-ring' }, fade: ['peep-iron', 'peep-glow'],
    nodes: { stringLeft: 'string-left', stringRight: 'string-right', serving: 'serving', round: 'loaded-bolt', sightPost: 'peep-post' },
    anchors: { tipL: [-0.335, 0.004, -0.205], tipR: [0.335, 0.004, -0.205], nockRest: [0, 0.009, -0.215], nockDrawn: [0, 0.009, 0.128] },
    string: { spring: [1400, 34], reloadSpring: [260, 28], release: -40, reload: [0.18, 0.78] },
    glance: { lift: 0.01, keep: 0.2, bounce: 0.25, maxSpeed: 9 },
    /** the held camera's timing; reload, contact and flight stay the weapon's phases */
    frame: { clock: 'frame', fovWhen: 'always', recoil: { decay: 9, attack: 40, recovery: 6 }, lag: { gain: 0.5, clampYaw: 0.12, clampPitch: 0.1, k: 220, c: 20 },
      clampAfter: true, readout: { range: 120, mask: 3, held: false, posed: true } },
    /** the flight trail's allocation and source-clock expiry, the bolt's spin and its glow sizes */
    tracer: { row: { mode: 'trail', follow: { kind: 'fx.trail', every: null, movementSq: 1e-8 }, roster: 8, points: 2048, width: 8, color: [1, 0, 0], order: 1200, lifetime: 6, fade: 1.5, markerScale: 0.32 }, spin: 14,
      glow: { flight: 0.035, stuck: 0.025, impact: 0.06, ring: [0.10, 0.14] } },
    displayRest,
  },
};
