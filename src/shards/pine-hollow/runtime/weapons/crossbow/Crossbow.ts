import { crossbowData, crossbowHierarchy, heldGeometry, type CrossbowRows } from '../../boot/crossbowGeometry';
import { viewmodelRowMaterial, type RangedWorld } from '@wildshard/engine/combat/view/ranged';
import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { Targets } from '@wildshard/engine/combat/types';
import type { HeldFirearmModel, HeldHandRow } from '@wildshard/game/plugin/heldFirearm';
import { HeldLauncher, type HeldLauncherRows } from '@wildshard/game/plugin/heldLauncher';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { coatSet, loadCoatTextures } from '../../viewmodel/gloveHands';
import { bakedHandGeometry, handsPresentation } from '../../boot/handsGeometry';
import { SECTIONS } from '../../sections';
import { crossbowProfile, type CrossbowProfile } from '../../../weapons/crossbow/profiles';
import type { InferOutput } from 'valibot';

/**
 * Crossbow — Pine Hollow's first-person hero weapon, rows on the held-launcher host (`@wildshard/game/plugin/heldLauncher`,
 * H3): the medieval hunting crossbow's baked parts and its rows (`custom/crossbowPool`: the looks, the hunter's gloved
 * hands, the iron-sights view; authored in generators/crossbowRows.ts) and the playback sections. The trigger, string, bolts (the engine's flight law, sticking, glancing),
 * tracers, ADS solve and pose are the host's.
 *
 *   const crossbow = pineCrossbow(world, targets, { row: CROSSBOW, allowUnlocked, held: crossbowHeldRows(ctx.product) });
 *
 * ADS = true iron sights: the camera looks straight down the bolt; the rear peep (mockup art/ads-aim/round-1/ads-C-peep-sight.png,
 * a dark-iron ring on a post just ahead of the nut, 2.1 cm) fades in on the eye → tip line.
 */

export const MAX_BOLTS = 30;

type Section<K extends keyof typeof SECTIONS> = InferOutput<(typeof SECTIONS)[K]>;
interface Held { readonly playback: Section<'custom/heldPlayback'>; readonly inputs: Section<'custom/heldInputs'>; readonly sights: Section<'custom/heldSights'> }
/** Read the crossbow's playback sections (load time, never in a frame loop). */
export function crossbowHeldRows(product: ShardProduct): Held {
  return { playback: product.section('custom/heldPlayback', SECTIONS), inputs: product.section('custom/heldInputs', SECTIONS), sights: product.section('custom/heldSights', SECTIONS) };
}
/** The crossbow's rows on the host, its playback groups from the sections. */
export function crossbowRows(held?: Held): HeldLauncherRows {
  const groups = held === undefined ? { frame: [], pose: [], parts: [], sight: [], string: [], peep: [] }
    : { frame: held.inputs.frames.crossbow.program, pose: held.playback.crossbow, parts: held.playback.crossbowParts, sight: held.sights.sight, string: held.sights.string, peep: held.sights.peep };
  return { ...crossbowData().launcher, scene: crossbowHierarchy(),
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
/** A hold row on its baked hand (generators/handsPool.ts `hand-<part>`), borrowed from the held pool. */
function hand({ part, ...hold }: CrossbowRows['hands']['left']): HeldHandRow {
  return { ...hold, ...bakedHandGeometry(part) };
}
/** Pine's crossbow: the profile, view, rows, parts and hands on the held-launcher host. */
export function pineCrossbow(world: RangedWorld, targets: Targets | undefined, opts: { row: EquipmentRow; allowUnlocked?: boolean; held: Held; profile: unknown }): CrossbowWeapon {
  return new HeldLauncher(world, targets, { row: opts.row, allowUnlocked: opts.allowUnlocked ?? false, profile: crossbowProfile(opts.profile), view: crossbowData().view,
    rows: crossbowRows(opts.held), model: crossbowModel(),
    hands: { material: viewmodelRowMaterial(world.sky, 'hunter-hands', handsPresentation().hands), coatMaterial: viewmodelRowMaterial(world.sky, 'hunter-coat', handsPresentation().coat, { coat: coatSet() }),
      left: hand(crossbowData().hands.left), right: hand(crossbowData().hands.right) } });
}
/** A built Pine crossbow. */
export type CrossbowWeapon = HeldLauncher<CrossbowProfile>;
