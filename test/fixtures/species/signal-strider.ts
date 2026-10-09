// Shipping declaration oracle captured from 539d18a9262151dbe28aa0656068065e9b3d0193:src/shards/sunscar-dunes/runtime/species/strider.ts; no hand-written policy.
import type { StrikeSpec } from '../../../src/engine/ai/strikes';
import type { SpeciesRow } from '../../../src/engine/ai/species';
import { STRINGS } from '../../../src/shards/sunscar-dunes/data/strings';

export const STRIDE = { notice: 24, charge: 17, walk: 1.1, approach: 2.4, homeR: 16, lose: 40, face: 0.7 } as const;

export const CHARGE: StrikeSpec = { id: 'sunscar.strider.charge', shape: { kind: 'lane', length: 13, width: 2.2 }, windup: 1.1, active: 1.2, recover: 1.8, cooldown: 3.5,
  range: STRIDE.charge, damage: 22, tags: ['creature.duneStrider'], motion: { speed: 11, overshoot: 3 }, weight: (c) => Math.hypot(c.target.x - c.actor.position.x, c.target.z - c.actor.position.z) > 5 ? 2 : 0.2 };

export const HORNS: StrikeSpec = { id: 'sunscar.strider.horns', shape: { kind: 'arc', radius: 3.4, halfAngle: 0.9 }, windup: 0.6, active: 0.2, recover: 0.8, cooldown: 1.6,
  range: 3.2, damage: 12, tags: ['creature.duneStrider'], weight: () => 1 };

export const DUNE_STRIDER: SpeciesRow = { id: 'sunscar.creature.duneStrider', kind: 'duneStrider', label: STRINGS.strider, aggressive: true, lockable: true, blood: false,
  variants: [{ id: 'dusk', label: STRINGS.strider, weight: 1, rarity: 'uncommon', scale: [0.95, 1.1], hp: 150 }] };
