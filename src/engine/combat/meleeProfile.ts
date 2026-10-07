import type { EquipmentRow } from './Equipment';
import type { SwordMoveSet, SwordFraming } from './view/melee';

/** Numeric camera lag, bob and sway parameters consumed by a weapon view strategy. */
export interface ViewmodelFeel {
  lag: { gain: number; clampYaw: number; clampPitch: number; k: number; c: number; posYaw: number; posPitch: number };
  bob: { x: number; y: number; rz: number; rx: number };
  sway: { ax: number; fx: number; ay: number; fy: number };
  fovHip: number; portraitFov?: number;
}
/** Authored contact, sweep, combo and view parameters for the generic melee family. */
export interface MeleeProfile extends EquipmentRow {
  family: 'melee'; parent?: string;
  damage: number; reach: number; swingScale: number;
  portraitPullX: number; framing: SwordFraming; feel: ViewmodelFeel;
  moves?: SwordMoveSet;
  cooldown: number; comboGap: number; chainLag: number; heavyCharge: number; chargeBlend: number;
  lunge: { range: number; heavyRange: number; cone: number; stop: number; speed: number; minTime: number; maxTime: number };
  sweep: { rays: number; extensions: readonly number[]; step: number; maxSamples: number; maxHits: number };
  trail: { samples: number; subdivisions: number };
  dodgeKick: { kick: number; k: number; c: number }; armFollow: number;
}

/** Internal rows use a discriminated family field; legacy UI-only rows retain default sword tuning. */
export function isMeleeProfile(row: EquipmentRow): row is MeleeProfile {
  return 'family' in row && row.family === 'melee';
}

