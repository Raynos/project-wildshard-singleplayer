// Shipping declaration oracle captured from 539d18a9262151dbe28aa0656068065e9b3d0193:src/shards/far-reach/species/galeWisp.ts; no hand-written policy.
import type { StrikeSpec } from '../../../src/engine/ai/strikes';

export const BURST: StrikeSpec = { id: 'far.wisp.burst', shape: { kind: 'sphere', radius: 1.4 }, windup: 0.7, active: 0.7, recover: 1.2, cooldown: 3.5,
  range: 9, damage: 6, tags: ['creature.galeWisp'], units: 'world', weight: () => 1 };
