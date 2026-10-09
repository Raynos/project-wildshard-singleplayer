import type { SpeciesData, StrikeData } from '@wildshard/sdk/species';
import { STRINGS } from '../strings';

export const SKITTER = { wake: 13, sleep: 34, burst: 0.55, run: 5.6, ring: 2.2, retreat: 1.1, rebury: 5 } as const;

export const BITE_DATA: StrikeData = { id: 'sunscar.skitterer.bite', shape: { kind: 'point', radius: 1.4 }, windup: 0.38, active: 0.15, recover: 0.45, cooldown: 1.3,
  range: 1.9, damage: 6, tags: ['creature.sandSkitterer'], weight: { kind: 'constant', value: 1 } };

export const SKITTERER_DATA: SpeciesData = { id: 'sunscar.creature.sandSkitterer', kind: 'sandSkitterer', label: STRINGS.skitterer, aggressive: true, lockable: true, blood: false,
  variants: [{ id: 'dusk', label: STRINGS.skitterer, weight: 1, rarity: 'common', scale: [0.9, 1.1], hp: 24 }] };

