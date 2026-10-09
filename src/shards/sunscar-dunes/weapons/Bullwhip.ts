import type { App } from '@wildshard/engine/app/app';
import type { Targets } from '@wildshard/engine/combat/types';
import { LashWeapon, lashSpec } from '@wildshard/sdk/items/lashWeapon';
import { WHIP_ROW } from './rows';
import { WHIP_ITEM, WHIP_MOVES, WHIP_TIMING } from '../data/items';
import { WHIP_VIEW } from '../data/whip';
import { braidedMaterial, buildWhipModel } from './whipModel';

/** The crack's numbers: reach, width, damage, cooldowns and charge are the declared item row's (data/items.ts); the lash's timing is the whip's own (`pull` is the yank's speed, m/s, on a creature of `pullMaxHp` or less). */
export const CRACK = lashSpec(WHIP_ITEM, WHIP_TIMING, WHIP_MOVES);

/**
 * The bullwhip (rung 3): the platform's lash weapon on the declared crack, its view the whip's rows (data/whip.ts
 * WHIP_VIEW) over the gloved fist and braided coil (`weapons/whipModel.ts`). A light crack is one long, narrow lash to
 * the crosshair; the heavy is a double crack whose second lash staggers a creature. Desktop: Attack = Mouse0 / F,
 * Heavy = Mouse2 (`weapon.melee`). Touch: a tap cracks, a still hold fills the charge ring and its release throws the
 * double crack. Levers and braziers (C3) take the crack through `aimAt`.
 */
export class Bullwhip extends LashWeapon {
  constructor(app: App, targets: Targets | null = null) {
    const model = buildWhipModel();
    super(app, targets, { row: WHIP_ROW, spec: CRACK, view: WHIP_VIEW, parts: { ...model, hero: model.glove !== null, restCoil: model.hd === null, wrapMaterial: braidedMaterial } });
  }
}
