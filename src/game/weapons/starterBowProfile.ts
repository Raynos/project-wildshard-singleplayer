import { wind } from '@wildshard/engine/world/steppeWind';
import type { BowProfile as PlatformBowProfile } from '@wildshard/engine/combat/view/bowProfile';

/** The starter view recipes keep their existing repaint vocabulary. */
export type BowStyle = 'recurve' | 'golden' | 'sky-wolf';
/** The starter bow profile accepts those same trusted view strategies. */
export type BowProfile = PlatformBowProfile<BowStyle>;

/** The default bow's numbers. SF54: its view (the recurve's poses, arrow line, build and arrow) moved with the recurve into
 *  Nalati (src/shards/nalati-grasslands/weapons/loadout.ts NALATI_BOW); a bow brings its own, as Pine's longbow does. */
export const BOW: Omit<BowProfile, 'poses' | 'arrowX' | 'arrowY' | 'arrowLength' | 'build' | 'arrow'> = {
  family: 'bow', quiver: 24, swayMax: 1.5 * (Math.PI / 180), speedBase: 30, speedDraw: 28, damageScale: 1.2,
  aimZoom: 2, aimVmZoom: 0.85, aimSway: 0.5, aimSpread: 0.5, aimIn: 10,
  arcFrom: 0.25, arcColour: 0x8fe3ff, arcMode: 'setting', zoomLook: true,
  inspectZ: -0.5, inspectHidesArms: false, transparentParts: false, vmScale: 0.72,
  wind,
};
