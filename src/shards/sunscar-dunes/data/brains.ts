import type { BrainedSpecies, SpeciesBrain } from '@wildshard/sdk/speciesBrains';
import type { StrikeData } from '@wildshard/sdk/species';
import { BASIN, RAY_HOME } from './layout';
import { DUNE_RAY, SWOOP_DATA } from './species/duneRay';
import { DUNE_STRIDER, CHARGE_DATA, HORNS_DATA } from './species/strider';
import { SKITTERER_DATA, BITE_DATA, SKITTER } from './species/skitterer';
import skitterer from '../behaviour/skitterer.json' with { type: 'json' };
import { MATRIARCH, MATRIARCH_DATA, MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA } from './species/matriarch';

/** Shipping strider challenge and exact charge/close utility, including native pose memory fields; six circling slots. */
export const STRIDER_BRAIN: SpeciesBrain = { archetype: 'challenge-grazer', phaseSlots: 6, data: { id: 'sunscar.brain.strider', kind: 'challenge-grazer',
  charge: 'sunscar.strider.charge', close: 'sunscar.strider.horns',
  noticeRadius: 24, chargeRadius: 17, loseRadius: 40, walkSpeed: 1.1, approachSpeed: 2.4, homeRadius: 16, faceSeconds: 0.7,
  circleRate: 0.05, farPreferenceRadius: 5, farWeight: 2, nearWeight: 0.2, closeWeight: 1, windupField: 'paw', recoveryField: 'winded' } };
/** Shipping home patrol round the tower and near-player swoop. */
export const RAY_BRAIN: SpeciesBrain = { archetype: 'patrol-diver', data: { id: 'sunscar.brain.ray', kind: 'patrol-diver', strike: 'sunscar.ray.swoop',
  home: { x: RAY_HOME.x, z: RAY_HOME.z },
  glideAltitude: 14, glideSpeed: 9, circleRadius: 20, patrolRadius: 34, patrolAltitude: 22,
  noticeRadius: 55, diveFrom: 38, diveSpeed: 15, climbAltitude: 17, climbSeconds: 2.6, diveMaxSeconds: 4.5,
  restSeconds: 3, targetHeight: 1.2, diveSlope: 0.35, climbSpeedBonus: 3, orbitLead: 0.55, heldField: 'held' } };
/**
 * The skitterer's burrow hunt as an admitted species script (behaviour/skitterer.as, compiled to behaviour/skitterer.json by
 * scripts/bake/species-scripts.mjs): its slots are its state (0 buried, 1 burst, 2 hunt, 3 retreat), clock and far time;
 * it writes its `burrow` pose memory and asks for its bite.
 */
export const SKITTERER_BRAIN: SpeciesBrain = { archetype: 'script', data: { id: 'sunscar.brain.skitterer', kind: 'script', module: skitterer.module,
  parameters: [SKITTER.wake, SKITTER.sleep, SKITTER.burst, SKITTER.run, SKITTER.ring, SKITTER.retreat, SKITTER.rebury, BITE_DATA.range ?? 0],
  slots: [0, 0, 0], memory: [{ field: 'burrow', initial: 1 }], maxSpeed: SKITTER.run, maxTurnRate: 8, strikes: [{ event: 1, strike: BITE_DATA.id }] } };
/**
 * The Dune Matriarch as a phased boss flyer (SF27): she circles the basin's heart, dives on the chest with her maw and
 * climbs away (phase II from the storm altitude and more often); from phase III she lies on the sand, crawls to 9 m and
 * sweeps her tail or buffets. Her fight (data/matriarchFight.ts MATRIARCH_FIGHT) writes `fight`, `rise` and `phase` on her memory.
 * Round 2 (seat B: the camera passed through her): her centre never drops under `skim` m, so at 3.6x her belly clears
 * the player's head; her 4 m strike sphere still reaches the chest 3 m below.
 */
export const MATRIARCH_BRAIN: SpeciesBrain = { archetype: 'phased-flyer', data: { id: 'sunscar.brain.matriarch', kind: 'phased-flyer',
  dive: [MAW_DATA.id], grounded: [TAIL_SWEEP_DATA.id, BUFFET_DATA.id], center: { x: BASIN.x, z: BASIN.z }, circleRadius: MATRIARCH.circleR, orbitLead: 0.5,
  altitudes: [MATRIARCH.alt, MATRIARCH.stormAlt, MATRIARCH.alt], restSeconds: [...MATRIARCH.every], initialRestSeconds: 3,
  speed: MATRIARCH.speed, diveSpeed: MATRIARCH.diveSpeed, climbSpeedBonus: 3, climbSeconds: MATRIARCH.climbFor, diveMaxSeconds: 5.5,
  skim: MATRIARCH.skim, diveSlope: 0.4, targetHeight: 1.2, groundedPhase: 2, crawlSpeed: MATRIARCH.crawl, lieAltitude: MATRIARCH.lieAlt, standOff: MATRIARCH.standOff,
  dormant: { from: MATRIARCH.groundAlt, to: MATRIARCH.alt, speed: 3, yawLead: 0.4, turn: 0.6 },
  turns: { circle: 1.1, dive: 2.4, climb: 1, grounded: 1.2 }, fields: { fight: 'fight', phase: 'phase', rise: 'rise' } } };
/** The admitted species script modules: each module's SHA-256 → the base64 its bake wrote (a plain JSON row). */
export const SIGNAL_MODULES: Readonly<Record<string, string>> = { [skitterer.module]: skitterer.bytes };

/**
 * Signal Dunes' species catalogue in home-kind order (SF27): every kind runs its declared brain (the ray, the skitterer's
 * admitted script, the strider and the Matriarch).
 */
export const SIGNAL_SPECIES: readonly BrainedSpecies[] = [{ ...DUNE_RAY, brain: RAY_BRAIN }, { ...SKITTERER_DATA, brain: SKITTERER_BRAIN }, { ...DUNE_STRIDER, brain: STRIDER_BRAIN }, { ...MATRIARCH_DATA, brain: MATRIARCH_BRAIN }];
/** Every strike row the catalogue's creatures use. */
export const SIGNAL_STRIKES: readonly StrikeData[] = [SWOOP_DATA, CHARGE_DATA, HORNS_DATA, BITE_DATA, MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA];
