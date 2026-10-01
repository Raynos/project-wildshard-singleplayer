import { WOODEN_SWORD, IRON_SWORD } from '../equipment';
import { REST, CHARGE, SPRINT, COMBO, HEAVY } from './moves';
import type { MeleeProfile } from './Melee';

export const SWORD_WOOD: MeleeProfile = {
  ...WOODEN_SWORD, family: 'melee', damage: 12, reach: 2.2, swingScale: 1,
  portraitPullX: 0.32, framing: { shrink: 0.33, dx: -0.03, dy: -0.055, tilt: 0.36, yaw: -0.02 },
  moves: { rest: REST, charge: CHARGE, sprint: SPRINT, combo: COMBO, heavy: HEAVY },
  cooldown: 0.08, comboGap: 0.6, chainLag: 0.02, heavyCharge: 0.45, chargeBlend: 0.16,
  lunge: { range: 4, heavyRange: 5, cone: 25 * Math.PI / 180, stop: 1.1, speed: 22, minTime: 0.08, maxTime: 0.15 },
  sweep: { rays: 5, extensions: [0.12, 0.24, 0.36, 0.48], step: 0.09, maxSamples: 6, maxHits: 8 },
  trail: { samples: 20, subdivisions: 3 }, dodgeKick: { kick: 2.2, k: 160, c: 14 }, armFollow: 0.45,
  feel: { lag: { gain: 0.5, clampYaw: 0.12, clampPitch: 0.1, k: 220, c: 20, posYaw: 0.25, posPitch: 0.2 },
    bob: { x: 0.018, y: 0.014, rz: 0.02, rx: 0.012 }, sway: { ax: 0.003, fx: 0.7, ay: 0.0025, fy: 1.1 }, fovHip: 72 },
};
export const SWORD_IRON: MeleeProfile = { ...SWORD_WOOD, ...IRON_SWORD, parent: SWORD_WOOD.id, damage: 28 };
