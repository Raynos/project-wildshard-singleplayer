import type { EliteScriptData as EliteScriptRow } from '@wildshard/format/eliteScripts';
import { QARA_RULES, QARA_MODES } from '../data/qaraBrain';

import compiled from '../behaviour/qara.generated.json' with { type: 'json' };

/** The metered module generated at build time by the kept SDK compiler recipe. */
export const QARA_MODULE = { notice: compiled.notice, module: compiled.module, bytes: compiled.bytes };

/** Declare the same fight for the authoritative lair; no actor is allocated or installed here. */
export function qaraBrain(lair: { readonly x: number; readonly z: number }): EliteScriptRow {
  const r = QARA_RULES;
  return { id: 'nalati.elite.qara', kind: 'elite-script', module: QARA_MODULE.module,
    parameters: [r.waitTurn, r.home.speed, r.home.turn, r.home.arrival,
      r.circle.radius, r.circle.lead, r.circle.speed, r.circle.turn,
      r.wheel.speed, r.wheel.turn, r.wheel.beyond, r.wheel.alpha, r.wheel.growth, r.wheel.fadeSeconds, r.wheel.seconds,
      r.charge.speed, r.charge.turn, r.charge.alpha, r.charge.range, r.charge.playerHeight, r.charge.damage, r.charge.along, r.charge.seconds,
      r.open.speed, r.open.turn, r.open.forward, r.cooldown, r.phaseCooldown, lair.x, lair.z, r.open.seconds],
    slots: [{ field: 'clock', initial: 0 }, { field: 'cooldown', initial: r.initialCooldown }, { field: 'pairs', initial: 0 }, { field: 'struck', initial: 0 }],
    modes: [...QARA_MODES], voices: ['horse_squeal', 'opening'], lanes: [], contacts: [],
    actions: ['target', 'wheelEndpoint', 'chargeTarget', 'openTarget', 'drawLane', 'hit'], maxSpeed: r.charge.speed, maxTurnRate: r.wheel.turn };
}
