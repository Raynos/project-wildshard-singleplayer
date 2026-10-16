import type { BowProfile } from '@wildshard/engine/combat/view/bowProfile';
import type { HeldFirearmModel } from '@wildshard/game/plugin/heldFirearm';
import { heldBowProfile, type HeldBowRows } from '@wildshard/game/plugin/heldLauncher';
import { BOW } from '@wildshard/game/weapons/starterBowProfile';
import { BOW_PROFILE } from '../../data/bowProfile';
import { LONGBOW_LOOSE } from '../../weapons/longbowFlight';
import { bakedBowRows, handsPart } from '../boot/handsGeometry';
import { ARROW_MATERIAL, LONGBOW_MATERIAL, LONGBOW_POSES } from '../const';

/** The Warden's longbow in first person: rows on the held bow draw (`@wildshard/game/plugin/heldLauncher`, H3) over the
 *  baked stave (generators/handsPool.ts, `custom/handsPool`'s `bow`); the draw, loose and arrows are the platform Bow's. */
const PARTS = { stave: 'bow-stave', nocked: 'bow-arrow-nocked', rightFist: 'bow-right-fist', leftSleeve: 'bow-left-sleeve', rightSleeve: 'bow-right-sleeve', arrow: 'bow-arrow' } as const;
/** The longbow's rows (load time: the bake is read from the admitted held pool). */
export function longbowRows(): HeldBowRows {
  return { bake: bakedBowRows(), parts: PARTS, materials: { bow: { name: 'longbow', look: LONGBOW_MATERIAL }, arrow: { name: 'longbow-arrow', look: ARROW_MATERIAL } },
    arrow: { ...BOW_PROFILE.flight, bury: 0.09, recover: 0.7, maxFlying: BOW_PROFILE.pool, maxStuck: 48 }, wind: { base: 1.2, gust: 7 }, poses: LONGBOW_POSES };
}
/** The longbow's baked parts (borrowed from the preloaded held pool). */
export function longbowModel(): HeldFirearmModel { return { geometry: new Map(Object.values(PARTS).map(id => [id, handsPart(id)])) }; }
/** The Warden's longbow profile: the authored clocks and loose, the starter bow's feel, the rows' view, arrow and wind. */
export function pineLongbow(): BowProfile {
  return heldBowProfile({ ...BOW, draw: BOW_PROFILE.draw, loose: { ...BOW_PROFILE.spread, muzzle: BOW_PROFILE.muzzle },
    projectile: { ...BOW_PROFILE.flight, maxFlying: BOW_PROFILE.pool, substeps: BOW_PROFILE.substeps, lifetime: BOW_PROFILE.lifetime }, parent: 'weapon.bow', ...LONGBOW_LOOSE,
    swayMax: 1.4 * (Math.PI / 180), aimZoom: 1.6, arcColour: 0xffc070, arcMode: 'aim', zoomLook: false, inspectZ: -1.4, inspectHidesArms: true, transparentParts: true,
  }, longbowRows(), longbowModel());
}
