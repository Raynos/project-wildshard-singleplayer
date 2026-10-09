// Shipping declaration oracle captured from 539d18a9262151dbe28aa0656068065e9b3d0193:src/shards/sunscar-dunes/runtime/species/matriarch.ts; no hand-written policy.
import type { StrikeSpec } from '../../../src/engine/ai/strikes';
import type { SpeciesRow } from '../../../src/engine/ai/species';
import { STRINGS } from '../../../src/shards/sunscar-dunes/data/strings';

export const MATRIARCH = { circleR: 30, alt: 18, stormAlt: 24, speed: 12, diveSpeed: 19, every: [5, 3.2, 0], climbFor: 2.4, crawl: 2.2, groundAlt: 0.9, skim: 4.2,
  /** Grounded she lies on the sand (`lieAlt`) and holds `standOff` m from the player (her centre): at 3.6× her nose is 6.4 m
   * ahead of it, so she fills the lower half of the view and the lash (7 m) still lands on her head and back. */
  lieAlt: 0.2, standOff: 9 } as const;

export const MATRIARCH_HP = 600;

export const MAW: StrikeSpec = { id: 'sunscar.matriarch.dive', shape: { kind: 'sphere', radius: 4 }, windup: 0.35, active: 0.5, recover: 0.6, cooldown: 2,
  range: 10, damage: 18, tags: ['creature.duneMatriarch'], units: 'world', weight: () => 1 };

export const TAIL_SWEEP: StrikeSpec = { id: 'sunscar.matriarch.tail', shape: { kind: 'ring', inner: 0, outer: 12 }, windup: 1.0, active: 0.25, recover: 1.0, cooldown: 4,
  range: 11.5, damage: 16, tags: ['creature.duneMatriarch'], units: 'world', weight: () => 2 };

export const BUFFET: StrikeSpec = { id: 'sunscar.matriarch.buffet', shape: { kind: 'arc', radius: 11, halfAngle: 0.8 }, windup: 0.7, active: 0.2, recover: 0.8, cooldown: 2.2,
  range: 10.5, damage: 12, tags: ['creature.duneMatriarch'], units: 'world', weight: () => 1 };

export const MATRIARCH_DATA: SpeciesRow = { id: 'sunscar.creature.duneMatriarch', kind: 'duneMatriarch', label: STRINGS.matriarch, aggressive: true, lockable: true, blood: false,
  // She is huge and circles the bowl far out: lock from 60 m (sol-lock).
  flight: { altitude: MATRIARCH.alt, above: 'ground', climbRate: 7, diveRate: 20, lockRange: 60 },
  variants: [{ id: 'matriarch', label: STRINGS.matriarch, weight: 1, rarity: 'legendary', scale: [3.6, 3.6], hp: MATRIARCH_HP }] };
