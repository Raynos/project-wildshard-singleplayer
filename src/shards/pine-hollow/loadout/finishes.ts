import type { EffectDef } from '@wildshard/engine/combat/effects/types';
import { pineFinishEffect } from './effects';
/**
 * Pine Hollow's FINISHES row on the Bag's GEAR (E314, Jake's pick C, art/loot/round-3-other-shards/board-1-pine-hollow.jpg):
 * every crossbow / lever-action finish (src/engine/player/Skins.ts) as a tap-to-wear card, the ones you don't own yet dim with
 * who or what gives them. It reuses Nalati's SKINS row (src/game/bag/bag.ts renderGear); before it, Pine Hollow could never
 * change a finish: the newest one was always worn.
 *
 *   pineFinishes(locker) → SkinRow[]           (Menu's `skins`)
 *   finishPick(locker, id) → 'wear' | 'off' | null   (what a tap does: main.ts applies it to the weapon's model)
 */
import type { SkinLocker } from '@wildshard/game/cosmetics/locker';
import { SKINS } from './skins';
import { FINISH_CARDS } from '../data/finishCards';

export const PINE_FINISH_EFFECTS: readonly EffectDef[] = FINISH_CARDS.map(({ id }) => pineFinishEffect(id, SKINS[id].weapon));

export const isSkinId = (id: string): id is keyof typeof SKINS => Object.hasOwn(SKINS, id);

export const pineFinishes = (locker: Pick<SkinLocker, 'cardRows'>): ReturnType<SkinLocker['cardRows']> => locker.cardRows(FINISH_CARDS);

/** a tap on finish `id`: wear it, take it off (it is worn), or nothing (not owned / not a finish) */
export const finishPick = (locker: Pick<SkinLocker, 'pick'>, id: string): ReturnType<SkinLocker['pick']> => isSkinId(id) ? locker.pick(id) : null;
