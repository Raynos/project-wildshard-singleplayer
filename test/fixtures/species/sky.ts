// Shipping declaration oracle captured from 539d18a9262151dbe28aa0656068065e9b3d0193:src/shards/far-reach/runtime/strikes.ts; no hand-written policy.
import type { StrikeSpec } from '../../../src/engine/ai/strikes';

export const RAM: StrikeSpec = { id: 'far.goat.ram', shape: { kind: 'lane', length: 4, width: 1.4 }, windup: 0.8, active: 0.5, recover: 0.9, cooldown: 3,
  range: 5, damage: 12, tags: ['creature.skyGoat'], weight: () => 1, motion: {} };

export const DIVE: StrikeSpec = { id: 'far.ray.dive', shape: { kind: 'sphere', radius: 1.9 }, windup: 1.1, active: 1.1, recover: 0.6, cooldown: 5,
  range: 14, damage: 10, tags: ['creature.driftRay'], units: 'world', weight: () => 1 };
