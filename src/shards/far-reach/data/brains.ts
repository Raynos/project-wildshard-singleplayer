import { RAM_DATA, DIVE_DATA, BURST_DATA } from './strikes';
import type { BrainedSpecies, speciesBrains } from '@wildshard/sdk/speciesBrains';
import LAYOUT from './layout.generated.json' with { type: 'json' };
import { SKY_GOAT_DATA, DRIFT_RAY_DATA, GALE_WISP_DATA, STORM_ROC_DATA } from './species';

/** Shipping rim-aware goat policy; the native spawn binds the island home and floor. */
export const GOAT_BRAIN = { id: 'far.brain.goat', kind: 'ram-grazer', strike: 'far.goat.ram',
  grazeSpeed: 1.2, ramSpeed: 7.5, noticeRadius: 9, rimMargin: 2.5, fallDrop: 1.5, levelTolerance: 2.5,
  threatSpeed: 1.6, wanderMinSeconds: 2, wanderMaxSeconds: 5, rampRate: 4 };
/** Shipping overhead circle/dive policy; each spawn supplies its existing authored orbit. */
export const RAY_BRAIN = { id: 'far.brain.ray', kind: 'orbit-diver', strike: 'far.ray.dive',
  circleSpeed: 8, hangAltitude: 9, stalkSpeed: 10, diveSpeed: 16, restSeconds: 6, noticeRadius: 40,
  giveUpRadius: 60, initialRestSeconds: 3, stalkMaxSeconds: 12, riseMargin: 2,
  targetHeight: 1.2, alignRadius: 3, alignTolerance: 1.6 };
/** Shipping wisp orbit/dart policy; the authorized native player impulse remains the contact recipe. */
export const WISP_BRAIN = { id: 'far.brain.wisp', kind: 'burst-flyer', strike: 'far.wisp.burst',
  circleSpeed: 5, dartSpeed: 13, noticeRadius: 14, shoveSpeed: 7, liftSpeed: 2.5, targetHeight: 1.2 };

/**
 * The Storm Roc's strikes: phase 1's stoop (a 3-D sphere dive from the storm onto the player's chest), phase 2's gale
 * wall (a wide lane of wind swept across the crown from its hover; it shoves you toward the rim, G24) and phase 3's wing
 * sweep round the dais, grounded.
 */
export const ROC_STRIKES: readonly [Parameters<typeof speciesBrains>[1][number], Parameters<typeof speciesBrains>[1][number], Parameters<typeof speciesBrains>[1][number]] = [
  { id: 'far.roc.stoop', shape: { kind: 'sphere', radius: 2.6 }, windup: 1.2, active: 1.2, recover: 0.8, cooldown: 4,
    range: 22, damage: 14, tags: ['creature.stormRoc'], units: 'world', weight: { kind: 'constant', value: 1 } },
  { id: 'far.roc.galeWall', shape: { kind: 'lane', length: 26, width: 6 }, windup: 1.5, active: 0.6, recover: 1.4, cooldown: 3.5,
    range: 30, damage: 12, tags: ['creature.stormRoc'], units: 'world', weight: { kind: 'constant', value: 1 } },
  { id: 'far.roc.sweep', shape: { kind: 'arc', radius: 4.5, halfAngle: 1.2 }, windup: 0.9, active: 0.3, recover: 1.1, cooldown: 2.2,
    range: 5, damage: 16, tags: ['creature.stormRoc'], units: 'world', weight: { kind: 'constant', value: 1 } },
];

/** The page's exact native motor, unlimited attack and environment-contact recipes; decisions invent none of these ports. */
export const SKY_BODY_ROWS = {
  ground: { kind: 'animal', motion: 'ground', attack: 'unlimited', stunned: 'look-hold', contact: { kind: 'environment', halfArc: 70 * Math.PI / 180 } },
  flight: { kind: 'animal', motion: 'flight', attack: 'unlimited', stunned: 'look-hold', contact: { kind: 'environment', halfArc: 70 * Math.PI / 180 } },
} as const;

/** Canonical gameplay profiles; each native body binds its actual island home and existing authority. */
const SKY_GOAT_PROFILE: BrainedSpecies = { ...SKY_GOAT_DATA, body: SKY_BODY_ROWS.ground, brain: { archetype: 'grazer' as const, data: { ...GOAT_BRAIN, kind: 'grazer' as const, pattern: 'wander-ram' as const } } };
const DRIFT_RAY_PROFILE: BrainedSpecies = { ...DRIFT_RAY_DATA, body: SKY_BODY_ROWS.flight, brain: { archetype: 'diver' as const, data: { ...RAY_BRAIN, kind: 'diver' as const, pattern: 'orbit' as const,
    home: LAYOUT.RAY_HOMES[0] ?? { x: 0, z: -24, r: 22, y: LAYOUT.DECK + 14 } } } };
const GALE_WISP_PROFILE: BrainedSpecies = { ...GALE_WISP_DATA, body: SKY_BODY_ROWS.flight, brain: { archetype: 'diver' as const, data: { ...WISP_BRAIN, kind: 'diver' as const, pattern: 'burst' as const,
    home: { x: LAYOUT.KEEPER.x, z: LAYOUT.KEEPER.z, r: 7, y: LAYOUT.KEEPER.y + 3 } } } };

/** Every native body declares its policy; the held encounter accesses the Roc through its catalogue. */
const STORM_ROC_PROFILE: BrainedSpecies = { ...STORM_ROC_DATA, body: SKY_BODY_ROWS.flight, brain: { archetype: 'decision', data: { script: 'far.roc.decision', actor: 'far.roc', perch: 'far.roc.perch', leanField: 'rocLean', bankField: 'rocBank',
  strikeEffects: [{ strike: 'far.roc.stoop', aimHeight: 1.2, speed: 0, lift: 0 }, { strike: 'far.roc.galeWall', aimHeight: 0, speed: 14, lift: 2 }] } } };
export const SKY_CREATURE_ROWS: readonly BrainedSpecies[] = [SKY_GOAT_PROFILE, DRIFT_RAY_PROFILE, GALE_WISP_PROFILE, STORM_ROC_PROFILE];
/** Existing page registration order, independently of the native roster's spawn order. */
export const SKY_PAGE_ROWS = [DRIFT_RAY_PROFILE, SKY_GOAT_PROFILE, GALE_WISP_PROFILE, STORM_ROC_PROFILE];
export const SKY_CREATURE_STRIKES = [RAM_DATA, DIVE_DATA, BURST_DATA, ...ROC_STRIKES];
/** Original page fallbacks; the owning catalogue lends each materialized body's actual home. */
export const SKY_PAGE_HOMES = {
  skyGoat: { x: LAYOUT.WINDMILL.x, z: LAYOUT.WINDMILL.z, r: LAYOUT.WINDMILL.r * LAYOUT.APOTHEM, y: LAYOUT.WINDMILL.y },
  driftRay: LAYOUT.RAY_HOMES[0] ?? { x: 0, z: -24, r: 22, y: LAYOUT.DECK + 14 },
  galeWisp: { x: LAYOUT.KEEPER.x, z: LAYOUT.KEEPER.z, r: 7, y: LAYOUT.KEEPER.y + 3 },
};
