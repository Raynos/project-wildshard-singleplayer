import { crossbowHierarchy, heldGeometry } from '../../boot/crossbowGeometry';
import { viewmodelMaterial, viewmodelRowMaterial, type RangedWorld } from '@wildshard/engine/combat/view/ranged';
import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { Targets } from '@wildshard/engine/combat/types';
import type { HeldFirearmModel, HeldHandRow } from '@wildshard/game/plugin/heldFirearm';
import { HeldLauncher, type HeldLauncherRows, type HeldLauncherView } from '@wildshard/game/plugin/heldLauncher';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { coatSet, handGeometry, loadCoatTextures, type HandHold } from '../../viewmodel/gloveHands';
import { BUCKSKIN, COAT_MATERIAL, CROSSBOW_DISPLAY_REST, HANDS_MATERIAL, HUNTER_HANDS } from '../../const';
import { CROSSBOW_MATERIALS, CROSSBOW_TILING } from '../heldLook';
import { RANGED_FRAME, RANGED_TRACE } from '../../items/rangedFrame';
import { SECTIONS } from '../../sections';
import { CROSSBOW_PROFILE, type CrossbowProfile } from '../../../weapons/crossbow/profiles';
import type { InferOutput } from 'valibot';
import * as THREE from 'three';

/**
 * Crossbow — Pine Hollow's first-person hero weapon, rows on the held-launcher host (`@wildshard/game/plugin/heldLauncher`,
 * H3): the medieval hunting crossbow's baked parts (`custom/crossbowPool`), its looks, the hunter's gloved hands, the
 * iron-sights view and the playback sections. The trigger, string, bolts (the engine's flight law, sticking, glancing),
 * tracers, ADS solve and pose are the host's.
 *
 *   const crossbow = pineCrossbow(world, targets, { row: CROSSBOW, allowUnlocked, held: crossbowHeldRows(ctx.product) });
 *
 * ADS = true iron sights: the camera looks straight down the bolt; the rear peep (mockup art/ads-aim/round-1/ads-C-peep-sight.png,
 * a dark-iron ring on a post just ahead of the nut, 2.1 cm) fades in on the eye → tip line.
 */

export const MAX_BOLTS = 30;

/** Pine's iron-sights view: the hip pose (lower-right, Skyrim) at 1.35×; the cheek on the stock (the eye 5.6 cm above the
 *  rail, looking straight down the bolt, the nut 3 cm in front of the near plane); the peep at model z 0.10, 2.1 cm. */
export const CROSSBOW_VIEW: HeldLauncherView = {
  hip: { px: 0.12, py: -0.165, pz: -0.27, rx: 0.035, ry: 0.13, rz: 0.04, scale: 1.35 },
  ads: { eyeAboveRail: 0.056, nearMargin: 0.03, pitch: 0 },
  peep: { z: 0.10, radius: 0.01, worldRadius: 0.0105 },
};

/**
 * E322 F-M6: the hunter's gloved hands (Jake's pick B), in model space: the left round the back of the fore-end's leather,
 * its coat sleeve free (aimed at an elbow off the frame's lower left, so the reload's tilt never swings the arm away); the
 * right under the grip with the index by the trigger. Both in the coat's sleeves. Baked: generators/handsPool.ts.
 */
export const CROSSBOW_HAND_HOLDS: { left: HandHold; right: HandHold } = {
  left: { spec: { R: 0.025, curl: 0.7, thumbCurl: 0.9, armLen: 1, tint: 2.2, gloveTint: BUCKSKIN, coat: true, elbow: [-0.35, -0.45, -0.45] }, at: [0.004, -0.034, -0.04], axis: [0, 0, -1], palm: [-0.5, 0.87, 0] },
  right: { spec: { R: 0.03, curl: 0.6, thumbCurl: 0.9, bend: [0.8, -1.2], armLen: 0.6, tint: 2.2, gloveTint: BUCKSKIN, coat: true }, at: [0, -0.09, 0.33], axis: [0, 0.34, -0.94], palm: [0, 1, 0] },
};

