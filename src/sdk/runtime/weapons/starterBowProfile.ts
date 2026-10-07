import { BOW as StarterBOW, type BowStyle as StarterBowStyle, type BowProfile as StarterBowProfile } from '@wildshard/game/weapons/starterBowProfile';

/** The starter view recipes retain their closed repaint vocabulary. */
export type BowStyle = StarterBowStyle;
/** The original starter numeric bow profile with trusted injected view strategies. */
export type BowProfile = StarterBowProfile;
/** The original starter BOW binding; all trusted callers share its identity. */
export const BOW: typeof StarterBOW = StarterBOW;
