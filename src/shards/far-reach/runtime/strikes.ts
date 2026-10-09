import type { StrikeSpec } from '@wildshard/engine/ai/strikes';

// The goat's and the ray's strike declarations, renderer-free (SF72): the shipping species rows and policies and the
// headless runtime read the same constants.
/** The ram: a short lane straight ahead, telegraphed by a head-down windup. */
export const RAM: StrikeSpec = { id: 'far.goat.ram', shape: { kind: 'lane', length: 4, width: 1.4 }, windup: 0.8, active: 0.5, recover: 0.9, cooldown: 3,
  range: 5, damage: 12, tags: ['creature.skyGoat'], weight: () => 1 };
/** The dive: a 3-D sphere contact around the ray, tested against the player's chest (ENGINE §19 "Short flyer"). */
export const DIVE: StrikeSpec = { id: 'far.ray.dive', shape: { kind: 'sphere', radius: 1.9 }, windup: 1.1, active: 1.1, recover: 0.6, cooldown: 5,
  range: 14, damage: 10, tags: ['creature.driftRay'], units: 'world', weight: () => 1 };
