import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';
import type { StrikeData } from '@wildshard/sdk/species';
import LAYOUT from './layout.generated.json' with { type: 'json' };
import { DUNE_RAY, SWOOP_DATA } from './species/duneRay';
import { DUNE_STRIDER, CHARGE_DATA, HORNS_DATA } from './species/strider';
import { SKITTERER_DATA, BITE_DATA, SKITTER } from './species/skitterer';
import skitterer from '../behaviour/skitterer.json' with { type: 'json' };
import { MATRIARCH_DATA, MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA } from './species/matriarch';

/** Shipping strider challenge and exact charge/close utility, including native pose memory fields; six circling slots. */
export const STRIDER_BRAIN: NonNullable<BrainedSpecies['brain']> = { archetype: 'grazer', phaseSlots: 6, data: { id: 'sunscar.brain.strider', kind: 'grazer', pattern: 'circle-challenge',
  charge: 'sunscar.strider.charge', close: 'sunscar.strider.horns',
  noticeRadius: 24, chargeRadius: 17, loseRadius: 40, walkSpeed: 1.1, approachSpeed: 2.4, homeRadius: 16, faceSeconds: 0.7,
  circleRate: 0.05, farPreferenceRadius: 5, farWeight: 2, nearWeight: 0.2, closeWeight: 1, windupField: 'paw', recoveryField: 'winded' } };
/** Shipping home patrol round the tower and near-player swoop. */
export const RAY_BRAIN: NonNullable<BrainedSpecies['brain']> = { archetype: 'diver', data: { id: 'sunscar.brain.ray', kind: 'diver', pattern: 'patrol', strike: 'sunscar.ray.swoop',
  home: { x: LAYOUT.RAY_HOME.x, z: LAYOUT.RAY_HOME.z },
  glideAltitude: 14, glideSpeed: 9, circleRadius: 20, patrolRadius: 34, patrolAltitude: 22,
  noticeRadius: 55, diveFrom: 38, diveSpeed: 15, climbAltitude: 17, climbSeconds: 2.6, diveMaxSeconds: 4.5,
  restSeconds: 3, targetHeight: 1.2, diveSlope: 0.35, climbSpeedBonus: 3, orbitLead: 0.55, heldField: 'held' } };
/**
 * The skitterer's burrow hunt as an admitted species script (behaviour/skitterer.as, compiled to behaviour/skitterer.json by
 * scripts/bake/species-scripts.mjs): its slots are its state (0 buried, 1 burst, 2 hunt, 3 retreat), clock and far time;
 * it writes its `burrow` pose memory and asks for its bite.
 */
export const SKITTERER_BRAIN: NonNullable<BrainedSpecies['brain']> = { archetype: 'script', data: { id: 'sunscar.brain.skitterer', kind: 'script', module: skitterer.module,
  parameters: [SKITTER.wake, SKITTER.sleep, SKITTER.burst, SKITTER.run, SKITTER.ring, SKITTER.retreat, SKITTER.rebury, BITE_DATA.range ?? 0],
  slots: [0, 0, 0], memory: [{ field: 'burrow', initial: 1 }], maxSpeed: SKITTER.run, maxTurnRate: 8, strikes: [{ event: 1, strike: BITE_DATA.id }] } };
/** Decisions run on the existing spawned body; its encounter owns these marks. */
export const MATRIARCH_BRAIN: NonNullable<BrainedSpecies['brain']> = { archetype: 'decision', data: { script: 'sunscar.matriarch.decision', actor: 'sunscar.matriarch',
  marks: { fight: 'fight', phase: 'phase' }, idle: { move: 'sunscar.matriarch.rise', progress: 'rise' },
  strikeEffects: [{ strike: MAW_DATA.id, aimHeight: 1.2, speed: 0, lift: 0 }] } };
/** The admitted species script modules: each module's SHA-256 → the base64 its bake wrote (a plain JSON row). */
export const SIGNAL_MODULES: Readonly<Record<string, string>> = { [skitterer.module]: skitterer.bytes };

/** The page's existing native motor/contact recipes; the home keeper retains attack tokens, RNG and all clocks. */
export const SIGNAL_BODY_ROWS = {
  duneRay: { kind: 'animal', motion: 'flight', attack: 'keeper', stunned: 'none', contact: { kind: 'actor', halfArc: 70 * Math.PI / 180, move: 'sunscar.duneRay.contact' } },
  skitterer: { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'actor', halfArc: 70 * Math.PI / 180, move: 'sunscar.skitterer.contact' } },
  duneStrider: { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'actor', halfArc: 70 * Math.PI / 180, move: 'sunscar.duneStrider.contact' } },
  matriarch: { kind: 'animal', motion: 'flight', attack: 'keeper', stunned: 'none', contact: { kind: 'actor', halfArc: 70 * Math.PI / 180, move: 'sunscar.matriarch.contact' } },
} as const;

/**
 * Signal Dunes' species catalogue in home-kind order (SF27): every kind runs its declared brain (the ray, the skitterer's
 * admitted script, the strider and the Matriarch).
 */
export const SIGNAL_SPECIES: readonly BrainedSpecies[] = [{ ...DUNE_RAY, body: SIGNAL_BODY_ROWS.duneRay, brain: RAY_BRAIN }, { ...SKITTERER_DATA, body: SIGNAL_BODY_ROWS.skitterer, brain: SKITTERER_BRAIN }, { ...DUNE_STRIDER, body: SIGNAL_BODY_ROWS.duneStrider, brain: STRIDER_BRAIN }, { ...MATRIARCH_DATA, body: SIGNAL_BODY_ROWS.matriarch, brain: MATRIARCH_BRAIN }];
/** Every strike row the catalogue's creatures use. */
export const SIGNAL_STRIKES: readonly StrikeData[] = [SWOOP_DATA, CHARGE_DATA, HORNS_DATA, BITE_DATA, MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA];

/** Original page metadata order, without adding native body or brain fields. */
export const SIGNAL_PAGE_ROWS = [DUNE_RAY, SKITTERER_DATA, DUNE_STRIDER, MATRIARCH_DATA];
