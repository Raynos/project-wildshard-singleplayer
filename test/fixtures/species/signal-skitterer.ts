// Shipping declaration oracle captured from 539d18a9262151dbe28aa0656068065e9b3d0193:src/shards/sunscar-dunes/runtime/species/skitterer.ts; no hand-written policy.
import type { StrikeSpec } from '../../../src/engine/ai/strikes';
import type { SpeciesRow } from '../../../src/engine/ai/species';
import { STRINGS } from '../../../src/shards/sunscar-dunes/data/strings';

export const SKITTER = { wake: 13, sleep: 34, burst: 0.55, run: 5.6, ring: 2.2, retreat: 1.1, rebury: 5 } as const;

export const BITE: StrikeSpec = { id: 'sunscar.skitterer.bite', shape: { kind: 'point', radius: 1.4 }, windup: 0.38, active: 0.15, recover: 0.45, cooldown: 1.3,
  range: 1.9, damage: 6, tags: ['creature.sandSkitterer'], weight: () => 1 };

export const SKITTERER_DATA: SpeciesRow = { id: 'sunscar.creature.sandSkitterer', kind: 'sandSkitterer', label: STRINGS.skitterer, aggressive: true, lockable: true, blood: false,
  variants: [{ id: 'dusk', label: STRINGS.skitterer, weight: 1, rarity: 'common', scale: [0.9, 1.1], hp: 24 }] };
