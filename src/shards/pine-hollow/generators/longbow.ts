import { BOW } from '@wildshard/game/weapons/starterBowProfile';
import { BOW_PROFILE } from '../data/bowProfile';
import hands from '../data/handsPool.generated.json' with { type: 'json' };
import { LONGBOW_MATERIAL, ARROW_MATERIAL, LONGBOW_POSES } from './longbowPresentation';

const { wind, ...STARTER_BOW } = BOW;
void wind;

/** Original longbow binding compiled beside its borrowed hand/stave pool. */
export const PINE_HELD_BOW = {
  base: { ...STARTER_BOW, draw: BOW_PROFILE.draw, loose: { ...BOW_PROFILE.spread, muzzle: BOW_PROFILE.muzzle },
    projectile: { ...BOW_PROFILE.flight, maxFlying: BOW_PROFILE.pool, substeps: BOW_PROFILE.substeps, lifetime: BOW_PROFILE.lifetime },
    parent: 'weapon.bow', speedBase: BOW_PROFILE.speedBase, speedDraw: BOW_PROFILE.speedDraw, damageScale: BOW_PROFILE.damageScale,
    quiver: BOW_PROFILE.quiver, aimSpread: BOW_PROFILE.spread.aimMultiplier,
    swayMax: 1.4 * (Math.PI / 180), aimZoom: 1.6, arcColour: 0xffc070, arcMode: 'aim', zoomLook: false,
    inspectZ: -1.4, inspectHidesArms: true, transparentParts: true },
  bow: { bake: hands.bow,
    parts: { stave: 'bow-stave', nocked: 'bow-arrow-nocked', rightFist: 'bow-right-fist', leftSleeve: 'bow-left-sleeve', rightSleeve: 'bow-right-sleeve', arrow: 'bow-arrow' },
    materials: { bow: { name: 'longbow', look: LONGBOW_MATERIAL }, arrow: { name: 'longbow-arrow', look: ARROW_MATERIAL } },
    arrow: { ...BOW_PROFILE.flight, bury: 0.09, recover: 0.7, maxFlying: BOW_PROFILE.pool, maxStuck: 48 },
    wind: { base: 1.2, gust: 7 }, poses: LONGBOW_POSES },
};
