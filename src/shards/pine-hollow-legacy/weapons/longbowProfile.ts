import type { BowProfile } from '@wildshard/sdk/weapons/bowProfile';
import { BOW } from '@wildshard/game/weapons/starterBowProfile';

import { WIND_DIR, windGustAt } from '@wildshard/engine/world/wind';
import { POSE, buildLongbow, arrowKind, ARROW_LEN } from './longbowView';
import { LONGBOW_LOOSE } from './longbowFlight';

export const pineWind: BowProfile['wind'] = {
  vecAt: (x, z, out) => { const s = 1.2 + 7 * windGustAt(x, z); out.x = WIND_DIR.x * s; out.z = WIND_DIR.z * s; return out; },
};
export const LONGBOW: BowProfile = {
  ...BOW, parent: 'weapon.bow', ...LONGBOW_LOOSE, swayMax: 1.4 * (Math.PI / 180),
  aimZoom: 1.6, arcColour: 0xffc070, arcMode: 'aim', zoomLook: false,
  inspectZ: -1.4, inspectHidesArms: true, transparentParts: true,
  poses: POSE, arrowX: -0.017, arrowY: 0.052, arrowLength: ARROW_LEN, build: buildLongbow, arrow: arrowKind, wind: pineWind,
};
