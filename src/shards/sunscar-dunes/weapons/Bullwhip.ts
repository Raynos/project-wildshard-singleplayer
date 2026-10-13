import type { App } from '@wildshard/engine/app/app';
import type { Targets } from '@wildshard/engine/combat/types';
import { LashWeapon } from '../runtime/items/lashWeapon';
import { lashSpec, type LashSpec } from '../runtime/items/lash';
import { WHIP_ROW } from './rows';
import { WHIP_ITEM } from '../data/items';
import { WHIP_VIEW } from '../data/whip';
import { braidedCoil, buildWhipModel } from './whipModel';

/** The crack's numbers: reach, width, damage, cooldowns and charge are the declared item row's (data/items.ts); the lash's timing is the whip's own (`pull` is the yank's speed, m/s, on a creature of `pullMaxHp` or less). */
export const CRACK = lashSpec(WHIP_ITEM, WHIP_ITEM.profile);

/**
 * The bullwhip (rung 3): the platform's lash weapon on the declared crack, its view the whip's rows (data/whip.ts
 * WHIP_VIEW) over the hero glove and its plaited coil (`weapons/whipModel.ts`). A light crack is one long, narrow lash to
 * the crosshair; the heavy is a double crack whose second lash staggers a creature. Desktop: Attack = Mouse0 / F,
 * Heavy = Mouse2 (`weapon.melee`). Touch: a tap cracks, a still hold fills the charge ring and its release throws the
 * double crack. Levers and braziers (C3) take the crack through `aimAt`.
 */
export class Bullwhip extends LashWeapon {
  constructor(app: App, targets: Targets | null = null, spec: LashSpec = CRACK) {
    const model = buildWhipModel();
    super(app, targets, { row: WHIP_ROW, spec, view: WHIP_VIEW, parts: { ...model, hero: true, restCoil: model.hd === null, wrapCoil: () => braidedCoil(model) } });
  }
}
