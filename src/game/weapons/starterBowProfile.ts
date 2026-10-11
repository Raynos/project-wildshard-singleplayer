import { STARTER_BOW } from './starter.generated';
import { wind } from '@wildshard/engine/world/steppeWind';
import type { BowProfile as PlatformBowProfile } from '@wildshard/engine/combat/view/bowProfile';

/** The starter view recipes keep their existing repaint vocabulary. */
export type BowStyle = 'recurve' | 'golden' | 'sky-wolf';
/** The starter bow profile accepts those same trusted view strategies. */
export type BowProfile = PlatformBowProfile<BowStyle>;

/** The default bow's numbers. SF54: its view (the recurve's poses, arrow line, build and arrow) moved with the recurve into
 *  Nalati (src/shards/nalati-grasslands/weapons/loadout.ts NALATI_BOW); a bow brings its own, as Pine's longbow does. */
export const BOW: Omit<BowProfile, 'poses' | 'arrowX' | 'arrowY' | 'arrowLength' | 'build' | 'arrow'> = {
  ...STARTER_BOW, wind,
};
