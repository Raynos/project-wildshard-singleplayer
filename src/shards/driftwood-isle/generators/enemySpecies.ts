import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';
import { STRIKES as DRIFTWOOD_STRIKE_ROWS } from './strikeRows';
import * as authoredSpeciesActions from './speciesContactRows';
import { MONKEY_VARIANTS } from './monkeyVariants';
import { CRAB_BRAIN_PROFILE, SAILOR_BRAIN_PROFILE, MONKEY_BRAIN_PROFILE } from './brains';

const { CRAB_ACTIONS, SAILOR_ACTIONS } = authoredSpeciesActions;

/** One authored gameplay definition per enemy; renderer and native policies retain their own callbacks. */
export const ENEMY_SPECIES_METADATA: Record<'crab' | 'monkey' | 'sailor' | 'captain', Omit<BrainedSpecies, 'brain' | 'body'>> = {
  crab: {
    lockable: true, id: 'creature.crab', kind: 'crab', label: 'Reef crab', aggressive: true,
    walkSpeed: 0.5, chargeDamage: 10, sounds: { call: 'crab_click', hurt: 'crab_click', callEvery: [8, 25] },
    variants: [
      { id: 'small', label: 'Reef crab', weight: 75, rarity: 'common', scale: [0.78, 0.95], hp: 25 },
      { id: 'big', label: 'Big reef crab', weight: 25, rarity: 'uncommon', scale: [1.7, 1.9], hp: 70, mods: { chargeDamage: 14 } },
    ], tick: 'ai',
  },
  monkey: {
    lockable: true, id: 'creature.monkey', kind: 'monkey', label: 'Coconut monkey', aggressive: true,
    walkSpeed: 1.2, chargeDamage: 6, sounds: { call: 'monkey_chatter', hurt: 'monkey_shriek', callEvery: [6, 18] },
    variants: MONKEY_VARIANTS, tick: 'ai',
  },
  sailor: {
    lockable: true, id: 'creature.sailor', kind: 'sailor', label: 'Drowned sailor', aggressive: true,
    walkSpeed: 1.1, chargeDamage: 14, corpseFade: 60,
    sounds: { call: 'sailor_groan', hurt: 'sailor_groan', callEvery: [12, 30] },
    variants: [{ id: 'sailor', label: 'Drowned sailor', weight: 100, rarity: 'uncommon', scale: [1, 1.05], hp: 60 }],
    tick: 'ai',
  },
  captain: {
    lockable: true, id: 'creature.captain', kind: 'captain', label: 'The Drowned Captain', aggressive: true,
    walkSpeed: 1.2, chargeDamage: 24, corpseFade: 90,
    sounds: { call: 'sailor_groan', hurt: 'sailor_groan', callEvery: [8, 20] },
    variants: [{ id: 'captain', label: 'The Drowned Captain', weight: 100, rarity: 'uncommon', scale: [1.35, 1.35], hp: 320 }],
  },
};

/** The same three admitted decision families; the captain retains its existing fight owner. */
export const DRIFTWOOD_ENEMY_SPECIES: BrainedSpecies[] = [
  { ...ENEMY_SPECIES_METADATA.crab, body: { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'environment', halfArc: 70 * Math.PI / 180 }, actions: CRAB_ACTIONS }, brain: { archetype: 'stalker', data: CRAB_BRAIN_PROFILE } },
  { ...ENEMY_SPECIES_METADATA.monkey, brain: { archetype: 'guardian', data: MONKEY_BRAIN_PROFILE } },
  { ...ENEMY_SPECIES_METADATA.sailor, body: { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'environment', halfArc: 70 * Math.PI / 180 }, actions: SAILOR_ACTIONS }, brain: { archetype: 'guardian', data: SAILOR_BRAIN_PROFILE } },
];

/** The canonical contact rows resolved while this existing catalogue is admitted. */
export const DRIFTWOOD_ENEMY_STRIKES: { id: string; shape: { kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; }; windup: number; active: number; recover: number; cooldown: number; range: number | null; damage: number; tags: `${string}.${string}`[]; weight: { kind: "constant"; value: number; } | { kind: "horizontal-distance"; above: number; far: number; near: number; }; units?: "actor" | "world"; alternatives?: ({ kind: "arc"; radius: number; halfAngle: number; yawOffset?: number; } | { kind: "lane"; length: number; width: number; } | { kind: "ring"; inner: number; outer: number; } | { kind: "wedge"; length: number; halfAngle: number; } | { kind: "point"; radius: number; exclusive?: boolean; } | { kind: "sphere"; radius: number; })[]; motion?: { speed?: number; delay?: number; track?: "none" | "lead" | "follow"; overshoot?: number; skid?: number; }; eligibility?: { maxDy?: number; jumpDodges?: boolean; }; }[] = Object.values(DRIFTWOOD_STRIKE_ROWS);
