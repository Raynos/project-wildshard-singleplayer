import baked from '../data/spots.generated.json' with { type: 'json' };

export const PINE_INTERACT = 'pine.interact';
export const PINE_ACT = { talk: 0, logA: 1, logB: 2, glass: 3, flint: 4, pond: 5, ridge: 6, den: 7, zip: 8, rifle: 9,
  token1: 10, token2: 11, token3: 12, token4: 13, token5: 14, token6: 15, token7: 16, token8: 17, bench: 18, miller: 19, trader: 20, kingBow: 21, cancelTalk: -1 } as const;
export const QUEST_STEP = 'pine.quest';
export const PINE_AMMO = 'pine.ammo';


export function pineSpots(): Omit<typeof baked, 'profile' | 'notice'> { const { profile: _profile, notice: _notice, ...spots } = structuredClone(baked); return spots; }
export type PineSpots = ReturnType<typeof pineSpots>;
