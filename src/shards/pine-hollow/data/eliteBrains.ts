import type { EliteScriptRow } from '@wildshard/sdk/eliteScripts';
import ironhide from '../behaviour/ironhide.json' with { type: 'json' };
import ghostStag from '../behaviour/ghostStag.json' with { type: 'json' };
import blackpaw from '../behaviour/blackpaw.json' with { type: 'json' };
import imperialBull from '../behaviour/imperialBull.json' with { type: 'json' };
import { GHOST_LAIR } from '../combat/eliteRoster';

/**
 * Pine Hollow's four named elites' fights as admitted elite scripts (SF27): each elite's module (behaviour/<name>.as behind
 * behaviour/elitePrelude.as, compiled to behaviour/<name>.json by scripts/bake/species-scripts.mjs) picks its moves and
 * keeps its clocks in its slots; the game's elite rules and the trusted lane and contact runners stay the host's.
 */

/** Old Ironhide: circles, then GORE CHARGE (lane 0); slot `again` owes a second charge in phase 2. */
export const IRONHIDE_BRAIN: EliteScriptRow = { id: 'pine.elite.ironhide', kind: 'elite-script', module: ironhide.module, parameters: [],
  slots: [{ field: 'again', initial: 0 }], modes: ['idle', 'home', 'circle', 'charge'], voices: ['boar_squeal', 'boar_grunt'],
  lanes: [{ mode: 'charge', lane: 0, trauma: 0.45 }], contacts: [], actions: [], maxSpeed: 4.2, maxTurnRate: 2.8 };
/** The Ghost Stag: flees round its glade, stares, FADES (its `fade` / `comeBack` actions); `lastHit` -1e6 is never hit. */
export const GHOST_STAG_BRAIN: EliteScriptRow = { id: 'pine.elite.ghost-stag', kind: 'elite-script', module: ghostStag.module,
  parameters: [GHOST_LAIR.x, GHOST_LAIR.z, 110],
  slots: [{ field: 'cd', initial: 3 }, { field: 'lastHit', initial: -1e6 }, { field: 'fadeT', initial: 0 }, { field: 'autoT', initial: 5 }],
  modes: ['idle', 'home', 'faded', 'stare', 'flee'], voices: [], lanes: [], contacts: [], actions: ['fade', 'comeBack'], maxSpeed: 7, maxTurnRate: 4 };
/** Old Blackpaw: bursts out of the den, ROAR-STUN (a ring tell, contacts 0 / 1), then a charge (lane 0) or a swipe (contact 2). */
export const BLACKPAW_BRAIN: EliteScriptRow = { id: 'pine.elite.blackpaw', kind: 'elite-script', module: blackpaw.module, parameters: [],
  slots: [{ field: 'roarCd', initial: 0 }, { field: 'swipeT', initial: -1 }], modes: ['idle', 'home', 'lurk', 'roar', 'charge', 'swipe', 'stalk'],
  voices: ['bear_growl', 'bear_roar'], lanes: [{ mode: 'charge', lane: 0, trauma: 0.5 }],
  contacts: [{ strike: 'strike.blackpaw.roar', throughWalls: true, stun: 1.3, trauma: 0.4 }, { strike: 'strike.blackpaw.roar.phase2', throughWalls: true, stun: 1.3, trauma: 0.4 },
    { strike: 'strike.blackpaw.swipe', throughWalls: false, stun: 0, trauma: 0.35 }],
  actions: ['burstOut', 'roarFx'], maxSpeed: 4, maxTurnRate: 3 };
/** The Imperial Bull: postures and charges (lane 0); BUGLE once a phase at dusk calls two rivals (host values: live rivals, the hour). */
export const IMPERIAL_BULL_BRAIN: EliteScriptRow = { id: 'pine.elite.imperial-bull', kind: 'elite-script', module: imperialBull.module, parameters: [],
  slots: [{ field: 'bugledPhase', initial: -1 }], modes: ['idle', 'home', 'bugle', 'charge', 'posture'], voices: ['elk_bugle', 'deer_call'],
  lanes: [{ mode: 'charge', lane: 0, trauma: 0.5 }], contacts: [], actions: ['callRivals'], maxSpeed: 3.5, maxTurnRate: 2.2 };
/** Each module's SHA-256 → the base64 its bake wrote. */
export const PINE_ELITE_MODULES: Readonly<Record<string, string>> = {
  [ironhide.module]: ironhide.bytes, [ghostStag.module]: ghostStag.bytes, [blackpaw.module]: blackpaw.bytes, [imperialBull.module]: imperialBull.bytes,
};
