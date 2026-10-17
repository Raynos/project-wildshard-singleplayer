import type { StrikeData } from '@wildshard/sdk/species';

/** The goat runner owns motion: the empty motion row preserves the native charge's distance stop. */
export const RAM_DATA: StrikeData = { id: 'far.goat.ram', shape: { kind: 'lane', length: 4, width: 1.4 },
  windup: 0.8, active: 0.5, recover: 0.9, cooldown: 3, range: 5, damage: 12,
  tags: ['creature.skyGoat'], weight: { kind: 'constant', value: 1 }, motion: {} };
/** The ray uses world-space sphere contact against the player's chest. */
export const DIVE_DATA: StrikeData = { id: 'far.ray.dive', shape: { kind: 'sphere', radius: 1.9 },
  windup: 1.1, active: 1.1, recover: 0.6, cooldown: 5, range: 14, damage: 10,
  tags: ['creature.driftRay'], units: 'world', weight: { kind: 'constant', value: 1 } };
/** The wisp's sphere strike; its existing burst policy owns the shove. */
export const BURST_DATA: StrikeData = { id: 'far.wisp.burst', shape: { kind: 'sphere', radius: 1.4 },
  windup: 0.7, active: 0.7, recover: 1.2, cooldown: 3.5, range: 9, damage: 6,
  tags: ['creature.galeWisp'], units: 'world', weight: { kind: 'constant', value: 1 } };
