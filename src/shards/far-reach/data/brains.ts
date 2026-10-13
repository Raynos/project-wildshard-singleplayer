import { CROWN_STONES } from './crownLayout';
import { STORM } from './storm';
import { RAM_DATA, DIVE_DATA, BURST_DATA } from './strikes';
import type { BrainedSpecies, speciesBrains } from '@wildshard/sdk/speciesBrains';
import { CROWN, DAIS, ROC, RAY_HOMES, DECK, KEEPER, WINDMILL, APOTHEM } from './layout';
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

/**
 * The Storm Roc's body as a phased raptor (SF27; its perch, the top of the crown ring's tallest stone facing into the
 * storm's wind, is placed by runtime/stormRocBrain.ts). It laps the dais 13 m out at 10 m/s, closes at up to 12 m/s and
 * stoops at 20. The take-off (E399 rounds 8-13): 4 s off the perch, gathering 1.6 m/s, swinging round onto the player at
 * 0.15 rad/s and leaning up to 0.35 rad into the swing. Phase 1 hangs 10 m over the player and stoops on their chest;
 * phase 2 hovers at wall height, holds off 14 m (backing away inside it) and sweeps the gale wall, which shoves 14 m/s
 * along its lane and 2 m/s up; phase 3 stands on the dais, laps a tight circle at a 2.4 m/s walk and walks up to sweep.
 */
export const ROC_BRAIN = { id: 'far.brain.roc', kind: 'phased-raptor',
  lap: { x: ROC.x, z: ROC.z, r: ROC.r, y: ROC.y }, speeds: { circle: 10, stalk: 12, dive: 20 },
  takeoff: { seconds: 4, speed: 1.6, turn: 0.15, bank: 0.35 }, firstRest: 2,
  turns: { perch: 2, circle: 2, stalk: 3, strike: 4 }, fields: { lean: 'rocLean', bank: 'rocBank' },
  phases: [
    { strike: 'far.roc.stoop', altitude: ROC.y, aimHeight: 1.2, orbit: { x: ROC.x, z: ROC.z, r: ROC.r, speed: 10 },
      stalk: { standOff: 2.5, retreat: false, speed: null, above: 10, ready: { kind: 'over', radius: 4, height: 2 } }, dive: true, shove: null, rest: 2.4 },
    { strike: 'far.roc.galeWall', altitude: CROWN.y + 7, aimHeight: 0, orbit: { x: ROC.x, z: ROC.z, r: ROC.r, speed: 10 },
      stalk: { standOff: 14, retreat: true, speed: null, above: null, ready: { kind: 'band', tolerance: 3 } }, dive: false, shove: { speed: 14, lift: 2 }, rest: 2.4 },
    { strike: 'far.roc.sweep', altitude: CROWN.y + DAIS.h + 0.05, aimHeight: 0, orbit: { x: DAIS.x, z: DAIS.z, r: DAIS.r * 0.4, speed: 2.4 },
      stalk: { standOff: 3, retreat: false, speed: 2.4, above: null, ready: { kind: 'range' } }, dive: false, shove: null, rest: 1.2 },
  ] };

/** The page's exact native motor, unlimited attack and environment-contact recipes; decisions invent none of these ports. */
export const SKY_BODY_ROWS = {
  ground: { kind: 'animal', motion: 'ground', attack: 'unlimited', stunned: 'look-hold', contact: { kind: 'environment', halfArc: 70 * Math.PI / 180 } },
  flight: { kind: 'animal', motion: 'flight', attack: 'unlimited', stunned: 'look-hold', contact: { kind: 'environment', halfArc: 70 * Math.PI / 180 } },
} as const;

/** Canonical gameplay profiles; each native body binds its actual island home and existing authority. */
const SKY_GOAT_PROFILE: BrainedSpecies = { ...SKY_GOAT_DATA, body: SKY_BODY_ROWS.ground, brain: { archetype: 'grazer' as const, data: { ...GOAT_BRAIN, kind: 'grazer' as const, pattern: 'wander-ram' as const } } };
const DRIFT_RAY_PROFILE: BrainedSpecies = { ...DRIFT_RAY_DATA, body: SKY_BODY_ROWS.flight, brain: { archetype: 'diver' as const, data: { ...RAY_BRAIN, kind: 'diver' as const, pattern: 'orbit' as const,
    home: RAY_HOMES[0] ?? { x: 0, z: -24, r: 22, y: DECK + 14 } } } };
const GALE_WISP_PROFILE: BrainedSpecies = { ...GALE_WISP_DATA, body: SKY_BODY_ROWS.flight, brain: { archetype: 'diver' as const, data: { ...WISP_BRAIN, kind: 'diver' as const, pattern: 'burst' as const,
    home: { x: KEEPER.x, z: KEEPER.z, r: 7, y: KEEPER.y + 3 } } } };
export const SKY_SPECIES_BRAINS: readonly BrainedSpecies[] = [SKY_GOAT_PROFILE, DRIFT_RAY_PROFILE, GALE_WISP_PROFILE];

const tallest = CROWN_STONES.reduce((best, stone) => stone.h > best.h ? stone : best);
const perch = { x: tallest.x, y: CROWN.y + tallest.h + 0.6, z: tallest.z };
const spin = Math.sign(STORM.layers[0].spin), dx = perch.x - CROWN.x, dz = perch.z - (CROWN.z - STORM.ahead);
/** The Roc perches on the actual tallest stone, facing into the authored storm wind; no live calculation or owner grants. */
export const ROC_PROFILE = { ...ROC_BRAIN, perch: { ...perch, yaw: Math.atan2(-spin * dz, spin * dx) } };

/** Every native body declares its policy; the held encounter accesses the Roc through its catalogue. */
const STORM_ROC_PROFILE: BrainedSpecies = { ...STORM_ROC_DATA, body: SKY_BODY_ROWS.flight, brain: { archetype: 'raptor', data: ROC_PROFILE } };
export const SKY_CREATURE_ROWS: readonly BrainedSpecies[] = [...SKY_SPECIES_BRAINS, STORM_ROC_PROFILE];
/** Existing page registration order, independently of the native roster's spawn order. */
export const SKY_PAGE_SPECIES = ['driftRay', 'skyGoat', 'galeWisp', 'stormRoc'] as const;
export const SKY_PAGE_ROWS = [DRIFT_RAY_PROFILE, SKY_GOAT_PROFILE, GALE_WISP_PROFILE, STORM_ROC_PROFILE];
export const SKY_CREATURE_STRIKES = [RAM_DATA, DIVE_DATA, BURST_DATA, ...ROC_STRIKES];
/** Original page fallbacks; the owning catalogue lends each materialized body's actual home. */
export const SKY_PAGE_HOMES = {
  skyGoat: { x: WINDMILL.x, z: WINDMILL.z, r: WINDMILL.r * APOTHEM, y: WINDMILL.y },
  driftRay: RAY_HOMES[0] ?? { x: 0, z: -24, r: 22, y: DECK + 14 },
  galeWisp: { x: KEEPER.x, z: KEEPER.z, r: 7, y: KEEPER.y + 3 },
};
