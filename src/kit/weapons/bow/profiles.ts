import { wind } from '#engine';
import { POSE, buildRecurve, arrowKind, ARROW_LEN } from './recurve';
import type { BowProfile } from './profile';

export const BOW: BowProfile = {
  family: 'bow', quiver: 24, swayMax: 1.5 * (Math.PI / 180), speedBase: 30, speedDraw: 28, damageScale: 1.2,
  aimZoom: 2, aimVmZoom: 0.85, aimSway: 0.5, aimSpread: 0.5, aimIn: 10,
  arcFrom: 0.25, arcColour: 0x8fe3ff, arcMode: 'setting', zoomLook: true,
  inspectZ: -0.5, inspectHidesArms: false, transparentParts: false, vmScale: 0.72,
  poses: POSE, arrowX: 0.02, arrowY: 0.058, arrowLength: ARROW_LEN, build: buildRecurve, arrow: arrowKind, wind,
};
