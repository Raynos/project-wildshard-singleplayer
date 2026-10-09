import type { SpeciesData, StrikeData } from '@wildshard/sdk/species';
import { STRINGS } from '../strings';
import type { SpeciesClips } from '@wildshard/sdk/species/clips';

export const MATRIARCH = { circleR: 30, alt: 18, stormAlt: 24, speed: 12, diveSpeed: 19, every: [5, 3.2, 0], climbFor: 2.4, crawl: 2.2, groundAlt: 0.9, skim: 4.2,
  /** Grounded she lies on the sand (`lieAlt`) and holds `standOff` m from the player (her centre): at 3.6× her nose is 6.4 m
   * ahead of it, so she fills the lower half of the view and the lash (7 m) still lands on her head and back. */
  lieAlt: 0.2, standOff: 9 } as const;

export const MATRIARCH_HP = 600;

export const MAW_DATA: StrikeData = { id: 'sunscar.matriarch.dive', shape: { kind: 'sphere', radius: 4 }, windup: 0.35, active: 0.5, recover: 0.6, cooldown: 2,
  range: 10, damage: 18, tags: ['creature.duneMatriarch'], units: 'world', weight: { kind: 'constant', value: 1 } };

export const TAIL_SWEEP_DATA: StrikeData = { id: 'sunscar.matriarch.tail', shape: { kind: 'ring', inner: 0, outer: 12 }, windup: 1.0, active: 0.25, recover: 1.0, cooldown: 4,
  range: 11.5, damage: 16, tags: ['creature.duneMatriarch'], units: 'world', weight: { kind: 'constant', value: 2 } };

export const BUFFET_DATA: StrikeData = { id: 'sunscar.matriarch.buffet', shape: { kind: 'arc', radius: 11, halfAngle: 0.8 }, windup: 0.7, active: 0.2, recover: 0.8, cooldown: 2.2,
  range: 10.5, damage: 12, tags: ['creature.duneMatriarch'], units: 'world', weight: { kind: 'constant', value: 1 } };

export const MATRIARCH_DATA: SpeciesData = { id: 'sunscar.creature.duneMatriarch', kind: 'duneMatriarch', label: STRINGS.matriarch, aggressive: true, lockable: true, blood: false,
  // She is huge and circles the bowl far out: lock from 60 m (sol-lock).
  flight: { altitude: MATRIARCH.alt, above: 'ground', climbRate: 7, diveRate: 20, lockRange: 60 },
  variants: [{ id: 'matriarch', label: STRINGS.matriarch, weight: 1, rarity: 'legendary', scale: [3.6, 3.6], hp: MATRIARCH_HP }] };

/** Grounded (her brain's phase 2 on): she lies on the sand. */
const GROUNDED = { alive: true, mem: { key: 'phase', atLeast: 2 } } as const;
const BUFFET = { attacking: true } as const;
/** The Matriarch's clips (SHARD-PLATFORM M3): grounded, the head dips and the tail lifts to sweep. */
export const MATRIARCH_CLIPS: SpeciesClips = [
  { bone: 'head', channel: 'rotation.x', cases: [{ when: GROUNDED, sum: [0.22] }, { sum: [0] }] },
  // Slow beats aloft; grounded the wings drape and lift into a buffet; dead they hang (the left mirrors the right).
  { bone: 'wingL', channel: 'rotation.z', cases: [{ when: { alive: false }, sum: [0.4] },
    { when: GROUNDED, sum: [0.14, { of: [{ wave: 't', rate: 1.1 }, -0.06] }, { when: BUFFET, of: [{ attack: true }, 0.4] }] },
    { sum: [{ of: [{ wave: 't', rate: 1.5 }, -0.34] }] }] },
  { bone: 'wingR', channel: 'rotation.z', cases: [{ when: { alive: false }, sum: [-0.4] },
    { when: GROUNDED, sum: [-0.14, { of: [{ wave: 't', rate: 1.1 }, 0.06] }, { when: BUFFET, of: [{ attack: true }, -0.4] }] },
    { sum: [{ of: [{ wave: 't', rate: 1.5 }, 0.34] }] }] },
  { bone: 'tail', channel: 'rotation.y', cases: [{ when: GROUNDED, sum: [{ of: [{ wave: 't', rate: 0.9 }, 0.3] }] },
    { when: { alive: true }, sum: [{ of: [{ wave: 't', rate: 1.2 }, 0.3] }] }, { sum: [0] }] },
  { bone: 'tail', channel: 'rotation.x', cases: [{ when: { ...GROUNDED, ...BUFFET }, sum: [{ of: [{ attack: true }, -0.7] }] }, { sum: [0] }] },
];
