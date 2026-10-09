// Shipping declaration oracle captured from 539d18a9262151dbe28aa0656068065e9b3d0193:src/shards/far-reach/runtime/stormRocBrain.ts; no hand-written policy.
import type { StrikeSpec } from '../../../src/engine/ai/strikes';

export const STOOP: StrikeSpec = { id: 'far.roc.stoop', shape: { kind: 'sphere', radius: 2.6 }, windup: 1.2, active: 1.2, recover: 0.8, cooldown: 4,
  range: 22, damage: 14, tags: ['creature.stormRoc'], units: 'world', weight: () => 1 };

export const GALE_WALL: StrikeSpec = { id: 'far.roc.galeWall', shape: { kind: 'lane', length: 26, width: 6 }, windup: 1.5, active: 0.6, recover: 1.4, cooldown: 3.5,
  range: 30, damage: 12, tags: ['creature.stormRoc'], units: 'world', weight: () => 1 };

export const SWEEP: StrikeSpec = { id: 'far.roc.sweep', shape: { kind: 'arc', radius: 4.5, halfAngle: 1.2 }, windup: 0.9, active: 0.3, recover: 1.1, cooldown: 2.2,
  range: 5, damage: 16, tags: ['creature.stormRoc'], units: 'world', weight: () => 1 };
