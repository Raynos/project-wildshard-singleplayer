import { BOW_PROFILE } from '../data/bowProfile';
/** The longbow's loose: m/s at brace + m/s more at full draw, the damage scale on the damage model's blow, the quiver. */
export const LONGBOW_LOOSE = { speedBase: BOW_PROFILE.speedBase, speedDraw: BOW_PROFILE.speedDraw, damageScale: BOW_PROFILE.damageScale, quiver: BOW_PROFILE.quiver, aimSpread: BOW_PROFILE.spread.aimMultiplier };
