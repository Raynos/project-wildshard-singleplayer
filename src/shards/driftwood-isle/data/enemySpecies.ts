import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';
import { MONKEY_VARIANTS } from '../species/monkeyVariants';
import { CRAB_BRAIN_PROFILE, SAILOR_BRAIN_PROFILE, MONKEY_BRAIN_PROFILE } from './brains';

/** The island enemies' gameplay rows; native rigs, contacts, rise and perch recipes remain trusted adapters. */
export const DRIFTWOOD_ENEMY_SPECIES: BrainedSpecies[] = [
  {
    lockable: true, id: 'creature.crab', kind: 'crab', label: 'Reef crab', aggressive: true,
    walkSpeed: 0.5, chargeDamage: 10, sounds: { call: 'crab_click', hurt: 'crab_click', callEvery: [8, 25] },
    variants: [
      { id: 'small', label: 'Reef crab', weight: 75, rarity: 'common', scale: [0.78, 0.95], hp: 25 },
      { id: 'big', label: 'Big reef crab', weight: 25, rarity: 'uncommon', scale: [1.7, 1.9], hp: 70, mods: { chargeDamage: 14 } },
    ], tick: 'ai', brain: { archetype: 'stalker', data: CRAB_BRAIN_PROFILE },
  },
  {
    lockable: true, id: 'creature.monkey', kind: 'monkey', label: 'Coconut monkey', aggressive: true,
    walkSpeed: 1.2, chargeDamage: 6, sounds: { call: 'monkey_chatter', hurt: 'monkey_shriek', callEvery: [6, 18] },
    variants: MONKEY_VARIANTS, tick: 'ai', brain: { archetype: 'guardian', data: MONKEY_BRAIN_PROFILE },
  },
  {
    lockable: true, id: 'creature.sailor', kind: 'sailor', label: 'Drowned sailor', aggressive: true,
    walkSpeed: 1.1, chargeDamage: 14, corpseFade: 60,
    sounds: { call: 'sailor_groan', hurt: 'sailor_groan', callEvery: [12, 30] },
    variants: [{ id: 'sailor', label: 'Drowned sailor', weight: 100, rarity: 'uncommon', scale: [1, 1.05], hp: 60 }],
    tick: 'ai', brain: { archetype: 'guardian', data: SAILOR_BRAIN_PROFILE },
  },
];
