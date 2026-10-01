import type { StrikeSpec } from '#engine';

const lane = (id: string, windup: number, width: number, speed: number, overshoot: number, damage: number, recover: number, range: number): StrikeSpec => ({
  id, shape: { kind: 'lane', width, length: 0 }, windup, active: 0, recover, cooldown: 0, range, damage,
  tags: ['creature.charge'], weight: () => 1,
  motion: { speed, track: 'lead', overshoot, skid: recover },
});
/** Authored lane rows; phase-dependent windups/speed multipliers remain the fight's policy. */
export const PINE_LANES = {
  ironhide: lane('strike.ironhide.charge', 0.9, 2.4, 12.5, 7, 30, 1.1, 1.7),
  blackpaw: lane('strike.blackpaw.charge', 0.75, 2.6, 10.5, 5, 28, 1.2, 1.6),
  imperial: lane('strike.imperial-bull.charge', 1, 2.8, 11, 8, 34, 1.3, 1.8),
  rival: lane('strike.imperial-bull.rival', 0.9, 2.4, 9.5, 6, 18, 1.4, 1.7),
  king: lane('strike.antler-king.last-light', 1.1, 5.2, 13, 10, 32, 1.6, 2),
  thrall: lane('strike.antler-king.thrall', 0.7, 2.4, 9, 5, 14, 1.2, 1.7),
};
