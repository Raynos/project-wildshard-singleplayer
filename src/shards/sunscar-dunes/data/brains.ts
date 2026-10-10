import type { BrainedSpecies, SpeciesBrain } from '@wildshard/sdk/speciesBrains';
import type { StrikeData } from '@wildshard/sdk/species';
import { RAY_HOME } from './layout';
import { DUNE_RAY, SWOOP_DATA } from './species/duneRay';
import { DUNE_STRIDER, CHARGE_DATA, HORNS_DATA } from './species/strider';
import { SKITTERER_DATA, BITE_DATA, SKITTER } from './species/skitterer';
import skitterer from '../behaviour/skitterer.json' with { type: 'json' };
import { MATRIARCH_DATA, MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA } from './species/matriarch';

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
/** The admitted species script modules by hash (base64 from the bake). */
export const SIGNAL_MODULES: ReadonlyMap<string, string> = new Map([[skitterer.module, skitterer.bytes]]);

/**
 * Signal Dunes' species catalogue in home-kind order (SF27): the ray, the skitterer and the strider run their declared
 * brains; the Matriarch's unique policy stays in the runtime (runtime/species/matriarch.ts).
 */
export const SIGNAL_SPECIES: readonly BrainedSpecies[] = [{ ...DUNE_RAY, brain: RAY_BRAIN }, { ...SKITTERER_DATA, brain: SKITTERER_BRAIN }, { ...DUNE_STRIDER, brain: STRIDER_BRAIN }, MATRIARCH_DATA];
/** Every strike row the catalogue's creatures use. */
export const SIGNAL_STRIKES: readonly StrikeData[] = [SWOOP_DATA, CHARGE_DATA, HORNS_DATA, BITE_DATA, MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA];