type Section<K extends keyof typeof SECTIONS> = InferOutput<(typeof SECTIONS)[K]>;
interface Held { readonly playback: Section<'custom/heldPlayback'>; readonly inputs: Section<'custom/heldInputs'>; readonly sights: Section<'custom/heldSights'> }
/** Read the crossbow's playback sections (load time, never in a frame loop). */
export function crossbowHeldRows(product: ShardProduct): Held {
  return { playback: product.section('custom/heldPlayback', SECTIONS), inputs: product.section('custom/heldInputs', SECTIONS), sights: product.section('custom/heldSights', SECTIONS) };
}
const CROSSBOW_LOOK = {
  materials: { ...Object.fromEntries((['wood', 'iron', 'prod', 'leather', 'cord', 'brass'] as const).map(id => [id, { name: `xbow-${id}`, look: CROSSBOW_MATERIALS[id] }])),
    bolt: { name: 'xbow-bolt', look: { ...CROSSBOW_MATERIALS.bolt, side: THREE.DoubleSide } }, 'peep-iron': { name: 'xbow-peep', look: CROSSBOW_MATERIALS.peep },
    'peep-glow': { name: 'xbow-peep-glow', basic: { color: 0x8fe3ff, opacity: 0.85 } } },
  textures: { walnut: { set: 'walnut', repeat: CROSSBOW_TILING.walnut }, steel: { set: 'brushed-steel', repeat: CROSSBOW_TILING.steel }, leather: { set: 'leather' }, cord: { set: 'cord' }, bolt: { set: 'bolt' } },
} as const;
/** The crossbow's rows on the host, its playback groups from the sections. */
export function crossbowRows(held?: Held): HeldLauncherRows {
  const groups = held === undefined ? { frame: [], pose: [], parts: [], sight: [], string: [], peep: [] }
    : { frame: held.inputs.frames.crossbow.program, pose: held.playback.crossbow, parts: held.playback.crossbowParts, sight: held.sights.sight, string: held.sights.string, peep: held.sights.peep };
  return { ...CROSSBOW_LOOK, scene: crossbowHierarchy(), objects: { sight: 'peep', sightRing: 'peep-ring' }, fade: ['peep-iron', 'peep-glow'],
    nodes: { stringLeft: 'string-left', stringRight: 'string-right', serving: 'serving', round: 'loaded-bolt', sightPost: 'peep-post' },
    anchors: { tipL: [-0.335, 0.004, -0.205], tipR: [0.335, 0.004, -0.205], nockRest: [0, 0.009, -0.215], nockDrawn: [0, 0.009, 0.128] },
    string: { spring: [1400, 34], reloadSpring: [260, 28], release: -40, reload: [0.18, 0.78] }, glance: { lift: 0.01, keep: 0.2, bounce: 0.25, maxSpeed: 9 },
    frame: RANGED_FRAME.crossbow, tracer: { row: RANGED_TRACE.trail, spin: 14, glow: { flight: 0.035, stuck: 0.025, impact: 0.06, ring: [0.10, 0.14] } }, displayRest: CROSSBOW_DISPLAY_REST,
    playback: { groups, inputs: held === undefined ? [] : [{ group: 'frame', rows: held.inputs.frames.crossbow.inputs }, { group: 'pose', rows: held.inputs.crossbow },
      { group: 'sight', rows: held.sights.sightInputs }, { group: 'string', rows: held.sights.stringInputs }, { group: 'peep', rows: held.sights.peepInputs }],
    outputs: held === undefined ? [] : [{ group: 'frame', rows: held.inputs.frames.crossbow.outputs, target: 'frame' }, { group: 'sight', rows: held.sights.sightOutputs, target: 'sight' }] } };
}
/** The crossbow's baked parts by geometry id (borrowed from the preloaded held pool). */
export function crossbowModel(): HeldFirearmModel {
  const pool = heldGeometry();
  return { geometry: new Map(crossbowHierarchy().nodes.flatMap(node => {
    if (node.kind !== 'mesh') return [];
    const geometry = pool.geometry(node.geometry, { borrow: true }); if (geometry === null) throw new Error('Crossbow pool part missing');
    return [[node.geometry, geometry] as const];
  })) };
}

/** Load the coat's baked canvas before constructing the hands; geometry comes from the preloaded held pool. */
export async function prepareCrossbowHands(due: () => Promise<void> | null): Promise<void> {
  await loadCoatTextures();
  const wait = due(); if (wait !== null) await wait;
}
const hand = (hold: HandHold, mirror: boolean): HeldHandRow => ({ ...handGeometry(HUNTER_HANDS, { ...hold.spec, mirror }, hold.spec.elbow !== undefined), at: hold.at, axis: hold.axis, palm: hold.palm,
  ...hold.spec.coat === undefined ? {} : { coat: hold.spec.coat }, ...hold.spec.elbow === undefined ? {} : { elbow: hold.spec.elbow } });
/** Pine's crossbow: the profile, view, rows, parts and hands on the held-launcher host. */
export function pineCrossbow(world: RangedWorld, targets: Targets | undefined, opts: { row: EquipmentRow; allowUnlocked?: boolean; held: Held; profile?: CrossbowProfile }): CrossbowWeapon {
  return new HeldLauncher(world, targets, { row: opts.row, allowUnlocked: opts.allowUnlocked ?? false, profile: opts.profile ?? CROSSBOW_PROFILE, view: CROSSBOW_VIEW,
    rows: crossbowRows(opts.held), model: crossbowModel(),
    hands: { material: viewmodelMaterial(world.sky, 'hunter-hands', HANDS_MATERIAL), coatMaterial: viewmodelRowMaterial(world.sky, 'hunter-coat', COAT_MATERIAL, { coat: coatSet() }),
      left: hand(CROSSBOW_HAND_HOLDS.left, true), right: hand(CROSSBOW_HAND_HOLDS.right, false) } });
}
/** A built Pine crossbow. */
export type CrossbowWeapon = HeldLauncher<CrossbowProfile>;
