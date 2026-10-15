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
import { SKINS, type SkinId } from './skins';

/** the row's order: the crossbow's first (the hero), then the lever-action's; and where each one comes from */
const FINISHES: readonly { id: SkinId; from: string }[] = [
  { id: 'hollow-ash', from: "Mott's stall" },
  { id: 'ghost-stag', from: 'The Ghost Stag' },
  { id: 'blackpaw', from: 'Old Blackpaw' },
  { id: 'imperial', from: 'The Imperial Bull' },
  { id: 'warden', from: 'The Antler King' },
  { id: 'ironhide', from: 'Old Ironhide' },
  { id: 'scarback-furnace', from: "Mott's stall" },
];

export const PINE_FINISH_EFFECTS: readonly EffectDef[] = FINISHES.map(({ id }) => pineFinishEffect(id, SKINS[id].weapon));

const WEAPON_WORD: Record<'crossbow' | 'rifle', string> = { crossbow: 'Crossbow', rifle: 'Lever-action' };

export const isSkinId = (id: string): id is SkinId => Object.hasOwn(SKINS, id);

const CARDS = FINISHES.map(({ id, from }) => {
  const skin = SKINS[id], word = WEAPON_WORD[skin.weapon];
  return { id, name: skin.name, blurb: word, lockedBlurb: `${word} · ${from}`,
    icon: skin.weapon === 'rifle' ? 'lever' as const : 'crossbow' as const };
});
export const pineFinishes = (locker: Pick<SkinLocker, 'cardRows'>): ReturnType<SkinLocker['cardRows']> => locker.cardRows(CARDS);

/** a tap on finish `id`: wear it, take it off (it is worn), or nothing (not owned / not a finish) */
export const finishPick = (locker: Pick<SkinLocker, 'pick'>, id: string): ReturnType<SkinLocker['pick']> => isSkinId(id) ? locker.pick(id) : null;
